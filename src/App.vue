<template>
  <div class="app-root">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <div class="logo-mark">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 3l9 5-9 5V3z"/></svg>
          </div>
          <span class="logo-text">GPX<span>2</span>VIDEO</span>
        </div>
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

    <!-- ── Body ────────────────────────────────────────────────────────────── -->
    <div class="app-body" :class="dragCursorClass">

      <!-- ── Side Nav ──────────────────────────────────────────────────────── -->
      <nav class="side-nav">
        <button
          v-for="tab in topTabs"
          :key="tab.id"
          class="sn-btn"
          :class="{ active: activeTab === tab.id, 'sn-disabled': tab.disabled }"
          @click="!tab.disabled && toggleTab(tab.id)"
        >
          <span class="sn-icon" v-html="tab.icon" />
          <span class="sn-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Left Panel -->
      <aside v-show="activeTab" class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
        <div class="resize-handle resize-handle--ew" @mousedown.prevent="startDragLeft" />

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
              :loaded="gpxPoints.length > 0"
              :strava-open="stravaOpen"
              @file="loadFileWithName"
              @remove="removeGpx"
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
              ref="videoLoaderRef"
              @file="onVideoFile"
              @append="onVideoAppend"
              @select="onVideoSelect"
              @clear="onVideoClear"
            />
          </div>
          <div v-if="hasVideo && hasTimestamps" class="lp-divider" />
          <div v-if="hasVideo && hasTimestamps" class="lp-section">
            <div class="sync-quick-header">
              <span class="lp-label" style="margin:0">Sync Offset</span>
              <span class="sync-badge" :class="autoDetected ? 'auto' : 'manual'">
                {{ autoDetected ? (autoDetectSource === 'filedate' ? 'Auto (file date) ✓' : 'Auto ✓') : 'Manual' }}
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
          <div class="lp-header">Track Stats
          </div>
          <div v-if="!stats" class="lp-note">Load a GPX file to see stats.</div>
          <div v-else class="lp-section">
            <MetricsRow :stats="stats" />
          </div>
        </template>

        <!-- Captions -->
        <template v-if="activeTab === 'captions'">
          <div class="lp-header">Captions</div>
          <CaptionEditor
            :video-src="videoSrc"
            :status="captionStatus"
            :progress="captionProgress"
            :error="captionError"
            :segments="captionSegments"
            :model-size="captionModelSize"
            v-model:style="captionStyle"
            @transcribe="onCaptionTranscribe"
            @set-model="captionModelSize = $event"
            @add="addCaption"
            @remove="removeCaption"
            @update="updateCaption"
            @clear="clearCaptions"
          />
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
          :caption-segments="captionSegments"
          v-model:caption-style="captionStyle"
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
      <aside class="right-panel" :style="{ width: rightPanelWidth + 'px' }">
        <div class="resize-handle resize-handle--ew resize-handle--ew-left" @mousedown.prevent="startDragRight" />
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
    <div class="app-timeline" :style="timelineHeight ? { height: timelineHeight + 'px' } : {}">
      <div class="resize-handle resize-handle--ns" @mousedown.prevent="startDragBottom" />

      <!-- Tab bar -->
      <div class="tl-tabs">
        <button
          v-for="t in timelineTabs"
          :key="t.id"
          class="tl-tab"
          :class="{ active: timelineTab === t.id }"
          @click="timelineTab = t.id"
        >{{ t.label }}</button>
      </div>

      <SyncPanel
        :points="gpxPoints"
        :anim-idx="activeAnimIdx"
        :trim-start="trimStart"
        :trim-end="trimEnd"
        :has-video="hasVideo"
        :has-timestamps="hasTimestamps"
        :auto-detected="autoDetected"
        :auto-detect-source="autoDetectSource"
        :video-start-time="videoStartTime"
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
        :timeline-tab="timelineTab"
        @update:trim-start="onTrimStart"
        @update:trim-end="onTrimEnd"
        @update:manual-offset-sec="setManualOffset"
        @update:video-trim-start="onVideoTrimStart"
        @update:video-trim-end="onVideoTrimEnd"
        @seek="onVideoSeek"
        @seek-gpx="onGpxSeek"
        @gpx-window-drag="setGpxWindowStart"
        @move-clip="({ index, newStart }) => moveClip(index, newStart)"
        @select-clip="i => { selectedClipIdx = i }"
        @reorder-clips="onReorderClips"
        @trim-clip="onTrimClip"
        @merge-clips="onMergeClips"
        @set-current-frame-time="onSetCurrentFrameTime"
        @drop-video="f => hasVideo ? onVideoAppend([f]) : onVideoFile(f)"
        :captions="captionSegments"
      />
      <ChartRow v-show="timelineTab === 'charts'" :points="gpxPoints" />
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
import CaptionEditor           from './components/CaptionEditor.vue'
import { useWhisperTranscription, releaseWhisperWorker } from './composables/useWhisperTranscription.js'
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
  videoAbsProgress: vidAbsProgress, autoDetected, autoDetectSource, manualOffsetSec, totalOffsetSec,
  trimStart, trimEnd, videoDuration, videoTrimStart, videoTrimEnd,
  clips, timelineShift, activeClipIndex, currentAbsTime,
  splitAtTime, deleteClip, moveClip, reorderClips, trimClip, mergeClips,
  setVideoTrimStart, setVideoTrimEnd,
  setVideoDuration, addSegment, advanceSegment, seekToAbsolute,
  gpxWindowIdx, setGpxWindowStart, setCurrentFrameTime, loadVideo,
  onTimeUpdate: processTimeUpdate, gpxIdxToAbsoluteTime, cleanup: cleanupVideo,
} = useVideoSync(gpxPoints)

// ── Panel resize ─────────────────────────────────────────────────────────────
const leftPanelWidth  = ref(260)
const rightPanelWidth = ref(248)
const timelineHeight  = ref(null)

const dragging = ref(null) // 'left' | 'right' | 'bottom'
const dragCursorClass = computed(() => ({
  'is-dragging-ew': dragging.value === 'left' || dragging.value === 'right',
  'is-dragging-ns': dragging.value === 'bottom',
}))

let _dragStartX = 0, _dragStartY = 0, _dragStartSize = 0
let _appTimelineEl = null

function startDragLeft(e) {
  dragging.value = 'left'; _dragStartX = e.clientX; _dragStartSize = leftPanelWidth.value
  _attachDragListeners()
}
function startDragRight(e) {
  dragging.value = 'right'; _dragStartX = e.clientX; _dragStartSize = rightPanelWidth.value
  _attachDragListeners()
}
function startDragBottom(e) {
  dragging.value = 'bottom'; _dragStartY = e.clientY
  _appTimelineEl = e.currentTarget.parentElement
  _dragStartSize = _appTimelineEl.offsetHeight
  _attachDragListeners()
}
function _attachDragListeners() {
  document.addEventListener('mousemove', _onDragMove)
  document.addEventListener('mouseup', _stopDrag)
}
function _onDragMove(e) {
  if (dragging.value === 'left') {
    leftPanelWidth.value = Math.max(160, Math.min(520, _dragStartSize + (e.clientX - _dragStartX)))
  } else if (dragging.value === 'right') {
    rightPanelWidth.value = Math.max(160, Math.min(520, _dragStartSize - (e.clientX - _dragStartX)))
  } else if (dragging.value === 'bottom') {
    timelineHeight.value = Math.max(80, Math.min(600, _dragStartSize - (e.clientY - _dragStartY)))
  }
}
function _stopDrag() {
  dragging.value = null
  document.removeEventListener('mousemove', _onDragMove)
  document.removeEventListener('mouseup', _stopDrag)
}

const selectedClipIdx  = ref(null)  // user-click selection; null = fall back to activeClipIndex
const videoFileName    = ref(null)
const gpxFileName      = ref(null)
const stravaOpen       = ref(false)
const videoStageRef    = ref(null)
const videoLoaderRef   = ref(null)
const videoFilter      = ref('none')
const overlayFormat    = ref('classic')
const overlayColor     = ref('#00ff88')
const playerAspect     = ref('16:9')
const speedCurvePreset = ref('normal')
const activeTab        = ref('media')
const captionStyle     = ref({ placement: 'bot-center', fontSize: 15, fontFamily: 'sans', color: '#ffffff', bold: true, allCaps: false, lowercase: false, background: true, bgOpacity: 55, outline: false })

const {
  status: captionStatus, progress: captionProgress, error: captionError,
  segments: captionSegments, modelSize: captionModelSize,
  transcribe: runTranscription,
  addSegment: addCaption, removeSegment: removeCaption,
  updateSegment: updateCaption, clearSegments: clearCaptions,
} = useWhisperTranscription()

async function onCaptionTranscribe() {
  if (!videoSrc.value) return
  const res  = await fetch(videoSrc.value)
  const blob = await res.blob()
  await runTranscription(blob)
}
const rightTab         = ref('video')
const timelineTab      = ref('video')

const timelineTabs = [
  { id: 'gpx',    label: 'GPX' },
  { id: 'video',  label: 'Video' },
  { id: 'sync',   label: 'Sync' },
  { id: 'charts', label: 'Charts' },
]

const pendingSeekAfterLoad = ref(null)
const pendingSameSegSeek   = ref(null)   // target localTime for in-progress same-seg cut seek
const hasVideo = computed(() => !!videoSrc.value)

const videoStartTime = computed(() => {
  const pts = gpxPoints.value
  if (!pts.length || !pts[0].time) return null
  return new Date(pts[0].time.getTime() + totalOffsetSec.value * 1000)
})

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
    id: 'captions',
    label: 'Captions',
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
      const timer = setTimeout(() => { v.src = ''; resolve(0) }, 15000)
      v.onloadedmetadata = () => { clearTimeout(timer); resolve(v.duration); v.src = '' }
      v.onerror          = () => { clearTimeout(timer); resolve(0) }
      v.src = src
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
  releaseWhisperWorker()   // free WASM model memory before VideoEncoder starts
  const videoEl = videoStageRef.value?.getVideoEl()
  startExport(
    videoEl, segments.value, gpxPoints.value, totalOffsetSec.value,
    stats.value?.totalTime ?? videoDuration.value ?? 0, trimStart.value, trimEnd.value,
    videoTrimStart.value, videoTrimEnd.value,
    overlayFormat.value, overlayColor.value,
    locationName.value,
    SHADER_PARAMS[videoFilter.value] ?? SHADER_PARAMS.none,
    speedCurvePreset.value,
    gpxPoints.value.length ? clips.value : null,
    captionSegments.value,
    captionStyle.value,
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

function onVideoClear() {
  // Revoke any existing object URLs before clearing
  segments.value.forEach(s => { try { URL.revokeObjectURL(s.src) } catch {} })
  segments.value  = []
  clips.value     = []
  vidSegIdx.value = 0
  videoFileName.value = null
  pendingSeekAfterLoad.value = null
  pendingSameSegSeek.value   = null
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

function onVideoMetadata({ duration, videoWidth, videoHeight }) {
  if (pendingSeekAfterLoad.value !== null) {
    const t = pendingSeekAfterLoad.value
    pendingSeekAfterLoad.value = null; pendingSameSegSeek.value = null
    nextTick(() => videoStageRef.value?.seekTo(t))
    return
  }
  if (clips.value.length === 0) {
    setVideoDuration(duration)
    if (videoWidth && videoHeight) {
      playerAspect.value = videoHeight > videoWidth ? '9:16' : '16:9'
    }
  }
}

function onVideoTrimStart(val) { setVideoTrimStart(val); _doSeek(val) }
function onVideoTrimEnd(val)   { setVideoTrimEnd(val);   _doSeek(val) }
function onVideoSeek(sec)      { _doSeek(sec) }
function onGpxSeek(idx)        { gpxAnimIdx.value = Math.max(0, Math.min(idx, gpxPoints.value.length - 1)) }
function onSetCurrentFrameTime(date) { setCurrentFrameTime(date); _doSeek(videoTrimStart.value) }

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
  videoLoaderRef.value?.clearCache()
  videoFileName.value = null; gpxFileName.value = null
  stravaOpen.value = false; videoFilter.value = 'none'
  pendingSeekAfterLoad.value = null; pendingSameSegSeek.value = null
  gpxPoints.value = []; stats.value = null; parseError.value = ''
}
function removeGpx() {
  gpxReset(); geocodeClear()
  gpxFileName.value = null; stravaOpen.value = false
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
function onStravaGpx(gpxString, activity) {
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
  gap: 8px;
  padding: 0 12px;
  height: 44px;
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
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.logo-mark {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--blue);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo-mark svg { width: 12px; height: 12px; color: #fff; }
.logo-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.logo-text span { color: var(--text2); font-weight: 400; }
.header-track {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.track-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--green);
  flex-shrink: 0;
  animation: pulse 2s ease infinite;
}
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
.track-name {
  font-size: 12px;
  font-weight: 400;
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
.track-location svg { width: 10px; height: 10px; flex-shrink: 0; opacity: .5; }
.header-tools {
  display: flex;
  align-items: center;
  gap: 5px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.hdr-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: .28rem .6rem;
  height: 28px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: var(--bg3);
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  white-space: nowrap;
}
.hdr-btn:hover:not(:disabled) {
  border-color: var(--border3);
  color: var(--text);
  background: var(--bg4);
}
.hdr-btn--danger:hover:not(:disabled) { border-color: rgba(239,68,68,.4); color: var(--red); background: rgba(239,68,68,.06); }
.hdr-btn:disabled { opacity: .35; cursor: not-allowed; }
.hdr-btn svg { width: 12px; height: 12px; flex-shrink: 0; }

.warn-banner {
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245,158,11,.07);
  border-bottom: 1px solid rgba(245,158,11,.18);
  padding: .4rem .75rem;
  flex-shrink: 0;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Side Nav (vertical icon toolbar) ─────────────────────────────────────── */
.side-nav {
  width: 64px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.side-nav::-webkit-scrollbar { display: none; }

.sn-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 52px;
  padding: 8px 0 7px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-radius: var(--radius-lg);
  transition: color .15s, background .15s;
  flex-shrink: 0;
  position: relative;
}
.sn-btn:hover:not(.sn-disabled) {
  color: var(--text2);
  background: var(--bg4);
}
.sn-btn.active {
  color: var(--text);
  background: var(--bg5);
}
.sn-btn.sn-disabled {
  opacity: .3;
  cursor: not-allowed;
}

.sn-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sn-icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.sn-label {
  font-size: 9.5px;
  font-weight: 500;
  text-align: center;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0;
}

/* ── Resize handles ─────────────────────────────────────────────────────────── */
.resize-handle {
  position: absolute;
  z-index: 100;
  background: transparent;
  transition: background .12s;
}
.resize-handle:hover, .resize-handle:active { background: var(--border3); }
.resize-handle--ew {
  top: 0; right: -2px; bottom: 0;
  width: 4px;
  cursor: col-resize;
}
.resize-handle--ew-left {
  right: auto;
  left: -2px;
}
.resize-handle--ns {
  top: -2px; left: 0; right: 0;
  height: 4px;
  cursor: row-resize;
}
.is-dragging-ew, .is-dragging-ew * { cursor: col-resize !important; user-select: none !important; }
.is-dragging-ns, .is-dragging-ns * { cursor: row-resize !important; user-select: none !important; }

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
  position: relative;
}

/* Left panel tab row (Import / Record) */
.lp-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  padding: 0 12px;
}
.lp-tab {
  padding: .55rem .5rem;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
  margin-bottom: -1px;
}
.lp-tab.active { color: var(--text); border-bottom-color: var(--text); }
.lp-tab:hover:not(.active) { color: var(--text2); }

.lp-header {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lp-section { padding: .65rem 12px; }
.lp-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text3);
  margin-bottom: .5rem;
}
.lp-divider { height: 1px; background: var(--border); flex-shrink: 0; }
.lp-note {
  padding: .65rem 12px;
  font-size: 12px;
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
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
}
.sync-badge.auto  { background: rgba(34,197,94,.12); color: var(--green); border: 1px solid rgba(34,197,94,.22); }
.sync-badge.manual { background: var(--bg4); color: var(--text2); border: 1px solid var(--border2); }
.sync-val { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.sync-slider { width: 100%; accent-color: var(--blue); cursor: pointer; height: 20px; }

.import-error {
  font-size: 11px;
  color: var(--red);
  margin-top: .4rem;
  padding: .4rem .6rem;
  background: rgba(239,68,68,.06);
  border-radius: var(--radius-md);
  border: 1px solid rgba(239,68,68,.18);
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
  font-size: 11px;
  font-weight: 500;
  color: var(--green);
  background: rgba(20,20,20,.88);
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid rgba(34,197,94,.22);
  backdrop-filter: blur(8px);
  pointer-events: none;
}
.synced-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); }

/* Timecode display */
.timecode-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: .32rem 1rem;
  flex-shrink: 0;
  width: 100%;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
}
.timecode-val {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: .06em;
}
.timecode-total {
  font-size: 11px;
  font-weight: 400;
  color: var(--text3);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Fira Code', monospace;
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
  font-size: 13px;
  color: var(--text3);
}
.controls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .55rem 12px;
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
  position: relative;
}

/* Main tabs row */
.rp-main-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 8px;
}
.rp-main-tabs::-webkit-scrollbar { display: none; }

.rp-main-tab {
  padding: .5rem .45rem;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
  white-space: nowrap;
  margin-bottom: -1px;
}
.rp-main-tab.active { color: var(--text); border-bottom-color: var(--text); }
.rp-main-tab:hover:not(.active) { color: var(--text2); }

/* Sub-tabs row */
.rp-sub-tabs {
  display: flex;
  gap: 3px;
  padding: .4rem 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.rp-sub-tab {
  padding: .22rem .55rem;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.rp-sub-tab.active {
  background: var(--bg4);
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
  padding: .6rem 12px .3rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
}

.rp-section { padding: .35rem 12px .55rem; }

.rp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .4rem;
}
.rp-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--text3);
  min-width: 52px;
}
.rp-divider { height: 1px; background: var(--border); margin: .25rem 0; }
.rp-note {
  padding: .6rem 12px;
  font-size: 12px;
  color: var(--text3);
  line-height: 1.5;
}

/* ── Timeline ──────────────────────────────────────────────────────────────── */
.app-timeline {
  border-top: 1px solid var(--border);
  background: var(--bg2);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.tl-tabs {
  display: flex;
  gap: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
}
.tl-tab {
  padding: 0 14px;
  height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color .15s, border-color .15s;
}
.tl-tab:hover { color: var(--text2); }
.tl-tab.active {
  color: var(--text);
  border-bottom-color: var(--text);
}
</style>
