import { ref, computed, watch } from 'vue'
import { parseMp4CreationTime } from '../utils/mp4.js'

export function useVideoSync(gpxPoints) {
  // Each segment = one video file's contribution to the concatenated timeline
  const segments       = ref([])   // { src, duration, offset }
  const activeSegIdx   = ref(0)

  const playing          = ref(false)
  const animIdx          = ref(0)
  const progress         = ref(0)   // trim-relative 0→1 (drives HUD bar)
  const videoAbsProgress = ref(0)   // absolute 0→1 over full timeline
  const autoOffsetSec       = ref(null)
  const manualOffsetSec     = ref(0)
  const autoDetected        = ref(false)
  const autoDetectSource    = ref(null)   // 'mp4' | 'filedate' | null
  let   pendingLastModified = null        // file.lastModified saved until duration is known

  const trimStart = ref(0)
  const trimEnd   = ref(0)

  // clips: intervals in absolute concatenated-timeline seconds
  const clips          = ref([])
  const currentAbsTime = ref(0)
  // raw video position that maps to the visual left edge of the strip
  // accumulates when clips at the beginning are deleted
  const timelineShift  = ref(0)

  // ── Derived ───────────────────────────────────────────────────────────────────
  const videoSrc = computed(() => segments.value[activeSegIdx.value]?.src ?? null)

  const videoDuration = computed(() =>
    segments.value.reduce((sum, s) => sum + s.duration, 0)
  )

  const videoTrimStart = computed(() => clips.value[0]?.start ?? 0)
  const videoTrimEnd   = computed(() => clips.value[clips.value.length - 1]?.end ?? videoDuration.value)

  const currentSegOffset = computed(() => segments.value[activeSegIdx.value]?.offset ?? 0)

  const activeClipIndex = computed(() => {
    const t = currentAbsTime.value
    const c = clips.value
    for (let i = 0; i < c.length; i++) {
      if (t >= c[i].start && t <= c[i].end) return i
    }
    return Math.max(0, c.length - 1)
  })

  // ── Segment management ────────────────────────────────────────────────────────

  // Called from App.vue after first segment's loadedmetadata
  function setVideoDuration(d) {
    if (!segments.value.length) return
    segments.value = [{ ...segments.value[0], duration: d }]
    clips.value = [{ start: 0, end: d, segmentIdx: 0, segStart: 0 }]

    // Fallback: use file.lastModified as recording-end time when no MP4 timestamp was found
    if (autoOffsetSec.value === null && pendingLastModified !== null) {
      const pts = gpxPoints.value
      if (pts.length && pts[0].time) {
        const videoStartMs  = pendingLastModified - d * 1000
        autoOffsetSec.value = (videoStartMs - pts[0].time.getTime()) / 1000
        autoDetected.value  = true
        autoDetectSource.value = 'filedate'
      }
      pendingLastModified = null
    }
  }

  // Append a new segment to the end of the timeline
  function addSegment(src, duration, name = '') {
    const offset = videoDuration.value
    const segIdx = segments.value.length
    segments.value = [...segments.value, { src, duration, offset, name }]
    clips.value    = [...clips.value, { start: offset, end: offset + duration, segmentIdx: segIdx, segStart: 0 }]
  }

  // Advance to next segment; returns true if successfully advanced
  function advanceSegment() {
    if (activeSegIdx.value < segments.value.length - 1) {
      activeSegIdx.value++
      return true
    }
    return false
  }

  // Seek to an absolute timeline position using clip metadata.
  // Switches activeSegIdx if needed; returns { localTime, segmentChanged }
  function seekToAbsolute(absoluteSec) {
    const c = clips.value
    if (!c.length) return { localTime: 0, segmentChanged: false }

    // Use exclusive end so that a boundary time (= next clip's start) resolves to the next clip
    let clip = c.find(cl => absoluteSec >= cl.start && absoluteSec < cl.end)
    if (!clip) clip = absoluteSec <= c[0].start ? c[0] : c[c.length - 1]

    const localOffset  = Math.max(0, Math.min(absoluteSec - clip.start, clip.end - clip.start))
    const segLocalTime = (clip.segStart ?? 0) + localOffset
    const targetIdx    = clip.segmentIdx ?? 0
    const segmentChanged = targetIdx !== activeSegIdx.value
    if (segmentChanged) activeSegIdx.value = targetIdx

    // Move the playhead immediately — don't wait for the async video timeupdate
    currentAbsTime.value   = absoluteSec
    videoAbsProgress.value = videoDuration.value > 0 ? absoluteSec / videoDuration.value : 0
    _applyTime(absoluteSec, lastDuration)   // updates animIdx + progress if GPX loaded

    return { localTime: segLocalTime, segmentChanged }
  }

  // ── Trim / split / delete ─────────────────────────────────────────────────────

  function setVideoTrimStart(val) {
    if (!clips.value.length) return
    const clamped = Math.min(val, clips.value[0].end - 0.1)
    clips.value = [{ ...clips.value[0], start: clamped }, ...clips.value.slice(1)]
  }

  function setVideoTrimEnd(val) {
    if (!clips.value.length) return
    const last    = clips.value.length - 1
    const clamped = Math.max(val, clips.value[last].start + 0.1)
    clips.value = [...clips.value.slice(0, last), { ...clips.value[last], end: clamped }]
  }

  function splitAtTime(absTime) {
    const c   = clips.value
    const idx = c.findIndex(clip => absTime > clip.start + 0.05 && absTime < clip.end - 0.05)
    if (idx === -1) return
    const clip       = c[idx]
    const segStart   = clip.segStart ?? 0
    const localOffset = absTime - clip.start
    const next = [...c]
    next.splice(idx, 1,
      { start: clip.start, end: absTime,   segmentIdx: clip.segmentIdx ?? 0, segStart },
      { start: absTime,    end: clip.end,  segmentIdx: clip.segmentIdx ?? 0, segStart: segStart + localOffset }
    )
    clips.value = next
  }

  function deleteClip(index) {
    if (clips.value.length <= 1) return
    if (index === 0) {
      // Collapse the dead zone: shift the visual origin to the start of the next clip
      timelineShift.value = clips.value[1].start
    }
    clips.value = clips.value.filter((_, i) => i !== index)
  }

  function reorderClips(newClips) {
    clips.value = newClips
  }

  function trimClip(index, start, end) {
    if (index < 0 || index >= clips.value.length) return
    const clip = clips.value[index]
    const trimInDelta = Math.max(0, start - clip.start)
    const next = [...clips.value]
    next[index] = { ...clip, start, end, segStart: (clip.segStart ?? 0) + trimInDelta }
    clips.value = next
  }

  function mergeClips(indexA) {
    const c = clips.value
    const indexB = indexA + 1
    if (indexA < 0 || indexB >= c.length) return
    const next = [...c]
    next.splice(indexA, 2, { start: c[indexA].start, end: c[indexB].end })
    clips.value = next
  }

  function moveClip(index, newStart) {
    const c = clips.value
    if (index < 0 || index >= c.length) return
    const dur = c[index].end - c[index].start
    const minStart = index > 0
      ? c[index - 1].end + 0.01
      : (timelineShift.value || 0)
    const maxStart = index < c.length - 1
      ? c[index + 1].start - dur - 0.01
      : videoDuration.value - dur
    const clamped = Math.max(minStart, Math.min(maxStart, newStart))
    const next = [...c]
    next[index] = { start: clamped, end: clamped + dur }
    clips.value = next
  }

  // ── GPX trim range ─────────────────────────────────────────────────────────────
  watch(gpxPoints, (pts) => {
    trimStart.value = 0
    trimEnd.value   = Math.max(0, pts.length - 1)
  }, { immediate: true })

  const totalOffsetSec = computed(() => (autoOffsetSec.value ?? 0) + manualOffsetSec.value)

  let lastAbsTime  = 0
  let lastDuration = 1

  watch([trimStart, trimEnd], () => {
    if (videoSrc.value) _applyTime(lastAbsTime, lastDuration)
  })

  // Re-apply when the offset changes (slider or manual start-time entry).
  // flush:'sync' so animIdx updates in the same tick as the input event.
  // We must refresh trimStart/trimEnd from the already-fresh gpxWindowIdx computed
  // BEFORE calling _applyTime, otherwise the new index gets clamped to the stale window.
  watch(totalOffsetSec, () => {
    if (!videoSrc.value) return
    const { start, end } = gpxWindowIdx.value
    trimStart.value = start
    trimEnd.value   = end
    _applyTime(lastAbsTime, lastDuration)
  }, { flush: 'sync' })

  // GPX window (highlighted region on the elevation strip)
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

  // Set the sync by saying "at the current video frame, the real-world time is `date`"
  function setCurrentFrameTime(date) {
    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return
    // totalOffset = (date - gpxStart) / 1000 - videoAbsTime
    const newOffset = (date.getTime() - pts[0].time.getTime()) / 1000 - lastAbsTime
    autoOffsetSec.value    = newOffset
    manualOffsetSec.value  = 0
    autoDetected.value     = false
    autoDetectSource.value = null
  }

  function setGpxWindowStart(frac) {
    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return
    const N          = Math.max(1, pts.length - 1)
    const idx        = Math.max(0, Math.min(N, Math.round(frac * N)))
    const gpxTimeSec = (pts[idx].time.getTime() - pts[0].time.getTime()) / 1000
    manualOffsetSec.value = gpxTimeSec - videoTrimStart.value - (autoOffsetSec.value ?? 0)
  }

  watch(gpxWindowIdx, ({ start, end }) => {
    if (!videoSrc.value) return
    trimStart.value = start
    trimEnd.value   = end
  })

  // ── Load / cleanup ─────────────────────────────────────────────────────────────

  async function loadVideo(file) {
    segments.value.forEach(s => URL.revokeObjectURL(s.src))
    const src = URL.createObjectURL(file)
    // Segment duration is set later via setVideoDuration (loadedmetadata)
    segments.value     = [{ src, duration: 0, offset: 0, name: file.name }]
    activeSegIdx.value = 0
    clips.value        = []
    timelineShift.value   = 0
    playing.value      = false
    animIdx.value      = trimStart.value
    progress.value     = 0
    autoOffsetSec.value    = null
    autoDetected.value     = false
    autoDetectSource.value = null
    manualOffsetSec.value  = 0
    currentAbsTime.value   = 0
    lastAbsTime  = 0
    lastDuration = 1
    pendingLastModified = null

    const pts = gpxPoints.value
    if (!pts.length || !pts[0].time) return

    const creationTime = await parseMp4CreationTime(file)
    if (creationTime) {
      autoOffsetSec.value    = (creationTime.getTime() - pts[0].time.getTime()) / 1000
      autoDetected.value     = true
      autoDetectSource.value = 'mp4'
    } else if (file.lastModified) {
      // Store for use in setVideoDuration once duration is known
      pendingLastModified = file.lastModified
    }
  }

  function cleanup() {
    segments.value.forEach(s => URL.revokeObjectURL(s.src))
    segments.value        = []
    activeSegIdx.value    = 0
    playing.value         = false
    animIdx.value         = 0
    progress.value        = 0
    videoAbsProgress.value = 0
    autoOffsetSec.value    = null
    autoDetected.value     = false
    autoDetectSource.value = null
    manualOffsetSec.value  = 0
    pendingLastModified    = null
    lastAbsTime  = 0
    lastDuration = 1
    trimStart.value      = 0
    trimEnd.value        = Math.max(0, gpxPoints.value.length - 1)
    clips.value          = []
    timelineShift.value  = 0
    currentAbsTime.value = 0
  }

  // ── Playback tracking ──────────────────────────────────────────────────────────

  function onTimeUpdate(localTimeSec, localDurationSec) {
    // Map physical segment position → logical timeline position via clip metadata
    const c      = clips.value
    const segIdx = activeSegIdx.value
    let absTime  = currentAbsTime.value

    for (const clip of c) {
      const ss  = clip.segStart ?? 0
      const dur = clip.end - clip.start
      if ((clip.segmentIdx ?? 0) === segIdx && localTimeSec >= ss - 0.1 && localTimeSec <= ss + dur + 0.1) {
        absTime = clip.start + (localTimeSec - ss)
        break
      }
    }

    currentAbsTime.value = absTime
    lastAbsTime          = absTime
    lastDuration         = Math.max(1, localDurationSec)
    _applyTime(absTime, localDurationSec)
  }

  function _applyTime(absTime, localDurationSec) {
    videoAbsProgress.value = videoDuration.value > 0 ? absTime / videoDuration.value : 0

    const pts = gpxPoints.value
    if (!pts.length) return

    const tStart = trimStart.value
    const tEnd   = trimEnd.value

    const vStart = videoTrimStart.value
    const vEnd   = Math.max(vStart + 0.001, videoTrimEnd.value)
    progress.value = Math.max(0, Math.min((absTime - vStart) / (vEnd - vStart), 1))

    // Zero-width GPS window: video offset places it outside the GPS recording range,
    // or GPS has too few points to span the video. Show data at trimStart so the
    // overlay reflects the current GPS window position when the user adjusts it.
    if (tEnd <= tStart) {
      animIdx.value = Math.max(0, Math.min(tStart, pts.length - 1))
      return
    }

    let idx
    if (pts[0].time) {
      const targetMs = pts[0].time.getTime() + (totalOffsetSec.value + absTime) * 1000
      let lo = 0, hi = pts.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        pts[mid].time.getTime() < targetMs ? (lo = mid + 1) : (hi = mid)
      }
      idx = lo
    } else {
      const totalDur = videoDuration.value || Math.max(1, localDurationSec)
      idx = Math.max(0, Math.min(
        Math.round((absTime / totalDur) * (pts.length - 1)),
        pts.length - 1
      ))
    }

    if (idx < tStart || idx > tEnd) {
      const rel = Math.max(0, Math.min((absTime - vStart) / (vEnd - vStart), 1))
      idx = Math.round(tStart + rel * (tEnd - tStart))
    }

    animIdx.value = Math.max(tStart, Math.min(idx, tEnd))
  }

  // Convert a GPX index to an absolute timeline time (for seek-on-trim-drag)
  function gpxIdxToAbsoluteTime(idx) {
    const pts = gpxPoints.value
    if (!pts.length) return 0
    const p = pts[Math.max(0, Math.min(idx, pts.length - 1))]
    if (pts[0].time && p?.time) {
      return (p.time.getTime() - pts[0].time.getTime()) / 1000 - totalOffsetSec.value
    }
    return (idx / Math.max(1, pts.length - 1)) * (videoDuration.value || lastDuration)
  }

  return {
    videoSrc,
    segments,
    activeSegIdx,
    playing,
    animIdx,
    progress,
    videoAbsProgress,
    autoOffsetSec,
    manualOffsetSec,
    autoDetected,
    autoDetectSource,
    totalOffsetSec,
    trimStart,
    trimEnd,
    videoDuration,
    videoTrimStart,
    videoTrimEnd,
    clips,
    timelineShift,
    activeClipIndex,
    currentAbsTime,
    setVideoDuration,
    addSegment,
    advanceSegment,
    seekToAbsolute,
    setVideoTrimStart,
    setVideoTrimEnd,
    splitAtTime,
    deleteClip,
    moveClip,
    reorderClips,
    trimClip,
    mergeClips,
    gpxWindowIdx,
    setGpxWindowStart,
    setCurrentFrameTime,
    loadVideo,
    onTimeUpdate,
    gpxIdxToAbsoluteTime,
    cleanup,
  }
}
