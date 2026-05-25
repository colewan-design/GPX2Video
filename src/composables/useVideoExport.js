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
        videoTrimStartSec, videoTrimEndSec,
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
    videoTrimStartSec, videoTrimEndSec,
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
    const supportsAudio = 'AudioEncoder' in window && 'MediaStreamTrackProcessor' in window
    const AUDIO_SAMPLE_RATE = 44100
    const AUDIO_CHANNELS    = 2

    let audioCtx     = null
    let audioEncoder = null
    let audioReader  = null

    if (supportsAudio) {
      try {
        audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
        const mediaSrc  = audioCtx.createMediaElementSource(videoEl)
        const streamDst = audioCtx.createMediaStreamDestination()
        mediaSrc.connect(streamDst)
        const processor = new MediaStreamTrackProcessor({
          track: streamDst.stream.getAudioTracks()[0],
        })
        audioReader = processor.readable.getReader()
      } catch {
        audioCtx?.close()
        audioCtx    = null
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
    videoEl.muted = true
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

          ctx.drawImage(videoEl, 0, 0, W, H)
          drawMapInset(ctx, W, H, gpxPoints, idx, maxSpeed, trimStart)
          drawHud(ctx, W, H, point, gpxPoints, trimProgress, totalTime)

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
    if (audioCtx) await audioCtx.close()

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

function drawMapInset(ctx, W, H, pts, animIdx, maxSpeed, segStart = 0) {
  // Scale inset relative to video height (designed at 320px CSS height)
  const s  = H / 320
  const IW = Math.round(168 * s)
  const IH = Math.round(112 * s)
  const IX = W - IW - Math.round(12 * s)
  const IY = H - IH - Math.round(64 * s)

  const latMin = pts.reduce((a, p) => Math.min(a, p.lat),  Infinity)
  const latMax = pts.reduce((a, p) => Math.max(a, p.lat), -Infinity)
  const lonMin = pts.reduce((a, p) => Math.min(a, p.lon),  Infinity)
  const lonMax = pts.reduce((a, p) => Math.max(a, p.lon), -Infinity)
  const pad    = 12 * s

  const toXY = (lat, lon) => [
    IX + pad + (lon - lonMin) / ((lonMax - lonMin) || 1) * (IW - 2 * pad),
    IY + pad + (1 - (lat - latMin) / ((latMax - latMin) || 1)) * (IH - 2 * pad),
  ]

  ctx.save()
  rrect(ctx, IX, IY, IW, IH, 8 * s)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth   = 0.5
  ctx.stroke()
  ctx.clip()

  // Full faint trail
  ctx.beginPath()
  pts.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth   = 1 * s
  ctx.stroke()

  // Speed-colored traveled segment — start from segStart so we don't iterate
  // through thousands of off-window points on long GPX tracks
  for (let i = Math.max(1, segStart); i <= animIdx && i < pts.length; i++) {
    const t  = pts[i].speedSmooth / maxSpeed
    const r  = Math.round(lerp(30, 255, t))
    const g  = Math.round(lerp(100, 80, t))
    const b  = Math.round(lerp(255, 30, t))
    const [x0, y0] = toXY(pts[i - 1].lat, pts[i - 1].lon)
    const [x1, y1] = toXY(pts[i].lat,     pts[i].lon)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth   = 2 * s
    ctx.stroke()
  }

  // Current position dot
  if (animIdx < pts.length) {
    const [cx, cy] = toXY(pts[animIdx].lat, pts[animIdx].lon)
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5 * s, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }

  ctx.restore()
}

function drawHud(ctx, W, H, point, pts, progress, totalTime) {
  const s = H / 320

  // Taller gradient — starts at 55% so the fade has breathing room
  const grad = ctx.createLinearGradient(0, H * 0.55, 0, H)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.72)')
  grad.addColorStop(1,   'rgba(0,0,0,0.92)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H * 0.55, W, H * 0.45)

  ctx.save()

  const padX  = Math.round(24 * s)
  const valY  = H - Math.round(46 * s)   // value baseline
  const lblY  = valY + Math.round(14 * s) // label baseline

  const stats = [
    { val: point?.speedSmooth?.toFixed(1) ?? '0.0', unit: 'km/h', label: 'SPEED',     accent: '#06b6d4' },
    { val: String(Math.round(point?.ele ?? 0)),      unit: 'm',    label: 'ELEVATION', accent: '#22c55e' },
    { val: ((point?.cumDist ?? 0) / 1000).toFixed(2), unit: 'km', label: 'DISTANCE',  accent: '#f97316' },
  ]

  let x      = padX
  const colW = Math.round(110 * s)

  stats.forEach(({ val, unit, label, accent }) => {
    // Colored left accent bar
    const accentH = Math.round(28 * s)
    ctx.fillStyle = accent
    ctx.fillRect(x, valY - Math.round(20 * s), Math.max(2, Math.round(2 * s)), accentH)

    const tx = x + Math.max(6, Math.round(8 * s))

    // Value — bold, tabular
    ctx.font         = `700 ${Math.round(20 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle    = '#ffffff'
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(val, tx, valY)

    // Unit — inline, smaller, dimmer
    const valW = ctx.measureText(val).width
    ctx.font      = `600 ${Math.round(9 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText(unit, tx + valW + Math.round(4 * s), valY - Math.round(2 * s))

    // Label — tiny caps, very muted
    ctx.font      = `700 ${Math.round(8 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillText(label, tx, lblY)

    x += colW
  })

  // ── Progress section (right of stats) ───────────────────────────────────────
  const secX = x + Math.round(16 * s)
  const secW = W - secX - padX

  const p0      = pts[0]
  const timeCur = point?.time && p0?.time ? fmtTime(point.time - p0.time) : ''
  const timeEnd = totalTime > 0 ? fmtTime(totalTime) : ''

  ctx.font         = `600 ${Math.round(10 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.fillStyle    = 'rgba(255,255,255,0.45)'
  ctx.textBaseline = 'middle'

  const timeW   = ctx.measureText('0:00:00').width + Math.round(10 * s)
  const trackX  = secX + timeW
  const trackW  = secW - timeW * 2
  const trackH  = Math.max(2, Math.round(3 * s))
  const trackMY = valY - Math.round(8 * s)  // vertically centered with stat values

  ctx.textAlign = 'left'
  ctx.fillText(timeCur, secX, trackMY)
  ctx.textAlign = 'right'
  ctx.fillText(timeEnd, secX + secW, trackMY)

  // Track background
  rrect(ctx, trackX, trackMY - trackH / 2, trackW, trackH, trackH / 2)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()

  // Filled portion
  const fillW = trackW * Math.max(0, Math.min(1, progress))
  if (fillW > 0) {
    rrect(ctx, trackX, trackMY - trackH / 2, fillW, trackH, trackH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fill()
  }

  // Dot marker at playhead
  const dotR = Math.max(3, Math.round(4 * s))
  ctx.beginPath()
  ctx.arc(trackX + fillW, trackMY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Watermark
  ctx.font         = `500 ${Math.round(9 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = 'rgba(255,255,255,0.25)'
  ctx.fillText('salidumay.com', W - Math.round(10 * s), Math.round(10 * s))

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
