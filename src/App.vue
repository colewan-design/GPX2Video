<template>
  <div class="dash-root">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="dash-header">
      <div class="dash-logo">
        GPX<span class="logo-accent">2</span>VIDEO
      </div>
      <div v-if="gpxPoints.length" class="dash-track">
        <span class="track-dot" />
        <span class="track-name">{{ trackName || 'Unnamed Track' }}</span>
        <span v-if="locationName" class="track-location">
          <svg viewBox="0 0 12 12" fill="currentColor"><path d="M6 0a4 4 0 0 1 4 4c0 3-4 8-4 8S2 7 2 4a4 4 0 0 1 4-4zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
          {{ locationName }}
        </span>
      </div>
      <div class="dash-header-right">
        <button v-if="gpxPoints.length" class="btn-ghost" @click="resetAll">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3.5A6.5 6.5 0 1 1 2 8" stroke-linecap="round"/><path d="M0 2l1.5 1.5L3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          New session
        </button>
      </div>
    </header>

    <!-- ── 4-Panel Dashboard ────────────────────────────────────────────────── -->

      <p v-if="gpxPoints.length && !hasTimestamps" class="warn-banner">
        No timestamps in GPX — speed will read 0. Export from Strava or Garmin for speed data.
      </p>

      <div class="dash-grid">

        <!-- ── LEFT: Import + Live Stats ──────────────────────────────────── -->
        <aside class="dash-panel panel-left">

          <!-- Step header -->
          <div class="panel-section-header">
            <span class="section-tag">Session</span>
            <div class="steps-mini">
              <span class="step-mini" :class="gpxPoints.length ? 'step-done' : 'step-active'">GPX{{ gpxPoints.length ? ' ✓' : '' }}</span>
              <span class="step-mini-sep" />
              <span class="step-mini" :class="gpxPoints.length && hasVideo ? 'step-done' : gpxPoints.length ? 'step-active' : ''">Video{{ hasVideo ? ' ✓' : '' }}</span>
              <span class="step-mini-sep" />
              <span class="step-mini" :class="hasVideo ? 'step-active' : ''">Export</span>
            </div>
          </div>

          <!-- GPX import + Strava -->
          <div class="panel-inner-section">
            <div class="section-label">GPX Source</div>
            <GpxLoader
              :file-name="gpxFileName"
              :strava-open="stravaOpen"
              @file="loadFileWithName"
              @toggle-strava="stravaOpen = !stravaOpen"
            />
            <p v-if="parseError" class="import-error">{{ parseError }}</p>
            <div v-if="stravaOpen" class="strava-inline">
              <StravaConnect @gpx="onStravaGpx" />
            </div>
          </div>

          <div class="panel-divider" />

          <!-- Video import -->
          <div class="panel-inner-section">
            <div class="section-label">Video Source</div>
            <VideoLoader :file-name="videoFileName" @file="onVideoFile" />
          </div>

          <!-- Sync offset (shown when video + timestamps available) -->
          <div v-if="hasVideo && hasTimestamps" class="sync-quick" style="border-top: 1px solid var(--border); margin-top: -1px;">
            <div class="sync-quick-header">
              <span class="sync-quick-label">Sync offset</span>
              <span class="sync-badge" :class="autoDetected ? 'auto' : 'manual'">
                {{ autoDetected ? 'Auto ✓' : 'Manual' }}
              </span>
              <span class="sync-val">{{ offsetDisplayLocal }}</span>
            </div>
            <input
              class="sync-slider"
              type="range"
              min="-300"
              max="300"
              step="0.5"
              :value="manualOffsetSec"
              @input="setManualOffset(Number($event.target.value))"
            />
          </div>

          <!-- Divider -->
          <div class="panel-divider" />

          <!-- Live Stats HUD -->
          <div v-if="stats" class="panel-inner-section">
            <div class="section-label">Track Stats</div>
            <MetricsRow :stats="stats" />
          </div>

        </aside>

        <!-- ── CENTER: Preview + Map ───────────────────────────────────────── -->
        <section class="dash-panel panel-center">

          <!-- Synced badge -->
          <div v-if="hasVideo && autoDetected" class="synced-badge">
            <span class="synced-dot" />
            Synced 100%
          </div>

          <!-- Stage always rendered so its border/outline is always visible -->
          <VideoStage
            ref="videoStageRef"
            :points="gpxPoints"
            :filter-id="videoFilter"
            :anim-idx="activeAnimIdx"
            :trim-start="trimStart"
            :progress="activeProgress"
            :total-time="activeTotal"
            :video-src="videoSrc"
            :playing="activePlaying"
            :overlay-format="overlayFormat"
            :overlay-color="overlayColor"
            :player-aspect="playerAspect"
            :location-name="locationName"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onVideoMetadata"
            @ended="onVideoEnded"
          />

          <!-- Empty state overlay — shown when no GPX loaded -->
          <div v-if="!gpxPoints.length" class="center-empty">
            <p>Load a GPX file to get started</p>
          </div>

          <!-- Controls row — only when GPX data is available -->
          <div v-if="gpxPoints.length" class="controls-bar">
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
            <div class="controls-right">
              <ExportButton
                v-if="hasVideo"
                :exporting="exporting"
                :progress="exportProgress"
                :can-export="!exporting"
                :error="exportError"
                @export="onExport"
                @cancel="cancelExport"
              />
              <StickerExport
                v-if="stats"
                :points="gpxPoints"
                :stats="stats"
                :track-name="trackName"
                :accent-color="overlayColor"
              />
            </div>
          </div>

        </section>

        <!-- ── RIGHT: Overlay Studio ──────────────────────────────────────── -->
        <aside class="dash-panel panel-right">
          <div class="panel-section-header">
            <span class="section-tag">Overlay Studio</span>
          </div>

          <div class="panel-inner-section">
            <OverlayFormatBar v-model="overlayFormat" />
          </div>

          <div v-if="!hasVideo" class="studio-no-video">
            Load a video to enable all style controls.
          </div>

          <template v-if="hasVideo">
            <div class="panel-inner-section">
              <div class="section-label">Color</div>
              <OverlayColorPicker v-model="overlayColor" />
            </div>
            <div class="panel-inner-section">
              <div class="section-label">Filter</div>
              <FilterBar v-model="videoFilter" />
            </div>
          </template>

          <div class="panel-inner-section">
            <div class="section-label">Aspect Ratio</div>
            <PlayerSizeBar v-model="playerAspect" />
          </div>
        </aside>

      </div>

      <!-- ── Pro Timeline (full width) — always visible ───────────────────── -->
      <div class="dash-timeline">
        <div class="timeline-header">
          <span class="section-tag">Pro Timeline</span>
          <span v-if="gpxPoints.length" class="timeline-hint">Drag handles to trim · Click track to seek</span>
          <span v-else class="timeline-hint">Load a GPX file to populate the timeline</span>
        </div>

        <template v-if="gpxPoints.length">
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
        <div v-else class="timeline-empty">
          <div class="timeline-empty-track" />
        </div>
      </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, watchEffect } from 'vue'
import GpxLoader         from './components/GpxLoader.vue'
import MetricsRow        from './components/MetricsRow.vue'
import VideoLoader       from './components/VideoLoader.vue'
import VideoStage        from './components/VideoStage.vue'
import PlaybackControls  from './components/PlaybackControls.vue'
import ExportButton      from './components/ExportButton.vue'
import SyncPanel         from './components/SyncPanel.vue'
import ChartRow          from './components/ChartRow.vue'
import FilterBar         from './components/FilterBar.vue'
import OverlayFormatBar  from './components/OverlayFormatBar.vue'
import OverlayColorPicker from './components/OverlayColorPicker.vue'
import PlayerSizeBar     from './components/PlayerSizeBar.vue'
import StickerExport     from './components/StickerExport.vue'
import StravaConnect     from './components/StravaConnect.vue'
import { SHADER_PARAMS } from './utils/filters.js'
import { useGpxParser }  from './composables/useGpxParser.js'
import { useAnimation }  from './composables/useAnimation.js'
import { useVideoSync }  from './composables/useVideoSync.js'
import { useVideoExport } from './composables/useVideoExport.js'

// --- GPX ---
const { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile, parseGPX } = useGpxParser()

// --- GPX-only animation ---
const { animIdx: gpxAnimIdx, playing: gpxPlaying, playbackSpeed, progress: gpxProgress, toggle: gpxToggle, reset: gpxReset } = useAnimation(gpxPoints)

// --- Video sync ---
const {
  videoSrc, playing: vidPlaying, animIdx: vidAnimIdx, progress: vidProgress,
  videoAbsProgress: vidAbsProgress, autoDetected, manualOffsetSec, totalOffsetSec,
  trimStart, trimEnd, videoDuration, videoTrimStart, videoTrimEnd,
  setVideoDuration, gpxWindowIdx, setGpxWindowStart, loadVideo,
  onTimeUpdate: processTimeUpdate, gpxIdxToVideoTime, cleanup: cleanupVideo,
} = useVideoSync(gpxPoints)

const videoFileName  = ref(null)
const gpxFileName    = ref(null)
const stravaOpen     = ref(false)
const videoStageRef  = ref(null)
const videoFilter    = ref('none')
const overlayFormat  = ref('classic')
const overlayColor   = ref('#00ff88')
const playerAspect   = ref('16:9')

const hasVideo = computed(() => !!videoSrc.value)

// --- Export ---
const { exporting, exportProgress, exportError, startExport, cancel: cancelExport } = useVideoExport()

function onExport() {
  const videoEl = videoStageRef.value?.getVideoEl()
  startExport(
    videoEl, gpxPoints.value, totalOffsetSec.value,
    stats.value?.totalTime ?? 0, trimStart.value, trimEnd.value,
    videoTrimStart.value, videoTrimEnd.value,
    overlayFormat.value, overlayColor.value,
    locationName.value,
    SHADER_PARAMS[videoFilter.value] ?? SHADER_PARAMS.none,
  )
}

function onTrimStart(val) {
  trimStart.value = val
  if (hasVideo.value) { const t = gpxIdxToVideoTime(val); if (t >= 0) videoStageRef.value?.seekTo(t) }
}
function onTrimEnd(val) {
  trimEnd.value = val
  if (hasVideo.value) { const t = gpxIdxToVideoTime(val); if (t >= 0) videoStageRef.value?.seekTo(t) }
}

// --- Unified state ---
const activeAnimIdx     = computed(() => hasVideo.value ? vidAnimIdx.value   : gpxAnimIdx.value)
const activeProgress    = computed(() => hasVideo.value ? vidProgress.value  : gpxProgress.value)
const activePlaying     = computed(() => hasVideo.value ? vidPlaying.value   : gpxPlaying.value)
const activeAbsProgress = computed(() => hasVideo.value ? vidAbsProgress.value : gpxProgress.value)
const activeTotal = computed(() => {
  if (hasVideo.value && videoDuration.value > 0) return (videoTrimEnd.value - videoTrimStart.value) * 1000
  return stats.value?.totalTime ?? 0
})

// --- Reverse geocode ---
const { locationName, lookup: geocodeLookup, lookupNow: geocodeLookupNow, clear: geocodeClear } = useReverseGeocode()

watchEffect(() => {
  const idx = activeAnimIdx.value
  const pts = gpxPoints.value
  if (!pts.length) return
  const pt = pts[Math.min(idx, pts.length - 1)]
  geocodeLookup(pt.lat, pt.lon)
})

watch(gpxPoints, (pts) => {
  if (pts.length) geocodeLookupNow(pts[0].lat, pts[0].lon)
  else geocodeClear()
})

// --- Sync offset display ---
const offsetDisplayLocal = computed(() => {
  const v = totalOffsetSec.value
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}s`
})

// --- Event handlers ---
async function onVideoFile(file) {
  videoFileName.value = file.name
  await loadVideo(file)
}
function onTimeUpdate({ currentTime, duration }) {
  processTimeUpdate(currentTime, duration)
  if (!exporting.value && hasVideo.value && videoTrimEnd.value > 0 && currentTime >= videoTrimEnd.value) {
    vidPlaying.value = false
    videoStageRef.value?.seekTo(videoTrimStart.value)
  }
}
function onVideoMetadata({ duration }) { setVideoDuration(duration) }
function onVideoTrimStart(val) { videoTrimStart.value = val; videoStageRef.value?.seekTo(val) }
function onVideoTrimEnd(val)   { videoTrimEnd.value   = val; videoStageRef.value?.seekTo(val) }
function onVideoSeek(sec)      { videoStageRef.value?.seekTo(sec) }
function onVideoEnded()        { vidPlaying.value = false; videoStageRef.value?.seekTo(videoTrimStart.value) }
function onToggle() {
  if (hasVideo.value) vidPlaying.value = !vidPlaying.value
  else gpxToggle()
}
function onReset() {
  if (hasVideo.value) {
    vidPlaying.value = false
    videoStageRef.value?.seekTo(videoTrimStart.value)
    vidAnimIdx.value = trimStart.value
    vidProgress.value = 0
  } else { gpxReset() }
}
function resetAll() {
  gpxReset(); cleanupVideo(); geocodeClear()
  videoFileName.value = null; gpxFileName.value = null
  stravaOpen.value = false; videoFilter.value = 'none'
  gpxPoints.value = []; stats.value = null; parseError.value = ''
}
function setManualOffset(val) { manualOffsetSec.value = val }

// Capture GPX filename on load
const _origLoadFile = loadFile
function loadFileWithName(file) {
  gpxFileName.value = file.name
  stravaOpen.value  = false
  _origLoadFile(file)
}

watch(gpxPoints, () => {
  gpxReset(); cleanupVideo()
  videoFileName.value = null
  // Don't clear gpxFileName — keep the name visible after reload
})

// ── Strava ────────────────────────────────────────────────────────────────────
import { useReverseGeocode } from './composables/useReverseGeocode.js'
import { useStravaAuth } from './composables/useStravaAuth.js'
const { handleCallback: stravaHandleCallback } = useStravaAuth()
onMounted(async () => { if (window.location.search.includes('code=')) await stravaHandleCallback() })
function onStravaGpx(gpxString) {
  parseGPX(gpxString)
  gpxFileName.value = null   // Strava has no local filename
  stravaOpen.value  = false
}
</script>

<style scoped>
/* ── Root ────────────────────────────────────────────────────────────────────── */
.dash-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────────────── */
.dash-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: .45rem 0 .45rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
  flex-shrink: 0;
}
.dash-logo {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: .18em;
  color: var(--text);
  text-transform: uppercase;
  flex-shrink: 0;
}
.logo-accent { color: var(--accent); }
.dash-track {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
.track-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
  flex-shrink: 0;
  animation: pulse 2s ease infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
.track-name {
  font-size: 12px;
  color: var(--text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-location {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}
.track-location svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  opacity: .6;
}
.dash-header-right { margin-left: auto; }
.btn-ghost {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: .38rem .75rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.btn-ghost:hover { border-color: var(--accent-semi); color: var(--accent); }
.btn-ghost svg { width: 13px; height: 13px; }

.warn-banner {
  font-size: 11px;
  color: #e5ac00;
  background: rgba(229,172,0,.07);
  border: 1px solid rgba(229,172,0,.2);
  border-radius: var(--radius-md);
  padding: .55rem .85rem;
  margin-bottom: .85rem;
}

/* ── 4-Panel Grid ─────────────────────────────────────────────────────────────── */
.dash-grid {
  display: grid;
  grid-template-columns: 240px 1fr 230px;
  gap: 6px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  margin-bottom: 6px;
}
@media (max-width: 1100px) {
  .dash-grid { grid-template-columns: 220px 1fr; }
  .panel-right { display: none; }
}
@media (max-width: 720px) {
  .dash-grid { grid-template-columns: 1fr; }
  .panel-left { display: none; }
}

/* ── Glass Panel ─────────────────────────────────────────────────────────────── */
.dash-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Left Panel ──────────────────────────────────────────────────────────────── */
.panel-left {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}
.panel-section-header {
  padding: .65rem .9rem .5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.section-tag {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--accent);
}
.steps-mini {
  display: flex;
  align-items: center;
  gap: 5px;
}
.step-mini {
  font-size: 9px;
  font-weight: 600;
  color: var(--text3);
  letter-spacing: .04em;
}
.step-mini.step-done { color: var(--accent-green); }
.step-mini.step-active { color: var(--accent); }
.step-mini-sep {
  width: 10px; height: 1px;
  background: var(--border2);
}
.panel-inner-section { padding: .65rem .9rem; }
.panel-divider { height: 1px; background: var(--border); margin: 0; }
.section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text3);
  margin-bottom: .5rem;
}

/* Sync quick controls */
.sync-quick {
  padding: .5rem .9rem .65rem;
  border-top: 1px solid var(--border);
}
.sync-quick-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: .4rem;
}
.sync-quick-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text3);
}
.sync-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 20px;
  letter-spacing: .06em;
}
.sync-badge.auto {
  background: rgba(34,197,94,.12);
  color: var(--accent-green);
  border: 1px solid rgba(34,197,94,.25);
}
.sync-badge.manual {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent-semi);
}
.sync-val {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.sync-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
  height: 20px;
}

.center-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  font-size: 11px;
  letter-spacing: .06em;
  pointer-events: none;
  z-index: 5;
}

/* ── Center Panel ────────────────────────────────────────────────────────────── */
.panel-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
/* Stage fills available height; aspect-ratio then drives width */
.panel-center :deep(.stage) {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  width: auto;
  max-width: 100%;
  align-self: center;
}
.synced-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--accent);
  background: rgba(9,10,15,.82);
  padding: 4px 8px;
  border-radius: 20px;
  border: 1px solid var(--accent-semi);
  backdrop-filter: blur(8px);
  pointer-events: none;
}
.synced-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-glow);
}
.controls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .7rem .85rem;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
/* Embed VideoStage flush inside the panel */
.panel-center :deep(.stage) {
  border-radius: 0;
  margin-bottom: 0;
  border: none;
  border-bottom: 1px solid var(--border);
}

/* ── Right Panel ──────────────────────────────────────────────────────────────── */
.panel-right {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}
.import-error {
  font-size: 11px;
  color: var(--red);
  margin-top: .4rem;
  padding: .4rem .6rem;
  background: rgba(255,77,77,.06);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255,77,77,.18);
  line-height: 1.4;
}
.strava-inline {
  margin-top: 6px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg3);
  border: 1px solid var(--border);
}
.strava-inline :deep(.strava-wrap) {
  padding: .5rem .5rem;
  gap: 6px;
}
.strava-inline :deep(.strava-divider) { display: none; }
.strava-inline :deep(.strava-card) { padding: 8px 10px; }
.strava-inline :deep(.strava-row) { gap: 6px; padding: 5px 4px; }

.studio-no-video {
  padding: .6rem .9rem;
  font-size: 11px;
  color: var(--text3);
  line-height: 1.5;
}

/* ── Pro Timeline ─────────────────────────────────────────────────────────────── */
.dash-timeline {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
}
.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: .6rem .9rem .5rem;
  border-bottom: 1px solid var(--border);
}
.timeline-hint {
  font-size: 10px;
  color: var(--text3);
  margin-left: auto;
}
.timeline-empty {
  padding: .75rem .9rem;
}
.timeline-empty-track {
  height: 28px;
  border-radius: 4px;
  background: repeating-linear-gradient(
    90deg,
    var(--border) 0px,
    var(--border) 1px,
    transparent 1px,
    transparent 48px
  );
  border: 1px solid var(--border);
  opacity: 0.5;
}
</style>
