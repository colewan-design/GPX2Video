<template>
  <div class="app-root">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <div class="header-left">
        <div class="app-logo">GPX<span class="logo-accent">2</span>VIDEO</div>
        <div v-if="gpxPoints.length" class="header-track">
          <span class="track-dot" />
          <span class="track-name">{{ trackName || 'Unnamed Track' }}</span>
          <span v-if="locationName" class="track-location">
            <svg viewBox="0 0 12 12" fill="currentColor"><path d="M6 0a4 4 0 0 1 4 4c0 3-4 8-4 8S2 7 2 4a4 4 0 0 1 4-4zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
            {{ locationName }}
          </span>
        </div>
      </div>

      <div class="header-tools">
        <button v-if="hasVideo && videoDuration > 0" class="hdr-btn" title="Split clip (Ctrl+B)" @click="onSplit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="3.5" cy="3.5" r="2"/><circle cx="3.5" cy="12.5" r="2"/>
            <path d="M5.5 3.5L14 8M5.5 12.5L14 8"/>
          </svg>
          Split
        </button>
        <button v-if="hasVideo && videoDuration > 0" class="hdr-btn hdr-btn--danger" title="Delete clip (Del)" @click="onDeleteClip">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/>
          </svg>
          Delete
        </button>
      </div>

      <div class="header-right">
        <button v-if="gpxPoints.length" class="hdr-btn" @click="resetAll">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3.5A6.5 6.5 0 1 1 2 8" stroke-linecap="round"/><path d="M0 2l1.5 1.5L3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          New
        </button>
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
    </header>

    <p v-if="gpxPoints.length && !hasTimestamps" class="warn-banner">
      No timestamps in GPX — speed will read 0. Export from Strava or Garmin for speed data.
    </p>

    <!-- ── Top Toolbar ─────────────────────────────────────────────────────── -->
    <nav class="top-toolbar">
      <button
        v-for="tab in topTabs"
        :key="tab.id"
        class="tt-btn"
        :class="{ active: activeTab === tab.id, 'tt-disabled': tab.disabled }"
        @click="!tab.disabled && toggleTab(tab.id)"
      >
        <span class="tt-icon" v-html="tab.icon" />
        <span class="tt-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- ── Body ────────────────────────────────────────────────────────────── -->
    <div class="app-body">

      <!-- Left Panel -->
      <aside v-show="activeTab" class="left-panel">

        <!-- Media -->
        <template v-if="activeTab === 'media'">
          <div class="lp-tabs">
            <button class="lp-tab active">Import</button>
            <button class="lp-tab" style="opacity:.45;pointer-events:none">Record</button>
          </div>
          <div class="lp-section">
            <div class="lp-label">GPX Source</div>
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
          <div class="lp-divider" />
          <div class="lp-section">
            <div class="lp-label">Video Source</div>
            <VideoLoader
              @file="onVideoFile"
              @append="onVideoAppend"
              @select="onVideoSelect"
            />
          </div>
          <div v-if="hasVideo && hasTimestamps" class="lp-divider" />
          <div v-if="hasVideo && hasTimestamps" class="lp-section">
            <div class="sync-quick-header">
              <span class="lp-label" style="margin:0">Sync Offset</span>
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
        </template>

        <!-- Stats -->
        <template v-if="activeTab === 'stats'">
          <div class="lp-header">Track Stats</div>
          <div v-if="!stats" class="lp-note">Load a GPX file to see stats.</div>
          <div v-else class="lp-section">
            <MetricsRow :stats="stats" />
          </div>
        </template>

      </aside>

      <!-- Main Canvas -->
      <main class="main-canvas">
        <div v-if="hasVideo && autoDetected" class="synced-badge">
          <span class="synced-dot" />
          Synced 100%
        </div>

        <!-- Timecode display -->
        <div v-if="hasVideo" class="timecode-bar">
          <span class="timecode-val">{{ timecodeDisplay }}</span>
          <span class="timecode-total">{{ timecodeTotal }}</span>
        </div>

        <VideoStage
          ref="videoStageRef"
          :points="gpxPoints"
          :filter-id="videoFilter"
          :anim-idx="activeAnimIdx"
          :trim-start="trimStart"
          :progress="activeProgress"
          :total-time="activeTotal"
          :video-src="videoSrc"
          :next-video-src="segments[vidSegIdx + 1]?.src ?? null"
          :playing="activePlaying"
          :overlay-format="overlayFormat"
          :overlay-color="overlayColor"
          :player-aspect="playerAspect"
          :location-name="locationName"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onVideoMetadata"
          @ended="onVideoEnded"
        />

        <div v-if="!gpxPoints.length" class="canvas-empty">
          <div class="canvas-empty-inner">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="width:42px;height:42px;opacity:.25">
              <rect x="4" y="10" width="40" height="28" rx="4"/>
              <path d="M20 18l10 6-10 6V18z" fill="currentColor" stroke="none" opacity=".5"/>
            </svg>
            <p>Load a GPX file to get started</p>
          </div>
        </div>

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
        </div>
      </main>

      <!-- Right Panel (Properties) -->
      <aside class="right-panel">
        <!-- Main tabs -->
        <div class="rp-main-tabs">
          <button
            v-for="t in rightMainTabs"
            :key="t.id"
            class="rp-main-tab"
            :class="{ active: rightTab === t.id }"
            @click="rightTab = t.id"
          >{{ t.label }}</button>
        </div>

        <!-- Video tab: Overlay Format + Aspect -->
        <template v-if="rightTab === 'video'">
          <div class="rp-sub-tabs">
            <button class="rp-sub-tab active">Basic</button>
          </div>
          <div class="rp-body">
            <div class="rp-section-head">
              <span>Overlay</span>
            </div>
            <div class="rp-section">
              <div class="rp-row">
                <span class="rp-label">Format</span>
              </div>
              <OverlayFormatBar v-model="overlayFormat" />
            </div>
            <div class="rp-divider" />
            <div class="rp-section-head">
              <span>Canvas</span>
            </div>
            <div class="rp-section">
              <div class="rp-row">
                <span class="rp-label">Aspect Ratio</span>
              </div>
              <PlayerSizeBar v-model="playerAspect" />
            </div>
          </div>
        </template>

        <!-- Color tab -->
        <template v-if="rightTab === 'color'">
          <div class="rp-sub-tabs">
            <button class="rp-sub-tab active">Color</button>
          </div>
          <div class="rp-body">
            <div class="rp-section-head"><span>Accent Color</span></div>
            <div class="rp-section">
              <OverlayColorPicker v-model="overlayColor" />
            </div>
          </div>
        </template>

        <!-- Adjust tab -->
        <template v-if="rightTab === 'adjust'">
          <div class="rp-sub-tabs">
            <button class="rp-sub-tab active">Filter</button>
          </div>
          <div class="rp-body">
            <div v-if="!hasVideo" class="rp-note">Load a video to apply filters.</div>
            <div v-else class="rp-section">
              <FilterBar v-model="videoFilter" />
            </div>
            <div class="rp-divider" />
            <div class="rp-section-head"><span>Speed Curve</span></div>
            <div class="rp-section">
              <div v-if="!hasVideo" class="rp-note">Load a video to set speed curves.</div>
              <SpeedCurveBar v-else v-model="speedCurvePreset" />
            </div>
          </div>
        </template>

      </aside>

    </div>

    <!-- ── Timeline ────────────────────────────────────────────────────────── -->
    <div class="app-timeline">
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
        :clips="clips"
        :timeline-shift="timelineShift"
        :active-clip-idx="selectedClipIdx ?? activeClipIndex"
        :segments="segments"
        @update:trim-start="onTrimStart"
        @update:trim-end="onTrimEnd"
        @update:manual-offset-sec="setManualOffset"
        @update:video-trim-start="onVideoTrimStart"
        @update:video-trim-end="onVideoTrimEnd"
        @seek="onVideoSeek"
        @gpx-window-drag="setGpxWindowStart"
        @move-clip="({ index, newStart }) => moveClip(index, newStart)"
        @select-clip="i => { selectedClipIdx = i }"
        @reorder-clips="onReorderClips"
        @trim-clip="onTrimClip"
        @merge-clips="onMergeClips"
        @drop-video="f => hasVideo ? onVideoAppend([f]) : onVideoFile(f)"
      />
      <ChartRow :points="gpxPoints" />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, watchEffect } from 'vue'
import GpxLoader          from './components/GpxLoader.vue'
import MetricsRow         from './components/MetricsRow.vue'
import VideoLoader        from './components/VideoLoader.vue'
import VideoStage         from './components/VideoStage.vue'
import PlaybackControls   from './components/PlaybackControls.vue'
import ExportButton       from './components/ExportButton.vue'
import SyncPanel          from './components/SyncPanel.vue'
import ChartRow           from './components/ChartRow.vue'
import FilterBar          from './components/FilterBar.vue'
import OverlayFormatBar   from './components/OverlayFormatBar.vue'
import OverlayColorPicker from './components/OverlayColorPicker.vue'
import PlayerSizeBar      from './components/PlayerSizeBar.vue'
import StickerExport      from './components/StickerExport.vue'
import StravaConnect      from './components/StravaConnect.vue'
import SpeedCurveBar      from './components/SpeedCurveBar.vue'
import { SHADER_PARAMS }  from './utils/filters.js'
import { useGpxParser }   from './composables/useGpxParser.js'
import { useAnimation }   from './composables/useAnimation.js'
import { useVideoSync }   from './composables/useVideoSync.js'
import { useVideoExport } from './composables/useVideoExport.js'
import { useReverseGeocode } from './composables/useReverseGeocode.js'
import { useStravaAuth }  from './composables/useStravaAuth.js'

// --- GPX ---
const { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile, parseGPX } = useGpxParser()

// --- GPX-only animation ---
const { animIdx: gpxAnimIdx, playing: gpxPlaying, playbackSpeed, progress: gpxProgress, toggle: gpxToggle, reset: gpxReset } = useAnimation(gpxPoints)

// --- Video sync ---
const {
  videoSrc, segments, activeSegIdx: vidSegIdx, playing: vidPlaying, animIdx: vidAnimIdx, progress: vidProgress,
  videoAbsProgress: vidAbsProgress, autoDetected, manualOffsetSec, totalOffsetSec,
  trimStart, trimEnd, videoDuration, videoTrimStart, videoTrimEnd,
  clips, timelineShift, activeClipIndex, currentAbsTime,
  splitAtTime, deleteClip, moveClip, reorderClips, trimClip, mergeClips,
  setVideoTrimStart, setVideoTrimEnd,
  setVideoDuration, addSegment, advanceSegment, seekToAbsolute,
  gpxWindowIdx, setGpxWindowStart, loadVideo,
  onTimeUpdate: processTimeUpdate, gpxIdxToAbsoluteTime, cleanup: cleanupVideo,
} = useVideoSync(gpxPoints)

const selectedClipIdx  = ref(null)  // user-click selection; null = fall back to activeClipIndex
const videoFileName    = ref(null)
const gpxFileName      = ref(null)
const stravaOpen       = ref(false)
const videoStageRef    = ref(null)
const videoFilter      = ref('none')
const overlayFormat    = ref('classic')
const overlayColor     = ref('#00ff88')
const playerAspect     = ref('16:9')
const speedCurvePreset = ref('normal')
const activeTab        = ref('media')
const rightTab         = ref('video')

const pendingSeekAfterLoad = ref(null)
const pendingSameSegSeek   = ref(null)   // target localTime for in-progress same-seg cut seek
const hasVideo = computed(() => !!videoSrc.value)

// --- Top Toolbar Tabs (activate left panel) ---
const topTabs = [
  {
    id: 'media',
    label: 'Media',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="16" height="12" rx="2"/>
      <path d="M8 8l5 2.5L8 13V8z" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Audio',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 7H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2l4 3V4L6 7z"/>
      <path d="M15.54 4.46a7 7 0 0 1 0 11.08M12.66 7.34a3 3 0 0 1 0 5.32"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Text',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <path d="M4 5h12M10 5v10M7 15h6"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Stickers',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="7"/>
      <path d="M7 11s1 2 3 2 3-2 3-2M8 8h.01M12 8h.01"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Effects',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 3l1.5 3.5L15 8l-3.5 1.5L10 13l-1.5-3.5L5 8l3.5-1.5L10 3z"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Transitions',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="2" y="5" width="7" height="10" rx="1"/>
      <rect x="11" y="5" width="7" height="10" rx="1"/>
      <path d="M9 10h2"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Captions',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="2" y="13" width="16" height="4" rx="1"/>
      <path d="M5 15h4M11 15h4"/>
    </svg>`,
  },
  {
    id: null,
    label: 'Filters',
    disabled: true,
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <path d="M3 5h14M6 10h8M9 15h2"/>
    </svg>`,
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 15V9M7 15V5M11 15v-4M15 15V7"/>
    </svg>`,
  },
]

// --- Right Panel Tabs ---
const rightMainTabs = [
  { id: 'video',  label: 'Video'  },
  { id: 'color',  label: 'Color'  },
  { id: 'adjust', label: 'Adjust' },
]

function toggleTab(id) {
  if (!id) return
  activeTab.value = activeTab.value === id ? null : id
}

// ── Timecode display ──────────────────────────────────────────────────────────
function fmtTC(sec) {
  if (!sec || !isFinite(sec)) return '00:00:00:00'
  const h   = Math.floor(sec / 3600)
  const m   = Math.floor((sec % 3600) / 60)
  const s   = Math.floor(sec % 60)
  const f   = Math.floor((sec % 1) * 30)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`
}
const timecodeDisplay = computed(() => fmtTC(currentAbsTime.value))
const timecodeTotal   = computed(() => {
  const dur = videoDuration.value
  return dur > 0 ? fmtTC(dur) : '00:00:00:00'
})

// ── Seek helper ───────────────────────────────────────────────────────────────
function _doSeek(absoluteSec) {
  const { localTime, segmentChanged } = seekToAbsolute(absoluteSec)
  if (segmentChanged) {
    pendingSeekAfterLoad.value = localTime
  } else {
    videoStageRef.value?.seekTo(localTime)
  }
}

// ── Append multiple video files ───────────────────────────────────────────────
async function onVideoAppend(files) {
  for (const file of files) {
    const src      = URL.createObjectURL(file)
    const duration = await new Promise(resolve => {
      const v     = document.createElement('video')
      v.preload   = 'metadata'
      v.src       = src
      v.onloadedmetadata = () => { resolve(v.duration); v.src = '' }
      v.onerror          = () => resolve(0)
    })
    addSegment(src, duration, file.name)
  }
}

function onVideoSelect(i) {
  const seg = segments.value[i]
  if (!seg) return
  _doSeek(seg.offset)
}

// --- Export ---
const { exporting, exportProgress, exportError, startExport, cancel: cancelExport } = useVideoExport()

function onExport() {
  const videoEl = videoStageRef.value?.getVideoEl()
  startExport(
    videoEl, segments.value, gpxPoints.value, totalOffsetSec.value,
    stats.value?.totalTime ?? 0, trimStart.value, trimEnd.value,
    videoTrimStart.value, videoTrimEnd.value,
    overlayFormat.value, overlayColor.value,
    locationName.value,
    SHADER_PARAMS[videoFilter.value] ?? SHADER_PARAMS.none,
    speedCurvePreset.value,
    clips.value,
  )
}

function onTrimStart(val) {
  trimStart.value = val
  if (hasVideo.value) {
    const absTime = gpxIdxToAbsoluteTime(val)
    if (absTime >= 0) _doSeek(absTime)
  }
}
function onTrimEnd(val) {
  trimEnd.value = val
  if (hasVideo.value) {
    const absTime = gpxIdxToAbsoluteTime(val)
    if (absTime >= 0) _doSeek(absTime)
  }
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
  pendingSeekAfterLoad.value = null; pendingSameSegSeek.value = null
  await loadVideo(file)
}

function onTimeUpdate({ currentTime, duration }) {
  processTimeUpdate(currentTime, duration)
  if (!exporting.value && hasVideo.value) {
    const activeClips = clips.value
    if (!activeClips.length) return
    const absTime = currentAbsTime.value

    // Clear same-seg seek guard once video has arrived at the target
    if (pendingSameSegSeek.value !== null && currentTime >= pendingSameSegSeek.value - 0.05) {
      pendingSameSegSeek.value = null
    }

    for (let i = 0; i < activeClips.length - 1; i++) {
      const cur = activeClips[i]
      const nxt = activeClips[i + 1]
      const curSegIdx = cur.segmentIdx ?? 0
      const nxtSegIdx = nxt.segmentIdx ?? 0

      // Timeline gap (same or different segment)
      const inGap = absTime >= cur.end && absTime < nxt.start

      // Cross-segment boundary: fire as soon as we're at/past cur.end on cur's segment
      const crossSegBoundary = curSegIdx !== nxtSegIdx &&
        vidSegIdx.value === curSegIdx &&
        absTime >= cur.end - 0.08

      // Same-segment cut: jump 80ms before curVideoEnd so the first cut frame never shows
      const curVideoEnd   = (cur.segStart ?? 0) + (cur.end - cur.start)
      const nxtVideoStart = nxt.segStart ?? 0
      const samSegCut = curSegIdx === nxtSegIdx &&
        nxtVideoStart > curVideoEnd + 0.05 &&
        currentTime >= curVideoEnd - 0.08 &&
        currentTime < nxtVideoStart &&
        pendingSameSegSeek.value === null

      if ((inGap || crossSegBoundary || samSegCut) && pendingSeekAfterLoad.value === null) {
        if (samSegCut) pendingSameSegSeek.value = nxtVideoStart
        _doSeek(nxt.start)
        return
      }
    }
    const lastClip = activeClips[activeClips.length - 1]
    const lastVideoEnd = (lastClip.segStart ?? 0) + (lastClip.end - lastClip.start)
    const lastClipDone = lastClip &&
      vidSegIdx.value === (lastClip.segmentIdx ?? 0) &&
      currentTime >= lastVideoEnd - 0.08 &&
      pendingSeekAfterLoad.value === null &&
      pendingSameSegSeek.value === null
    if (lastClipDone) {
      vidPlaying.value = false
      _doSeek(activeClips[0].start)
    }
  }
}

function onVideoMetadata({ duration }) {
  if (pendingSeekAfterLoad.value !== null) {
    const t = pendingSeekAfterLoad.value
    pendingSeekAfterLoad.value = null; pendingSameSegSeek.value = null
    nextTick(() => videoStageRef.value?.seekTo(t))
    return
  }
  if (clips.value.length === 0) {
    setVideoDuration(duration)
  }
}

function onVideoTrimStart(val) { setVideoTrimStart(val); _doSeek(val) }
function onVideoTrimEnd(val)   { setVideoTrimEnd(val);   _doSeek(val) }
function onVideoSeek(sec)      { _doSeek(sec) }

function onVideoEnded() {
  const activeClips = clips.value
  const finishedSegIdx = vidSegIdx.value
  // Find the first clip that belongs to the next segment
  const nextClip = activeClips.find(c => (c.segmentIdx ?? 0) === finishedSegIdx + 1)
  if (nextClip) {
    _doSeek(nextClip.start)
  } else {
    vidPlaying.value = false
    _doSeek(activeClips[0]?.start ?? 0)
  }
}

function onSplit() {
  splitAtTime(currentAbsTime.value)
}

function onDeleteClip() {
  if (!hasVideo.value) return
  const idx = selectedClipIdx.value ?? activeClipIndex.value
  selectedClipIdx.value = null
  if (clips.value.length <= 1) {
    cleanupVideo()
    videoFileName.value = null
    return
  }
  deleteClip(idx)
  const remaining = clips.value
  if (remaining.length) {
    const target = remaining[Math.min(idx, remaining.length - 1)]
    _doSeek(target.start)
  }
}

function onReorderClips(newClips) {
  reorderClips(newClips)
}

function onTrimClip({ index, start, end }) {
  trimClip(index, start, end)
}

function onMergeClips(indexA) {
  mergeClips(indexA)
  selectedClipIdx.value = null
}

function onToggle() {
  if (hasVideo.value) vidPlaying.value = !vidPlaying.value
  else gpxToggle()
}

function onReset() {
  if (hasVideo.value) {
    vidPlaying.value = false
    _doSeek(videoTrimStart.value)
    vidAnimIdx.value  = trimStart.value
    vidProgress.value = 0
  } else { gpxReset() }
}

function resetAll() {
  gpxReset(); cleanupVideo(); geocodeClear()
  videoFileName.value = null; gpxFileName.value = null
  stravaOpen.value = false; videoFilter.value = 'none'
  pendingSeekAfterLoad.value = null; pendingSameSegSeek.value = null
  gpxPoints.value = []; stats.value = null; parseError.value = ''
}
function setManualOffset(val) { manualOffsetSec.value = val }

const _origLoadFile = loadFile
function loadFileWithName(file) {
  gpxFileName.value = file.name
  stravaOpen.value  = false
  _origLoadFile(file)
}

watch(gpxPoints, () => {
  gpxReset()
})

const { handleCallback: stravaHandleCallback } = useStravaAuth()
onMounted(async () => {
  if (window.location.search.includes('code=')) await stravaHandleCallback()
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => { window.removeEventListener('keydown', onKeyDown) })

function onKeyDown(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  if (!hasVideo.value || !videoDuration.value) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); onSplit(); return }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onDeleteClip(); return }
  if (e.key === ' ' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onToggle() }
}
function onStravaGpx(gpxString) {
  parseGPX(gpxString)
  gpxFileName.value = null
  stravaOpen.value  = false
}
</script>

<style scoped>
/* ── Root ──────────────────────────────────────────────────────────────────── */
.app-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.app-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: .4rem .75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg2);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.app-logo {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--text);
  flex-shrink: 0;
}
.logo-accent { color: var(--accent); }
.header-track {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
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
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
.track-name {
  font-size: 12px;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
}
.track-location svg { width: 10px; height: 10px; flex-shrink: 0; opacity: .6; }
.header-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.hdr-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: .3rem .65rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
  white-space: nowrap;
}
.hdr-btn:hover:not(:disabled) { border-color: var(--accent-semi); color: var(--accent); }
.hdr-btn--danger:hover:not(:disabled) { border-color: rgba(255,77,77,.4); color: var(--red); }
.hdr-btn:disabled { opacity: .35; cursor: not-allowed; }
.hdr-btn svg { width: 12px; height: 12px; }

.warn-banner {
  font-size: 11px;
  color: #e5ac00;
  background: rgba(229,172,0,.07);
  border-bottom: 1px solid rgba(229,172,0,.2);
  padding: .45rem .75rem;
  flex-shrink: 0;
}

/* ── Top Toolbar ───────────────────────────────────────────────────────────── */
.top-toolbar {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 6px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.top-toolbar::-webkit-scrollbar { display: none; }

.tt-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  position: relative;
  transition: color .15s;
  flex-shrink: 0;
  min-width: 56px;
}
.tt-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px; right: 8px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
  transition: background .15s;
}
.tt-btn:hover:not(.tt-disabled) { color: var(--text2); }
.tt-btn.active { color: var(--accent); }
.tt-btn.active::after { background: var(--accent); }
.tt-btn.tt-disabled { opacity: .35; cursor: not-allowed; }

.tt-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.tt-icon :deep(svg) { width: 20px; height: 20px; }
.tt-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .04em;
  text-align: center;
  line-height: 1;
  white-space: nowrap;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Left Panel ────────────────────────────────────────────────────────────── */
.left-panel {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg2);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Left panel tab row (Import / Record) */
.lp-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lp-tab {
  flex: 1;
  padding: .5rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
}
.lp-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.lp-tab:hover:not(.active) { color: var(--text2); }

.lp-header {
  padding: .6rem .9rem .45rem;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lp-section { padding: .6rem .85rem; }
.lp-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text3);
  margin-bottom: .5rem;
}
.lp-divider { height: 1px; background: var(--border); flex-shrink: 0; }
.lp-note {
  padding: .65rem .9rem;
  font-size: 11px;
  color: var(--text3);
  line-height: 1.5;
}

.sync-quick-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: .5rem;
}
.sync-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 20px;
  letter-spacing: .06em;
}
.sync-badge.auto  { background: rgba(34,197,94,.12); color: var(--accent-green); border: 1px solid rgba(34,197,94,.25); }
.sync-badge.manual { background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent-semi); }
.sync-val { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.sync-slider { width: 100%; accent-color: var(--accent); cursor: pointer; height: 20px; }

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
.strava-inline :deep(.strava-wrap) { padding: .5rem; gap: 6px; }
.strava-inline :deep(.strava-divider) { display: none; }
.strava-inline :deep(.strava-card) { padding: 8px 10px; }
.strava-inline :deep(.strava-row) { gap: 6px; padding: 5px 4px; }

/* ── Main Canvas ───────────────────────────────────────────────────────────── */
.main-canvas {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  position: relative;
  background: var(--bg);
}
.main-canvas :deep(.stage) {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  width: auto;
  max-width: 100%;
  align-self: center;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
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
.synced-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent-glow); }

/* Timecode display */
.timecode-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: .35rem 1rem;
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
}
.timecode-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: .08em;
}
.timecode-total {
  font-size: 11px;
  font-weight: 500;
  color: var(--text3);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: .06em;
}

.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
}
.canvas-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.canvas-empty-inner p {
  font-size: 12px;
  color: var(--text3);
  letter-spacing: .06em;
}
.controls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .6rem .85rem;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
}

/* ── Right Panel ───────────────────────────────────────────────────────────── */
.right-panel {
  width: 248px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Main tabs row */
.rp-main-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.rp-main-tabs::-webkit-scrollbar { display: none; }

.rp-main-tab {
  flex: 1;
  padding: .5rem .3rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
  white-space: nowrap;
}
.rp-main-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.rp-main-tab:hover:not(.active) { color: var(--text2); }

/* Sub-tabs row */
.rp-sub-tabs {
  display: flex;
  gap: 4px;
  padding: .45rem .7rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.rp-sub-tab {
  padding: .2rem .55rem;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  letter-spacing: .03em;
  transition: background .15s, color .15s, border-color .15s;
}
.rp-sub-tab.active {
  background: var(--bg3);
  color: var(--text);
  border-color: var(--border2);
}
.rp-sub-tab:hover:not(.active) { color: var(--text2); }

/* Right panel body */
.rp-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.rp-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .5rem .8rem .3rem;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text2);
}

.rp-section { padding: .4rem .8rem .6rem; }

.rp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .4rem;
}
.rp-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text3);
}
.rp-divider { height: 1px; background: var(--border); margin: .2rem 0; }
.rp-note {
  padding: .6rem .8rem;
  font-size: 11px;
  color: var(--text3);
  line-height: 1.5;
}

/* ── Timeline ──────────────────────────────────────────────────────────────── */
.app-timeline {
  border-top: 1px solid var(--border);
  background: var(--bg2);
  flex-shrink: 0;
  overflow: hidden;
}
.timeline-empty { }
.timeline-empty-inner {
  display: flex;
  align-items: stretch;
  height: 56px;
}
.tl-track-head {
  width: 60px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg3);
}
.tl-track-body {
  flex: 1;
  display: flex;
  align-items: center;
  padding: .5rem .75rem;
}
.timeline-empty-track {
  flex: 1;
  height: 28px;
  border-radius: 4px;
  background: repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 1px, transparent 1px, transparent 48px);
  border: 1px solid var(--border);
  opacity: 0.5;
}
</style>
