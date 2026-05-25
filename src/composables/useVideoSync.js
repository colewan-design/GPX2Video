import { ref, computed, watch } from 'vue'
import { parseMp4CreationTime } from '../utils/mp4.js'

export function useVideoSync(gpxPoints) {
  const videoSrc           = ref(null)
  const playing            = ref(false)
  const animIdx            = ref(0)
  const progress           = ref(0)   // trim-relative 0→1 (drives HUD bar)
  const videoAbsProgress   = ref(0)   // absolute 0→1 over full video (drives strip playhead)
  const autoOffsetSec      = ref(null)
  const manualOffsetSec = ref(0)
  const autoDetected    = ref(false)

  // GPX trim range (indices into gpxPoints)
  const trimStart = ref(0)
  const trimEnd   = ref(0)

  // Video-level trim (seconds within the video file)
  const videoDuration  = ref(0)
  const videoTrimStart = ref(0)
  const videoTrimEnd   = ref(0)

  function setVideoDuration(d) {
    videoDuration.value  = d
    videoTrimStart.value = 0
    videoTrimEnd.value   = d
  }

  // Keep trim range valid when GPX points change
  watch(gpxPoints, (pts) => {
    trimStart.value = 0
    trimEnd.value   = Math.max(0, pts.length - 1)
  }, { immediate: true })

  const totalOffsetSec = computed(() => (autoOffsetSec.value ?? 0) + manualOffsetSec.value)

  // Remember last video time so we can re-evaluate when trim handles move
  let lastCurrentTime = 0
  let lastDuration    = 1

  // Re-apply last known time whenever trim changes (updates stats immediately on drag)
  watch([trimStart, trimEnd], () => {
    if (videoSrc.value) _applyTime(lastCurrentTime, lastDuration)
  })

  // GPX point indices that correspond to [videoTrimStart, videoTrimEnd] in the video
  const gpxWindowIdx = computed(() => {
    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time || !videoSrc.value) {
      return { start: trimStart.value, end: trimEnd.value }
    }
    const base   = pts[0].time.getTime()
    const N      = pts.length - 1
    const vStart = videoTrimStart.value
    const vEnd   = videoTrimEnd.value > vStart ? videoTrimEnd.value : Math.max(1, videoDuration.value)

    const find = (ms) => {
      let lo = 0, hi = N
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        pts[mid].time.getTime() < ms ? (lo = mid + 1) : (hi = mid)
      }
      return Math.max(0, Math.min(N, lo))
    }

    return {
      start: find(base + (totalOffsetSec.value + vStart) * 1000),
      end:   find(base + (totalOffsetSec.value + vEnd)   * 1000),
    }
  })

  // Move the GPX window by updating manualOffsetSec so that the window
  // start aligns with newStartFrac (0-1 fraction of the full GPX track).
  function setGpxWindowStart(frac) {
    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return
    const N   = Math.max(1, pts.length - 1)
    const idx = Math.max(0, Math.min(N, Math.round(frac * N)))
    const gpxTimeSec = (pts[idx].time.getTime() - pts[0].time.getTime()) / 1000
    manualOffsetSec.value = gpxTimeSec - videoTrimStart.value - (autoOffsetSec.value ?? 0)
  }

  // Keep trimStart/trimEnd locked to the GPX window while video is loaded
  watch(gpxWindowIdx, ({ start, end }) => {
    if (!videoSrc.value) return
    trimStart.value = start
    trimEnd.value   = end
  })

  async function loadVideo(file) {
    if (videoSrc.value) URL.revokeObjectURL(videoSrc.value)
    videoSrc.value    = URL.createObjectURL(file)
    playing.value     = false
    animIdx.value     = trimStart.value
    progress.value    = 0
    autoOffsetSec.value   = null
    autoDetected.value    = false
    manualOffsetSec.value = 0

    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return

    const creationTime = await parseMp4CreationTime(file)
    if (creationTime) {
      autoOffsetSec.value = (creationTime.getTime() - pts[0].time.getTime()) / 1000
      autoDetected.value  = true
    }
  }

  function onTimeUpdate(currentTimeSec, durationSec) {
    lastCurrentTime = currentTimeSec
    lastDuration    = Math.max(1, durationSec)
    _applyTime(currentTimeSec, durationSec)
  }

  function _applyTime(currentTimeSec, durationSec) {
    const pts = gpxPoints.value
    if (!pts.length) return

    const tStart = trimStart.value
    const tEnd   = trimEnd.value

    let idx
    if (pts[0].time) {
      const targetMs =
        pts[0].time.getTime() + (totalOffsetSec.value + currentTimeSec) * 1000
      let lo = 0, hi = pts.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (pts[mid].time.getTime() < targetMs) lo = mid + 1
        else hi = mid
      }
      idx = lo
    } else {
      idx = Math.max(0, Math.min(
        Math.round((currentTimeSec / durationSec) * (pts.length - 1)),
        pts.length - 1
      ))
    }

    // If the sync/offset hasn't aligned the video with the GPX trim window,
    // fall back to a linear mapping so stats always advance during playback.
    if (idx < tStart || idx > tEnd) {
      const vStart = videoTrimStart.value
      const vEnd   = videoTrimEnd.value > vStart ? videoTrimEnd.value : Math.max(1, durationSec)
      const rel    = Math.max(0, Math.min((currentTimeSec - vStart) / (vEnd - vStart), 1))
      idx = Math.round(tStart + rel * (tEnd - tStart))
    }

    animIdx.value          = Math.max(tStart, Math.min(idx, tEnd))
    videoAbsProgress.value = durationSec > 0 ? currentTimeSec / durationSec : 0

    const vStart = videoTrimStart.value
    const vEnd   = Math.max(vStart + 0.001, videoTrimEnd.value)
    progress.value = Math.max(0, Math.min((currentTimeSec - vStart) / (vEnd - vStart), 1))
  }

  /**
   * Convert a GPX point index back to the video timestamp (seconds).
   * Used to seek the video when the user drags a trim handle.
   */
  function gpxIdxToVideoTime(idx) {
    const pts = gpxPoints.value
    if (!pts.length) return 0
    const p = pts[Math.max(0, Math.min(idx, pts.length - 1))]
    if (pts[0].time && p?.time) {
      return (p.time.getTime() - pts[0].time.getTime()) / 1000 - totalOffsetSec.value
    }
    // No-timestamp fallback: linear
    return (idx / Math.max(1, pts.length - 1)) * lastDuration
  }

  function cleanup() {
    if (videoSrc.value) URL.revokeObjectURL(videoSrc.value)
    videoSrc.value        = null
    playing.value            = false
    animIdx.value            = 0
    progress.value           = 0
    videoAbsProgress.value   = 0
    autoOffsetSec.value      = null
    autoDetected.value    = false
    manualOffsetSec.value = 0
    lastCurrentTime       = 0
    lastDuration          = 1
    trimStart.value       = 0
    trimEnd.value         = Math.max(0, gpxPoints.value.length - 1)
    videoDuration.value   = 0
    videoTrimStart.value  = 0
    videoTrimEnd.value    = 0
  }

  return {
    videoSrc,
    playing,
    animIdx,
    progress,
    videoAbsProgress,
    autoOffsetSec,
    manualOffsetSec,
    autoDetected,
    totalOffsetSec,
    trimStart,
    trimEnd,
    videoDuration,
    videoTrimStart,
    videoTrimEnd,
    setVideoDuration,
    gpxWindowIdx,
    setGpxWindowStart,
    loadVideo,
    onTimeUpdate,
    gpxIdxToVideoTime,
    cleanup,
  }
}
