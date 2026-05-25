<template>
  <div>
    <header class="app-header">
      <h1>GPX<span class="accent">2</span>Video</h1>
      <button v-if="gpxPoints.length" class="load-new" @click="resetAll">Load new file</button>
    </header>

    <DropZone v-if="!gpxPoints.length" @file="loadFile" />

    <p v-if="parseError" class="error">{{ parseError }}</p>

    <template v-if="gpxPoints.length">
      <p v-if="!hasTimestamps" class="warning">
        No timestamps in this GPX — speed readings will be 0. Export from Strava or Garmin for speed data.
      </p>

      <MetricsRow :stats="stats" />

      <!-- Video file loader strip (always shown once GPX is loaded) -->
      <VideoLoader :file-name="videoFileName" @file="onVideoFile" />

      <VideoStage
        ref="videoStageRef"
        :points="gpxPoints"
        :anim-idx="activeAnimIdx"
        :progress="activeProgress"
        :total-time="activeTotal"
        :video-src="videoSrc"
        :playing="activePlaying"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onVideoMetadata"
        @ended="onVideoEnded"
      />

      <div class="controls-row">
        <PlaybackControls
          :playing="activePlaying"
          :speed="playbackSpeed"
          :track-name="trackName"
          :has-video="hasVideo"
          :disabled="exporting"
          @toggle="onToggle"
          @reset="onReset"
          @speed="playbackSpeed = $event"
        />
        <ExportButton
          v-if="hasVideo"
          :exporting="exporting"
          :progress="exportProgress"
          :can-export="!exporting"
          :error="exportError"
          @export="onExport"
        />
      </div>

      <!-- GPX timeline: elevation + trim + offset -->
      <SyncPanel
        :points="gpxPoints"
        :anim-idx="activeAnimIdx"
        :trim-start="trimStart"
        :trim-end="trimEnd"
        :has-video="hasVideo"
        :has-timestamps="hasTimestamps"
        :auto-detected="autoDetected"
        :manual-offset-sec="manualOffsetSec"
        :total-offset-sec="totalOffsetSec"
        :video-duration="videoDuration"
        :video-trim-start="videoTrimStart"
        :video-trim-end="videoTrimEnd"
        :video-progress="activeAbsProgress"
        :window-start-idx="gpxWindowIdx.start"
        :window-end-idx="gpxWindowIdx.end"
        @update:trim-start="onTrimStart"
        @update:trim-end="onTrimEnd"
        @update:manual-offset-sec="setManualOffset"
        @update:video-trim-start="onVideoTrimStart"
        @update:video-trim-end="onVideoTrimEnd"
        @seek="onVideoSeek"
        @gpx-window-drag="setGpxWindowStart"
      />

      <ChartRow :points="gpxPoints" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DropZone         from './components/DropZone.vue'
import MetricsRow       from './components/MetricsRow.vue'
import VideoLoader      from './components/VideoLoader.vue'
import VideoStage       from './components/VideoStage.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import ExportButton     from './components/ExportButton.vue'
import SyncPanel        from './components/SyncPanel.vue'
import ChartRow         from './components/ChartRow.vue'
import { useGpxParser }   from './composables/useGpxParser.js'
import { useAnimation }   from './composables/useAnimation.js'
import { useVideoSync }   from './composables/useVideoSync.js'
import { useVideoExport } from './composables/useVideoExport.js'

// --- GPX ---
const { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile } = useGpxParser()

// --- GPX-only animation (used when no video is loaded) ---
const { animIdx: gpxAnimIdx, playing: gpxPlaying, playbackSpeed, progress: gpxProgress, toggle: gpxToggle, reset: gpxReset } = useAnimation(gpxPoints)

// --- Video sync ---
const {
  videoSrc,
  playing:           vidPlaying,
  animIdx:           vidAnimIdx,
  progress:          vidProgress,
  videoAbsProgress:  vidAbsProgress,
  autoDetected,
  manualOffsetSec,
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
  onTimeUpdate:      processTimeUpdate,
  gpxIdxToVideoTime,
  cleanup:           cleanupVideo,
} = useVideoSync(gpxPoints)

const videoFileName  = ref(null)
const videoStageRef  = ref(null)

const hasVideo = computed(() => !!videoSrc.value)

// --- Export ---
const { exporting, exportProgress, exportError, startExport } = useVideoExport()

function onExport() {
  const videoEl = videoStageRef.value?.getVideoEl()
  startExport(
    videoEl,
    gpxPoints.value,
    totalOffsetSec.value,
    stats.value?.totalTime ?? 0,
    trimStart.value,
    trimEnd.value,
    videoTrimStart.value,
    videoTrimEnd.value,
  )
}

function onTrimStart(val) {
  trimStart.value = val
  if (hasVideo.value) {
    const t = gpxIdxToVideoTime(val)
    if (t >= 0) videoStageRef.value?.seekTo(t)
  }
}
function onTrimEnd(val) {
  trimEnd.value = val
  if (hasVideo.value) {
    const t = gpxIdxToVideoTime(val)
    if (t >= 0) videoStageRef.value?.seekTo(t)
  }
}

// --- Unified state (video mode takes precedence) ---
const activeAnimIdx   = computed(() => hasVideo.value ? vidAnimIdx.value    : gpxAnimIdx.value)
const activeProgress  = computed(() => hasVideo.value ? vidProgress.value   : gpxProgress.value)
const activePlaying   = computed(() => hasVideo.value ? vidPlaying.value    : gpxPlaying.value)
// Absolute video progress (0→1 over full video) used only for the strip playhead
const activeAbsProgress = computed(() => hasVideo.value ? vidAbsProgress.value : gpxProgress.value)
// Total time shown in the HUD: trimmed video window duration (ms) when video loaded
const activeTotal = computed(() => {
  if (hasVideo.value && videoDuration.value > 0) {
    return (videoTrimEnd.value - videoTrimStart.value) * 1000
  }
  return stats.value?.totalTime ?? 0
})

// --- Event handlers ---
async function onVideoFile(file) {
  videoFileName.value = file.name
  await loadVideo(file)
}

function onTimeUpdate({ currentTime, duration }) {
  processTimeUpdate(currentTime, duration)
  // Stop and reset to trim start when the trim end is reached (skip during export)
  if (!exporting.value && hasVideo.value && videoTrimEnd.value > 0 && currentTime >= videoTrimEnd.value) {
    vidPlaying.value = false
    videoStageRef.value?.seekTo(videoTrimStart.value)
  }
}

function onVideoMetadata({ duration }) {
  setVideoDuration(duration)
}

function onVideoTrimStart(val) {
  videoTrimStart.value = val
  videoStageRef.value?.seekTo(val)
}

function onVideoTrimEnd(val) {
  videoTrimEnd.value = val
  videoStageRef.value?.seekTo(val)
}

function onVideoSeek(sec) {
  videoStageRef.value?.seekTo(sec)
}

function onVideoEnded() {
  vidPlaying.value = false
  videoStageRef.value?.seekTo(videoTrimStart.value)
}

function onToggle() {
  if (hasVideo.value) {
    vidPlaying.value = !vidPlaying.value
  } else {
    gpxToggle()
  }
}

function onReset() {
  if (hasVideo.value) {
    vidPlaying.value = false
    videoStageRef.value?.seekTo(videoTrimStart.value)
    vidAnimIdx.value = trimStart.value
    vidProgress.value = 0
  } else {
    gpxReset()
  }
}

function resetAll() {
  gpxReset()
  cleanupVideo()
  videoFileName.value  = null
  gpxPoints.value      = []
  stats.value          = null
  parseError.value     = ''
}

function setManualOffset(val) {
  manualOffsetSec.value = val
}

// Cancel in-flight animation when a new GPX file is loaded
watch(gpxPoints, () => { gpxReset(); cleanupVideo(); videoFileName.value = null })
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -.02em;
  color: var(--text);
}
.accent { color: var(--accent-blue); }
.load-new {
  font-size: 12px;
  padding: .4rem .8rem;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border2);
  background: var(--bg2);
  color: var(--text2);
  cursor: pointer;
}
.load-new:hover { color: var(--text); background: var(--bg3); }

.error {
  color: #ff5a5a;
  font-size: 13px;
  margin-bottom: 1rem;
  padding: .75rem 1rem;
  background: rgba(255, 90, 90, .08);
  border-radius: var(--radius-md);
  border: 0.5px solid rgba(255, 90, 90, .2);
}
.warning {
  font-size: 12px;
  color: #f0a500;
  background: rgba(240, 165, 0, .08);
  border: 0.5px solid rgba(240, 165, 0, .2);
  border-radius: var(--radius-md);
  padding: .65rem 1rem;
  margin-bottom: 1rem;
}

/* --- Controls + export row --- */
.controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.5rem;
}
.controls-row :deep(.controls) {
  flex: 1;
  margin-bottom: 0;
}

</style>
