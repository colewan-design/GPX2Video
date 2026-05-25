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
        :total-time="stats.totalTime"
        :video-src="videoSrc"
        :playing="activePlaying"
        @timeupdate="onTimeUpdate"
        @ended="onVideoEnded"
      />

      <PlaybackControls
        :playing="activePlaying"
        :speed="playbackSpeed"
        :track-name="trackName"
        :has-video="hasVideo"
        @toggle="onToggle"
        @reset="onReset"
        @speed="playbackSpeed = $event"
      />

      <!-- Sync offset row — only when video + GPX timestamps are both present -->
      <div v-if="hasVideo && hasTimestamps" class="sync-row">
        <div class="sync-left">
          <span class="sync-label">Sync offset</span>
          <span v-if="autoDetected" class="auto-badge">Auto-detected</span>
          <span v-else class="manual-badge">Manual</span>
        </div>
        <input
          class="offset-slider"
          type="range"
          min="-300"
          max="300"
          step="0.5"
          :value="manualOffsetSec"
          @input="setManualOffset(Number($event.target.value))"
        />
        <span class="offset-val">{{ offsetDisplay }}</span>
        <button class="offset-reset" title="Reset to auto-detected offset" @click="setManualOffset(0)">↺</button>
      </div>

      <ChartRow :points="gpxPoints" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DropZone        from './components/DropZone.vue'
import MetricsRow      from './components/MetricsRow.vue'
import VideoLoader     from './components/VideoLoader.vue'
import VideoStage      from './components/VideoStage.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import ChartRow        from './components/ChartRow.vue'
import { useGpxParser }  from './composables/useGpxParser.js'
import { useAnimation }  from './composables/useAnimation.js'
import { useVideoSync }  from './composables/useVideoSync.js'

// --- GPX ---
const { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile } = useGpxParser()

// --- GPX-only animation (used when no video is loaded) ---
const { animIdx: gpxAnimIdx, playing: gpxPlaying, playbackSpeed, progress: gpxProgress, toggle: gpxToggle, reset: gpxReset } = useAnimation(gpxPoints)

// --- Video sync ---
const {
  videoSrc,
  playing:        vidPlaying,
  animIdx:        vidAnimIdx,
  progress:       vidProgress,
  autoDetected,
  manualOffsetSec,
  totalOffsetSec,
  loadVideo,
  onTimeUpdate:   processTimeUpdate,
  cleanup:        cleanupVideo,
} = useVideoSync(gpxPoints)

const videoFileName  = ref(null)
const videoStageRef  = ref(null)

const hasVideo = computed(() => !!videoSrc.value)

// --- Unified state (video mode takes precedence) ---
const activeAnimIdx = computed(() => hasVideo.value ? vidAnimIdx.value  : gpxAnimIdx.value)
const activeProgress = computed(() => hasVideo.value ? vidProgress.value : gpxProgress.value)
const activePlaying  = computed(() => hasVideo.value ? vidPlaying.value  : gpxPlaying.value)

// --- Offset display ---
const offsetDisplay = computed(() => {
  const v = totalOffsetSec.value
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}s`
})

// --- Event handlers ---
async function onVideoFile(file) {
  videoFileName.value = file.name
  await loadVideo(file)
}

function onTimeUpdate({ currentTime, duration }) {
  processTimeUpdate(currentTime, duration)
}

function onVideoEnded() {
  vidPlaying.value = false
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
    videoStageRef.value?.seekTo(0)
    vidAnimIdx.value = 0
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

/* --- Sync offset row --- */
.sync-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.25rem;
  padding: .6rem 1rem;
  border-radius: var(--radius-md);
  background: var(--bg2);
  border: 0.5px solid var(--border);
}
.sync-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.sync-label {
  font-size: 12px;
  color: var(--text2);
  white-space: nowrap;
}
.auto-badge, .manual-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 20px;
  font-weight: 500;
}
.auto-badge {
  background: rgba(58, 143, 255, .15);
  color: var(--accent-blue);
  border: 0.5px solid rgba(58, 143, 255, .3);
}
.manual-badge {
  background: rgba(255, 122, 58, .12);
  color: var(--accent-orange);
  border: 0.5px solid rgba(255, 122, 58, .25);
}
.offset-slider {
  flex: 1;
  accent-color: var(--accent-blue);
  cursor: pointer;
  height: 3px;
}
.offset-val {
  font-size: 12px;
  color: var(--text);
  min-width: 52px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.offset-reset {
  font-size: 14px;
  background: none;
  border: none;
  color: var(--text3);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.offset-reset:hover { color: var(--text2); }
</style>
