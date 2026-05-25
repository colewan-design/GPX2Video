import { ref } from 'vue'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { arrayMax, lerp, fmtTime } from '../utils/geo.js'

export function useVideoExport() {
  const exporting     = ref(false)
  const exportProgress = ref(0)
  const exportError   = ref(null)

  async function startExport(
    videoEl, gpxPoints, totalOffsetSec, totalTime,
    trimStart = 0, trimEnd = null,
    videoTrimStartSec = null, videoTrimEndSec = null,
    videoFilterCss = 'none',
  ) {
    if (!videoEl || !gpxPoints.length) return

    if (!('VideoEncoder' in window)) {
      exportError.value = 'WebCodecs not supported — use Chrome or Edge 94+.'
      return
    }

    exporting.value      = true
    exportProgress.value = 0
    exportError.value    = null

    const tEnd = trimEnd ?? gpxPoints.length - 1

    try {
      await runExport(
        videoEl, gpxPoints, totalOffsetSec, totalTime, trimStart, tEnd,
        videoTrimStartSec, videoTrimEndSec, videoFilterCss,
      )
    } catch (e) {
      exportError.value = e.message ?? 'Export failed.'
    } finally {
      exporting.value = false
    }
  }

  function cancel() {
    exporting.value = false
  }

  async function runExport(
    videoEl, gpxPoints, totalOffsetSec, totalTime, trimStart, trimEnd,
    videoTrimStartSec, videoTrimEndSec, videoFilterCss = 'none',
  ) {
    const srcW = videoEl.videoWidth
    const srcH = videoEl.videoHeight

    // Cap at 1920px wide to keep encoding responsive
    const scale = Math.min(1, 1920 / srcW)
    // Dimensions must be even numbers for H.264
    const W = Math.round(srcW * scale / 2) * 2
    const H = Math.round(srcH * scale / 2) * 2

    const fps      = 30
    const duration = videoEl.duration

    const canvas = new OffscreenCanvas(W, H)
    const ctx    = canvas.getContext('2d')

    // ── Audio setup (before muxer so we know whether to include audio track) ──
    // Use captureStream() instead of createMediaElementSource so the video
    // element's audio pipeline is never hijacked and keeps working after export.
    let AUDIO_SAMPLE_RATE = 48000
    let AUDIO_CHANNELS    = 2
    let audioEncoder      = null
    let audioReader       = null

    if (
      'AudioEncoder' in window &&
      'MediaStreamTrackProcessor' in window &&
      typeof videoEl.captureStream === 'function'
    ) {
      try {
        const stream     = videoEl.captureStream()
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          const settings    = audioTrack.getSettings()
          AUDIO_SAMPLE_RATE = settings.sampleRate   ?? 48000
          AUDIO_CHANNELS    = settings.channelCount ?? 2
          audioReader       = new MediaStreamTrackProcessor({ track: audioTrack }).readable.getReader()
        }
      } catch {
        audioReader = null
      }
    }

    const target = new ArrayBufferTarget()
    const muxer  = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      ...(audioReader ? { audio: { codec: 'aac', sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: AUDIO_CHANNELS } } : {}),
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    })

    let encoderError = null
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => { encoderError = e },
    })

    encoder.configure({
      codec:     avcCodec(W, H),
      width:     W,
      height:    H,
      bitrate:   8_000_000,
      framerate: fps,
    })

    if (audioReader) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  (e) => { encoderError = e },
      })
      audioEncoder.configure({
        codec:            'mp4a.40.2',
        sampleRate:       AUDIO_SAMPLE_RATE,
        numberOfChannels: AUDIO_CHANNELS,
        bitrate:          128_000,
      })
    }

    const maxSpeed      = arrayMax(gpxPoints.map(p => p.speedSmooth)) || 1
    const frameInterval = 1 / fps

    // Use explicit video trim seconds if provided, otherwise derive from GPX trim indices
    const [vTrimStart, vTrimEnd] = (videoTrimStartSec !== null && videoTrimEndSec !== null)
      ? [Math.max(0, videoTrimStartSec), Math.min(duration, videoTrimEndSec)]
      : gpxTrimToVideoRange(gpxPoints, totalOffsetSec, duration, trimStart, trimEnd)
    const trimDuration = vTrimEnd - vTrimStart

    let lastEncodedTime = vTrimStart - frameInterval
    let frameCount      = 0
    const savedTime     = videoEl.currentTime

    // Seek to trim start and wait for the seek to fully complete before
    // registering requestVideoFrameCallback.  Without this, the first RVFC
    // can fire while the video is still seeking, ctx.drawImage gets a null
    // frame, and new VideoFrame throws "Cannot read properties of null
    // (reading 'colorSpace')".
    await new Promise(seekDone => {
      if (Math.abs(videoEl.currentTime - vTrimStart) < 0.01) {
        seekDone()
      } else {
        videoEl.addEventListener('seeked', seekDone, { once: true })
        videoEl.currentTime = vTrimStart
      }
    })

    // ── Audio capture loop (runs concurrently with video frame loop) ──────────
    let audioDone = false
    const audioLoopDone = audioReader
      ? (async () => {
          let firstAudioTs = null
          try {
            while (true) {
              const { value: data, done } = await audioReader.read()
              if (done || audioDone || !exporting.value) { data?.close(); break }
              if (firstAudioTs === null) firstAudioTs = data.timestamp
              const adjusted = copyAudioData(data, data.timestamp - firstAudioTs)
              data.close()
              audioEncoder.encode(adjusted)
              adjusted.close()
            }
          } catch { /* reader cancelled */ } finally {
            audioReader.cancel().catch(() => {})
          }
        })()
      : Promise.resolve()

    await new Promise((resolve, reject) => {
      function frameCallback(_, metadata) {
        if (!exporting.value || encoderError) { resolve(); return }

        const vt = metadata.mediaTime

        // Skip frames before trim start (can happen on first callback after seek)
        if (vt < vTrimStart - frameInterval * 0.5) {
          videoEl.requestVideoFrameCallback(frameCallback)
          return
        }

        if (vt - lastEncodedTime >= frameInterval - 0.001) {
          const idx   = findAnimIdx(gpxPoints, totalOffsetSec, vt, duration, trimStart, trimEnd)
          const point = gpxPoints[idx]

          // Progress relative to trim duration
          const trimProgress = trimDuration > 0
            ? Math.max(0, Math.min((vt - vTrimStart) / trimDuration, 1))
            : 0

          if (videoFilterCss && videoFilterCss !== 'none') ctx.filter = videoFilterCss
          ctx.drawImage(videoEl, 0, 0, W, H)
          ctx.filter = 'none'
          drawMapInset(ctx, W, H, gpxPoints, idx, maxSpeed, trimStart)
          drawHud(ctx, W, H, point, gpxPoints, idx, trimProgress, totalTime)

          // Timestamps relative to trim start so output MP4 begins at t=0
          const ts       = Math.round((vt - vTrimStart) * 1_000_000)
          const keyFrame = frameCount % (fps * 2) === 0
          const frame    = new VideoFrame(canvas, { timestamp: ts })
          encoder.encode(frame, { keyFrame })
          frame.close()

          frameCount++
          lastEncodedTime      = vt
          exportProgress.value = trimProgress
        }

        if (vt < vTrimEnd - frameInterval) {
          videoEl.requestVideoFrameCallback(frameCallback)
        } else {
          resolve()
        }
      }

      videoEl.requestVideoFrameCallback(frameCallback)
      videoEl.play().catch(reject)
    })

    videoEl.pause()
    videoEl.currentTime = savedTime

    audioDone = true
    await audioLoopDone

    if (encoderError) throw encoderError

    await encoder.flush()
    encoder.close()

    if (audioEncoder) {
      await audioEncoder.flush()
      audioEncoder.close()
    }

    muxer.finalize()

    // Trigger download
    const blob = new Blob([target.buffer], { type: 'video/mp4' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'gpx2video-export.mp4'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)

    exportProgress.value = 1
  }

  return { exporting, exportProgress, exportError, startExport, cancel }
}

// ─── Video trim range ────────────────────────────────────────────────────────
// Returns [videoStart, videoEnd] in seconds for the given GPX trim indices.
function gpxTrimToVideoRange(gpxPoints, totalOffsetSec, duration, trimStart, trimEnd) {
  let vStart, vEnd

  const p0    = gpxPoints[0]
  const pS    = gpxPoints[Math.max(0, trimStart)]
  const pE    = gpxPoints[Math.min(gpxPoints.length - 1, trimEnd)]
  const hasTs = p0?.time && pS?.time && pE?.time

  if (hasTs) {
    vStart = (pS.time.getTime() - p0.time.getTime()) / 1000 - totalOffsetSec
    vEnd   = (pE.time.getTime() - p0.time.getTime()) / 1000 - totalOffsetSec
  } else {
    const N = gpxPoints.length - 1
    vStart = (trimStart / N) * duration
    vEnd   = (trimEnd   / N) * duration
  }

  // Clamp to actual video range with a minimum clip length
  vStart = Math.max(0, vStart)
  vEnd   = Math.min(duration, vEnd)
  if (vEnd <= vStart) vEnd = duration  // fallback: full video

  return [vStart, vEnd]
}

// ─── H.264 codec string ──────────────────────────────────────────────────────
// Pick the minimum AVC level (Main profile) that fits the coded area.
// Coded height is rounded up to the next multiple of 16 (macroblock row).
function avcCodec(width, height) {
  const codedH = Math.ceil(height / 16) * 16
  const area   = width * codedH
  // Level 3.1 → 921 600  px  (≤ 1280×720)
  // Level 4.0 → 2 097 152 px (≤ 1920×1080)
  // Level 4.1 → 2 097 152 px same area, higher frame-rate budget
  // Level 5.1 → 8 912 896 px (≤ 4096×2304)
  const level = area <= 921_600 ? '1f' : area <= 2_097_152 ? '28' : '33'
  return `avc1.4d00${level}` // Main profile
}

// ─── GPX index lookup ────────────────────────────────────────────────────────

function findAnimIdx(gpxPoints, totalOffsetSec, videoTimeSec, duration, trimStart = 0, trimEnd = null) {
  const maxIdx = trimEnd ?? gpxPoints.length - 1

  let idx
  if (!gpxPoints[0]?.time) {
    // No timestamps: linear stretch over video duration
    idx = Math.round((videoTimeSec / duration) * (gpxPoints.length - 1))
  } else {
    const targetMs = gpxPoints[0].time.getTime() + (totalOffsetSec + videoTimeSec) * 1000
    let lo = 0, hi = gpxPoints.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (gpxPoints[mid].time.getTime() < targetMs) lo = mid + 1
      else hi = mid
    }
    idx = lo
  }

  return Math.max(trimStart, Math.min(idx, maxIdx))
}

// ─── Canvas overlay drawing ──────────────────────────────────────────────────

const INSET_LAT_R = 0.002  // ~220m radius — zoomed close-up around current position

function drawMapInset(ctx, W, H, pts, animIdx, maxSpeed, segStart = 0) {
  const s  = W / 1920
  const IW = Math.round(384 * s)
  const IH = Math.round(288 * s)
  const IX = W - IW - Math.round(16 * s)
  const IY = Math.round(16 * s)

  const cp   = pts[animIdx]
  const latR = INSET_LAT_R
  const lonR = latR * (IW / IH)

  // Heading from recent points (averaging ~20 points for smooth rotation)
  let heading = 0
  const look = Math.min(20, animIdx)
  if (look >= 2) {
    const p0 = pts[animIdx - look]
    heading = Math.atan2(cp.lon - p0.lon, cp.lat - p0.lat)
  }

  const CX = IX + IW / 2, CY = IY + IH / 2

  // Project lat/lon to inset canvas coords centered on cp
  const toXY = (lat, lon) => [
    CX + ((lon - cp.lon) / (lonR * 2)) * IW,
    CY - ((lat - cp.lat) / (latR * 2)) * IH,
  ]

  // Background + clip
  ctx.save()
  rrect(ctx, IX, IY, IW, IH, 8 * s)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth   = 0.5 * s
  ctx.stroke()
  ctx.clip()

  // Rotate around inset center for heading-up view
  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(-heading)
  ctx.translate(-CX, -CY)

  // Full faint trail
  ctx.beginPath()
  pts.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth   = 1.5 * s
  ctx.stroke()

  // Speed-colored traveled segment
  for (let i = Math.max(1, segStart); i <= animIdx && i < pts.length; i++) {
    const t  = pts[i].speedSmooth / maxSpeed
    const r  = Math.round(lerp(30, 255, t))
    const g  = Math.round(lerp(100, 80, t))
    const b  = Math.round(lerp(255, 30, t))
    const [x0, y0] = toXY(pts[i - 1].lat, pts[i - 1].lon)
    const [x1, y1] = toXY(pts[i].lat,     pts[i].lon)
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth   = 2.5 * s
    ctx.stroke()
  }

  ctx.restore()  // undo rotation

  // Position marker at inset center (always centered regardless of heading)
  ctx.beginPath(); ctx.arc(CX, CY, 4 * s, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX, CY, 7 * s, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 * s; ctx.stroke()

  ctx.restore()  // undo clip

  // North indicator — small arrow in top-right of inset, rotates to show true north
  ctx.save()
  ctx.translate(IX + IW - Math.round(11 * s), IY + Math.round(11 * s))
  ctx.rotate(-heading)
  ctx.beginPath()
  ctx.moveTo(0, -8 * s); ctx.lineTo(-3.5 * s, 3 * s); ctx.lineTo(0, 1 * s); ctx.lineTo(3.5 * s, 3 * s)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()
  ctx.restore()
}

function drawHud(ctx, W, H, point, pts, animIdx, progress, totalTime) {
  // Reference width 1080 instead of 1920 so elements scale to ~1.78× larger,
  // matching the proportions of the live CSS preview which uses cqw units at ~700px.
  const s = W / 1080
  ctx.save()
  ctx.font = `700 ${Math.round(14 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`

  // ── Top progress bar ─────────────────────────────────────────────────────────
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(0, 0, W, barH)
  const fillW = W * Math.max(0, Math.min(1, progress))
  ctx.fillStyle = '#f59e0b'
  ctx.fillRect(0, 0, fillW, barH)

  // ── Bottom gradient ──────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, H * 0.72, 0, H)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H * 0.72, W, H * 0.28)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const AMBER  = '#f59e0b'
  const WHITE  = '#ffffff'
  const DIM    = 'rgba(255,255,255,0.65)'
  const DIMMER = 'rgba(255,255,255,0.42)'
  const FONT   = '-apple-system, BlinkMacSystemFont, sans-serif'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur  = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'
  }

  // ── Left stats panel ─────────────────────────────────────────────────────────
  const lx   = Math.round(28 * s)
  const topY = Math.round(H * 0.30)
  const rowH = Math.round(H * 0.08)

  const spd   = (point?.speedSmooth ?? 0).toFixed(0)
  const cadV  = point?.cadSmooth  != null ? String(Math.round(point.cadSmooth))  : '--'
  const hrV   = point?.hrSmooth   != null ? String(Math.round(point.hrSmooth))   : '--'
  const pwV   = point?.powerSmooth!= null ? `${Math.round(point.powerSmooth)}W`  : '--'

  const gainM = Math.round(point?.cumElevGain ?? 0)
  const lossM = Math.round(point?.cumElevLoss ?? 0)

  const spdKmh = point?.speedSmooth ?? 0
  let paceStr = '--:--'
  if (spdKmh > 0.5) {
    const mpm = 60 / spdKmh, m = Math.floor(mpm), sec = Math.round((mpm - m) * 60)
    paceStr = `${m}:${String(sec).padStart(2,'0')}`
  }

  // cadence row
  text(cadV, lx + Math.round(26*s), topY, 15, 700, WHITE)
  text('rpm', lx + ctx.measureText(cadV).width + Math.round(30*s), topY, 9, 600, DIM)

  // gain/loss row
  text(`Gain: ${gainM} m`, lx + Math.round(26*s), topY + rowH,     13, 600, WHITE)
  text(`Loss: ${lossM} m`, lx + Math.round(26*s), topY + rowH + Math.round(16*s), 12, 600, DIM)

  // power row
  text(pwV, lx + Math.round(26*s), topY + rowH * 2 + Math.round(12*s), 15, 700, WHITE)

  // pace row
  text(`${paceStr}/km`, lx + Math.round(26*s), topY + rowH * 3 + Math.round(12*s), 15, 700, WHITE)

  // ── Right stats panel ─────────────────────────────────────────────────────────
  const rx = W - Math.round(28 * s)

  // kcal estimate
  const p0 = pts[0]
  let kcalStr = '--'
  if (point?.time && p0?.time) {
    const hrs = (point.time - p0.time) / 3_600_000
    if (hrs > 0.01) {
      const avgKmh = (point.cumDist / 1000) / hrs
      kcalStr = String(Math.round((350 + 12 * avgKmh) * hrs))
    }
  }

  const grade = point?.grade ?? 0
  const gradeStr = `${grade >= 0 ? '+' : ''}${grade.toFixed(1)}%`

  text(`${kcalStr} kcal`, rx, topY,                                   15, 700, WHITE, 'right')
  text(gradeStr,          rx, topY + rowH,                             15, 700, WHITE, 'right')
  text('-- - --',         rx, topY + rowH * 2 + Math.round(12*s),     15, 700, WHITE, 'right')
  text(`${hrV} bpm`,      rx, topY + rowH * 3 + Math.round(12*s),     15, 700, WHITE, 'right')

  // ── Elevation chart ───────────────────────────────────────────────────────────
  const chartX = Math.round(W * 0.25)
  const chartW = Math.round(W * 0.52)
  const chartY = Math.round(H * 0.10)
  const chartH = Math.round(H * 0.12)

  if (pts.length > 1) {
    const eles = pts.map(p => p.ele)
    const eMin = Math.min(...eles), eMax = Math.max(...eles), eRange = (eMax - eMin) || 1
    const pL=4*s, pR=50*s, pT=8*s, pB=4*s
    const xOf = i   => chartX + pL + (i / (pts.length-1)) * (chartW - pL - pR)
    const yOf = ele => chartY + chartH - pB - ((ele - eMin) / eRange) * (chartH - pT - pB)

    ctx.beginPath()
    ctx.moveTo(xOf(0), chartY + chartH)
    for (let i = 0; i < pts.length; i++) ctx.lineTo(xOf(i), yOf(pts[i].ele))
    ctx.lineTo(xOf(pts.length-1), chartY + chartH)
    ctx.closePath()
    const eg = ctx.createLinearGradient(0, chartY, 0, chartY + chartH)
    eg.addColorStop(0, 'rgba(245,158,11,0.25)'); eg.addColorStop(1, 'rgba(245,158,11,0.04)')
    ctx.fillStyle = eg; ctx.fill()

    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      i===0 ? ctx.moveTo(xOf(0),yOf(pts[0].ele)) : ctx.lineTo(xOf(i),yOf(pts[i].ele))
    }
    ctx.strokeStyle = 'rgba(245,158,11,0.4)'; ctx.lineWidth = Math.round(1.5*s); ctx.stroke()

    if (animIdx > 0) {
      ctx.beginPath()
      for (let i = 0; i <= animIdx && i < pts.length; i++) {
        i===0 ? ctx.moveTo(xOf(0),yOf(pts[0].ele)) : ctx.lineTo(xOf(i),yOf(pts[i].ele))
      }
      ctx.strokeStyle = AMBER; ctx.lineWidth = Math.round(2*s); ctx.stroke()
    }

    if (animIdx < pts.length) {
      const cx = xOf(animIdx), cy = yOf(pts[animIdx].ele)
      ctx.beginPath(); ctx.arc(cx, cy, Math.round(5*s), 0, Math.PI*2)
      ctx.fillStyle = '#fbbf24'; ctx.fill()
      const eleM = Math.round(pts[animIdx].ele)
      text(String(eleM), cx + Math.round(8*s), cy, 13, 700, WHITE, 'left', 'middle')
    }
  }

  // ── Arc gauge helper ──────────────────────────────────────────────────────────
  function drawGauge(cx, cy, r, value, maxVal, minLabel, maxLabel, valLabel) {
    const CIRC = 2 * Math.PI * r, ARC = CIRC * 0.75
    const p = Math.max(0, Math.min(1, (parseFloat(valLabel) || 0) / maxVal))
    const startAngle = (225 - 90) * Math.PI / 180  // 225° from top = 135° from 3 o'clock

    // Background arc
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, startAngle + ARC * 0.9999 * (Math.PI*2/CIRC) * CIRC / r)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.round(5*s)
    ctx.lineCap = 'round'; ctx.stroke()

    // Value arc
    if (p > 0.01) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, startAngle + ARC * p * (Math.PI*2) / CIRC)
      ctx.strokeStyle = AMBER; ctx.lineWidth = Math.round(5*s)
      ctx.lineCap = 'round'; ctx.stroke()
    }

    // Center value
    text(valLabel, cx, cy + Math.round(4*s), 18, 700, WHITE, 'center', 'middle')

    // Min/max labels
    const labelOffset = r + Math.round(10*s)
    const minX = cx + labelOffset * Math.cos((225-90)*Math.PI/180)
    const minY = cy + labelOffset * Math.sin((225-90)*Math.PI/180)
    const maxAngleDeg = 225 + 270
    const maxX = cx + labelOffset * Math.cos((maxAngleDeg-90)*Math.PI/180)
    const maxY = cy + labelOffset * Math.sin((maxAngleDeg-90)*Math.PI/180)
    text(minLabel, minX, minY, 8, 600, DIM, 'center', 'middle')
    text(maxLabel, maxX, maxY, 8, 600, DIM, 'center', 'middle')
  }

  const gaugeR  = Math.round(38 * s)
  const gaugeY  = Math.round(H * 0.87)
  const gaugePad = Math.round(W * 0.065)

  drawGauge(gaugePad, gaugeY, gaugeR, 0, 60,  '0', '60',  spd)
  drawGauge(W - gaugePad, gaugeY, gaugeR, 0, 130, '0', '130', cadV)

  // ── Speed/RPM unit labels ─────────────────────────────────────────────────────
  text('km/h', gaugePad,   gaugeY + gaugeR + Math.round(12*s), 9, 700, DIM, 'center', 'top')
  text('rpm', W-gaugePad,  gaugeY + gaugeR + Math.round(12*s), 9, 700, DIM, 'center', 'top')

  // ── Power zones ───────────────────────────────────────────────────────────────
  const ZONES = [
    { label:'100-149', min:100, max:150 },
    { label:'150-199', min:150, max:200 },
    { label:'200-237', min:200, max:238 },
    { label:'238-274', min:238, max:275 },
    { label:'275-374', min:275, max:375 },
    { label:'375-499', min:375, max:500 },
    { label:'500+',    min:500, max:Infinity },
  ]
  const counts = ZONES.map(() => 0)
  let activeZ = -1
  const curPw = point?.powerSmooth ?? null
  for (let i = 0; i <= animIdx && i < pts.length; i++) {
    const pw = pts[i].powerSmooth
    if (pw != null) {
      for (let z = 0; z < ZONES.length; z++) {
        if (pw >= ZONES[z].min && pw < ZONES[z].max) { counts[z]++; break }
      }
    }
  }
  if (curPw != null) {
    for (let z = 0; z < ZONES.length; z++) {
      if (curPw >= ZONES[z].min && curPw < ZONES[z].max) { activeZ = z; break }
    }
  }
  const maxC = Math.max(...counts, 1)

  const zx     = Math.round(W * 0.30)
  const zw     = Math.round(W * 0.40)
  const zy     = Math.round(H * 0.75)
  const zH     = Math.round(H * 0.14)
  const barW   = Math.round((zw - ZONES.length * Math.round(3*s)) / ZONES.length)
  const barGap = Math.round(3 * s)
  const zoneName = ['Recovery','Endurance','Tempo','Threshold','VO2max','Anaerobic','Neuromuscular']

  // Zone title
  const topZone = counts.indexOf(Math.max(...counts))
  text(zoneName[topZone] ?? 'Power Zones', zx + zw/2, zy - Math.round(10*s), 10, 700, DIM, 'center', 'bottom')

  ZONES.forEach((zone, i) => {
    const bx     = zx + i * (barW + barGap)
    const pct    = counts[i] / maxC
    const bh     = Math.round(zH * pct)
    const isActive = i === activeZ

    // Bar background
    ctx.fillStyle = isActive ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'
    rrect(ctx, bx, zy, barW, zH, Math.round(2*s)); ctx.fill()

    // Bar fill
    if (bh > 0) {
      ctx.fillStyle = isActive ? AMBER : 'rgba(245,158,11,0.45)'
      rrect(ctx, bx, zy + zH - bh, barW, bh, Math.round(2*s)); ctx.fill()
    }

    // Zone label
    text(zone.label, bx + barW/2, zy + zH + Math.round(6*s), 7, 600, isActive ? '#fbbf24' : DIMMER, 'center', 'top')
  })

  ctx.restore()
}

// ─── AudioData copy with adjusted timestamp ──────────────────────────────────
// AudioData timestamps can't be mutated; we must copy the raw PCM into a new
// object. Handles both interleaved and planar formats.
function copyAudioData(src, timestamp) {
  const planeCount = src.format.includes('planar') ? src.numberOfChannels : 1
  const planes = []
  let totalBytes = 0
  for (let i = 0; i < planeCount; i++) {
    const size = src.allocationSize({ planeIndex: i })
    const buf  = new ArrayBuffer(size)
    src.copyTo(buf, { planeIndex: i })
    planes.push(new Uint8Array(buf))
    totalBytes += size
  }
  const combined = new Uint8Array(totalBytes)
  let off = 0
  for (const p of planes) { combined.set(p, off); off += p.byteLength }
  return new AudioData({
    timestamp,
    format:           src.format,
    sampleRate:       src.sampleRate,
    numberOfFrames:   src.numberOfFrames,
    numberOfChannels: src.numberOfChannels,
    data:             combined.buffer,
  })
}

// Rounded-rect path helper (avoids relying on ctx.roundRect in OffscreenCanvas)
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}
