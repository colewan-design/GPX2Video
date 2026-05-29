<template>
  <div class="sync-panel">
    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">Track timeline</span>
      <span v-if="points.length" class="range-info">{{ trimRangeText }}</span>
    </div>

    <!-- Elevation area -->
    <div
      class="elev-wrap"
      ref="wrapRef"
      :class="{ 'is-draggable': useWindow }"
      @mousedown.prevent="beginWindowPan"
      @touchstart.prevent="beginWindowPan"
    >
      <canvas ref="canvasRef" class="elev-canvas" />

      <!-- Dim overlays outside trim region (GPX-only mode) -->
      <template v-if="!useWindow">
        <div class="dim dim-left"  :style="{ width: startPct + '%' }" />
        <div class="dim dim-right" :style="{ width: (100 - endPct) + '%' }" />
      </template>

      <!-- Playhead -->
      <div class="playhead" :style="{ left: activeAnimPct + '%' }" />

      <!-- Trim handles (GPX-only mode) -->
      <template v-if="!hasVideo">
        <div
          class="handle handle-start"
          :style="{ left: startPct + '%' }"
          @mousedown.stop.prevent="beginDrag('start', $event)"
          @touchstart.stop.prevent="beginDrag('start', $event)"
        />
        <div
          class="handle handle-end"
          :style="{ left: endPct + '%' }"
          @mousedown.stop.prevent="beginDrag('end', $event)"
          @touchstart.stop.prevent="beginDrag('end', $event)"
        />
      </template>
    </div>

    <!-- Video timeline strip (always visible) -->
    <div class="panel-header" style="margin-top:.65rem">
      <span class="panel-title">Video timeline</span>
      <span v-if="hasVideo && videoDuration > 0" class="range-info range-info--hint">Ctrl+scroll to zoom · drag clips · drag playhead</span>
      <span v-if="hasVideo && videoDuration > 0" class="range-info">{{ videoTrimRangeText }}</span>
    </div>

    <!-- NLE-style video timeline (drag-to-append wrapper) -->
    <div
      v-if="hasVideo && videoDuration > 0"
      class="vtl-drop-wrap"
      :class="{ 'drop-over': dropOver }"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onVideoDrop"
    >
      <VideoTimeline
        :clips="clips"
        :segments="segments"
        :video-duration="videoDuration"
        :timeline-shift="timelineShift"
        :video-progress="videoProgress"
        :video-trim-start="videoTrimStart"
        :video-trim-end="videoTrimEnd"
        :active-clip-idx="activeClipIdx"
        @seek="$emit('seek', $event)"
        @move-clip="$emit('move-clip', $event)"
        @select-clip="$emit('select-clip', $event)"
        @reorder-clips="$emit('reorder-clips', $event)"
        @trim-clip="$emit('trim-clip', $event)"
        @merge-clips="$emit('merge-clips', $event)"
      />
      <div v-if="dropOver" class="vtl-drop-overlay">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10M6 9l4 4 4-4"/><rect x="2" y="15" width="16" height="2" rx="1"/></svg>
        Append video
      </div>
    </div>

    <!-- Empty video drop zone (always visible when no video) -->
    <div
      v-else-if="!hasVideo"
      class="video-empty-drop video-empty-drop--always"
      :class="{ 'drop-over': dropOver }"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onVideoDrop"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10M6 9l4 4 4-4"/><rect x="2" y="15" width="16" height="2" rx="1"/></svg>
      Drop video here or use the Media panel
    </div>

    <!-- Offset row — only with video + timestamps -->
    <div v-if="hasVideo && hasTimestamps" class="offset-row">
      <div class="offset-left">
        <span class="sync-label">GPX–Video sync</span>
        <span v-if="autoDetected" class="badge auto" title="Offset was detected automatically from timestamps">Auto</span>
        <span v-else class="badge manual" title="Offset was adjusted manually">Manual</span>
      </div>
      <input
        class="offset-slider"
        type="range"
        min="-300"
        max="300"
        step="0.5"
        :value="manualOffsetSec"
        @input="$emit('update:manualOffsetSec', Number($event.target.value))"
        title="Slide to align your GPX track with the video. Positive = GPX starts later than video."
      />
      <span class="offset-val">{{ offsetDisplay }}</span>
      <button class="offset-reset" title="Reset to auto-detected offset" @click="$emit('update:manualOffsetSec', 0)">↺</button>
    </div>
    <div v-if="hasVideo && hasTimestamps" class="offset-hint">
      Drag the slider if the speed/map overlay appears out of sync with your footage.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { fmtTime } from '../utils/geo.js'
import { useDraggedVideo } from '../composables/useDraggedVideo.js'
import VideoTimeline from './VideoTimeline.vue'

const props = defineProps({
  points:          { type: Array,   required: true },
  animIdx:         { type: Number,  default: 0 },
  trimStart:       { type: Number,  default: 0 },
  trimEnd:         { type: Number,  default: 0 },
  hasVideo:        { type: Boolean, default: false },
  hasTimestamps:   { type: Boolean, default: true },
  autoDetected:    { type: Boolean, default: false },
  manualOffsetSec: { type: Number,  default: 0 },
  totalOffsetSec:  { type: Number,  default: 0 },
  videoDuration:   { type: Number,  default: 0 },
  videoTrimStart:  { type: Number,  default: 0 },
  videoTrimEnd:    { type: Number,  default: 0 },
  videoProgress:   { type: Number,  default: 0 },
  windowStartIdx:  { type: Number,  default: 0 },
  windowEndIdx:    { type: Number,  default: 0 },
  clips:           { type: Array,   default: () => [] },
  activeClipIdx:   { type: Number,  default: 0 },
  segments:        { type: Array,   default: () => [] },
  timelineShift:   { type: Number,  default: 0 },
})

const emit = defineEmits([
  'update:trimStart', 'update:trimEnd', 'update:manualOffsetSec',
  'update:videoTrimStart', 'update:videoTrimEnd',
  'seek', 'gpxWindowDrag', 'drop-video', 'move-clip', 'select-clip', 'reorder-clips', 'trim-clip', 'merge-clips',
])

const { draggedFile, isDragging } = useDraggedVideo()
const dropOver = ref(false)

function onDragOver() { if (isDragging.value) dropOver.value = true }
function onDragLeave() { dropOver.value = false }
function onVideoDrop() {
  dropOver.value = false
  if (draggedFile.value) emit('drop-video', draggedFile.value)
}

// ─── Percentages ──────────────────────────────────────────────────────────────
const N         = computed(() => Math.max(1, props.points.length - 1))
const startPct  = computed(() => (props.trimStart / N.value) * 100)
const endPct    = computed(() => (props.trimEnd   / N.value) * 100)

// Window mode: active when video loaded + GPX has timestamps + window indices are valid
const useWindow = computed(() =>
  props.hasVideo && props.hasTimestamps && props.windowEndIdx > props.windowStartIdx
)

// Playhead: always absolute position over the full GPX track
const activeAnimPct = computed(() =>
  Math.max(0, Math.min((props.animIdx / N.value) * 100, 100))
)

const videoTrimRangeText = computed(() => {
  if (!props.videoDuration) return ''
  const fmt = (s) => {
    const m   = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }
  if (props.clips && props.clips.length > 1) {
    const total = props.clips.reduce((sum, c) => sum + (c.end - c.start), 0)
    return `${props.clips.length} clips  ·  ${fmt(total)}`
  }
  const dur = props.videoTrimEnd - props.videoTrimStart
  return `${fmt(props.videoTrimStart)} → ${fmt(props.videoTrimEnd)}  ·  ${fmt(dur)}`
})

const offsetDisplay = computed(() => {
  const v = props.totalOffsetSec
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}s`
})

const trimRangeText = computed(() => {
  const pts = props.points
  if (!pts.length) return ''
  const s = pts[0]
  const e = pts[pts.length - 1]
  if (!s || !e) return ''
  const d2 = (e.cumDist / 1000).toFixed(1)
  if (s.time && e.time) {
    return `${d2} km  ·  ${fmtTime(e.time - s.time)}`
  }
  return `${d2} km`
})

// ─── Canvas elevation drawing ─────────────────────────────────────────────────
const wrapRef   = ref(null)
const canvasRef = ref(null)
let ctx = null
let ro  = null

// Sample points for drawing — always the full GPX track
const sampled = computed(() => {
  const pts = props.points
  if (!pts.length) return []
  const to    = pts.length - 1
  const step  = Math.max(1, Math.floor(to / 400))
  const result = []
  for (let i = 0; i <= to; i += step) result.push({ i, ele: pts[i].ele })
  if (result[result.length - 1]?.i !== to) result.push({ i: to, ele: pts[to].ele })
  return result
})

function draw() {
  if (!ctx || !props.points.length || !canvasRef.value) return
  const pts  = sampled.value
  const W    = canvasRef.value.width
  const H    = canvasRef.value.height

  const eleMin = pts.reduce((a, p) => Math.min(a, p.ele), Infinity)
  const eleMax = pts.reduce((a, p) => Math.max(a, p.ele), -Infinity)
  const range  = (eleMax - eleMin) || 1

  const toX = (i) => (i / N.value) * W
  const toY = (e) => H - 3 - ((e - eleMin) / range) * (H - 8)

  ctx.clearRect(0, 0, W, H)

  // Window region highlight (shown when video is synced)
  if (useWindow.value && props.windowEndIdx > props.windowStartIdx) {
    const wx1 = (props.windowStartIdx / N.value) * W
    const wx2 = (props.windowEndIdx   / N.value) * W
    ctx.fillStyle = 'rgba(255,214,10,0.07)'
    ctx.fillRect(wx1, 0, wx2 - wx1, H)
    ctx.strokeStyle = 'rgba(255,214,10,0.30)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(wx1, 0); ctx.lineTo(wx1, H)
    ctx.moveTo(wx2, 0); ctx.lineTo(wx2, H)
    ctx.stroke()
  }

  // Filled area
  ctx.beginPath()
  pts.forEach((p, si) => {
    const x = toX(p.i)
    const y = toY(p.ele)
    si === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,214,10,0.06)'
  ctx.fill()

  // Elevation line
  ctx.beginPath()
  pts.forEach((p, si) => {
    const x = toX(p.i)
    const y = toY(p.ele)
    si === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,214,10,0.50)'
  ctx.lineWidth   = 1.5
  ctx.lineJoin    = 'round'
  ctx.stroke()
}

function onResize(entries) {
  const { width, height } = entries[0].contentRect
  canvasRef.value.width  = Math.round(width)
  canvasRef.value.height = Math.round(height)
  draw()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  ro  = new ResizeObserver(onResize)
  ro.observe(wrapRef.value)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup',   endDrag)
  window.removeEventListener('touchmove', onDragMove)
  window.removeEventListener('touchend',  endDrag)
  window.removeEventListener('mousemove', onWindowPanMove)
  window.removeEventListener('mouseup',   endWindowPan)
  window.removeEventListener('touchmove', onWindowPanMove)
  window.removeEventListener('touchend',  endWindowPan)
})

watch(() => props.points, draw)
watch(() => [props.windowStartIdx, props.windowEndIdx], draw)

// ─── Drag logic ───────────────────────────────────────────────────────────────
let dragging = null

function beginDrag(which, event) {
  dragging = which
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup',   endDrag)
  window.addEventListener('touchmove', onDragMove, { passive: false })
  window.addEventListener('touchend',  endDrag)
}

function onDragMove(event) {
  if (!dragging || !wrapRef.value) return
  event.preventDefault()

  const rect    = wrapRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const rawPct  = (clientX - rect.left) / rect.width
  const rawIdx  = Math.round(Math.max(0, Math.min(1, rawPct)) * N.value)

  // Minimum gap: 2% of total points or at least 1 point
  const minGap = Math.max(1, Math.round(N.value * 0.02))

  if (dragging === 'start') {
    emit('update:trimStart', Math.min(rawIdx, props.trimEnd - minGap))
  } else {
    emit('update:trimEnd', Math.max(rawIdx, props.trimStart + minGap))
  }
}

function endDrag() {
  dragging = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup',   endDrag)
  window.removeEventListener('touchmove', onDragMove)
  window.removeEventListener('touchend',  endDrag)
}

// ─── GPX window pan (drag elevation strip to reposition the sync window) ─────
let panAnchor = null  // { clientX, windowStartIdx }

function beginWindowPan(event) {
  if (!useWindow.value || !wrapRef.value) return
  // Seek video to the clicked absolute GPX position
  const rect    = wrapRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const pct     = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const clickedIdx = Math.round(pct * N.value)
  // If click is within the window, use it as a seek; otherwise begin panning
  if (clickedIdx >= props.windowStartIdx && clickedIdx <= props.windowEndIdx) {
    const winPct = (clickedIdx - props.windowStartIdx) / Math.max(1, props.windowEndIdx - props.windowStartIdx)
    const sec = props.videoTrimStart + winPct * (props.videoTrimEnd - props.videoTrimStart)
    emit('seek', sec)
  }
  panAnchor = { clientX, windowStartIdx: props.windowStartIdx }
  window.addEventListener('mousemove', onWindowPanMove)
  window.addEventListener('mouseup',   endWindowPan)
  window.addEventListener('touchmove', onWindowPanMove, { passive: false })
  window.addEventListener('touchend',  endWindowPan)
}

function onWindowPanMove(event) {
  if (!panAnchor || !wrapRef.value) return
  event.preventDefault()
  const rect    = wrapRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  // Drag 1 full canvas width = traverse the entire GPX track
  const deltaFrac = (clientX - panAnchor.clientX) / rect.width
  const totalN    = Math.max(1, props.points.length - 1)
  const newStart  = panAnchor.windowStartIdx + Math.round(deltaFrac * totalN)
  const newFrac   = Math.max(0, Math.min(1, newStart / totalN))
  emit('gpxWindowDrag', newFrac)
}

function endWindowPan() {
  panAnchor = null
  window.removeEventListener('mousemove', onWindowPanMove)
  window.removeEventListener('mouseup',   endWindowPan)
  window.removeEventListener('touchmove', onWindowPanMove)
  window.removeEventListener('touchend',  endWindowPan)
}


</script>

<style scoped>
.sync-panel {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: .65rem .9rem 0;
  margin-bottom: 0;
  overflow: hidden;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .45rem;
}
.panel-title { font-size: 11px; font-weight: 500; color: var(--text2); text-transform: uppercase; letter-spacing: .04em; }
.range-info  { font-size: 11px; color: var(--text3); }
.range-info--hint { color: var(--text3); opacity: 0.6; font-style: italic; margin-right: auto; margin-left: 6px; }

/* Elevation area */
.elev-wrap {
  position: relative;
  height: 60px;
  cursor: default;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg);
}
.elev-wrap.is-draggable { cursor: grab; }
.elev-wrap.is-draggable:active { cursor: grabbing; }
.elev-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Dim overlays outside active trim region */
.dim {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.58);
  pointer-events: none;
  z-index: 4;
}
.dim-left  { left: 0; }
.dim-right { right: 0; }

/* Playhead */
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 6;
}
.playhead::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--accent-glow);
}

/* Trim handles */
.handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  transform: translateX(-50%);
  cursor: ew-resize;
  z-index: 8;
}
/* Vertical bar */
.handle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.85);
}
/* Bottom grip pill */
.handle::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 20px;
  background: #fff;
  border-radius: 3px 3px 0 0;
}
.handle-start::after { border-radius: 3px 3px 0 0; }
.handle-end::after   { border-radius: 3px 3px 0 0; }
.handle:hover::before { background: var(--accent); }
.handle:hover::after  { background: var(--accent); }

/* Wrapper around VideoTimeline that accepts video drops */
.vtl-drop-wrap {
  position: relative;
  margin-bottom: .4rem;
}
.vtl-drop-wrap.drop-over {
  border-radius: var(--radius-sm);
  outline: 2px dashed var(--accent);
  outline-offset: 2px;
}

/* Translucent overlay shown when dragging over the timeline */
.vtl-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(0, 0, 0, 0.55);
  border-radius: var(--radius-sm);
  pointer-events: none;
}
.vtl-drop-overlay svg { width: 15px; height: 15px; }

/* Offset row */
.offset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .6rem 0;
  border-top: 0.5px solid var(--border);
  margin-top: .5rem;
}
.offset-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.sync-label { font-size: 12px; color: var(--text2); }
.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 20px;
  font-weight: 500;
}
.badge.auto {
  background: rgba(58,143,255,.15);
  color: var(--accent-blue);
  border: 0.5px solid rgba(58,143,255,.3);
}
.badge.manual {
  background: rgba(255,122,58,.12);
  color: var(--accent-orange);
  border: 0.5px solid rgba(255,122,58,.25);
}
.offset-slider {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
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
  padding: 0 2px;
  line-height: 1;
}
.offset-reset:hover { color: var(--text2); }

.offset-hint {
  font-size: 11px;
  color: var(--text3);
  padding: .35rem 0 .5rem;
  line-height: 1.5;
}

/* ── Drag-and-drop ────────────────────────────────────────────────────────── */

.video-empty-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  margin-top: .65rem;
  border-radius: var(--radius-sm);
  border: 2px dashed var(--border2);
  color: var(--text3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .05em;
  transition: border-color .15s, color .15s, background .15s;
}
.video-empty-drop svg { width: 15px; height: 15px; flex-shrink: 0; }
.video-empty-drop.drop-over {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(255,214,10,.07);
}
.video-empty-drop--always {
  margin-top: 0;
  border-radius: var(--radius-sm);
  border-style: dashed;
  margin-bottom: .5rem;
}
.video-empty-drop--always:hover {
  border-color: rgba(255,214,10,.35);
  color: var(--text2);
}

</style>
