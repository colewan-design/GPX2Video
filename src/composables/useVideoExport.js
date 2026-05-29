import { ref } from 'vue'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { arrayMax, lerp, fmtTime } from '../utils/geo.js'
import { useVideoShader } from './useVideoShader.js'
import { SHADER_PARAMS } from '../utils/filters.js'
import { SPEED_PRESETS, buildFrameSourceTimes, isFlatNormal } from '../utils/speedCurve.js'

export function useVideoExport() {
  const exporting     = ref(false)
  const exportProgress = ref(0)
  const exportError   = ref(null)

  async function startExport(
    videoEl, segments, gpxPoints, totalOffsetSec, totalTime,
    trimStart = 0, trimEnd = null,
    videoTrimStartSec = null, videoTrimEndSec = null,
    overlayFormat = 'classic',
    overlayColor = '#f59e0b',
    locationName = '',
    shaderParams = null,
    speedCurvePreset = 'normal',
    clipsArray = null,
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
        videoEl, segments ?? [], gpxPoints, totalOffsetSec, totalTime, trimStart, tEnd,
        videoTrimStartSec, videoTrimEndSec, overlayFormat, overlayColor, locationName,
        shaderParams, speedCurvePreset, clipsArray,
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
    videoEl, segments, gpxPoints, totalOffsetSec, totalTime, trimStart, trimEnd,
    videoTrimStartSec, videoTrimEndSec, overlayFormat = 'classic', overlayColor = '#f59e0b', locationName = '',
    shaderParams = null, speedCurvePreset = 'normal', clipsArray = null,
  ) {
    const srcW = videoEl.videoWidth
    const srcH = videoEl.videoHeight

    const scale = Math.min(1, 1920 / srcW)
    const W = Math.round(srcW * scale / 2) * 2
    const H = Math.round(srcH * scale / 2) * 2

    const fps           = 30
    const frameInterval = 1 / fps

    const canvas = new OffscreenCanvas(W, H)
    const ctx    = canvas.getContext('2d')

    const glCanvas = new OffscreenCanvas(W, H)
    const shader   = useVideoShader()

    const maxSpeed = arrayMax(gpxPoints.map(p => p.speedSmooth)) || 1

    // ── Build clip list with segment-local time ranges ────────────────────────
    // Each entry: { absStart, clipDur, segmentIdx, localStart, localEnd, src }
    // localStart/localEnd are positions within the segment's video file.
    let activeClips
    if (clipsArray && clipsArray.length) {
      activeClips = clipsArray
        .filter(c => c.end > c.start)
        .map(c => {
          const segIdx     = c.segmentIdx ?? 0
          const segStart   = c.segStart   ?? 0
          const clipDur    = c.end - c.start
          const localStart = segStart
          const localEnd   = segStart + clipDur
          const src        = segments[segIdx]?.src ?? null
          return { absStart: c.start, clipDur, segmentIdx: segIdx, localStart, localEnd, src }
        })
        .filter(c => c.clipDur > 0.001 && c.src)
    } else {
      const seg0 = segments[0]
      const dur0 = videoEl.duration || seg0?.duration || 0
      const [s, e] = (videoTrimStartSec !== null && videoTrimEndSec !== null)
        ? [Math.max(0, videoTrimStartSec), Math.min(dur0, videoTrimEndSec)]
        : gpxTrimToVideoRange(gpxPoints, totalOffsetSec, dur0, trimStart, trimEnd)
      activeClips = [{
        absStart: s, clipDur: e - s,
        segmentIdx: 0, localStart: s, localEnd: e,
        src: seg0?.src ?? null,
      }]
    }

    const totalActiveDur = activeClips.reduce((sum, c) => sum + c.clipDur, 0)

    // ── Per-segment video elements (lazy-loaded) ──────────────────────────────
    // Reuse the live videoEl for segment 0; create hidden elements for others.
    const segEls = new Map()
    segEls.set(0, videoEl)

    async function getSegEl(segIdx, src) {
      if (segEls.has(segIdx)) return segEls.get(segIdx)
      const v = Object.assign(document.createElement('video'), {
        src, muted: true, preload: 'auto',
      })
      v.setAttribute('playsinline', '')
      await new Promise((res, rej) => {
        v.addEventListener('loadedmetadata', res, { once: true })
        v.addEventListener('error', rej, { once: true })
      })
      segEls.set(segIdx, v)
      return v
    }

    // ── Audio: only for single-segment flat-speed exports ─────────────────────
    const allSameSeg = activeClips.every(c => c.segmentIdx === 0)
    const curvePreset    = SPEED_PRESETS[speedCurvePreset] ?? SPEED_PRESETS.normal
    const curveKeyframes = curvePreset.keyframes
    const useCurve       = !isFlatNormal(curveKeyframes)

    let AUDIO_SAMPLE_RATE = 48000
    let AUDIO_CHANNELS    = 2
    let audioEncoder      = null
    let audioReader       = null

    if (allSameSeg && !useCurve &&
        'AudioEncoder' in window &&
        'MediaStreamTrackProcessor' in window &&
        typeof videoEl.captureStream === 'function') {
      try {
        const stream     = videoEl.captureStream()
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          const settings    = audioTrack.getSettings()
          AUDIO_SAMPLE_RATE = settings.sampleRate   ?? 48000
          AUDIO_CHANNELS    = settings.channelCount ?? 2
          audioReader       = new MediaStreamTrackProcessor({ track: audioTrack }).readable.getReader()
        }
      } catch { audioReader = null }
    }

    // ── Muxer + encoders ──────────────────────────────────────────────────────
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
    encoder.configure({ codec: avcCodec(W, H), width: W, height: H, bitrate: 8_000_000, framerate: fps })

    if (audioReader) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  (e) => { encoderError = e },
      })
      audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: AUDIO_CHANNELS, bitrate: 128_000 })
    }

    // ── Seek helper (per video element) ───────────────────────────────────────
    async function seekElTo(el, t) {
      if (Math.abs(el.currentTime - t) < 0.001) return
      await new Promise(r => {
        el.addEventListener('seeked', r, { once: true })
        el.currentTime = t
      })
    }

    // ── Render one frame ──────────────────────────────────────────────────────
    // absTime = absolute position on the full timeline (for GPX overlay mapping)
    let activeGlOk = false
    let activeVidEl = null

    function renderCanvas(absTime, overallProgress) {
      const idx   = findAnimIdx(gpxPoints, totalOffsetSec, absTime, totalActiveDur, trimStart, trimEnd)
      const point = gpxPoints[idx]
      if (activeGlOk) {
        shader.renderFrame()
        ctx.drawImage(glCanvas, 0, 0, W, H)
      } else {
        ctx.drawImage(activeVidEl, 0, 0, W, H)
      }
      drawMapInset(ctx, W, H, gpxPoints, idx, maxSpeed, trimStart)
      drawHud(ctx, W, H, point, gpxPoints, idx, overallProgress, totalTime, overlayFormat, overlayColor, locationName)
    }

    // Seek to the first clip start for audio sync
    await seekElTo(videoEl, activeClips[0].localStart)

    // ── Audio capture loop (single-segment flat-speed only) ───────────────────
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

    let frameCount       = 0
    let outputTimeOffset = 0

    // ── Encode each clip ──────────────────────────────────────────────────────
    for (const clip of activeClips) {
      if (!exporting.value || encoderError) break

      const el = await getSegEl(clip.segmentIdx, clip.src)

      // Re-init WebGL shader when switching video elements
      if (el !== activeVidEl) {
        if (activeVidEl) shader.destroy()
        activeGlOk  = shader.setup(glCanvas, el)
        if (activeGlOk) shader.setFilter(shaderParams ?? SHADER_PARAMS.none)
        activeVidEl = el
      }

      if (useCurve) {
        // ── Curved speed: seek-based ────────────────────────────────────────
        const sourceTimes = buildFrameSourceTimes(curveKeyframes, clip.clipDur, fps)
        let lastSeekTarget = -1

        for (let i = 0; i < sourceTimes.length; i++) {
          if (!exporting.value || encoderError) break
          const localT = clip.localStart + Math.min(sourceTimes[i], clip.clipDur - 0.001)

          if (Math.abs(localT - lastSeekTarget) >= frameInterval * 0.25) {
            await seekElTo(el, localT)
            lastSeekTarget = localT
          }

          const absTime     = clip.absStart + (localT - clip.localStart)
          const overallProg = totalActiveDur > 0 ? (outputTimeOffset + i / fps) / totalActiveDur : 0
          renderCanvas(absTime, overallProg)

          const ts = Math.round((outputTimeOffset + i / fps) * 1_000_000)
          const frame = new VideoFrame(canvas, { timestamp: ts })
          encoder.encode(frame, { keyFrame: frameCount % (fps * 2) === 0 })
          frame.close()
          frameCount++
          exportProgress.value = overallProg
        }

        outputTimeOffset += sourceTimes.length / fps
      } else {
        // ── Normal 1×: RVFC play-based ──────────────────────────────────────
        await seekElTo(el, clip.localStart)
        let lastEncodedTime = clip.localStart - frameInterval

        await new Promise((resolve, reject) => {
          function frameCallback(_, metadata) {
            if (!exporting.value || encoderError) { resolve(); return }
            const vt = metadata.mediaTime

            if (vt < clip.localStart - frameInterval * 0.5) {
              el.requestVideoFrameCallback(frameCallback); return
            }

            if (vt - lastEncodedTime >= frameInterval - 0.001) {
              const elapsed     = Math.max(0, vt - clip.localStart)
              const overallProg = totalActiveDur > 0 ? (outputTimeOffset + elapsed) / totalActiveDur : 0
              const absTime     = clip.absStart + elapsed
              renderCanvas(absTime, overallProg)

              const ts = Math.round((outputTimeOffset + elapsed) * 1_000_000)
              const frame = new VideoFrame(canvas, { timestamp: ts })
              encoder.encode(frame, { keyFrame: frameCount % (fps * 2) === 0 })
              frame.close()
              frameCount++
              lastEncodedTime      = vt
              exportProgress.value = overallProg
            }

            if (vt < clip.localEnd - frameInterval) {
              el.requestVideoFrameCallback(frameCallback)
            } else {
              resolve()
            }
          }

          el.requestVideoFrameCallback(frameCallback)
          el.play().catch(reject)
        })

        el.pause()
        outputTimeOffset += clip.clipDur
      }
    }

    // Restore live video element
    videoEl.pause()
    videoEl.currentTime = activeClips[0]?.localStart ?? 0

    // Clean up off-screen video elements created for other segments
    for (const [segIdx, el] of segEls.entries()) {
      if (segIdx !== 0) { el.src = ''; el.load() }
    }

    audioDone = true
    audioReader?.cancel().catch(() => {})
    await audioLoopDone

    if (encoderError) throw encoderError

    await encoder.flush()
    encoder.close()

    if (audioEncoder) {
      await audioEncoder.flush()
      audioEncoder.close()
    }

    shader.destroy()
    muxer.finalize()

    // Trigger download — anchor must be in DOM for Chrome 65+
    const blob = new Blob([target.buffer], { type: 'video/mp4' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'gpx2video-export.mp4'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)

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

// ─── Color helper ────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const h = (hex || '#f59e0b').replace('#', '')
  const r = parseInt(h.slice(0,2), 16) || 245
  const g = parseInt(h.slice(2,4), 16) || 158
  const b = parseInt(h.slice(4,6), 16) || 11
  return `rgba(${r},${g},${b},${alpha})`
}

function drawMapInset(ctx, W, H, pts, animIdx, maxSpeed, segStart = 0) {
  const s  = (W / 1920) * hudScaleFor(W, H)
  // Match preview CSS: width: 21%, aspect-ratio: 4/3, top: 4px, right: 4px
  const IW = Math.round(W * 0.21)
  const IH = Math.round(IW * 3 / 4)
  const gap = Math.max(4, Math.round(4 * (W / 1920)))
  const IX = W - IW - gap
  const IY = gap

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

// Scale factor that matches CSS --hud-scale: compensates for portrait videos
// where width-based sizing (W/1080) yields elements that look tiny against the tall frame.
function hudScaleFor(W, H) {
  return Math.max(1, Math.sqrt(H / W) / Math.sqrt(9 / 16))
}

function drawHud(ctx, W, H, point, pts, animIdx, progress, totalTime, overlayFormat = 'classic', overlayColor = '#f59e0b', locationName = '') {
  if (overlayFormat === 'minimal') { drawHudMinimal(ctx, W, H, point, pts, progress, overlayColor, locationName); return }
  if (overlayFormat === 'gopro')   { drawHudGoPro(ctx, W, H, point, pts, animIdx, progress, overlayColor, locationName); return }
  if (overlayFormat === 'sport')   { drawHudSport(ctx, W, H, point, progress, overlayColor, locationName); return }
  if (overlayFormat === 'cycling') { drawHudCycling(ctx, W, H, point, pts, animIdx, progress, overlayColor, locationName); return }
  const s = (W / 1080) * hudScaleFor(W, H)
  ctx.save()
  ctx.font = `700 ${Math.round(14 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`

  // ── Top progress bar ─────────────────────────────────────────────────────────
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(0, 0, W, barH)
  const fillW = W * Math.max(0, Math.min(1, progress))
  ctx.fillStyle = overlayColor
  ctx.fillRect(0, 0, fillW, barH)

  // ── Bottom gradient ──────────────────────────────────────────────────────────
  // CSS .hud-bottom-row: bottom:0; height:30%; gradient transparent→opaque at 55%
  const grad = ctx.createLinearGradient(0, H * 0.70, 0, H * 0.865)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H * 0.70, W, H * 0.30)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const AMBER  = overlayColor
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

  // ── SVG icon paths (24×24 viewBox) — copied from Vue template ───────────────
  const ICON_CADENCE = 'M12 4a8 8 0 1 0 0 16A8 8 0 0 0 12 4zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
  const ICON_ELEV    = 'M12 2 9 8h6L12 2zm0 20 3-6H9l3 6zM2 12l6-3v6L2 12zm20 0-6 3V9l6 3z'
  const ICON_POWER   = 'M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z'
  const ICON_PACE    = 'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z'
  const ICON_ZAP     = 'M7 2v11h3v9l7-12h-4l4-8z'
  const ICON_FLAG    = 'M14 6l-1-2H5v17h2v-7h5l1 2h7V6h-6zm4 8h-4l-1-2H7V6h5l1 2h5v6z'
  const ICON_GEAR    = 'M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.33.07-.67.07-1.08s-.03-.75-.07-1.08l2.32-1.8c.21-.16.27-.46.13-.7l-2.2-3.81c-.14-.24-.42-.32-.66-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08L14.8 2.28C14.74 2.02 14.5 1.83 14.22 1.83h-4.43c-.28 0-.52.19-.57.46L8.88 4.9c-.68.27-1.29.64-1.86 1.08L4.28 4.88c-.25-.09-.52 0-.66.24L1.42 8.93c-.14.24-.09.54.13.7l2.32 1.8C3.83 11.76 3.8 12.1 3.8 12.5s.03.74.07 1.08l-2.32 1.8c-.21.16-.27.46-.13.7l2.2 3.81c.14.24.42.32.66.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.36 2.63c.05.26.29.45.57.45h4.43c.28 0 .52-.19.57-.46l.36-2.62c.68-.27 1.29-.64 1.86-1.08l2.74 1.1c.25.09.52 0 .66-.24l2.2-3.81c.14-.24.09-.54-.13-.7l-2.32-1.8z'
  const ICON_HEART   = 'm12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
  const ICON_THERMO  = 'M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0z'

  // Draw a 24×24-viewBox SVG path centered at (cx, cy) with display size sz
  function icon(path, cx, cy, sz, color) {
    const sc = sz / 24
    ctx.save()
    ctx.translate(cx - sz / 2, cy - sz / 2)
    ctx.scale(sc, sc)
    ctx.fillStyle = color
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur  = Math.round(3 * s)
    ctx.fill(new Path2D(path))
    ctx.restore()
  }

  // ── Layout constants (match CSS percentages exactly) ──────────────────────────
  const iconSz  = Math.round(22 * s)           // CSS: clamp(14px, 2cqw, 22px) baseline
  const iconGap = Math.round(4 * s)            // CSS: clamp(3px, 0.5cqw, 7px)
  const lEdge   = Math.round(W * 0.015)        // CSS: left: 1.5%
  const rEdge   = W - Math.round(W * 0.015)    // CSS: right: 1.5%
  const licx    = lEdge + iconSz / 2           // left panel icon center x
  const ltx     = lEdge + iconSz + iconGap     // left panel text start x
  const ricx    = rEdge - iconSz / 2           // right panel icon center x
  const rtx     = rEdge - iconSz - iconGap     // right panel text end x (right-align)

  // Stat panel: CSS top:30% → bottom:30% (height=40%), space-around 4 rows
  const panelTop = Math.round(H * 0.30)
  const panelH   = Math.round(H * 0.40)
  const rc       = (i) => panelTop + Math.round(panelH * (2 * i + 1) / 8)
  const r0=rc(0), r1=rc(1), r2=rc(2), r3=rc(3)

  // ── Metric values ─────────────────────────────────────────────────────────────
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

  // ── Top info bar: temperature + distance ──────────────────────────────────────
  // CSS .hud-top-info: position:absolute; top:5px; left:29%; right:23%
  // Distance block is margin-left:auto (right-aligned within the area)
  const tiTop   = Math.round(5 * s)
  const tiRight = Math.round(W * 0.77) - Math.round(4 * s)
  const tempC   = point?.atemp != null ? Math.round(point.atemp) : null

  if (tempC !== null) {
    const tiLeft  = Math.round(W * 0.29) + Math.round(4 * s)
    const tIconSz = Math.round(20 * s)
    icon(ICON_THERMO, tiLeft + tIconSz / 2, tiTop + tIconSz / 2, tIconSz, WHITE)
    text(`${tempC}°C`, tiLeft + tIconSz + Math.round(3*s), tiTop + tIconSz / 2, 14, 600, WHITE, 'left', 'middle')
  }

  const distKmStr      = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  const totalDistKmStr = pts.length ? ((pts[pts.length - 1].cumDist / 1000).toFixed(1)) : '0.0'
  text(`${distKmStr} km`,          tiRight, tiTop + Math.round(2*s),  16, 700, WHITE,                       'right', 'top')
  text(`Total: ${totalDistKmStr}`, tiRight, tiTop + Math.round(22*s), 9,  400, 'rgba(255,255,255,0.40)',    'right', 'top')

  // ── Left stats panel (icon + value, vertically space-around) ─────────────────
  icon(ICON_CADENCE, licx, r0, iconSz, AMBER)
  text(cadV, ltx, r0, 15, 700, WHITE, 'left', 'middle')
  // measure cadV width while font is still set from text() above
  const cadVW = ctx.measureText(cadV).width
  text('rpm', ltx + cadVW + Math.round(3*s), r0, 9, 600, DIM, 'left', 'middle')

  icon(ICON_ELEV, licx, r1, iconSz, AMBER)
  const glOff = Math.round(8 * s)
  text(`Gain: ${gainM} m`, ltx, r1 - glOff, 13, 600, WHITE, 'left', 'middle')
  text(`Loss: ${lossM} m`, ltx, r1 + glOff, 12, 600, DIM,   'left', 'middle')

  icon(ICON_POWER, licx, r2, iconSz, AMBER)
  text(pwV, ltx, r2, 15, 700, WHITE, 'left', 'middle')

  icon(ICON_PACE, licx, r3, iconSz, AMBER)
  text(`${paceStr}/km`, ltx, r3, 15, 700, WHITE, 'left', 'middle')

  // ── Right stats panel (value + icon, right-aligned) ───────────────────────────
  icon(ICON_ZAP,   ricx, r0, iconSz, AMBER)
  text(`${kcalStr} kcal`, rtx, r0, 15, 700, WHITE, 'right', 'middle')

  icon(ICON_FLAG,  ricx, r1, iconSz, AMBER)
  text(gradeStr,   rtx, r1, 15, 700, WHITE, 'right', 'middle')

  icon(ICON_GEAR,  ricx, r2, iconSz, AMBER)
  text('-- - --',  rtx, r2, 15, 700, WHITE, 'right', 'middle')

  icon(ICON_HEART, ricx, r3, iconSz, AMBER)
  text(`${hrV} bpm`, rtx, r3, 15, 700, WHITE, 'right', 'middle')

  // ── Elevation chart ───────────────────────────────────────────────────────────
  // Match preview CSS: left:29%, right:23% (width=48%), top:12%, bottom:75% (height=13%)
  const chartX = Math.round(W * 0.29)
  const chartW = Math.round(W * 0.48)
  const chartY = Math.round(H * 0.12)
  const chartH = Math.round(H * 0.13)

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
    eg.addColorStop(0, hexToRgba(AMBER, 0.25)); eg.addColorStop(1, hexToRgba(AMBER, 0.04))
    ctx.fillStyle = eg; ctx.fill()

    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      i===0 ? ctx.moveTo(xOf(0),yOf(pts[0].ele)) : ctx.lineTo(xOf(i),yOf(pts[i].ele))
    }
    ctx.strokeStyle = hexToRgba(AMBER, 0.4); ctx.lineWidth = Math.round(1.5*s); ctx.stroke()

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
      ctx.fillStyle = AMBER; ctx.fill()
      const eleM = Math.round(pts[animIdx].ele)
      text(String(eleM), cx + Math.round(8*s), cy, 13, 700, WHITE, 'left', 'middle')
    }
  }

  // ── Gauge geometry: mirrors CSS .hud-gauge { width: 14% } with viewBox 0 0 100 80
  // Circle cx=50 cy=47 r=36. Rendered scale = (W*0.14)/100.
  // Bottom row: position:absolute; bottom:0; height:30%; padding: 0 1% 1.5%.
  // CSS padding-% is relative to containing block WIDTH, so pad-bottom = 1.5% * W.
  const gaugeW    = Math.round(W * 0.14)           // rendered SVG width
  const gaugeH    = Math.round(gaugeW * 0.80)      // viewBox 100×80 → height = 0.8 * width
  const gaugeR    = Math.round(gaugeW * 0.36)      // r=36 in 100-unit viewBox
  const gaugeSW   = Math.max(2, Math.round(gaugeW * 0.05))  // stroke-width=5 in 100-unit viewBox
  const padBottom = Math.round(W * 0.015)          // 1.5% of W bottom padding
  const gaugeBotY = H - padBottom                  // SVG bottom edge (align-items:flex-end)
  const gaugeY    = gaugeBotY - Math.round(gaugeH * (33 / 80))  // cy=47, so 33/80 below center
  const gaugeX    = Math.round(W * 0.08)           // center: 1% pad + 14%/2 = 8% from left

  // ── Arc gauge helper ──────────────────────────────────────────────────────────
  function drawGauge(cx, cy, r, sw, maxVal, minLabel, maxLabel, valLabel) {
    const ARC_RAD   = Math.PI * 1.5                              // 270° in radians
    const p         = Math.max(0, Math.min(1, (parseFloat(valLabel) || 0) / maxVal))
    const startAngle = (225 - 90) * Math.PI / 180               // 135° from 3-o'clock = lower-left

    // Background arc (270°, very dim)
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, startAngle + ARC_RAD * 0.9999)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = sw
    ctx.lineCap = 'round'; ctx.stroke()

    // Value arc
    if (p > 0.01) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, startAngle + ARC_RAD * p)
      ctx.strokeStyle = AMBER; ctx.lineWidth = sw
      ctx.lineCap = 'round'; ctx.stroke()
    }

    // Center value — font size mirrors SVG font-size="18" in 100-unit viewBox
    const valFontSz = Math.round(gaugeW * 18 / 100)
    ctx.font = `700 ${valFontSz}px ${FONT}`
    ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4*s)
    ctx.fillText(valLabel, cx, cy + Math.round(gaugeW * 4 / 100))
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

    // Min/max labels — font-size="7" in SVG viewbox, position from SVG text elements
    const lblFontSz = Math.round(gaugeW * 7 / 100)
    const lblR = r + Math.round(gaugeW * 10 / 100)
    const minX = cx + lblR * Math.cos(startAngle)
    const minY = cy + lblR * Math.sin(startAngle)
    const maxX = cx + lblR * Math.cos(startAngle + ARC_RAD)
    const maxY = cy + lblR * Math.sin(startAngle + ARC_RAD)
    ctx.font = `600 ${lblFontSz}px ${FONT}`
    ctx.fillStyle = DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(3*s)
    ctx.fillText(minLabel, minX, minY)
    ctx.fillText(maxLabel, maxX, maxY)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  drawGauge(gaugeX,     gaugeY, gaugeR, gaugeSW, 60,  '0', '60',  spd)
  drawGauge(W - gaugeX, gaugeY, gaugeR, gaugeSW, 130, '0', '130', cadV)

  // ── Speed/RPM unit labels — mirrors .gauge-lbl (font-size: 0.85cqw ≈ 10px at 1920cqw) ────
  const lblFontSz = Math.max(7, Math.round(W * 0.0052))
  text('km/h', gaugeX,     gaugeBotY - Math.round(gaugeH * 0.08), lblFontSz, 700, DIM, 'center', 'top')
  text('rpm',  W - gaugeX, gaugeBotY - Math.round(gaugeH * 0.08), lblFontSz, 700, DIM, 'center', 'top')

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

  // CSS .hud-zones: flex:1; margin:0 2%; sits between two 14% gauges with 1% row padding.
  // Zones span from (1% + 14% + 2%) = 17% to (100% - 17%) = 83% → width = 66%.
  // .zones-bars { height: 62% } of the gauge container height (same as gauge SVG height).
  const zx     = Math.round(W * 0.17)                     // 17% from left
  const zw     = Math.round(W * 0.66)                     // 66% width
  const zH     = Math.round(gaugeH * 0.62)                // 62% of gauge SVG height
  const zy     = gaugeBotY - zH                           // bars sit at bottom of row
  const barGap = Math.max(2, Math.round(2 * s))
  const barW   = Math.round((zw - ZONES.length * barGap) / ZONES.length)
  const zoneName = ['Recovery','Endurance','Tempo','Threshold','VO2max','Anaerobic','Neuromuscular']

  // Zone title (above bars, matching .zones-title margin-bottom:3px)
  const topZone = counts.indexOf(Math.max(...counts))
  text(zoneName[topZone] ?? 'Power Zones', zx + zw/2, zy - Math.round(5*s), 10, 700, DIM, 'center', 'bottom')

  ZONES.forEach((zone, i) => {
    const bx     = zx + i * (barW + barGap)
    const pct    = counts[i] / maxC
    const bh     = Math.round(zH * pct)
    const isActive = i === activeZ

    // Bar background
    ctx.fillStyle = isActive ? hexToRgba(AMBER, 0.25) : 'rgba(255,255,255,0.07)'
    rrect(ctx, bx, zy, barW, zH, Math.round(2*s)); ctx.fill()

    // Bar fill
    if (bh > 0) {
      ctx.fillStyle = isActive ? AMBER : hexToRgba(AMBER, 0.45)
      rrect(ctx, bx, zy + zH - bh, barW, bh, Math.round(2*s)); ctx.fill()
    }

    // Zone label
    text(zone.label, bx + barW/2, zy + zH + Math.round(6*s), 7, 600, isActive ? AMBER : DIMMER, 'center', 'top')
  })

  drawLocationPill(ctx, W, H, s, locationName, overlayFormat, overlayColor)
  drawWatermark(ctx, W, H, s)
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

// ─── Minimal HUD ────────────────────────────────────────────────────────────
function drawHudMinimal(ctx, W, H, point, pts, progress, overlayColor = '#f59e0b', locationName = '') {
  const s = (W / 1080) * hudScaleFor(W, H)
  ctx.save()
  const FONT   = '-apple-system, BlinkMacSystemFont, sans-serif'
  const AMBER  = overlayColor
  const WHITE  = '#ffffff'
  const DIM    = 'rgba(255,255,255,0.55)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Progress bar
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, barH)
  ctx.fillStyle = AMBER; ctx.fillRect(0, 0, W * Math.max(0, Math.min(1, progress)), barH)

  // Bottom gradient
  const grad = ctx.createLinearGradient(0, H * 0.7, 0, H)
  grad.addColorStop(0, 'transparent'); grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad; ctx.fillRect(0, H * 0.7, W, H * 0.3)

  const spd  = (point?.speedSmooth ?? 0).toFixed(0)
  const ele  = String(Math.round(point?.ele ?? 0))
  const dist = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  const grade = point?.grade ?? 0
  const gradeStr = `${grade >= 0 ? '+' : ''}${grade.toFixed(1)}%`
  const hrV  = point?.hrSmooth != null ? String(Math.round(point.hrSmooth)) : null

  const stats = [
    { val: spd,      unit: 'km/h', lbl: 'SPEED' },
    { val: ele,      unit: 'm',    lbl: 'ELEVATION' },
    { val: dist,     unit: 'km',   lbl: 'DISTANCE' },
    { val: gradeStr, unit: '',     lbl: 'GRADE' },
    ...(hrV ? [{ val: hrV, unit: 'bpm', lbl: 'HEART RATE' }] : []),
  ]
  const n      = stats.length
  const colW   = W / n
  const baseY  = Math.round(H * 0.92)
  const divH   = Math.round(H * 0.14)

  stats.forEach((st, i) => {
    const cx = Math.round(colW * i + colW / 2)
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(Math.round(colW * i) - 1, baseY - divH, 1, divH)
    }
    text(st.val,  cx, baseY - Math.round(28 * s), 22, 700, WHITE,  'center', 'bottom')
    text(st.unit, cx, baseY - Math.round(24 * s), 9,  600, DIM,    'center', 'top')
    text(st.lbl,  cx, baseY,                       8,  700, DIM,    'center', 'alphabetic')
  })

  drawLocationPill(ctx, W, H, s, locationName, 'minimal', overlayColor)
  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── GoPro HUD ───────────────────────────────────────────────────────────────
function computeBearing(pts, idx) {
  if (!pts.length || idx < 2) return { deg: 0, cardinal: 'N' }
  const look = Math.min(10, idx)
  const p0 = pts[idx - look], p1 = pts[idx]
  const dLon = (p1.lon - p0.lon) * Math.PI / 180
  const lat0 = p0.lat * Math.PI / 180, lat1 = p1.lat * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat1)
  const x = Math.cos(lat0) * Math.sin(lat1) - Math.sin(lat0) * Math.cos(lat1) * Math.cos(dLon)
  let deg = Math.atan2(y, x) * 180 / Math.PI
  deg = (deg + 360) % 360
  const cards = ['N','NE','E','SE','S','SW','W','NW']
  return { deg: Math.round(deg), cardinal: cards[Math.round(deg / 45) % 8] }
}

function fmtDMS(val, posChar, negChar) {
  if (val == null) return '--'
  const abs = Math.abs(val)
  const d = Math.floor(abs), m = Math.floor((abs - d) * 60)
  const s = (((abs - d) * 60 - m) * 60).toFixed(2)
  return `${d}°${String(m).padStart(2,'0')}'${s}" ${val >= 0 ? posChar : negChar}`
}

function drawHudGoPro(ctx, W, H, point, pts, animIdx, progress, overlayColor = '#f59e0b', locationName = '') {
  const hs = hudScaleFor(W, H)
  const s = (W / 1080) * hs
  ctx.save()
  const FONT  = '-apple-system, BlinkMacSystemFont, sans-serif'
  const AMBER = overlayColor
  const WHITE = '#ffffff'
  const DIM   = 'rgba(255,255,255,0.55)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Progress bar
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, barH)
  ctx.fillStyle = AMBER; ctx.fillRect(0, 0, W * Math.max(0, Math.min(1, progress)), barH)

  // GPS coordinates (top center)
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  text(`${latStr}   ${lonStr}`, W / 2, Math.round(16 * s), 9, 500, DIM, 'center', 'top')

  // Compass bearing (below coords)
  const { deg, cardinal } = computeBearing(pts, animIdx)
  const bearY = Math.round(30 * s)
  // Draw compass arrow
  const arrowH = Math.round(18 * s), arrowW = Math.round(8 * s)
  const arrowX = W / 2 - Math.round(50 * s)
  ctx.fillStyle = AMBER
  ctx.beginPath()
  ctx.moveTo(arrowX, bearY + arrowH * 0.08)
  ctx.lineTo(arrowX - arrowW / 2, bearY + arrowH)
  ctx.lineTo(arrowX, bearY + arrowH * 0.55)
  ctx.lineTo(arrowX + arrowW / 2, bearY + arrowH)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.moveTo(arrowX, bearY + arrowH * 0.92)
  ctx.lineTo(arrowX - arrowW / 2, bearY)
  ctx.lineTo(arrowX, bearY + arrowH * 0.45)
  ctx.lineTo(arrowX + arrowW / 2, bearY)
  ctx.closePath(); ctx.fill()
  text(`${deg}°${cardinal}`, W / 2 - Math.round(30 * s), bearY + arrowH * 0.55, 20, 700, WHITE, 'left', 'middle')

  // Left panel: Slope + Elevation
  const lx = Math.round(28 * s)
  const topPanelY = Math.round(H * 0.30)
  const panelGap  = Math.round(H * 0.14)

  const grade    = point?.grade ?? 0
  const slopeStr = `${Math.round(Math.abs(grade))}%`
  const eleStr   = `${Math.round(point?.ele ?? 0)} M`

  // Slope
  text('SLOPE',    lx + Math.round(22 * s), topPanelY,                      9,  700, DIM,   'left', 'top')
  text(slopeStr,   lx + Math.round(22 * s), topPanelY + Math.round(15 * s), 20, 700, WHITE, 'left', 'top')
  // Elevation
  text('ELEVATION', lx + Math.round(22 * s), topPanelY + panelGap,                      9,  700, DIM,   'left', 'top')
  text(eleStr,      lx + Math.round(22 * s), topPanelY + panelGap + Math.round(15 * s), 20, 700, WHITE, 'left', 'top')

  // Small triangle icons for each stat
  function drawTriangle(x, y, sz, filled) {
    ctx.beginPath()
    ctx.moveTo(x, y); ctx.lineTo(x - sz, y + sz * 1.5); ctx.lineTo(x + sz, y + sz * 1.5)
    ctx.closePath()
    ctx.fillStyle = filled ? 'rgba(255,255,255,0.75)' : 'transparent'
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, Math.round(1.2 * s))
    if (filled) ctx.fill(); else { ctx.fill(); ctx.stroke() }
  }
  drawTriangle(lx + Math.round(9 * s), topPanelY + Math.round(3 * s), Math.round(7 * s), false)
  drawTriangle(lx + Math.round(9 * s), topPanelY + panelGap + Math.round(3 * s), Math.round(7 * s), true)

  // Bottom gradient for gauge
  const grad = ctx.createLinearGradient(0, H * 0.65, 0, H)
  grad.addColorStop(0, 'transparent'); grad.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = grad; ctx.fillRect(0, H * 0.65, W, H * 0.35)

  // Large centered speed gauge — mirrors SVG: viewBox="0 0 160 110", cx=80 cy=82 r=60
  // CSS wrap: width:clamp(100px,18cqw,220px); position:absolute; bottom:0; padding-bottom:0.5%
  const gaugeW  = Math.round(W * 0.18 * hs)                  // 18cqw matches CSS clamp midpoint
  const gaugeH  = Math.round(gaugeW * 110 / 160)             // viewBox aspect ratio
  const gaugeCX = W / 2
  const padB    = Math.round(W * 0.005)                       // 0.5% bottom padding on wrap
  const gaugeCY = H - padB - Math.round(gaugeH * 28 / 110)   // cy=82 → 28/110 from SVG bottom
  const r       = gaugeW * 60 / 160                           // r=60 in 160-unit viewBox
  const arcSW   = Math.max(2, Math.round(6 * gaugeW / 160))  // stroke-width="6" in 160-unit viewBox

  const GOPRO_ARC  = 2 * Math.PI * r * 0.75
  const spd        = point?.speedSmooth ?? 0
  const p          = Math.max(0, Math.min(1, spd / 60))
  // SVG rotate(-135) shifts stroke start from 0° to 225° (clockwise from right in y-down coords)
  const startAngle = 225 * Math.PI / 180

  // Background arc
  ctx.beginPath()
  ctx.arc(gaugeCX, gaugeCY, r, startAngle, startAngle + GOPRO_ARC / r)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = arcSW
  ctx.lineCap = 'round'; ctx.stroke()

  // Value arc
  if (p > 0.01) {
    ctx.beginPath()
    ctx.arc(gaugeCX, gaugeCY, r, startAngle, startAngle + (GOPRO_ARC * p) / r)
    ctx.strokeStyle = AMBER; ctx.lineWidth = arcSW
    ctx.lineCap = 'round'; ctx.stroke()
  }

  // Gauge labels — SVG fixed positions: "0" at (9,106), "60" at (136,106) in 160×110 viewBox
  // font-size="9" in 160-unit viewBox → 9/160 * gaugeW px
  const svgU  = (u) => u * gaugeW / 160                      // SVG units → canvas px
  const svgX  = (x) => gaugeCX - gaugeW / 2 + Math.round(svgU(x))
  const lblY  = H - padB - Math.round(svgU(4))               // y=106 → 4 units from SVG bottom
  const lblFS = Math.max(7, Math.round(svgU(9)))              // font-size="9"
  ctx.font = `600 ${lblFS}px ${FONT}`
  ctx.fillStyle = DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(3 * s)
  ctx.fillText('0',  svgX(9),   lblY)
  ctx.fillText('60', svgX(136), lblY)
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  // Speed value — SVG: font-size="30", y=91 (9 units below cy=82)
  const spdFontPx = Math.max(14, Math.round(svgU(30)))
  ctx.font = `700 ${spdFontPx}px ${FONT}`
  ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4 * s)
  ctx.fillText(spd.toFixed(0), gaugeCX, gaugeCY + Math.round(svgU(9)))
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  // KM/H label — separate div below SVG in preview, sits at bottom of frame
  ctx.font = `700 ${lblFS}px ${FONT}`
  ctx.fillStyle = DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(3 * s)
  ctx.fillText('KM/H', gaugeCX, H - padB)
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  drawLocationPill(ctx, W, H, s, locationName, 'gopro', overlayColor)
  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Sport HUD ───────────────────────────────────────────────────────────────
function drawHudSport(ctx, W, H, point, progress, overlayColor = '#f59e0b', locationName = '') {
  const hs = hudScaleFor(W, H)
  const s = (W / 1080) * hs
  ctx.save()
  const FONT = '-apple-system, BlinkMacSystemFont, sans-serif'
  const CYAN = overlayColor
  const WHITE = '#ffffff'
  const CYAN_DIM = hexToRgba(overlayColor, 0.55)

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Progress bar
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, barH)
  ctx.fillStyle = CYAN; ctx.fillRect(0, 0, W * Math.max(0, Math.min(1, progress)), barH)

  // Distance (top-left)
  const dist = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  text(dist, Math.round(20 * s), Math.round(20 * s), 22, 700, WHITE, 'left', 'top')
  text('KM', Math.round(20 * s) + ctx.measureText(dist).width + Math.round(6 * s), Math.round(24 * s), 9, 700, CYAN, 'left', 'top')

  // GPS coords (top-right, below map inset area)
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  text(lonStr, W - Math.round(W * 0.22) - Math.round(8 * s), Math.round(14 * s), 8, 500, CYAN_DIM, 'right', 'top')
  text(latStr, W - Math.round(W * 0.22) - Math.round(8 * s), Math.round(26 * s), 8, 500, CYAN_DIM, 'right', 'top')

  // Slope (center-left)
  const grade = point?.grade ?? 0
  text('SLOPE', Math.round(28 * s), Math.round(H * 0.42), 8, 700, 'rgba(255,255,255,0.6)', 'left', 'top')
  text(grade.toFixed(2), Math.round(28 * s), Math.round(H * 0.42) + Math.round(14 * s), 28, 700, WHITE, 'left', 'top')
  text('%', Math.round(28 * s), Math.round(H * 0.42) + Math.round(52 * s), 10, 700, CYAN, 'left', 'top')

  // Circular speed gauge (bottom-left)
  const gSize  = Math.round(W * 0.18 * hs)     // diameter
  const r      = gSize * 62 / 160               // scaled radius (62/160 from viewBox)
  const cx     = Math.round(W * 0.01) + gSize / 2
  const cy     = H - Math.round(H * 0.01) - gSize / 2

  // Dark background circle
  ctx.beginPath(); ctx.arc(cx, cy, gSize / 2 * 0.925, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,12,28,0.82)'; ctx.fill()

  // Tick marks (19 ticks over 270°)
  const startA = (135 - 90) * Math.PI / 180   // 135° CCW from X+
  for (let i = 0; i <= 18; i++) {
    const a = startA + (i / 18) * (Math.PI * 1.5)
    const r1 = r * 1.04, r2 = r * 1.13
    ctx.beginPath()
    ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))
    ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
    ctx.strokeStyle = hexToRgba(overlayColor, 0.28); ctx.lineWidth = Math.max(1, Math.round(s))
    ctx.stroke()
  }

  // Background arc
  const SPORT_ARC_RAD = Math.PI * 1.5        // 270° in radians
  ctx.beginPath()
  ctx.arc(cx, cy, r, startA, startA + SPORT_ARC_RAD)
  ctx.strokeStyle = hexToRgba(overlayColor, 0.12); ctx.lineWidth = Math.round(4 * s)
  ctx.lineCap = 'round'; ctx.stroke()

  // Value arc
  const spd = point?.speedSmooth ?? 0
  const p = Math.max(0, Math.min(1, spd / 180))
  if (p > 0.01) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, startA, startA + SPORT_ARC_RAD * p)
    ctx.strokeStyle = CYAN; ctx.lineWidth = Math.round(4 * s)
    ctx.lineCap = 'round'; ctx.stroke()
  }

  // Arc scale labels: 0, 90, 180
  const labelR = r * 1.28
  const labelsAt = [
    { val: '0',   angle: startA },
    { val: '90',  angle: startA + SPORT_ARC_RAD * 0.5 },
    { val: '180', angle: startA + SPORT_ARC_RAD },
  ]
  for (const lb of labelsAt) {
    text(lb.val, cx + labelR * Math.cos(lb.angle), cy + labelR * Math.sin(lb.angle), 7, 600, CYAN_DIM, 'center', 'middle')
  }

  // "SPEED" label, value, "KM/H"
  text('SPEED', cx, cy - Math.round(r * 0.38), 7, 700, CYAN_DIM, 'center', 'middle')
  text(spd.toFixed(0), cx, cy + Math.round(r * 0.18), 22, 700, WHITE, 'center', 'middle')
  text('KM/H', cx, cy + Math.round(r * 0.55), 7, 700, CYAN_DIM, 'center', 'middle')

  drawLocationPill(ctx, W, H, s, locationName, 'sport', overlayColor)
  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Cycling HUD ─────────────────────────────────────────────────────────────
function drawHudCycling(ctx, W, H, point, pts, animIdx, progress, overlayColor = '#f59e0b', locationName = '') {
  const hs = hudScaleFor(W, H)
  const s = (W / 1080) * hs
  ctx.save()
  const FONT   = '-apple-system, BlinkMacSystemFont, sans-serif'
  const TEAL   = overlayColor
  const WHITE  = '#ffffff'
  const TEAL_D = hexToRgba(overlayColor, 0.55)

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Progress bar
  const barH = Math.max(3, Math.round(4 * s))
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, W, barH)
  ctx.fillStyle = TEAL; ctx.fillRect(0, 0, W * Math.max(0, Math.min(1, progress)), barH)

  // Top-left: ELEVATION label + value
  const lx = Math.round(20 * s), ty = Math.round(14 * s)
  text('ELEVATION', lx, ty, 8, 700, TEAL, 'left', 'top')
  text(`${Math.round(point?.ele ?? 0)} M`, lx, ty + Math.round(14 * s), 20, 700, WHITE, 'left', 'top')

  // Top-right: TOTAL DISTANCE label + value
  const rx = W - Math.round(20 * s)
  const dist = ((point?.cumDist ?? 0) / 1000).toFixed(2)
  text('TOTAL DISTANCE', rx, ty, 8, 700, TEAL, 'right', 'top')
  text(`${dist} KM`, rx, ty + Math.round(14 * s), 20, 700, WHITE, 'right', 'top')

  // Top-center: compass rose
  const compassCX = W / 2, compassCY = Math.round(28 * s), compassR = Math.round(18 * s)
  ctx.beginPath(); ctx.arc(compassCX, compassCY, compassR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.round(s); ctx.stroke()
  text('N', compassCX, compassCY - compassR * 0.55, 6, 700, 'rgba(255,255,255,0.55)', 'center', 'middle')
  // North arrow (teal)
  ctx.fillStyle = TEAL
  ctx.beginPath()
  ctx.moveTo(compassCX, compassCY - compassR * 0.72)
  ctx.lineTo(compassCX - compassR * 0.18, compassCY)
  ctx.lineTo(compassCX + compassR * 0.18, compassCY)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath()
  ctx.moveTo(compassCX, compassCY + compassR * 0.72)
  ctx.lineTo(compassCX - compassR * 0.18, compassCY)
  ctx.lineTo(compassCX + compassR * 0.18, compassCY)
  ctx.closePath(); ctx.fill()

  // Center-left: D-shape arc speed gauge
  const gaugeSize = Math.round(W * 0.20 * hs)
  const r = gaugeSize * 65 / 160                  // scaled radius
  const gcx = Math.round(W * 0.02) + gaugeSize / 2
  const gcy = Math.round(H * 0.72)                // center sits below visible midpoint → top portion shows

  const startA = (135 - 90) * Math.PI / 180       // 225° from top = 135° from X+
  const ARC_RAD = Math.PI * 1.5                    // 270°

  // Background arc
  ctx.beginPath()
  ctx.arc(gcx, gcy, r, startA, startA + ARC_RAD)
  ctx.strokeStyle = hexToRgba(overlayColor, 0.12); ctx.lineWidth = Math.round(6 * s)
  ctx.lineCap = 'round'; ctx.stroke()

  // Value arc
  const spd = point?.speedSmooth ?? 0
  const p = Math.max(0, Math.min(1, spd / 60))
  if (p > 0.01) {
    ctx.beginPath()
    ctx.arc(gcx, gcy, r, startA, startA + ARC_RAD * p)
    ctx.strokeStyle = TEAL; ctx.lineWidth = Math.round(6 * s)
    ctx.lineCap = 'round'; ctx.stroke()
  }

  // "SPEED" label above
  text('SPEED', gcx, gcy - r - Math.round(14 * s), 8, 700, TEAL_D, 'center', 'bottom')
  // Speed number (centered in arc)
  text(spd.toFixed(0), gcx, gcy - Math.round(r * 0.10), 36, 700, WHITE, 'center', 'middle')
  // "KM/H" below the speed number
  text('KM/H', gcx, gcy + Math.round(r * 0.30), 8, 700, TEAL_D, 'center', 'top')

  // Min/max labels on arc
  const lbR = r + Math.round(12 * s)
  text('0',  gcx + lbR * Math.cos(startA),           gcy + lbR * Math.sin(startA),           7, 600, TEAL_D, 'center', 'middle')
  text('60', gcx + lbR * Math.cos(startA + ARC_RAD), gcy + lbR * Math.sin(startA + ARC_RAD), 7, 600, TEAL_D, 'center', 'middle')

  // Center-right: SLOPE
  const sx = gcx + gaugeSize / 2 + Math.round(30 * s)
  const sy = gcy - r - Math.round(10 * s)
  const grade = point?.grade ?? 0
  text('SLOPE', sx, sy, 8, 700, 'rgba(255,255,255,0.65)', 'left', 'top')
  text(grade.toFixed(2), sx, sy + Math.round(16 * s), 32, 700, WHITE, 'left', 'top')
  text('%', sx, sy + Math.round(58 * s), 11, 700, TEAL, 'left', 'top')

  // Bottom: GPS coordinates
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  text(lonStr, Math.round(20 * s), H - Math.round(22 * s), 8, 500, 'rgba(255,255,255,0.55)', 'left', 'bottom')
  text(latStr, Math.round(20 * s), H - Math.round(10 * s), 8, 500, 'rgba(255,255,255,0.55)', 'left', 'bottom')

  drawLocationPill(ctx, W, H, s, locationName, 'cycling', overlayColor)
  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Location pill ────────────────────────────────────────────────────────────
// Mirrors the CSS .hud-location pill with layout-aware positioning.
function drawLocationPill(ctx, W, H, s, locationName, overlayFormat, overlayColor = '#00ff88') {
  if (!locationName) return

  const FONT = '-apple-system, BlinkMacSystemFont, sans-serif'
  const fontSize = Math.round(9 * s)
  const pinW  = Math.round(9 * s)
  const pinH  = Math.round(12 * s)
  const padH  = Math.round(3 * s)
  const padL  = Math.round(6 * s)
  const padR  = Math.round(9 * s)
  const gap   = Math.round(4 * s)
  const maxW  = W * 0.40

  ctx.save()
  ctx.font = `600 ${fontSize}px ${FONT}`
  const rawTextW = ctx.measureText(locationName).width
  const textW    = Math.min(rawTextW, maxW - pinW - gap - padL - padR)
  const pillW    = padL + pinW + gap + textW + padR
  const pillH    = Math.max(pinH, fontSize) + padH * 2

  // Position by layout — matches the Vue locationStyle computed
  let px, py
  switch (overlayFormat) {
    case 'classic':
      px = W * 0.24
      py = H * 0.69 - pillH  // just above the 31% bottom gap (bottom: 31%)
      break
    case 'minimal':
      px = Math.round(8 * s)
      py = Math.round(12 * s)
      break
    case 'gopro':
    case 'sport':
      px = W - pillW - W * 0.02
      py = H * 0.92 - pillH  // bottom: 8%
      break
    case 'cycling':
      px = W - pillW - W * 0.02
      py = H * 0.96 - pillH  // bottom: 4%
      break
    default:
      px = Math.round(8 * s)
      py = H - pillH - Math.round(8 * s)
  }

  // Pill background
  const radius = pillH / 2
  ctx.globalAlpha = 0.85
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  rrect(ctx, px, py, pillW, pillH, radius)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = Math.max(0.5, Math.round(0.5 * s))
  ctx.stroke()
  ctx.globalAlpha = 1

  // Pin icon (same SVG path as the Vue component)
  const pinX = px + padL
  const pinY = py + (pillH - pinH) / 2
  const ps   = pinH / 16   // path is drawn in a 12×16 viewBox → scale to pinH
  ctx.save()
  ctx.translate(pinX, pinY)
  ctx.scale(ps, ps)
  ctx.beginPath()
  // Outer teardrop
  ctx.moveTo(6, 0)
  ctx.bezierCurveTo(2.686, 0, 0, 2.686, 0, 6)
  ctx.bezierCurveTo(0, 10, 6, 16, 6, 16)
  ctx.bezierCurveTo(6, 16, 12, 10, 12, 6)
  ctx.bezierCurveTo(12, 2.686, 9.314, 0, 6, 0)
  ctx.closePath()
  // Inner circle hole (counterclockwise = subtract)
  ctx.arc(6, 6, 2, 0, Math.PI * 2, true)
  ctx.restore()
  ctx.fillStyle = 'var(--oc, #f59e0b)'   // fallback for OffscreenCanvas
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur  = Math.round(3 * s)

  // Re-draw pin without transform for OffscreenCanvas (no CSS vars)
  const pinColor = overlayColor
  ctx.save()
  ctx.translate(pinX, pinY)
  ctx.scale(ps, ps)
  ctx.beginPath()
  ctx.moveTo(6, 0)
  ctx.bezierCurveTo(2.686, 0, 0, 2.686, 0, 6)
  ctx.bezierCurveTo(0, 10, 6, 16, 6, 16)
  ctx.bezierCurveTo(6, 16, 12, 10, 12, 6)
  ctx.bezierCurveTo(12, 2.686, 9.314, 0, 6, 0)
  ctx.closePath()
  ctx.arc(6, 6, 2, 0, Math.PI * 2, true)
  ctx.fillStyle = pinColor
  ctx.fill('evenodd')
  ctx.restore()
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  // Location text (clipped to max width)
  ctx.save()
  const textX = px + padL + pinW + gap
  const textY = py + pillH / 2
  ctx.rect(textX, py, textW + 1, pillH)
  ctx.clip()
  ctx.font = `600 ${fontSize}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur  = Math.round(3 * s)
  ctx.fillText(locationName, textX, textY)
  ctx.restore()
}

// ─── Logo watermark helpers ──────────────────────────────────────────────────

function drawLogoMark(ctx, x, y, size, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  const r = size * 0.22
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + size, y, x + size, y + size, r)
  ctx.arcTo(x + size, y + size, x, y + size, r)
  ctx.arcTo(x, y + size, x, y, r)
  ctx.arcTo(x, y, x + size, y, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.30, y + size * 0.22)
  ctx.lineTo(x + size * 0.30, y + size * 0.78)
  ctx.lineTo(x + size * 0.80, y + size * 0.50)
  ctx.closePath()
  ctx.fillStyle = '#ff7a3a'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.08, y + size * 0.84)
  ctx.bezierCurveTo(x + size * 0.22, y + size * 0.72, x + size * 0.38, y + size * 0.78, x + size * 0.52, y + size * 0.64)
  ctx.bezierCurveTo(x + size * 0.62, y + size * 0.54, x + size * 0.72, y + size * 0.60, x + size * 0.92, y + size * 0.40)
  ctx.strokeStyle = '#3a8fff'
  ctx.lineWidth   = Math.max(1.5, size * 0.09)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

function drawWatermark(ctx, W, H, s) {
  const FONT     = '-apple-system, BlinkMacSystemFont, sans-serif'
  const iconSize = Math.round(18 * s)
  const gap      = Math.round(4 * s)
  const margin   = Math.round(14 * s)
  const label    = 'gpx2video'
  ctx.save()
  ctx.font = `600 ${Math.round(8 * s)}px ${FONT}`
  const textW  = ctx.measureText(label).width
  const totalW = iconSize + gap + textW
  const ix     = W - margin - totalW
  const iy     = H - margin - iconSize
  drawLogoMark(ctx, ix, iy, iconSize, 0.4)
  ctx.globalAlpha = 0.4
  ctx.font = `600 ${Math.round(8 * s)}px ${FONT}`
  ctx.fillStyle    = '#ffffff'
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor  = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur   = Math.round(3 * s)
  ctx.fillText(label, ix + iconSize + gap, iy + iconSize / 2)
  ctx.restore()
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
