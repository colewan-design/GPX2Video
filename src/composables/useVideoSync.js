import { ref, computed } from 'vue'
import { parseMp4CreationTime } from '../utils/mp4.js'

export function useVideoSync(gpxPoints) {
  const videoSrc = ref(null)
  const playing = ref(false)
  const animIdx = ref(0)
  const progress = ref(0)
  const autoOffsetSec = ref(null)  // null = could not detect from metadata
  const manualOffsetSec = ref(0)   // user-adjusted seconds
  const autoDetected = ref(false)

  // Total seconds to shift: positive = GPS started N sec before video
  const totalOffsetSec = computed(() => (autoOffsetSec.value ?? 0) + manualOffsetSec.value)

  async function loadVideo(file) {
    if (videoSrc.value) URL.revokeObjectURL(videoSrc.value)
    videoSrc.value = URL.createObjectURL(file)
    playing.value = false
    animIdx.value = 0
    progress.value = 0
    autoOffsetSec.value = null
    autoDetected.value = false
    manualOffsetSec.value = 0

    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return

    const creationTime = await parseMp4CreationTime(file)
    if (creationTime) {
      // How far (sec) is the video's t=0 from the first GPX point's timestamp.
      // Positive = GPS started before the video recording began.
      autoOffsetSec.value = (creationTime.getTime() - pts[0].time.getTime()) / 1000
      autoDetected.value = true
    }
  }

  function onTimeUpdate(currentTimeSec, durationSec) {
    const pts = gpxPoints.value
    if (!pts.length) return

    if (pts[0].time) {
      // Timestamp-based: find the GPX point whose time is closest to
      // (gpxStart + totalOffset + currentTime)
      const targetMs =
        pts[0].time.getTime() + (totalOffsetSec.value + currentTimeSec) * 1000

      let lo = 0
      let hi = pts.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (pts[mid].time.getTime() < targetMs) lo = mid + 1
        else hi = mid
      }
      animIdx.value = Math.max(0, Math.min(lo, pts.length - 1))
    } else {
      // No-timestamp fallback: linear stretch over the video duration
      animIdx.value = Math.max(
        0,
        Math.min(
          Math.round((currentTimeSec / durationSec) * (pts.length - 1)),
          pts.length - 1
        )
      )
    }

    progress.value = durationSec > 0 ? currentTimeSec / durationSec : 0
  }

  function cleanup() {
    if (videoSrc.value) URL.revokeObjectURL(videoSrc.value)
    videoSrc.value = null
    playing.value = false
    animIdx.value = 0
    progress.value = 0
    autoOffsetSec.value = null
    autoDetected.value = false
    manualOffsetSec.value = 0
  }

  return {
    videoSrc,
    playing,
    animIdx,
    progress,
    autoOffsetSec,
    manualOffsetSec,
    autoDetected,
    totalOffsetSec,
    loadVideo,
    onTimeUpdate,
    cleanup,
  }
}
