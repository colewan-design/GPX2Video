import { ref } from 'vue'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { createFile as mp4boxCreateFile, DataStream } from 'mp4box'
import { arrayMax, lerp, fmtTime } from '../utils/geo.js'
import { useVideoShader } from './useVideoShader.js'
import { SHADER_PARAMS } from '../utils/filters.js'
import { SPEED_PRESETS, buildFrameSourceTimes, isFlatNormal } from '../utils/speedCurve.js'

// Extract encoded audio samples from a blob URL via mp4box (no decode/re-encode).
// Returns { info, samples, description } or null if audio unavailable / parse fails.
async function extractAudioFromMp4(src) {
  try {
    const ab = await fetch(src).then(r => r.arrayBuffer())
    ab.fileStart = 0

    let info = null
    let description = null
    const samples = []
    let hasError = false

    const mp4file = mp4boxCreateFile()
    mp4file.onError = () => { hasError = true }

    mp4file.onReady = (boxInfo) => {
      const t = boxInfo.tracks.find(tr => tr.type === 'audio')
      if (!t) return
      info = {
        codec:            t.codec,
        sampleRate:       t.audio.sample_rate,
        numberOfChannels: t.audio.channel_count,
        timescale:        t.timescale,
      }
      // Try to grab AudioSpecificConfig from esds for the muxer decoderConfig
      try {
        const entry = mp4file.getTrackById(t.id).mdia.minf.stbl.stsd.entries[0]
        const decoderSpecInfo = entry.esds?.esd?.descs?.[0]?.descs?.[0]
        if (decoderSpecInfo?.data) description = new Uint8Array(decoderSpecInfo.data).buffer.slice(0)
      } catch {}
      mp4file.setExtractionOptions(t.id, null, { nbSamples: Infinity })
      mp4file.start()
    }

    mp4file.onSamples = (id, user, newSamples) => {
      for (const s of newSamples) samples.push(s)
    }

    mp4file.appendBuffer(ab)
    mp4file.flush()

    if (hasError || !info) return null
    return { info, samples, description }
  } catch {
    return null
  }
}

// ─── Rotation helpers ────────────────────────────────────────────────────────
// Phone cameras record landscape-coded frames with a rotation flag in the
// MP4 tkhd matrix. Browsers apply this for <video> display but not for
// ctx.drawImage() or VideoDecoder frames — we must compensate manually.

function parseMp4Rotation(matrix) {
  if (!matrix || matrix.length < 5) return 0
  // matrix is 16.16 fixed-point: [a,b,u, c,d,v, tx,ty,w]
  // Pure-rotation patterns (values ≈ ±65536 for ±1.0):
  const b = matrix[1], c = matrix[3]
  if (b > 0 && c < 0) return 90
  if (b < 0 && c > 0) return 270
  if (matrix[0] < 0 && matrix[4] < 0) return 180
  return 0
}

async function getVideoRotation(src) {
  if (!src) return 0
  try {
    const ab = await fetch(src).then(r => r.arrayBuffer())
    ab.fileStart = 0
    let rotation = 0
    const file = mp4boxCreateFile()
    file.onReady = (info) => {
      const t = info.tracks.find(tr => tr.type === 'video')
      if (!t) return
      try {
        const tkhd = file.getTrackById(t.id).tkhd
        if (tkhd?.matrix) rotation = parseMp4Rotation(tkhd.matrix)
      } catch {}
    }
    file.appendBuffer(ab)
    file.flush()
    return rotation
  } catch { return 0 }
}

// Extract encoded video samples + decoder config from a blob URL via mp4box.
// Returns { codec, codedWidth, codedHeight, description, samples, timescale } or null.
async function extractVideoFromMp4(src) {
  try {
    const ab = await fetch(src).then(r => r.arrayBuffer())
    ab.fileStart = 0

    let trackInfo = null
    let description = null
    const samples = []
    let hasError = false

    const file = mp4boxCreateFile()
    file.onError = () => { hasError = true }

    file.onReady = (info) => {
      const t = info.tracks.find(tr => tr.type === 'video')
      if (!t) return
      trackInfo = { codec: t.codec, codedWidth: t.video.width, codedHeight: t.video.height, timescale: t.timescale }
      try {
        const entry = file.getTrackById(t.id).mdia.minf.stbl.stsd.entries[0]
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
        if (box) {
          const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
          box.write(stream)
          description = new Uint8Array(stream.buffer, 8) // skip 4-byte size + 4-byte type header
        }
      } catch {}
      file.setExtractionOptions(t.id, null, { nbSamples: Infinity })
      file.start()
    }

    file.onSamples = (id, user, newSamples) => {
      for (const s of newSamples) samples.push(s)
    }

    file.appendBuffer(ab)
    file.flush()

    if (hasError || !trackInfo) return null
    return { ...trackInfo, description, samples }
  } catch {
    return null
  }
}

// Stream an MP4 through mp4box without loading the full file into RAM at once.
// Reads the file as a ReadableStream, calling onBatch(samples, trackInfo, descr)
// for each ~windowSec window of samples. Return false from onBatch to abort early.
// Peak memory is bounded to ~windowSec of encoded video data rather than the full file.
async function streamVideoSamples(src, windowSec, onBatch) {
  const file    = mp4boxCreateFile()
  let trackInfo = null
  let descr     = null
  let streamErr = null
  const pending = []

  file.onError  = (e) => { streamErr = String(e) }
  file.onReady  = (info) => {
    const t = info.tracks.find(tr => tr.type === 'video')
    if (!t) return
    trackInfo = { codec: t.codec, codedWidth: t.video.width, codedHeight: t.video.height, timescale: t.timescale }
    try {
      const entry = file.getTrackById(t.id).mdia.minf.stbl.stsd.entries[0]
      const box   = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
      if (box) {
        const ds = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
        box.write(ds)
        descr = new Uint8Array(ds.buffer, 8)
      }
    } catch {}
    file.setExtractionOptions(t.id, null, { nbSamples: Infinity })
    file.start()
  }
  file.onSamples = (_, __, s) => { for (const x of s) pending.push(x) }

  const resp   = await fetch(src)
  const reader = resp.body.getReader()
  let offset = 0, eof = false

  const readMore = async () => {
    if (eof) return
    const { value, done } = await reader.read()
    if (done) { eof = true; return }
    const ab = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    ab.fileStart = offset
    offset += ab.byteLength
    file.appendBuffer(ab)
    if (streamErr) throw new Error(streamErr)
  }

  while (!trackInfo && !eof) await readMore()
  if (!trackInfo) return

  while (true) {
    while (!eof) {
      if (pending.length >= 2) {
        const span = (pending[pending.length - 1].cts - pending[0].cts) / pending[0].timescale
        if (span >= windowSec) break
      }
      await readMore()
    }

    if (!pending.length) break

    let split = pending.length
    if (!eof && pending.length >= 2) {
      const tgt = pending[0].cts + windowSec * pending[0].timescale
      const idx = pending.findIndex(s => s.cts >= tgt)
      if (idx > 0) split = idx
    }

    const batch = pending.splice(0, split)
    const cont  = await onBatch(batch, trackInfo, descr)
    if (cont === false) break

    if (eof && pending.length === 0) break
  }

  reader.cancel().catch(() => {})
}

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
    captionSegments = [],
    captionStyle = null,
  ) {
    if (!videoEl) return

    if (!('VideoEncoder' in window)) {
      exportError.value = 'WebCodecs not supported — use Chrome or Edge 94+.'
      return
    }

    exporting.value      = true
    exportProgress.value = 0
    exportError.value    = null

    const tEnd = gpxPoints.length ? (trimEnd ?? gpxPoints.length - 1) : 0

    try {
      await runExport(
        videoEl, segments ?? [], gpxPoints, totalOffsetSec, totalTime, trimStart, tEnd,
        videoTrimStartSec, videoTrimEndSec, overlayFormat, overlayColor, locationName,
        shaderParams, speedCurvePreset, clipsArray, captionSegments, captionStyle,
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
    captionSegments = [], captionStyle = null,
  ) {
    const t0 = performance.now()
    const xlog = (...args) => console.log(`[export +${((performance.now()-t0)/1000).toFixed(2)}s]`, ...args)
    const xerr = (...args) => console.error(`[export +${((performance.now()-t0)/1000).toFixed(2)}s]`, ...args)
    xlog('start')

    const srcW = videoEl.videoWidth
    const srcH = videoEl.videoHeight

    // Read rotation from MP4 container metadata. Phone videos coded landscape with
    // rotate=90 need manual rotation since ctx.drawImage ignores rotation metadata.
    const firstSrc = segments?.[0]?.src || videoEl.src || null
    const videoRotation = await getVideoRotation(firstSrc)
    const swapDims = videoRotation === 90 || videoRotation === 270
    // Browsers return display (post-rotation) dimensions from videoWidth/videoHeight,
    // so dispW/dispH are already correct — no swap needed for canvas size.
    const dispW = srcW
    const dispH = srcH
    // Coded dimensions are needed by drawImage, which ignores rotation metadata.
    const codedW = swapDims ? srcH : srcW
    const codedH = swapDims ? srcW : srcH

    const scale = Math.min(1, 1920 / Math.max(dispW, dispH))
    const W = Math.round(dispW * scale / 2) * 2
    const H = Math.round(dispH * scale / 2) * 2

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

    // ── Audio stream copy: extract encoded audio from source segments ──────────
    const allSameSeg = activeClips.every(c => c.segmentIdx === 0)
    const curvePreset    = SPEED_PRESETS[speedCurvePreset] ?? SPEED_PRESETS.normal
    const curveKeyframes = curvePreset.keyframes
    const useCurve       = !isFlatNormal(curveKeyframes)

    xlog(`clips=${activeClips.length} totalDur=${totalActiveDur.toFixed(2)}s useCurve=${useCurve}`)

    // VideoDecoder requires the full file in RAM — cap at 30s to avoid OOM / tab context loss.
    // Audio stream copy only extracts the audio track (tiny), so no length limit.
    const shortClip = totalActiveDur <= 30

    const audioExtracted = new Map()  // segIdx → { info, samples, description }
    for (const segIdx of new Set(activeClips.map(c => c.segmentIdx))) {
      const src = activeClips.find(c => c.segmentIdx === segIdx)?.src
      if (src) {
        const data = await extractAudioFromMp4(src)
        if (data) audioExtracted.set(segIdx, data)
      }
    }
    const useStreamCopy = audioExtracted.size > 0 &&
      activeClips.every(c => audioExtracted.has(c.segmentIdx))
    const streamAudioInfo = useStreamCopy
      ? (audioExtracted.get(activeClips[0]?.segmentIdx ?? 0)?.info ?? null)
      : null

    // ── Pre-extract video samples for fast VideoDecoder path ─────────────────
    const videoExtracted = new Map()  // src → { codec, codedWidth, codedHeight, description, samples }
    if ('VideoDecoder' in window && !useCurve && shortClip) {
      for (const src of new Set(activeClips.map(c => c.src).filter(Boolean))) {
        const data = await extractVideoFromMp4(src)
        if (data) videoExtracted.set(src, data)
      }
    }
    const allClipsHaveDecoderData = !useCurve &&
      activeClips.length > 0 &&
      activeClips.every(c => c.src && videoExtracted.has(c.src))

    // ── Fallback: captureStream audio (single-segment, flat speed only) ───────
    let AUDIO_SAMPLE_RATE = 48000
    let AUDIO_CHANNELS    = 2
    let audioEncoder      = null
    let audioReader       = null

    if (!useStreamCopy && !allClipsHaveDecoderData && allSameSeg && !useCurve &&
        'AudioEncoder' in window &&
        'MediaStreamTrackProcessor' in window &&
        typeof videoEl.captureStream === 'function') {
      try {
        const stream     = videoEl.captureStream()
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          // Use getSettings() to get sample rate — avoids blocking read on a paused element.
          const settings    = audioTrack.getSettings()
          AUDIO_SAMPLE_RATE = settings.sampleRate   ?? 48000
          AUDIO_CHANNELS    = settings.channelCount ?? 2
          audioReader       = new MediaStreamTrackProcessor({ track: audioTrack }).readable.getReader()
        }
      } catch { audioReader = null }
    }

    // ── PCM fallback: AudioContext decode → AudioEncoder re-encode ───────────
    // Only attempted for short clips where the full-file load is feasible.
    let pcmAudioBuffer = null
    if (!useStreamCopy && !audioReader && shortClip && 'AudioEncoder' in window) {
      try {
        const firstSrc = activeClips[0]?.src
        if (firstSrc) {
          const ab     = await fetch(firstSrc).then(r => r.arrayBuffer())
          const tmpCtx = new AudioContext()
          pcmAudioBuffer = await tmpCtx.decodeAudioData(ab)
          await tmpCtx.close()
        }
      } catch { pcmAudioBuffer = null }
    }
    if (pcmAudioBuffer) {
      AUDIO_SAMPLE_RATE = pcmAudioBuffer.sampleRate
      AUDIO_CHANNELS    = pcmAudioBuffer.numberOfChannels
    }

    // ── Muxer + encoders ──────────────────────────────────────────────────────
    const hasAudio = useStreamCopy ? !!streamAudioInfo : !!(audioReader || pcmAudioBuffer)
    const audioSR  = useStreamCopy ? (streamAudioInfo?.sampleRate       ?? 48000) : AUDIO_SAMPLE_RATE
    const audioCH  = useStreamCopy ? (streamAudioInfo?.numberOfChannels ?? 2)     : AUDIO_CHANNELS

    const target = new ArrayBufferTarget()
    const muxer  = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      ...(hasAudio ? { audio: { codec: 'aac', sampleRate: audioSR, numberOfChannels: audioCH } } : {}),
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    })

    let encoderError = null
    let encCfg = { codec: avcCodec(W, H), width: W, height: H, bitrate: 8_000_000, framerate: fps, hardwareAcceleration: 'no-preference' }

    function makeVideoEncoder() {
      const enc = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error:  (e) => { xerr('VideoEncoder error:', e); encoderError = e },
      })
      enc.configure(encCfg)
      return enc
    }

    // Returns true if encoding can continue (error cleared or recovered), false if fatal.
    function tryRecoverEncoder() {
      if (!encoderError) return true
      // If already on software encoding, can't recover further.
      if (encCfg.hardwareAcceleration === 'prefer-software') return false
      encoderError = null
      try { encoder.close() } catch {}
      // Fall back to software encoding — works regardless of GPU contention/context loss.
      encCfg = { ...encCfg, hardwareAcceleration: 'prefer-software' }
      encoder = makeVideoEncoder()
      return true
    }

    let encoder = makeVideoEncoder()

    if (!useStreamCopy && audioReader) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  () => {},
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

    // ── Rotation-aware draw helper ────────────────────────────────────────────
    // Applies the transform needed to correct rotation metadata before drawing.
    // rotation=90 : coded 1920×1080 → display 1080×1920  (most phone portrait videos)
    // rotation=270: coded 1920×1080 → display 1080×1920  (opposite landscape orientation)
    function drawRotated(c, source) {
      if (videoRotation === 0) {
        c.drawImage(source, 0, 0, W, H)
        return
      }
      c.save()
      if (videoRotation === 90) {
        // translate(W, 0) + rotate(+90°) maps frame bottom-left → canvas top-left
        c.translate(W, 0)
        c.rotate(Math.PI / 2)
      } else if (videoRotation === 270) {
        c.translate(0, H)
        c.rotate(-Math.PI / 2)
      } else { // 180
        c.translate(W, H)
        c.rotate(Math.PI)
      }
      c.drawImage(source, 0, 0, codedW, codedH)
      c.restore()
    }

    // ── Render one frame ──────────────────────────────────────────────────────
    // absTime = absolute position on the full timeline (for GPX overlay mapping)
    let activeGlOk = false
    let activeVidEl = null

    // ── Caption drawing ───────────────────────────────────────────────────────
    const capStyle = captionStyle ?? { placement: 'bot-center', fontSize: 15, background: true, bgOpacity: 55, fontFamily: 'sans' }
    const CAP_FONT_FAMILY = {
      sans:        'Inter, Arial, sans-serif',
      montserrat:  "'Montserrat', sans-serif",
      impact:      "Impact, 'Arial Narrow', sans-serif",
      oswald:      "'Oswald', sans-serif",
      bebas:       "'Bebas Neue', Impact, sans-serif",
    }
    function drawCaptions(c, w, h, absTime) {
      if (!captionSegments?.length) return
      const seg = captionSegments.find(s => absTime >= s.start && absTime < s.end)
      if (!seg?.text) return

      // scale matches the CSS preview: stageW is the stage pixel width recorded on drag/resize;
      // fallback 600 matches the default layout width used when no interaction has occurred.
      const stageW = capStyle.stageW ?? 600
      const scale = w / stageW
      const baseFontPx = typeof capStyle.fontSize === 'number'
        ? capStyle.fontSize
        : ({ small: 12, medium: 15, large: 20 }[capStyle.fontSize] ?? 15)
      const renderedFontPx = baseFontPx * scale
      const fontFamily = CAP_FONT_FAMILY[capStyle.fontFamily] ?? CAP_FONT_FAMILY.sans
      const fontWeight = capStyle.bold !== false ? 'bold' : 'normal'
      c.save()
      c.font = `${fontWeight} ${renderedFontPx}px ${fontFamily}`

      // Use drag-positioned coordinates (capX/capY % from stage) when available,
      // otherwise fall back to the placement grid string.
      const hasDragPos = capStyle.capX != null && capStyle.capY != null
      const placement = capStyle.placement ?? (capStyle.position === 'top' ? 'top-center' : 'bot-center')
      const [vert, horiz] = placement.split('-')
      const capCX = hasDragPos
        ? w * capStyle.capX / 100
        : (horiz === 'left' ? w * 0.2 : horiz === 'right' ? w * 0.8 : w / 2)
      c.textAlign = hasDragPos ? 'center' : (horiz === 'left' ? 'left' : horiz === 'right' ? 'right' : 'center')
      c.textBaseline = 'bottom'
      const padH = 12 * scale   // horizontal padding — matches CSS padding: 4px 12px
      const padV =  4 * scale   // vertical padding
      const lineH = renderedFontPx * 1.35
      // capY% is the element TOP in CSS; offset by padding-top + lineH to get first-line text bottom.
      // For grid placement: capCY is the anchor used to compute baseY after word-wrap.
      const capCY = hasDragPos
        ? h * capStyle.capY / 100 + padV + lineH
        : (vert === 'top' ? lineH + 28 * scale : vert === 'mid' ? h / 2 : h - 31 * scale)

      const rawWords = seg.text.trim()
      const displayText = capStyle.allCaps ? rawWords.toUpperCase() : capStyle.lowercase ? rawWords.toLowerCase() : rawWords
      const words = displayText.split(/\s+/)
      const capWPct = capStyle.capW ?? 60
      const maxW = w * capWPct / 100
      const lines = []
      let line = ''
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (c.measureText(test).width > maxW && line) { lines.push(line); line = word }
        else line = test
      }
      if (line) lines.push(line)

      const blockH = lines.length * lineH
      // Drag case: capCY already encodes first-line bottom, so baseY = capCY (same as 'top').
      const baseY = (hasDragPos || vert === 'top') ? capCY : capCY - blockH + lineH

      if (capStyle.background) {
        const bgAlpha = (capStyle.bgOpacity ?? 55) / 100
        c.fillStyle = `rgba(0,0,0,${bgAlpha})`
        // Background width matches the CSS element width (capW%), not just the measured text.
        const bgW = w * capWPct / 100
        const rx = capCX - bgW / 2, ry = baseY - lineH - padV
        const rw = bgW, rh = blockH + padV * 2
        rrect(c, rx, ry, rw, rh, 6 * scale)
        c.fill()
      }

      if (capStyle.outline) {
        c.strokeStyle = '#000000'
        c.lineWidth = Math.max(1, renderedFontPx * 0.08)
        c.lineJoin = 'round'
        lines.forEach((l, i) => c.strokeText(l, capCX, baseY + i * lineH))
      }

      c.fillStyle = capStyle.color ?? '#ffffff'
      lines.forEach((l, i) => c.fillText(l, capCX, baseY + i * lineH))
      c.restore()
    }

    // ── Point 2: overlay cache — HUD + map are O(N-pts) to draw; GPS updates at
    // ~1 Hz while we encode at 30 fps, so we cache the overlay on a separate
    // canvas and only redraw it when the GPS point index actually changes.
    const overlayCanvas = new OffscreenCanvas(W, H)
    const overlayCtx    = overlayCanvas.getContext('2d')
    let lastOverlayIdx  = -1
    let lastOverlaySec  = -1

    function renderCanvas(absTime, overallProgress, frame = null) {
      const idx   = findAnimIdx(gpxPoints, totalOffsetSec, absTime, totalActiveDur, trimStart, trimEnd)
      const point = gpxPoints[idx]
      const currentSec = Math.floor(overallProgress * totalActiveDur)

      // Rebuild overlay when GPS point changes OR when the clock second ticks
      if (gpxPoints.length && (idx !== lastOverlayIdx || currentSec !== lastOverlaySec)) {
        const displayTime = gpxPoints[0]?.time
          ? new Date(gpxPoints[0].time.getTime() + (totalOffsetSec + absTime) * 1000)
          : null
        overlayCtx.clearRect(0, 0, W, H)
        if (overlayFormat === 'sticker2') {
          drawMapFull(overlayCtx, W, H, gpxPoints, idx, maxSpeed, trimStart, overlayColor)
        } else if (overlayFormat !== 'sticker1') {
          drawMapInset(overlayCtx, W, H, gpxPoints, idx, maxSpeed, trimStart)
        }
        drawHud(overlayCtx, W, H, point, gpxPoints, idx, overallProgress, totalTime, trimStart, overlayFormat, overlayColor, locationName, displayTime)
        lastOverlayIdx = idx
        lastOverlaySec = currentSec
      }

      // Draw video frame — VideoFrame (decoder path), WebGL shader, or plain video element.
      // ROTATION HANDLING:
      //   • VideoFrame (frame != null): raw coded pixels, pre-rotation — drawRotated applies the
      //     transform to produce display-correct output.
      //   • <video> element (activeVidEl): Chrome's drawImage delivers the browser's
      //     display-oriented frame (rotation metadata already applied internally). Adding
      //     drawRotated here would double-rotate portrait phone videos. Use plain drawImage.
      //   • WebGL shader: bypassed for rotated videos (needsShader = !swapDims && …) so
      //     activeGlOk is always false when swapDims=true — no rotation issue there.
      if (frame) {
        const cssFilter = shaderParams ? buildExportFilter(shaderParams) : null
        if (cssFilter) ctx.filter = cssFilter
        drawRotated(ctx, frame)   // VideoFrame = raw coded pixels; rotation IS needed
        if (cssFilter) ctx.filter = 'none'
      } else if (activeGlOk) {
        shader.renderFrame()
        if (shader.isContextOk()) {
          ctx.drawImage(glCanvas, 0, 0, W, H)
        } else {
          // WebGL context lost — fall back; browser already applied rotation via drawImage
          activeGlOk = false
          ctx.drawImage(activeVidEl, 0, 0, W, H)
        }
      } else {
        // <video> element: browser applies rotation metadata before handing pixels to
        // drawImage, so no additional transform is needed regardless of swapDims.
        ctx.drawImage(activeVidEl, 0, 0, W, H)
      }

      // Composite cached overlay
      ctx.drawImage(overlayCanvas, 0, 0, W, H)

      // Draw captions on top (not cached — they update every frame)
      drawCaptions(ctx, W, H, absTime)
    }

    // Seek to the first clip start for audio sync (only needed for captureStream path)
    if (!useStreamCopy) await seekElTo(videoEl, activeClips[0].localStart)

    // ── Fallback audio capture loop (captureStream path) ─────────────────────
    let audioDone = false
    const audioLoopDone = (!useStreamCopy && audioReader)
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

    xlog(`audio path: ${useStreamCopy ? 'stream-copy' : audioReader ? 'captureStream' : pcmAudioBuffer ? 'pcm-fallback' : 'none'}`)
    xlog(`video encoder: ${encCfg.codec} ${W}x${H} ${encCfg.bitrate/1000}kbps hw=${encCfg.hardwareAcceleration}`)

    // ── Encode each clip ──────────────────────────────────────────────────────
    for (const clip of activeClips) {
      if (!exporting.value) break
      if (encoderError && !tryRecoverEncoder()) break

      const videoData = clip.src ? videoExtracted.get(clip.src) : null

      xlog(`clip[${activeClips.indexOf(clip)}] localStart=${clip.localStart.toFixed(2)}s localEnd=${clip.localEnd.toFixed(2)}s src=${clip.src ? 'present' : 'none'} videoData=${!!videoData}`)

      let usedDecoder = false
      if (videoData) {
        // ── Fast VideoDecoder path ──────────────────────────────────────────
        xlog('clip: fast VideoDecoder path')
        const frameCountBefore = frameCount
        let lastDecodedPts = clip.localStart - frameInterval

        await new Promise((resolve, reject) => {
          const decoder = new VideoDecoder({
            output: (frame) => {
              if (!exporting.value) { frame.close(); return }
              const needsKeyFrame = !!encoderError
              if (encoderError && !tryRecoverEncoder()) { frame.close(); return }
              const ptsSec = frame.timestamp / 1_000_000

              if (ptsSec < clip.localStart - frameInterval * 0.5) { frame.close(); return }
              if (ptsSec >= clip.localEnd + frameInterval * 0.5)  { frame.close(); return }
              if (ptsSec - lastDecodedPts < frameInterval - 0.001) { frame.close(); return }

              lastDecodedPts = ptsSec
              const elapsed     = Math.max(0, ptsSec - clip.localStart)
              const overallProg = totalActiveDur > 0 ? (outputTimeOffset + elapsed) / totalActiveDur : 0

              try { renderCanvas(clip.absStart + elapsed, overallProg, frame) } catch (_) {}
              frame.close()

              const ts = Math.round((outputTimeOffset + elapsed) * 1_000_000)
              const vf = new VideoFrame(canvas, { timestamp: ts })
              try {
                encoder.encode(vf, { keyFrame: needsKeyFrame || frameCount % (fps * 2) === 0 })
                frameCount++
              } catch (e) {
                encoderError = e
              } finally {
                vf.close()
              }
              exportProgress.value = Math.min(0.93, overallProg)
            },
            error: (e) => { encoderError = e; resolve() },
          })

          try {
            decoder.configure({
              codec:       videoData.codec,
              codedWidth:  videoData.codedWidth,
              codedHeight: videoData.codedHeight,
              ...(videoData.description ? { description: videoData.description } : {}),
              hardwareAcceleration: 'prefer-software',
            })
          } catch (e) { decoder.close(); encoderError = e; resolve(); return }

          // Walk backwards to find the last keyframe at or before clip.localStart
          const { samples } = videoData
          let startIdx = 0
          for (let i = 0; i < samples.length; i++) {
            if (samples[i].cts / samples[i].timescale > clip.localStart + 0.001) break
            if (samples[i].is_sync) startIdx = i
          }

          for (let i = startIdx; i < samples.length; i++) {
            const s = samples[i]
            if (s.cts / s.timescale > clip.localEnd + 1.0) break
            decoder.decode(new EncodedVideoChunk({
              type:      s.is_sync ? 'key' : 'delta',
              timestamp: Math.round((s.cts / s.timescale) * 1_000_000),
              duration:  Math.round((s.duration / s.timescale) * 1_000_000),
              data:      s.data,
            }))
          }

          decoder.flush().then(() => { decoder.close(); resolve() }).catch(e => { encoderError = e; resolve() })
        })

        if (frameCount > frameCountBefore) {
          usedDecoder = true
          outputTimeOffset += clip.clipDur
        } else {
          // Decoder produced no frames — reset and fall through to RVFC path
          encoderError = null
          if (encoder.state === 'closed') encoder = makeVideoEncoder()
        }
      }

      // ── Streaming VideoDecoder path (long clips, no speed curve) ───────────
      // Reads the file as a stream so the full file is never loaded into RAM at
      // once. Maintains a keyframe chain buffer so seek accuracy is preserved.
      if (!usedDecoder && clip.src && 'VideoDecoder' in window && !useCurve) {
        xlog('clip: streaming VideoDecoder path')
        const frameCountBefore2 = frameCount
        let streamDec  = null
        let decReady   = false
        let preClipBuf = []   // samples from last keyframe up to clip.localStart
        let pastStart  = false
        let lastDecPts = clip.localStart - frameInterval
        // Max frames to keep in encoder queue before pausing decode.
        // Checked after a real macrotask yield so encoder output callbacks have fired.
        const MAX_ENC_QUEUE = fps * 2  // 2 seconds of buffering

        try {
          await streamVideoSamples(clip.src, 32, async (batch, trackInfo, descr) => {
            if (!exporting.value) return false
            if (encoderError && !tryRecoverEncoder()) return false

            if (!streamDec) {
              streamDec = new VideoDecoder({
                output: (frame) => {
                  if (!exporting.value) { frame.close(); return }
                  const needsKF = !!encoderError
                  if (encoderError && !tryRecoverEncoder()) { frame.close(); return }
                  const ptsSec = frame.timestamp / 1_000_000
                  if (ptsSec < clip.localStart - frameInterval * 0.5) { frame.close(); return }
                  if (ptsSec >= clip.localEnd   + frameInterval * 0.5) { frame.close(); return }
                  if (ptsSec - lastDecPts < frameInterval - 0.001)     { frame.close(); return }
                  lastDecPts = ptsSec
                  const elapsed     = Math.max(0, ptsSec - clip.localStart)
                  const overallProg = totalActiveDur > 0 ? (outputTimeOffset + elapsed) / totalActiveDur : 0
                  try { renderCanvas(clip.absStart + elapsed, overallProg, frame) } catch (_) {}
                  frame.close()
                  const ts = Math.round((outputTimeOffset + elapsed) * 1_000_000)
                  const vf = new VideoFrame(canvas, { timestamp: ts })
                  try {
                    encoder.encode(vf, { keyFrame: needsKF || frameCount % (fps * 2) === 0 })
                    frameCount++
                  } catch (e) { encoderError = e } finally { vf.close() }
                  exportProgress.value = Math.min(0.93, overallProg)
                },
                error: (e) => { encoderError = e },
              })
              try {
                streamDec.configure({
                  codec:       trackInfo.codec,
                  codedWidth:  trackInfo.codedWidth,
                  codedHeight: trackInfo.codedHeight,
                  ...(descr ? { description: descr } : {}),
                  hardwareAcceleration: 'prefer-software',
                })
                decReady = true
              } catch (e) { encoderError = e; return false }
            }

            for (const s of batch) {
              if (!exporting.value) return false
              if (encoderError && !tryRecoverEncoder()) return false
              const t = s.cts / s.timescale

              if (!pastStart) {
                // Accumulate samples since last keyframe; flush chain when we reach clip start
                if (s.is_sync) preClipBuf = []
                preClipBuf.push(s)
                if (t >= clip.localStart - frameInterval * 0.5) {
                  pastStart = true
                  for (const ps of preClipBuf) {
                    streamDec.decode(new EncodedVideoChunk({
                      type:      ps.is_sync ? 'key' : 'delta',
                      timestamp: Math.round((ps.cts / ps.timescale) * 1_000_000),
                      duration:  Math.round((ps.duration / ps.timescale) * 1_000_000),
                      data:      ps.data,
                    }))
                  }
                  preClipBuf = null
                }
              } else {
                if (t > clip.localEnd + 1.0) return false  // past clip end — stop streaming

                // Yield to the macrotask queue before every active-region decode so
                // decoder output callbacks and encoder processing run between submits.
                // Without this, all decode() calls in a batch execute as a microtask
                // chain and the encoder queue floods before any callbacks can fire.
                await new Promise(r => setTimeout(r, 0))

                if (!exporting.value) return false
                if (encoderError && !tryRecoverEncoder()) return false

                // If encoder is backed up, wait for it to drain before submitting more.
                while (encoder.encodeQueueSize > MAX_ENC_QUEUE) {
                  if (encoderError) { if (!tryRecoverEncoder()) return false; break }
                  await new Promise(r => setTimeout(r, 10))
                }

                streamDec.decode(new EncodedVideoChunk({
                  type:      s.is_sync ? 'key' : 'delta',
                  timestamp: Math.round((s.cts / s.timescale) * 1_000_000),
                  duration:  Math.round((s.duration / s.timescale) * 1_000_000),
                  data:      s.data,
                }))
              }
            }
            return true
          })

          xlog(`streaming: flush start (decReady=${decReady} encoderError=${encoderError?.message ?? encoderError ?? null})`)
          if (decReady) await streamDec.flush()
          xlog('streaming: flush complete')

          // Drain encoder — poll with stale detection so a stuck encoder doesn't hang.
          if (encoder.encodeQueueSize > 0) {
            xlog(`streaming: draining encoder (queueSize=${encoder.encodeQueueSize})`)
            let lastQ = encoder.encodeQueueSize, staleMs = 0
            while (encoder.encodeQueueSize > 0 && !encoderError) {
              await new Promise(r => setTimeout(r, 50))
              if (encoder.encodeQueueSize === lastQ) {
                staleMs += 50
                if (staleMs >= 5000) { xerr('streaming: encoder drain stalled, giving up'); break }
              } else { lastQ = encoder.encodeQueueSize; staleMs = 0 }
            }
            xlog(`streaming: encoder drained (queueSize=${encoder.encodeQueueSize} err=${!!encoderError})`)
          }
        } catch (e) {
          xerr('streaming decoder error:', e)
          encoderError = e
        } finally {
          try { streamDec?.close() } catch {}
        }

        if (frameCount > frameCountBefore2) {
          xlog(`streaming: done frames=${frameCount} encoderQueueSize=${encoder.encodeQueueSize}`)
          usedDecoder = true
          outputTimeOffset += clip.clipDur
        } else {
          xerr('streaming: no frames produced — falling through to RVFC', { encoderError })
          encoderError = null
          if (encoder.state === 'closed') encoder = makeVideoEncoder()
        }
      }

      if (!usedDecoder) {
        // ── Legacy path: WebGL shader + seek/RVFC ──────────────────────────
        xlog('clip: RVFC (legacy) path')
        const el = await getSegEl(clip.segmentIdx, clip.src)

        if (el !== activeVidEl) {
          if (activeVidEl) shader.destroy()
          // Skip WebGL for rotated videos (no UV-level rotation support in shader),
          // and also skip when shader params are identity (no effects active) to avoid
          // sustained GPU context pressure on long exports.
          const needsShader = !swapDims && shaderParams && isNonIdentityShader(shaderParams)
          activeGlOk  = needsShader ? shader.setup(glCanvas, el) : false
          if (activeGlOk) shader.setFilter(shaderParams)
          activeVidEl = el
        }

        if (useCurve) {
          // ── Curved speed: seek-based ────────────────────────────────────────
          const sourceTimes = buildFrameSourceTimes(curveKeyframes, clip.clipDur, fps)
          let lastSeekTarget = -1

          for (let i = 0; i < sourceTimes.length; i++) {
            if (!exporting.value) break
            if (encoderError && !tryRecoverEncoder()) break
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
            exportProgress.value = Math.min(0.93, overallProg)
            // Yield every second to let the browser flush GPU work and prevent
            // WebGL context loss / GPU watchdog timeout on long exports.
            if (frameCount % fps === 0) await new Promise(r => setTimeout(r, 0))
          }

          outputTimeOffset += sourceTimes.length / fps
        } else {
          // ── Normal 1×: RVFC play-based ──────────────────────────────────────
          await seekElTo(el, clip.localStart)
          let lastEncodedTime = clip.localStart - frameInterval

          await new Promise((resolve, reject) => {
            function frameCallback(_, metadata) {
              if (!exporting.value) { resolve(); return }
              if (encoderError && !tryRecoverEncoder()) { resolve(); return }
              const vt = metadata.mediaTime

              if (vt < clip.localStart - frameInterval * 0.5) {
                el.requestVideoFrameCallback(frameCallback); return
              }

              if (vt - lastEncodedTime >= frameInterval - 0.001) {
                const elapsed     = Math.max(0, vt - clip.localStart)
                const overallProg = totalActiveDur > 0 ? (outputTimeOffset + elapsed) / totalActiveDur : 0
                const absTime     = clip.absStart + elapsed
                try { renderCanvas(absTime, overallProg) } catch (_) {}

                const ts = Math.round((outputTimeOffset + elapsed) * 1_000_000)
                let frame = null
                try {
                  frame = new VideoFrame(canvas, { timestamp: ts })
                  encoder.encode(frame, { keyFrame: frameCount % (fps * 2) === 0 })
                  frameCount++
                  lastEncodedTime      = vt
                  exportProgress.value = Math.min(0.93, overallProg)
                } catch (e) {
                  encoderError = e
                } finally {
                  frame?.close()
                }
              }

              if (vt < clip.localEnd - frameInterval) {
                el.requestVideoFrameCallback(frameCallback)
              } else {
                resolve()
              }
            }

            el.addEventListener('ended', resolve, { once: true })
            el.requestVideoFrameCallback(frameCallback)
            el.play().catch(reject)
          })

          el.pause()
          outputTimeOffset += clip.clipDur
        }
      } // end legacy block
    }

    // ── Point 3a: PCM fallback audio — AudioContext decode → AudioEncoder ───────
    if (!useStreamCopy && pcmAudioBuffer && !encoderError) {
      const pcmEnc = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  () => {},
      })
      pcmEnc.configure({ codec: 'mp4a.40.2', sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: AUDIO_CHANNELS, bitrate: 128_000 })

      const FRAME  = 1024
      const sr     = pcmAudioBuffer.sampleRate
      const nch    = pcmAudioBuffer.numberOfChannels
      let timeOffset = 0

      for (const clip of activeClips) {
        const startFrame = Math.round(clip.localStart * sr)
        const endFrame   = Math.min(Math.round(clip.localEnd * sr), pcmAudioBuffer.length)

        for (let i = startFrame; i < endFrame; i += FRAME) {
          const len  = Math.min(FRAME, endFrame - i)
          const data = new Float32Array(len * nch)
          for (let ch = 0; ch < nch; ch++) {
            data.set(pcmAudioBuffer.getChannelData(ch).subarray(i, i + len), ch * len)
          }
          const ad = new AudioData({
            format:           'f32-planar',
            sampleRate:       sr,
            numberOfFrames:   len,
            numberOfChannels: nch,
            timestamp:        Math.round((timeOffset + (i - startFrame) / sr) * 1_000_000),
            data,
          })
          pcmEnc.encode(ad)
          ad.close()
        }
        timeOffset += clip.clipDur
      }
      await pcmEnc.flush()
      pcmEnc.close()
    }

    // ── Point 3b: stream-copy audio — splice encoded AAC frames directly ───────
    if (useStreamCopy && !encoderError) {
      let audioTimeOffset = 0
      let metaWritten = false

      for (const clip of activeClips) {
        const audioData = audioExtracted.get(clip.segmentIdx)
        if (!audioData) { audioTimeOffset += clip.clipDur; continue }

        const { info, samples, description } = audioData
        for (const sample of samples) {
          const pts = sample.cts / sample.timescale
          if (pts < clip.localStart - 0.001) continue
          if (pts >= clip.localEnd)          break

          const outputTs  = (audioTimeOffset + pts - clip.localStart) * 1_000_000
          const outputDur = sample.duration / sample.timescale * 1_000_000

          const chunk = new EncodedAudioChunk({
            type:      sample.is_sync ? 'key' : 'delta',
            timestamp: Math.round(outputTs),
            duration:  Math.round(outputDur),
            data:      sample.data,
          })

          muxer.addAudioChunk(chunk, !metaWritten ? {
            decoderConfig: {
              codec:            info.codec,
              sampleRate:       info.sampleRate,
              numberOfChannels: info.numberOfChannels,
              ...(description ? { description } : {}),
            },
          } : undefined)
          metaWritten = true
        }
        audioTimeOffset += clip.clipDur
      }
    }

    // Restore live video element
    videoEl.pause()
    videoEl.currentTime = activeClips[0]?.localStart ?? 0

    // Clean up off-screen video elements created for other segments
    for (const [segIdx, el] of segEls.entries()) {
      if (segIdx !== 0) { el.src = ''; el.load() }
    }

    xlog(`all clips done. totalFrames=${frameCount} encoderError=${encoderError?.message ?? encoderError ?? null}`)

    audioDone = true
    audioReader?.cancel().catch(() => {})
    await audioLoopDone

    if (encoderError && !tryRecoverEncoder()) {
      xerr('unrecoverable encoder error before flush:', encoderError)
      throw encoderError
    }

    exportProgress.value = 0.95
    xlog(`encoder.flush start (state=${encoder.state} encodeQueueSize=${encoder.encodeQueueSize})`)
    await encoder.flush()
    xlog('encoder.flush complete')
    encoder.close()

    exportProgress.value = 0.97
    if (!useStreamCopy && audioEncoder && audioEncoder.state !== 'closed') {
      xlog('audioEncoder.flush start')
      await audioEncoder.flush()
      xlog('audioEncoder.flush complete')
      audioEncoder.close()
    }

    exportProgress.value = 0.99
    shader.destroy()
    xlog('muxer.finalize start')
    muxer.finalize()
    xlog('muxer.finalize complete')

    exportProgress.value = 1

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

// ─── Shader identity check ───────────────────────────────────────────────────
// Returns true when params differ from the pass-through defaults.
// Skipping WebGL when no effects are active avoids GPU context pressure on long exports.
function isNonIdentityShader(p) {
  return p.sharp > 0 || p.bright !== 1 || p.contrast !== 1 ||
         p.sat !== 1 || p.sepia > 0 || (p.hue ?? 0) !== 0
}

// Build a Canvas 2D CSS filter string from shader params for the VideoDecoder paths.
// Sharpness has no CSS equivalent and is intentionally omitted (it only runs via WebGL).
function buildExportFilter(p) {
  if (!p) return null
  const parts = []
  if (p.bright   != null && p.bright   !== 1) parts.push(`brightness(${p.bright})`)
  if (p.contrast != null && p.contrast !== 1) parts.push(`contrast(${p.contrast})`)
  if (p.sat      != null && p.sat      !== 1) parts.push(`saturate(${p.sat})`)
  if (p.sepia    != null && p.sepia     >  0) parts.push(`sepia(${p.sepia})`)
  if (p.hue      != null && p.hue      !== 0) parts.push(`hue-rotate(${(p.hue * 360).toFixed(1)}deg)`)
  return parts.length ? parts.join(' ') : null
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

    // If the result hit an extreme (video doesn't overlap GPS range) and the trim
    // window is valid, advance proportionally within [trimStart, maxIdx] so the
    // gauge still moves rather than freezing at the boundary point.
    const hitExtreme = idx === 0 || idx === gpxPoints.length - 1
    if (hitExtreme && maxIdx > trimStart && duration > 0) {
      const rel = Math.max(0, Math.min(videoTimeSec / duration, 1))
      idx = Math.round(trimStart + rel * (maxIdx - trimStart))
    }
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
  const s  = textScale(W, H)   // layout-level scale (gap, border)
  // Match preview CSS: width: 21%, aspect-ratio: 4/3, top: 4px, right: 4px
  const IW = Math.round(W * 0.21)
  const IH = Math.round(IW * 3 / 4)
  const gap = Math.max(4, Math.round(4 * (W / 1920)))
  const IX = W - IW - gap
  const IY = gap

  // Scale internal elements proportional to the inset width.
  // Reference 168px = 21% of an 800px stage (typical desktop preview size).
  const ms = IW / 168

  const cp   = pts[animIdx]
  const latR = INSET_LAT_R
  const lonR = latR * (IW / IH)

  // Heading from recent points (averaging ~20 points for smooth rotation)
  let heading = 0
  const look = Math.min(20, animIdx)
  if (look >= 2) {
    const p0 = pts[animIdx - look]
    const midLat = ((cp.lat + p0.lat) / 2) * Math.PI / 180
    heading = Math.atan2((cp.lon - p0.lon) * Math.cos(midLat), cp.lat - p0.lat)
  }

  const CX = IX + IW / 2, CY = IY + IH / 2

  // Project lat/lon to inset canvas coords centered on cp
  const toXY = (lat, lon) => [
    CX + ((lon - cp.lon) / (lonR * 2)) * IW,
    CY - ((lat - cp.lat) / (latR * 2)) * IH,
  ]

  // Background + clip
  ctx.save()
  rrect(ctx, IX, IY, IW, IH, Math.round(6 * s))  // CSS border-radius: 6px
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth   = Math.max(0.5, 0.5 * s)
  ctx.stroke()
  ctx.clip()

  // Rotate around inset center for heading-up view
  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(-heading)
  ctx.translate(-CX, -CY)

  // Full faint trail — line widths scale with inset size, not global video width
  ctx.beginPath()
  pts.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth   = 1.5 * ms
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
    ctx.lineWidth   = 2.5 * ms
    ctx.stroke()
  }

  ctx.restore()  // undo rotation

  // Position marker — matches preview: inner r=4.5, outer r=8, stroke 1.5
  ctx.beginPath(); ctx.arc(CX, CY, 4.5 * ms, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX, CY, 8 * ms, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 * ms; ctx.stroke()

  ctx.restore()  // undo clip

  // North indicator — matches preview: arrow at (W-12, 12), 8px tall, 3.5px half-width
  ctx.save()
  ctx.translate(IX + IW - Math.round(12 * ms), IY + Math.round(12 * ms))
  ctx.rotate(-heading)
  ctx.beginPath()
  ctx.moveTo(0, -8 * ms); ctx.lineTo(-3.5 * ms, 3 * ms); ctx.lineTo(0, 1 * ms); ctx.lineTo(3.5 * ms, 3 * ms)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()
  ctx.restore()
}

// Scale factor that matches CSS --hud-scale (used for % of W element sizing).
function hudScaleFor(W, H) {
  return Math.max(1, Math.sqrt(H / W) / Math.sqrt(9 / 16))
}

// Scale for px-based sizing (fonts, borders, margins).
// The CSS preview applies --hud-scale as a transform *on top of* cqw-based sizes.
// For portrait the raw (W/1280)*hs formula gives the same s as landscape (math symmetry),
// but the CSS effectively scales text by hs× more. Using hs^1.3 in the exponent breaks
// that symmetry: portrait 1080×1920 → s≈1.78 (was 1.5); landscape → unchanged at 1.5.
function textScale(W, H) {
  const hs = Math.max(1, Math.sqrt(H / W) / Math.sqrt(9 / 16))
  return (W / 1280) * Math.pow(hs, 1.3)
}

function drawHud(ctx, W, H, point, pts, animIdx, progress, totalTime, trimStart = 0, overlayFormat = 'classic', overlayColor = '#f59e0b', locationName = '', displayTime = null) {
  if (overlayFormat === 'minimal')   { drawHudMinimal(ctx, W, H, point, pts, progress, overlayColor, locationName); return }
  if (overlayFormat === 'gopro')     { drawHudGoPro(ctx, W, H, point, pts, animIdx, progress, totalTime, trimStart, overlayColor, locationName, displayTime); return }
  if (overlayFormat === 'sport')     { drawHudSport(ctx, W, H, point, progress, overlayColor, locationName); return }
  if (overlayFormat === 'cycling')   { drawHudCycling(ctx, W, H, point, pts, animIdx, progress, overlayColor, locationName); return }
  if (overlayFormat === 'sticker1')  { drawHudSticker1(ctx, W, H, pts, totalTime, overlayColor, locationName); return }
  if (overlayFormat === 'sticker2')  { drawHudSticker2(ctx, W, H, pts, totalTime, overlayColor, locationName); return }
  if (overlayFormat === 'tac')       { drawHudTac(ctx, W, H, point, pts, animIdx, progress, totalTime, overlayColor); return }
  if (overlayFormat === 'dashboard') { drawHudDashboard(ctx, W, H, point, pts, animIdx, progress, totalTime, overlayColor); return }
  const s = textScale(W, H)
  ctx.save()
  ctx.font = `700 ${Math.round(14 * s)}px -apple-system, BlinkMacSystemFont, sans-serif`

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
    text(`${tempC}°C`, tiLeft + tIconSz + Math.round(3*s), tiTop + tIconSz / 2, 18, 600, WHITE, 'left', 'middle')
  }

  const distKmStr      = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  const totalDistKmStr = pts.length ? ((pts[pts.length - 1].cumDist / 1000).toFixed(1)) : '0.0'
  text(`${distKmStr} km`,          tiRight, tiTop + Math.round(2*s),  20, 700, WHITE,                       'right', 'top')
  text(`Total: ${totalDistKmStr}`, tiRight, tiTop + Math.round(24*s), 12, 400, 'rgba(255,255,255,0.40)',    'right', 'top')

  // ── Lap times box (top-left) — mirrors CSS .hud-laps ─────────────────────────
  // 1 km auto-laps; only shown when at least one full lap has been completed.
  {
    const LAP_KM = 1.0
    const lapMarkers = [0]; let nextKm = LAP_KM
    for (let i = 1; i < pts.length; i++) {
      if ((pts[i]?.cumDist ?? 0) / 1000 >= nextKm) { lapMarkers.push(i); nextKm += LAP_KM }
    }
    const totalLapsN   = Math.floor(((pts[pts.length - 1]?.cumDist ?? 0) / 1000) / LAP_KM)
    const currentLapN  = Math.floor(((point?.cumDist ?? 0) / 1000) / LAP_KM) + 1

    if (totalLapsN > 0) {
      const compLaps = []
      for (let i = 0; i < lapMarkers.length - 1; i++) {
        if (lapMarkers[i + 1] > animIdx) break
        const p0 = pts[lapMarkers[i]], p1 = pts[lapMarkers[i + 1]]
        const ms = (p0?.time && p1?.time) ? p1.time - p0.time : null
        compLaps.push({ n: i + 1, ms })
      }
      const validMs  = compLaps.filter(l => l.ms != null).map(l => l.ms)
      const bestLapMs = validMs.length ? Math.min(...validMs) : null
      const p0Lap    = lapMarkers[currentLapN - 1] != null ? pts[lapMarkers[currentLapN - 1]] : null
      const curLapMs = (p0Lap?.time && point?.time) ? point.time - p0Lap.time : 0

      function fmtLapMs(ms) {
        if (!ms || ms < 0) return '--'
        const sec = Math.floor(ms / 1000), m = Math.floor(sec / 60)
        const frac = String(Math.floor((ms % 1000) / 10)).padStart(3, '0')
        return `${m}:${String(sec % 60).padStart(2,'0')}.${frac}`
      }

      const lapRowsData = compLaps.slice(-5).map(l => ({
        n: l.n, time: fmtLapMs(l.ms),
        delta: l.ms && bestLapMs && l.ms > bestLapMs ? `+${fmtLapMs(l.ms - bestLapMs)}` : null,
        current: false,
      }))
      lapRowsData.unshift({ n: currentLapN, time: fmtLapMs(curLapMs), delta: null, current: true })
      const lapRows = lapRowsData.slice(0, 6)

      // Layout — CSS: left:0; top:4px; width:27%; padding:5px 8px 7px; border-radius:0 0 6px 0
      const lapW     = Math.round(W * 0.27)
      const lapPadT  = Math.round(5 * s), lapPadB = Math.round(7 * s), lapPadSide = Math.round(8 * s)
      const hdrFS = 13, rowFS = 15, curFS = 17  // CSS: 1cqw→13, 1.15cqw→15, 1.3cqw→17
      const lapLineH = Math.round(rowFS * s * 1.4)
      const lapBoxH  = lapPadT + Math.round(hdrFS * s) + Math.round(3 * s) + lapRows.length * lapLineH + lapPadB

      // Background — only bottom-right corner rounded
      const br = Math.round(6 * s)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, Math.round(4 * s))
      ctx.lineTo(lapW, Math.round(4 * s))
      ctx.lineTo(lapW, Math.round(4 * s) + lapBoxH - br)
      ctx.arcTo(lapW, Math.round(4 * s) + lapBoxH, lapW - br, Math.round(4 * s) + lapBoxH, br)
      ctx.lineTo(0, Math.round(4 * s) + lapBoxH)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fill()
      ctx.restore()

      // Header: "1 km lap {current}/{total}"
      const lapTopY = Math.round(4 * s) + lapPadT + Math.round(hdrFS * s)
      text(`1 km lap ${currentLapN}/${totalLapsN}`, lapPadSide, lapTopY, hdrFS, 700, 'rgba(255,255,255,0.45)')

      // Lap rows
      let lapRowY = lapTopY + Math.round(3 * s)
      for (const row of lapRows) {
        lapRowY += lapLineH
        const rowColor = row.current ? AMBER : 'rgba(255,255,255,0.55)'
        const rowStr   = row.delta ? `${row.n}/ ${row.time} ${row.delta}` : `${row.n}/ ${row.time}`
        text(rowStr, lapPadSide, lapRowY, row.current ? curFS : rowFS, row.current ? 700 : 500, rowColor)
      }
    }
  }

  // ── Left stats panel (icon + value, vertically space-around) ─────────────────
  // CSS .hud-stat-val: 1.4cqw→18, .hud-stat-multi: 1.2cqw→15
  icon(ICON_CADENCE, licx, r0, iconSz, AMBER)
  text(cadV, ltx, r0, 18, 700, WHITE, 'left', 'middle')
  const cadVW = ctx.measureText(cadV).width
  text('rpm', ltx + cadVW + Math.round(3*s), r0, 11, 600, DIM, 'left', 'middle')

  icon(ICON_ELEV, licx, r1, iconSz, AMBER)
  const glOff = Math.round(11 * s)
  text(`Gain: ${gainM} m`, ltx, r1 - glOff, 15, 600, WHITE, 'left', 'middle')
  text(`Loss: ${lossM} m`, ltx, r1 + glOff, 15, 600, DIM,   'left', 'middle')

  icon(ICON_POWER, licx, r2, iconSz, AMBER)
  text(pwV, ltx, r2, 18, 700, WHITE, 'left', 'middle')

  icon(ICON_PACE, licx, r3, iconSz, AMBER)
  text(`${paceStr}/km`, ltx, r3, 18, 700, WHITE, 'left', 'middle')

  // ── Right stats panel (value + icon, right-aligned) ───────────────────────────
  icon(ICON_ZAP,   ricx, r0, iconSz, AMBER)
  text(`${kcalStr} kcal`, rtx, r0, 18, 700, WHITE, 'right', 'middle')

  icon(ICON_FLAG,  ricx, r1, iconSz, AMBER)
  text(gradeStr,   rtx, r1, 18, 700, WHITE, 'right', 'middle')

  icon(ICON_GEAR,  ricx, r2, iconSz, AMBER)
  text('-- - --',  rtx, r2, 18, 700, WHITE, 'right', 'middle')

  icon(ICON_HEART, ricx, r3, iconSz, AMBER)
  text(`${hrV} bpm`, rtx, r3, 18, 700, WHITE, 'right', 'middle')

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
      text(String(eleM), cx + Math.round(8*s), cy, 15, 700, WHITE, 'left', 'middle')
    }
  }

  // ── Gauge geometry: mirrors CSS .hud-gauge { width: 18% } with viewBox 0 0 100 80
  // Circle cx=50 cy=47 r=36. Rendered scale = (W*0.18)/100.
  // Bottom row: position:absolute; bottom:0; height:30%; padding: 0 1% 1.5%.
  // CSS padding-% is relative to containing block WIDTH, so pad-bottom = 1.5% * W.
  const gaugeW    = Math.round(W * 0.18)           // rendered SVG width
  const gaugeH    = Math.round(gaugeW * 0.80)      // viewBox 100×80 → height = 0.8 * width
  const gaugeR    = Math.round(gaugeW * 0.36)      // r=36 in 100-unit viewBox
  const gaugeSW   = Math.max(2, Math.round(gaugeW * 0.05))  // stroke-width=5 in 100-unit viewBox
  const padBottom = Math.round(W * 0.015)          // 1.5% of W bottom padding
  const gaugeBotY = H - padBottom                  // SVG bottom edge (align-items:flex-end)
  const gaugeY    = gaugeBotY - Math.round(gaugeH * (33 / 80))  // cy=47, so 33/80 below center
  const gaugeX    = Math.round(W * 0.10)           // center: 1% pad + 18%/2 = 10% from left

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

  // ── Speed/RPM unit labels — mirrors .gauge-lbl (font-size: 0.85cqw) ────────
  const lblFontSz = Math.round(W * 0.0085)
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

  // CSS .hud-zones: flex:1; margin:0 2%; sits between two 18% gauges with 1% row padding.
  // Zones span from (1% + 18% + 2%) = 21% to (100% - 21%) = 79% → width = 58%.
  // .zones-bars { height: 62% } of the gauge container height (same as gauge SVG height).
  const zx     = Math.round(W * 0.21)                     // 21% from left
  const zw     = Math.round(W * 0.58)                     // 58% width
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
  const s = textScale(W, H)
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
    // CSS: .mini-val 2.8cqw→36, .mini-unit 0.9cqw→12, .mini-lbl 0.8cqw→10
    text(st.val,  cx, baseY - Math.round(32 * s), 36, 700, WHITE,  'center', 'bottom')
    text(st.unit, cx, baseY - Math.round(26 * s), 12, 600, DIM,    'center', 'top')
    text(st.lbl,  cx, baseY,                       10, 700, DIM,    'center', 'alphabetic')
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

function drawHudGoPro(ctx, W, H, point, pts, animIdx, progress, totalTime, trimStart, overlayColor = '#f59e0b', locationName = '', displayTime = null) {
  const hs = hudScaleFor(W, H)
  const s = textScale(W, H)
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

  // GPS coordinates (top center)
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  // CSS .gopro-coords: 0.85cqw→11
  text(`${latStr}   ${lonStr}`, W / 2, Math.round(16 * s), 11, 500, DIM, 'center', 'top')

  // Compass bearing (below coords) — center the [arrow | gap | text] group at W/2
  const { deg, cardinal } = computeBearing(pts, animIdx)
  const bearY   = Math.round(30 * s)
  const arrowH  = Math.round(18 * s), arrowW = Math.round(8 * s)
  const bearGap = Math.round(9 * s)
  const bearingStr = `${deg}°${cardinal}`
  ctx.font = `700 ${Math.round(24 * s)}px ${FONT}`
  const bearTextW = ctx.measureText(bearingStr).width
  // Group width = arrow + gap + text; center the whole group at W/2
  const arrowX = W / 2 - (arrowW / 2 + bearGap + bearTextW) / 2
  const bearTextX = arrowX + arrowW / 2 + bearGap
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
  // CSS .gopro-bearing-val: 1.9cqw→24
  text(bearingStr, bearTextX, bearY + arrowH * 0.55, 24, 700, WHITE, 'left', 'middle')

  // Left panel: Slope + Elevation
  const lx = Math.round(28 * s)
  const topPanelY = Math.round(H * 0.30)
  const panelGap  = Math.round(H * 0.14)

  const grade    = point?.grade ?? 0
  const slopeStr = `${Math.round(Math.abs(grade))}%`
  const eleStr   = `${Math.round(point?.ele ?? 0)} M`

  // CSS .gopro-stat-lbl: 0.85cqw→11, .gopro-stat-val: 2.1cqw→27
  text('SLOPE',    lx + Math.round(22 * s), topPanelY,                      11, 700, DIM,   'left', 'top')
  text(slopeStr,   lx + Math.round(22 * s), topPanelY + Math.round(17 * s), 27, 700, WHITE, 'left', 'top')
  text('ELEVATION', lx + Math.round(22 * s), topPanelY + panelGap,                      11, 700, DIM,   'left', 'top')
  text(eleStr,      lx + Math.round(22 * s), topPanelY + panelGap + Math.round(17 * s), 27, 700, WHITE, 'left', 'top')

  // CSS .gopro-datetime-time: 1.4cqw→18, .gopro-datetime-date: 0.85cqw→11
  const rawTime = displayTime
    ?? (point?.time instanceof Date ? point.time : point?.time ? new Date(point.time) : null)
  if (rawTime && !isNaN(rawTime)) {
    const timeStr = rawTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const dateStr = rawTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const dtY = topPanelY + panelGap * 2
    text(timeStr, lx + Math.round(22 * s), dtY,                       18, 700, WHITE, 'left', 'top')
    text(dateStr, lx + Math.round(22 * s), dtY + Math.round(22 * s),  11, 700, DIM,   'left', 'top')
  }

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
  // CSS wrap: width:clamp(100px,24cqw,460px); position:absolute; bottom:0; padding-bottom:0.5%
  const gaugeW  = Math.round(W * 0.24 * hs)                  // 24cqw matches CSS clamp midpoint
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
  const s = textScale(W, H)
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

  // Distance (top-left)
  const dist = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  text(dist, Math.round(20 * s), Math.round(20 * s), 36, 700, WHITE, 'left', 'top')
  text('KM', Math.round(20 * s) + ctx.measureText(dist).width + Math.round(6 * s), Math.round(24 * s), 13, 700, CYAN, 'left', 'top')

  // GPS coords (top-right, below map inset area)
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  text(lonStr, W - Math.round(W * 0.22) - Math.round(8 * s), Math.round(14 * s), 10, 500, CYAN_DIM, 'right', 'top')
  text(latStr, W - Math.round(W * 0.22) - Math.round(8 * s), Math.round(26 * s), 10, 500, CYAN_DIM, 'right', 'top')

  // Slope (center-left)
  const grade = point?.grade ?? 0
  text('SLOPE', Math.round(28 * s), Math.round(H * 0.42), 11, 700, 'rgba(255,255,255,0.6)', 'left', 'top')
  text(grade.toFixed(2), Math.round(28 * s), Math.round(H * 0.42) + Math.round(14 * s), 38, 700, WHITE, 'left', 'top')
  text('%', Math.round(28 * s), Math.round(H * 0.42) + Math.round(52 * s), 13, 700, CYAN, 'left', 'top')

  // Circular speed gauge (bottom-left)
  const gSize  = Math.round(W * 0.24 * hs)     // diameter
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
  const s = textScale(W, H)
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

  // Top-left: ELEVATION label + value
  const lx = Math.round(20 * s), ty = Math.round(14 * s)
  text('ELEVATION', lx, ty, 10, 700, TEAL, 'left', 'top')
  text(`${Math.round(point?.ele ?? 0)} M`, lx, ty + Math.round(14 * s), 27, 700, WHITE, 'left', 'top')

  // Top-right: TOTAL DISTANCE label + value
  const rx = W - Math.round(20 * s)
  const dist = ((point?.cumDist ?? 0) / 1000).toFixed(1)
  text('TOTAL DISTANCE', rx, ty, 10, 700, TEAL, 'right', 'top')
  text(`${dist} KM`, rx, ty + Math.round(14 * s), 27, 700, WHITE, 'right', 'top')

  // Top-center: compass rose
  const compassCX = W / 2, compassCY = Math.round(28 * s), compassR = Math.round(18 * s)
  ctx.beginPath(); ctx.arc(compassCX, compassCY, compassR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = Math.round(s); ctx.stroke()
  text('N', compassCX,                   compassCY - compassR * 0.80, 6, 700, 'rgba(255,255,255,0.55)', 'center', 'middle')
  text('S', compassCX,                   compassCY + compassR * 0.80, 5, 400, 'rgba(255,255,255,0.35)', 'center', 'middle')
  text('W', compassCX - compassR * 0.80, compassCY,                   5, 400, 'rgba(255,255,255,0.35)', 'center', 'middle')
  text('E', compassCX + compassR * 0.80, compassCY,                   5, 400, 'rgba(255,255,255,0.35)', 'center', 'middle')
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
  const gaugeSize = Math.round(W * 0.26 * hs)
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
  text('SPEED', gcx, gcy - r - Math.round(14 * s), 11, 700, TEAL_D, 'center', 'bottom')
  // Speed number (centered in arc)
  text(spd.toFixed(0), gcx, gcy - Math.round(r * 0.10), 36, 700, WHITE, 'center', 'middle')
  // "KM/H" below the speed number
  text('KM/H', gcx, gcy + Math.round(r * 0.30), 11, 700, TEAL_D, 'center', 'top')

  // Min/max labels on arc
  const lbR = r + Math.round(12 * s)
  text('0',  gcx + lbR * Math.cos(startA),           gcy + lbR * Math.sin(startA),           7, 600, TEAL_D, 'center', 'middle')
  text('60', gcx + lbR * Math.cos(startA + ARC_RAD), gcy + lbR * Math.sin(startA + ARC_RAD), 7, 600, TEAL_D, 'center', 'middle')

  // Center-right: SLOPE
  const sx = gcx + gaugeSize / 2 + Math.round(30 * s)
  const sy = gcy - r - Math.round(10 * s)
  const grade = point?.grade ?? 0
  text('SLOPE', sx, sy, 11, 700, 'rgba(255,255,255,0.65)', 'left', 'top')
  text(grade.toFixed(2), sx, sy + Math.round(16 * s), 49, 700, WHITE, 'left', 'top')
  text('%', sx, sy + Math.round(58 * s), 14, 700, TEAL, 'left', 'top')

  // Bottom: GPS coordinates
  const latStr = fmtDMS(point?.lat, 'N', 'S')
  const lonStr = fmtDMS(point?.lon, 'E', 'W')
  text(lonStr, Math.round(20 * s), H - Math.round(22 * s), 11, 500, 'rgba(255,255,255,0.55)', 'left', 'bottom')
  text(latStr, Math.round(20 * s), H - Math.round(10 * s), 11, 500, 'rgba(255,255,255,0.55)', 'left', 'bottom')

  drawLocationPill(ctx, W, H, s, locationName, 'cycling', overlayColor)
  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Sticker 2: full-route map (replaces inset) ───────────────────────────────
function drawMapFull(ctx, W, H, pts, animIdx, maxSpeed, segStart = 0, overlayColor = '#f59e0b') {
  const latMin = pts.reduce((a,p) => Math.min(a,p.lat), Infinity)
  const latMax = pts.reduce((a,p) => Math.max(a,p.lat), -Infinity)
  const lonMin = pts.reduce((a,p) => Math.min(a,p.lon), Infinity)
  const lonMax = pts.reduce((a,p) => Math.max(a,p.lon), -Infinity)
  const pad = Math.round(Math.min(W, H) * 0.08)
  const toXY = (lat, lon) => [
    pad + (lon - lonMin) / ((lonMax - lonMin) || 1) * (W - 2*pad),
    pad + (1 - (lat - latMin) / ((latMax - latMin) || 1)) * (H - 2*pad),
  ]

  ctx.fillStyle = 'rgba(0,8,20,0.87)'; ctx.fillRect(0, 0, W, H)

  // Glow pass
  ctx.beginPath()
  pts.forEach((p,i) => { const [x,y] = toXY(p.lat,p.lon); i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y) })
  ctx.shadowColor = overlayColor; ctx.shadowBlur = Math.round(W * 0.008)
  ctx.strokeStyle = hexToRgba(overlayColor, 0.22); ctx.lineWidth = Math.max(3, W * 0.005)
  ctx.stroke(); ctx.shadowBlur = 0

  // Full faint trail
  ctx.beginPath()
  pts.forEach((p,i) => { const [x,y] = toXY(p.lat,p.lon); i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y) })
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = Math.max(1, W * 0.0014); ctx.stroke()

  // Speed-colored traveled portion
  for (let i = Math.max(1, segStart); i <= animIdx && i < pts.length; i++) {
    const t = pts[i].speedSmooth / maxSpeed
    const r = Math.round(lerp(30,255,t)), g = Math.round(lerp(100,80,t)), b = Math.round(lerp(255,30,t))
    const [x0,y0] = toXY(pts[i-1].lat, pts[i-1].lon), [x1,y1] = toXY(pts[i].lat, pts[i].lon)
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1)
    ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = Math.max(1.5, W * 0.0024); ctx.stroke()
  }

  const mr = Math.max(4, Math.round(W * 0.006))

  const [sx,sy] = toXY(pts[0].lat, pts[0].lon)
  ctx.beginPath(); ctx.arc(sx, sy, mr, 0, Math.PI*2)
  ctx.fillStyle = '#00e676'; ctx.shadowColor = '#00e676'; ctx.shadowBlur = mr*1.5; ctx.fill(); ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(sx, sy, mr*1.8, 0, Math.PI*2)
  ctx.strokeStyle = 'rgba(0,230,118,0.35)'; ctx.lineWidth = Math.max(1, mr*0.25); ctx.stroke()

  const ep = pts[pts.length-1], [ex,ey] = toXY(ep.lat, ep.lon)
  ctx.beginPath(); ctx.arc(ex, ey, mr, 0, Math.PI*2)
  ctx.fillStyle = '#ff5252'; ctx.shadowColor = '#ff5252'; ctx.shadowBlur = mr*1.5; ctx.fill(); ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(ex, ey, mr*1.8, 0, Math.PI*2)
  ctx.strokeStyle = 'rgba(255,82,82,0.35)'; ctx.lineWidth = Math.max(1, mr*0.25); ctx.stroke()

  if (animIdx < pts.length) {
    const [cx,cy] = toXY(pts[animIdx].lat, pts[animIdx].lon)
    ctx.beginPath(); ctx.arc(cx, cy, mr*0.7, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.beginPath(); ctx.arc(cx, cy, mr*1.3, 0, Math.PI*2)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, mr*0.2); ctx.stroke()
  }
}

// ─── Sticker 1: Finisher card (right stats panel) ────────────────────────────
function drawHudSticker1(ctx, W, H, pts, totalTime, overlayColor = '#f59e0b', locationName = '') {
  if (!pts.length) return
  const hs = hudScaleFor(W, H)
  const s = textScale(W, H)
  ctx.save()
  const FONT  = '-apple-system, BlinkMacSystemFont, sans-serif'
  const AMBER = overlayColor
  const WHITE = '#ffffff'
  const DIM   = 'rgba(255,255,255,0.45)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Right gradient panel
  const gx = Math.round(W * 0.48)
  const grad = ctx.createLinearGradient(gx, 0, W, 0)
  grad.addColorStop(0,    'transparent')
  grad.addColorStop(0.18, 'rgba(0,0,0,0.80)')
  grad.addColorStop(1,    'rgba(0,0,0,0.92)')
  ctx.fillStyle = grad; ctx.fillRect(gx, 0, W - gx, H)

  const panelCX = Math.round(W * 0.745)

  const totalDist = ((pts[pts.length-1].cumDist / 1000).toFixed(1))
  const totalGain = Math.round(pts[pts.length-1].cumElevGain ?? 0)
  const hT = Math.floor(totalTime / 3600000), mT = Math.floor((totalTime % 3600000) / 60000)
  const timeStr = hT > 0 ? `${hT}h ${String(mT).padStart(2,'0')}m` : (mT > 0 ? `${mT}m` : '--')

  if (locationName) {
    text(locationName.split(',')[0].trim().toUpperCase(), panelCX, Math.round(H * 0.20), 14, 700, hexToRgba(AMBER, 0.9), 'center', 'middle')
  }

  // Large distance number
  const distY  = Math.round(H * 0.36)
  const distFS = Math.round(Math.min(W * 0.062 * hs, H * 0.09))
  ctx.font = `900 ${distFS}px ${FONT}`
  ctx.fillStyle = AMBER; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(10 * s)
  ctx.fillText(totalDist, panelCX, distY); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  const kmFS  = Math.round(distFS * 0.42)
  const finFS = Math.round(distFS * 0.22)
  ctx.font = `900 ${kmFS}px ${FONT}`
  ctx.fillStyle = AMBER; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(4 * s)
  ctx.fillText('KM', panelCX, distY + Math.round(2 * s))
  ctx.font = `800 ${finFS}px ${FONT}`; ctx.fillStyle = WHITE
  ctx.fillText('FINISHER', panelCX, distY + kmFS + Math.round(4 * s))
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(panelCX - Math.round(70*s), Math.round(H * 0.50))
  ctx.lineTo(panelCX + Math.round(70*s), Math.round(H * 0.50))
  ctx.stroke()

  // Stat rows
  const ICON_ELEV = 'M12 2 9 8h6L12 2zm0 20 3-6H9l3 6zM2 12l6-3v6L2 12zm20 0-6 3V9l6 3z'
  const ICON_CLK  = 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z'
  const ICON_PIN  = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
  const rows = [
    { icon: ICON_ELEV, lbl: 'ELEV GAIN', val: `${totalGain.toLocaleString()} m` },
    { icon: ICON_CLK,  lbl: 'TIME',      val: timeStr },
    { icon: ICON_PIN,  lbl: 'DISTANCE',  val: `${totalDist} km` },
  ]
  const statsTop = Math.round(H * 0.54), statsGap = Math.round(H * 0.145)
  const iSz = Math.round(30 * s), lx = panelCX - Math.round(85 * s)

  rows.forEach((st, i) => {
    const cy = statsTop + i * statsGap
    ctx.save()
    ctx.translate(lx, cy - iSz / 2); ctx.scale(iSz / 24, iSz / 24)
    ctx.fillStyle = hexToRgba(AMBER, 0.78)
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3
    ctx.fill(new Path2D(st.icon)); ctx.restore()
    const tx = lx + iSz + Math.round(9 * s)
    text(st.lbl, tx, cy - Math.round(8 * s), 10,  700, DIM,   'left', 'top')
    text(st.val, tx, cy + Math.round(6 * s), 31,  700, WHITE, 'left', 'top')
  })

  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Sticker 2: Route card (labels + stats over full-map canvas) ──────────────
function drawHudSticker2(ctx, W, H, pts, totalTime, overlayColor = '#f59e0b', locationName = '') {
  if (!pts.length) return
  const hs = hudScaleFor(W, H)
  const s = textScale(W, H)
  ctx.save()
  const FONT  = '-apple-system, BlinkMacSystemFont, sans-serif'
  const WHITE = '#ffffff'
  const DIM   = 'rgba(255,255,255,0.5)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'alphabetic') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  function fmtCoord(p) {
    if (!p) return '--'
    return `${Math.abs(p.lat).toFixed(3)}°${p.lat >= 0 ? 'N':'S'}  ${Math.abs(p.lon).toFixed(3)}°${p.lon >= 0 ? 'E':'W'}`
  }

  const pad = Math.round(10 * s), dotR = Math.round(6 * s)
  const bPad = Math.round(6 * s), bPadV = Math.round(4 * s)

  const totalDist = ((pts[pts.length-1].cumDist / 1000).toFixed(1))
  const totalGain = Math.round(pts[pts.length-1].cumElevGain ?? 0)
  const hT = Math.floor(totalTime / 3600000), mT = Math.floor((totalTime % 3600000) / 60000)
  const timeStr = hT > 0 ? `${hT}h ${String(mT).padStart(2,'0')}m` : (mT > 0 ? `${mT}m` : '--')

  // Stats box (top-right)
  const statsRows = [
    { lbl: 'DISTANCE',  val: `${totalDist} km` },
    { lbl: 'TIME',      val: timeStr },
    { lbl: 'ELEV GAIN', val: `${totalGain.toLocaleString()} m` },
  ]
  const rowH   = Math.round(22 * s)
  const statsW = Math.round(W * 0.25)
  const statsH = bPadV * 2 + statsRows.length * rowH
  const statsX = W - pad - statsW, statsY = pad

  ctx.save()
  rrect(ctx, statsX, statsY, statsW, statsH, Math.round(8 * s))
  ctx.fillStyle = 'rgba(0,0,0,0.70)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke()
  ctx.restore()
  statsRows.forEach((st, i) => {
    const y = statsY + bPadV + i * rowH + rowH / 2
    text(st.lbl, statsX + Math.round(8*s), y - Math.round(3*s), 10, 700, DIM,   'left', 'top')
    text(st.val, statsX + statsW - Math.round(8*s), y + Math.round(3*s), 18, 700, WHITE, 'right', 'bottom')
  })

  // Start badge (top-left)
  const sbW = Math.round(W * 0.35), sbH = Math.round(40 * s)
  ctx.save()
  rrect(ctx, pad, pad, sbW, sbH, Math.round(6 * s))
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke()
  ctx.restore()
  const sdCX = pad + bPad + dotR, sdCY = pad + sbH / 2
  ctx.beginPath(); ctx.arc(sdCX, sdCY, dotR, 0, Math.PI*2)
  ctx.fillStyle = '#00e676'; ctx.shadowColor = '#00e676'; ctx.shadowBlur = dotR*1.2; ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  const sTX = sdCX + dotR + Math.round(6*s)
  text('START',              sTX, sdCY - Math.round(5*s), 14, 800, WHITE, 'left', 'bottom')
  text(fmtCoord(pts[0]),     sTX, sdCY + Math.round(3*s), 10, 500, DIM,   'left', 'top')

  // End badge (bottom-right)
  const ebW = Math.round(W * 0.35), ebH = Math.round(40 * s)
  const ebX = W - pad - ebW, ebY = H - Math.round(38*s) - ebH
  ctx.save()
  rrect(ctx, ebX, ebY, ebW, ebH, Math.round(6 * s))
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke()
  ctx.restore()
  const edCX = ebX + bPad + dotR, edCY = ebY + ebH / 2
  ctx.beginPath(); ctx.arc(edCX, edCY, dotR, 0, Math.PI*2)
  ctx.fillStyle = '#ff5252'; ctx.shadowColor = '#ff5252'; ctx.shadowBlur = dotR*1.2; ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  const eTX = edCX + dotR + Math.round(6*s)
  text('END',                        eTX, edCY - Math.round(5*s), 14, 800, WHITE, 'left', 'bottom')
  text(fmtCoord(pts[pts.length-1]), eTX, edCY + Math.round(3*s), 10, 500, DIM,   'left', 'top')

  if (locationName) text(locationName.toUpperCase(), W/2, H/2, 23, 900, WHITE, 'center', 'middle')

  drawWatermark(ctx, W, H, s)
  ctx.restore()
}

// ─── Tactical HUD ────────────────────────────────────────────────────────────
function drawHudTac(ctx, W, H, point, pts, animIdx, progress, totalTime, overlayColor = '#f59e0b') {
  const hs = hudScaleFor(W, H)
  const s  = textScale(W, H)
  ctx.save()
  const FONT  = '-apple-system, BlinkMacSystemFont, sans-serif'
  const WHITE = '#ffffff'
  const DIM   = 'rgba(255,255,255,0.42)'
  const DIM2  = 'rgba(255,255,255,0.32)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'top') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = Math.round(5 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  // Outer border
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = Math.max(1, Math.round(s))
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

  // Corner bracket size
  const C = Math.round(Math.min(30, W * 0.022))
  const BW = Math.max(1.5, Math.round(2 * s))
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = BW
  const corners = [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]
  for (const [ox, oy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(ox + dx * C, oy); ctx.lineTo(ox, oy); ctx.lineTo(ox, oy + dy * C)
    ctx.stroke()
  }

  const BOTTOM_H = H * 0.12
  const CONTENT_BOT = H - BOTTOM_H
  const LEFT_W  = W * 0.26
  const RIGHT_W = W * 0.26
  const PAD_X = Math.round(Math.max(8, W * 0.014))
  const PAD_Y = Math.round(Math.max(8, H * 0.014))

  // Left panel background gradient
  const lgrd = ctx.createLinearGradient(0, 0, LEFT_W, 0)
  lgrd.addColorStop(0, 'rgba(0,0,0,0.68)'); lgrd.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lgrd; ctx.fillRect(0, 0, LEFT_W, CONTENT_BOT)

  // Right panel background gradient
  const rgrd = ctx.createLinearGradient(W - RIGHT_W, 0, W, 0)
  rgrd.addColorStop(0, 'rgba(0,0,0,0)'); rgrd.addColorStop(1, 'rgba(0,0,0,0.68)')
  ctx.fillStyle = rgrd; ctx.fillRect(W - RIGHT_W, 0, RIGHT_W, CONTENT_BOT)

  // Bottom strip
  ctx.fillStyle = 'rgba(0,0,0,0.52)'
  ctx.fillRect(0, CONTENT_BOT, W, BOTTOM_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, CONTENT_BOT); ctx.lineTo(W, CONTENT_BOT); ctx.stroke()

  // Vertical dividers
  const vgrd = ctx.createLinearGradient(0, H * 0.04, 0, CONTENT_BOT)
  vgrd.addColorStop(0, 'rgba(255,255,255,0)'); vgrd.addColorStop(0.15, 'rgba(255,255,255,0.22)')
  vgrd.addColorStop(0.85, 'rgba(255,255,255,0.22)'); vgrd.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = vgrd; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(LEFT_W, H * 0.04); ctx.lineTo(LEFT_W, CONTENT_BOT); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W - RIGHT_W, H * 0.04); ctx.lineTo(W - RIGHT_W, CONTENT_BOT); ctx.stroke()

  // ── Left panel ──────────────────────────────────────────────────────────────
  const spd = point?.speedSmooth ?? 0
  const dist = (point?.cumDist ?? 0) / 1000
  const grade = point?.grade ?? 0
  const paceStr = spd > 0.5 ? (() => { const pm = 60 / spd; const mm = Math.floor(pm); return `${mm}:${String(Math.round((pm-mm)*60)).padStart(2,'0')}` })() : '--'

  // Font sizes derived from CSS cqw values: size = cqw * 12.8 (reference width 1280px)
  // .tac-lbl / .tac-unit: 0.78cqw → 10, .tac-big: 5.8cqw → 74, .tac-big--md: 3.4cqw → 44
  // .tac-mini-lbl: 0.65cqw → 8, .tac-mini-val: 0.92cqw → 12
  // .tac-rlbl: 0.65cqw → 8, .tac-rval: 2.8cqw → 36, .tac-bval: 0.72cqw → 9
  const LBL_SZ   = 10
  const BIG_SZ   = 74
  const MD_SZ    = 44
  const MINI_L   = 8
  const MINI_V   = 12
  const R_LBL    = 8
  const R_VAL    = 36
  const BOT_SZ   = 9

  let ly = PAD_Y
  text('SPEED', PAD_X, ly, LBL_SZ, 700, DIM)
  ly += Math.round(12 * s)
  text(spd.toFixed(0), PAD_X, ly, BIG_SZ, 800, WHITE)
  ly += Math.round(80 * s)
  text('KM/H', PAD_X, ly, LBL_SZ, 700, DIM2)
  ly += Math.round(18 * s)

  // Separator
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(PAD_X, ly, LEFT_W - PAD_X * 2, 1); ly += Math.round(10 * s)

  // Mini rows
  text('GRADE', PAD_X, ly, MINI_L, 700, DIM2)
  text(`${grade.toFixed(1)}%`, LEFT_W - PAD_X, ly, MINI_V, 700, 'rgba(255,255,255,0.82)', 'right')
  ly += Math.round(17 * s)
  text('PACE', PAD_X, ly, MINI_L, 700, DIM2)
  text(paceStr, LEFT_W - PAD_X, ly, MINI_V, 700, 'rgba(255,255,255,0.82)', 'right')
  ly += Math.round(17 * s)

  // Separator
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(PAD_X, ly, LEFT_W - PAD_X * 2, 1); ly += Math.round(10 * s)

  text('DISTANCE', PAD_X, ly, LBL_SZ, 700, DIM)
  ly += Math.round(12 * s)
  text(dist.toFixed(2), PAD_X, ly, MD_SZ, 800, WHITE)
  ly += Math.round(48 * s)
  text('KM', PAD_X, ly, LBL_SZ, 700, DIM2)

  // ── Right panel ─────────────────────────────────────────────────────────────
  const ele = Math.round(point?.ele ?? 0)
  const totalDist = (pts[pts.length - 1]?.cumDist ?? 0) / 1000
  const remain = Math.max(0, totalDist - dist)
  const hr = point?.hr
  const cad = point?.cadence
  let elevGain = 0
  for (let i = Math.max(1, 0); i <= animIdx && i < pts.length; i++) {
    const d = (pts[i].ele ?? 0) - (pts[i-1].ele ?? 0)
    if (d > 0) elevGain += d
  }

  const rStats = [
    { lbl: 'ELEVATION', val: `${ele}`, unit: 'M' },
    { lbl: 'REMAIN',    val: remain.toFixed(1), unit: 'KM' },
    { lbl: hr != null ? 'HEART RATE' : 'ELEV GAIN', val: hr != null ? String(Math.round(hr)) : String(Math.round(elevGain)), unit: hr != null ? 'BPM' : 'M' },
    { lbl: cad != null ? 'CADENCE' : 'GRADE', val: cad != null ? String(Math.round(cad)) : `${grade.toFixed(1)}`, unit: cad != null ? 'RPM' : '%' },
  ]

  const rightRowH = (CONTENT_BOT - PAD_Y * 2) / rStats.length
  const rx = W - RIGHT_W + PAD_X
  for (let i = 0; i < rStats.length; i++) {
    const ry = PAD_Y + i * rightRowH
    text(rStats[i].lbl, rx, ry, R_LBL, 700, DIM2)
    const valY = ry + Math.round(10 * s)
    text(rStats[i].val, rx, valY, R_VAL, 800, WHITE)
    const valW = ctx.measureText(rStats[i].val).width
    const unitSz = Math.round(R_VAL * 0.38)  // .tac-runit: 0.38em of rval
    text(` ${rStats[i].unit}`, rx + valW, valY + Math.round(22 * s), unitSz, 600, DIM2, 'left', 'bottom')
    // Separator (not after last item)
    if (i < rStats.length - 1) {
      const sepY = ry + rightRowH - Math.round(2 * s)
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(rx, sepY, RIGHT_W - PAD_X * 2, 1)
    }
  }

  // ── Bottom strip ─────────────────────────────────────────────────────────────
  const progBarY = CONTENT_BOT + Math.round(BOTTOM_H * 0.28)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(PAD_X, progBarY, W - PAD_X * 2, 1)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillRect(PAD_X, progBarY, (W - PAD_X * 2) * Math.min(1, progress), 1)

  const labelY = CONTENT_BOT + Math.round(BOTTOM_H * 0.55)
  const elapsedSec = progress * totalTime
  const timeCur  = fmtTime(elapsedSec * 1000)
  const timeTotal = fmtTime(totalTime * 1000)
  text(timeCur,           PAD_X,       labelY, BOT_SZ, 600, DIM, 'left', 'top')
  text(`${totalDist.toFixed(1)} KM`, W / 2, labelY, BOT_SZ, 600, DIM, 'center', 'top')
  text(timeTotal,         W - PAD_X,   labelY, BOT_SZ, 600, DIM, 'right', 'top')

  ctx.restore()
}

// ─── Dashboard HUD ───────────────────────────────────────────────────────────
function drawHudDashboard(ctx, W, H, point, pts, animIdx, progress, totalTime, overlayColor = '#f59e0b') {
  const hs = hudScaleFor(W, H)
  const s  = textScale(W, H)
  ctx.save()
  const FONT  = '-apple-system, BlinkMacSystemFont, sans-serif'
  const WHITE = '#ffffff'
  const ACCENT = overlayColor
  const DIM    = 'rgba(255,255,255,0.38)'

  function text(str, x, y, size, weight, color, align = 'left', baseline = 'top') {
    ctx.font = `${weight} ${Math.round(size * s)}px ${FONT}`
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = Math.round(4 * s)
    ctx.fillText(str, x, y)
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
  }

  const PROG_H  = Math.round(Math.max(22, H * 0.028))  // progress row at very bottom
  const BAR_H   = H * 0.34                              // main bar height
  const BAR_Y   = H - PROG_H - BAR_H                   // bar top y

  // Main bar background
  ctx.fillStyle = 'rgba(0,0,0,0.82)'
  ctx.fillRect(0, BAR_Y, W, BAR_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, BAR_Y); ctx.lineTo(W, BAR_Y); ctx.stroke()

  // Panel layout: 4 panels × 14% + center flex
  const PANEL_W = W * 0.14
  const panels = [
    { x: 0,                                right: false },
    { x: PANEL_W,                          right: false },
    { x: PANEL_W * 4,                      right: false },  // far right
    { x: PANEL_W * 3,                      right: false },  // right of center
  ]

  const spd   = point?.speedSmooth ?? 0
  const dist  = (point?.cumDist ?? 0) / 1000
  const ele   = Math.round(point?.ele ?? 0)
  const grade = point?.grade ?? 0
  const hr    = point?.hr
  const cad   = point?.cadence
  const pwr   = point?.power
  const paceStr = spd > 0.5 ? (() => { const pm = 60 / spd; const mm = Math.floor(pm); return `${mm}:${String(Math.round((pm-mm)*60)).padStart(2,'0')}` })() : '--'
  const hrStr = hr  != null ? String(Math.round(hr))  : '--'
  const cadStr = cad != null ? String(Math.round(cad)) : '--'
  const pwrStr = pwr != null ? String(Math.round(pwr)) : '--'

  const PANPAD = Math.round(Math.max(6, W * 0.008))
  const MID_Y  = BAR_Y + BAR_H / 2
  const DIV_Y  = MID_Y

  function drawPanelStat(lbl, val, unit, cx, cy, big, showUnit = true) {
    const lblSz = 8, valSzB = 41, valSzN = 26
    const valSz = big ? valSzB : valSzN
    text(lbl,  cx, cy - Math.round(valSz * s * 0.6) - Math.round(10 * s), lblSz, 700, DIM, 'center', 'bottom')
    text(val,  cx, cy - Math.round(valSz * s * 0.5), valSz, big ? 800 : 700, big ? hexToRgba(overlayColor, val === '--' ? 0.35 : 1) : ACCENT, 'center', 'middle')
    if (showUnit && unit) text(unit, cx, cy + Math.round(valSz * s * 0.55), 9, 600, DIM, 'center', 'top')
  }

  // Panel vertical dividers
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
  for (const x of [PANEL_W, PANEL_W * 2, W - PANEL_W * 2, W - PANEL_W]) {
    ctx.beginPath(); ctx.moveTo(x, BAR_Y); ctx.lineTo(x, H - PROG_H); ctx.stroke()
  }
  // Horizontal dividers inside each side panel
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  for (const x of [PANEL_W / 2, PANEL_W * 1.5, W - PANEL_W * 1.5, W - PANEL_W / 2]) {
    ctx.beginPath(); ctx.moveTo(x - PANEL_W * 0.38, DIV_Y); ctx.lineTo(x + PANEL_W * 0.38, DIV_Y); ctx.stroke()
  }

  // Panel 0 (left): HEART RATE (big) + SPEED
  const p0cx = PANEL_W / 2
  drawPanelStat('HEART RATE', hrStr, 'bpm', p0cx, BAR_Y + BAR_H * 0.28, true)
  drawPanelStat('SPEED', spd.toFixed(0), 'km/h', p0cx, BAR_Y + BAR_H * 0.75, false)

  // Panel 1: CADENCE + POWER
  const p1cx = PANEL_W * 1.5
  drawPanelStat('CADENCE', cadStr, 'rpm', p1cx, BAR_Y + BAR_H * 0.28, false)
  drawPanelStat('POWER', pwrStr, 'w',   p1cx, BAR_Y + BAR_H * 0.75, false)

  // Center: elevation sparkline
  const CX = PANEL_W * 2, CW = W - PANEL_W * 4
  if (pts.length > 1) {
    const eles = pts.map(p => p.ele ?? 0)
    const eMin = Math.min(...eles), eMax = Math.max(...eles)
    const eRange = eMax - eMin || 1
    const CY2 = H - PROG_H, chartH = BAR_H * 0.72
    const cTopY = BAR_Y + BAR_H * 0.14

    ctx.beginPath()
    pts.forEach((p, i) => {
      const px = CX + (i / (pts.length - 1)) * CW
      const py = cTopY + chartH * (1 - ((p.ele ?? 0) - eMin) / eRange)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    })
    ctx.strokeStyle = hexToRgba(overlayColor, 0.35); ctx.lineWidth = Math.max(1, Math.round(1.5 * s))
    ctx.lineCap = 'round'; ctx.stroke()

    // Filled area under line up to current position
    const curPx = CX + animIdx / (pts.length - 1) * CW
    ctx.beginPath()
    for (let i = 0; i <= animIdx && i < pts.length; i++) {
      const px = CX + (i / (pts.length - 1)) * CW
      const py = cTopY + chartH * (1 - ((pts[i].ele ?? 0) - eMin) / eRange)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.lineTo(curPx, cTopY + chartH); ctx.lineTo(CX, cTopY + chartH); ctx.closePath()
    ctx.fillStyle = hexToRgba(overlayColor, 0.08); ctx.fill()

    // Current position marker
    const curPy = cTopY + chartH * (1 - ((pts[animIdx]?.ele ?? 0) - eMin) / eRange)
    ctx.beginPath(); ctx.arc(curPx, curPy, Math.max(2.5, 3 * s), 0, Math.PI * 2)
    ctx.fillStyle = ACCENT; ctx.fill()
  }

  // Panel 2 (right of center): ELEVATION + GRADE
  const p2cx = W - PANEL_W * 1.5
  drawPanelStat('ELEVATION', String(ele), 'm',   p2cx, BAR_Y + BAR_H * 0.28, false)
  drawPanelStat('GRADE',     `${grade.toFixed(1)}%`, '', p2cx, BAR_Y + BAR_H * 0.75, false, false)

  // Panel 3 (far right): DISTANCE (big) + PACE
  const p3cx = W - PANEL_W / 2
  drawPanelStat('DISTANCE', dist.toFixed(1), 'km', p3cx, BAR_Y + BAR_H * 0.28, true)
  drawPanelStat('PACE', paceStr, '/km',            p3cx, BAR_Y + BAR_H * 0.75, false)

  // Progress row
  ctx.fillStyle = 'rgba(0,0,0,0.88)'
  ctx.fillRect(0, H - PROG_H, W, PROG_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, H - PROG_H); ctx.lineTo(W, H - PROG_H); ctx.stroke()

  const fillW = W * Math.min(1, progress)
  ctx.fillStyle = ACCENT; ctx.fillRect(0, H - PROG_H, fillW, Math.round(3 * s))

  ctx.restore()
}

// ─── Location pill ────────────────────────────────────────────────────────────
// Mirrors the CSS .hud-location — each comma-separated part on its own line.
function drawLocationPill(ctx, W, H, s, locationName, overlayFormat, overlayColor = '#00ff88') {
  if (!locationName) return

  const parts = locationName.split(',').map(p => p.trim()).filter(Boolean)

  const FONT     = '-apple-system, BlinkMacSystemFont, sans-serif'
  const fontSize = Math.round(9 * s)
  const lineH    = Math.round(fontSize * 1.3)   // CSS line-height: 1.3
  const lineGap  = Math.round(1 * s)            // CSS gap: 1px between lines
  const pinW     = Math.round(9 * s)
  const pinH     = Math.round(12 * s)
  const padH     = Math.round(3 * s)
  const padL     = Math.round(6 * s)
  const padR     = Math.round(9 * s)
  const gap      = Math.round(4 * s)
  const maxLineW = W * 0.40 - pinW - gap - padL - padR

  ctx.save()
  ctx.font = `600 ${fontSize}px ${FONT}`

  // Measure each line and clamp to maxLineW
  const lineWidths = parts.map(p => Math.min(ctx.measureText(p).width, maxLineW))
  const textW      = Math.max(...lineWidths)
  const textBlockH = parts.length * lineH + (parts.length - 1) * lineGap
  const pillW      = padL + pinW + gap + textW + padR
  const pillH      = Math.max(pinH, textBlockH) + padH * 2

  // Always bottom-left — matches Vue locationStyle: { bottom: '8px', left: '8px' }
  const px = Math.round(8 * s)
  const py = H - pillH - Math.round(8 * s)

  // Pill background
  const radius = Math.round(4 * s)   // CSS border-radius: 4px
  ctx.globalAlpha = 0.85
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  rrect(ctx, px, py, pillW, pillH, radius)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = Math.max(0.5, 0.5 * s)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Pin icon — aligns to top of text block (flex-start)
  const pinX    = px + padL
  const textX   = px + padL + pinW + gap
  const textTopY = py + (pillH - textBlockH) / 2
  const pinY    = textTopY + (lineH - pinH) / 2  // vertically center pin within first line
  const ps      = pinH / 16                       // 12×16 viewBox → scale to pinH

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
  ctx.fillStyle = overlayColor
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur  = Math.round(3 * s) / ps
  ctx.fill('evenodd')
  ctx.restore()
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'

  // Each comma-part on its own line
  ctx.save()
  ctx.rect(textX, py, textW + 1, pillH)
  ctx.clip()
  ctx.font = `600 ${fontSize}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur  = Math.round(3 * s)
  parts.forEach((part, i) => {
    const lineY = textTopY + i * (lineH + lineGap)
    ctx.fillText(part, textX, lineY)
  })
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
