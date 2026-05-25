<template>
  <div class="sync-panel">
    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">GPX timeline</span>
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

    <!-- Video timeline strip (shows when video loaded) -->
    <template v-if="hasVideo && videoDuration > 0">
      <div class="panel-header" style="margin-top:.65rem">
        <span class="panel-title">Video timeline</span>
        <span class="range-info">{{ videoTrimRangeText }}</span>
      </div>
      <div class="video-wrap" ref="videoWrapRef" @mousedown.prevent="beginVideoScrub" @touchstart.prevent="beginVideoScrub">
        <!-- Dim outside trim -->
        <div class="dim dim-left"  :style="{ width: vStartPct + '%' }" />
        <div class="dim dim-right" :style="{ width: (100 - vEndPct) + '%' }" />

        <!-- Playhead -->
        <div class="playhead" :style="{ left: vPlayheadPct + '%' }" />

        <!-- Trim handles -->
        <div
          class="handle handle-start"
          :style="{ left: vStartPct + '%' }"
          @mousedown.stop.prevent="beginVideoDrag('start', $event)"
          @touchstart.stop.prevent="beginVideoDrag('start', $event)"
        />
        <div
          class="handle handle-end"
          :style="{ left: vEndPct + '%' }"
          @mousedown.stop.prevent="beginVideoDrag('end', $event)"
          @touchstart.stop.prevent="beginVideoDrag('end', $event)"
        />
      </div>
    </template>

    <!-- Offset row — only with video + timestamps -->
    <div v-if="hasVideo && hasTimestamps" class="offset-row">
      <div class="offset-left">
        <span class="sync-label">Sync</span>
        <span v-if="autoDetected" class="badge auto">Auto-detected</span>
        <span v-else class="badge manual">Manual</span>
      </div>
      <input
        class="offset-slider"
        type="range"
        min="-300"
        max="300"
        step="0.5"
        :value="manualOffsetSec"
        @input="$emit('update:manualOffsetSec', Number($event.target.value))"
      />
      <span class="offset-val">{{ offsetDisplay }}</span>
      <button class="offset-reset" title="Reset offset" @click="$emit('update:manualOffsetSec', 0)">↺</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { fmtTime } from '../utils/geo.js'

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
})

const emit = defineEmits([
  'update:trimStart', 'update:trimEnd', 'update:manualOffsetSec',
  'update:videoTrimStart', 'update:videoTrimEnd',
  'seek', 'gpxWindowDrag',
])

// ─── Percentages ──────────────────────────────────────────────────────────────
const N         = computed(() => Math.max(1, props.points.length - 1))
const startPct  = computed(() => (props.trimStart / N.value) * 100)
const endPct    = computed(() => (props.trimEnd   / N.value) * 100)

// Window mode: active when video loaded + GPX has timestamps + window indices are valid
const useWindow = computed(() =>
  props.hasVideo && props.hasTimestamps && props.windowEndIdx > props.windowStartIdx
)
const winN = computed(() => Math.max(1, props.windowEndIdx - props.windowStartIdx))

// Playhead: window-relative when in window mode, absolute otherwise
const activeAnimPct = computed(() => {
  if (useWindow.value) {
    return Math.max(0, Math.min(
      ((props.animIdx - props.windowStartIdx) / winN.value) * 100, 100
    ))
  }
  return Math.max(0, Math.min((props.animIdx / N.value) * 100, 100))
})

// ─── Video timeline percentages ───────────────────────────────────────────────
const vDur        = computed(() => Math.max(1, props.videoDuration))
const vStartPct   = computed(() => (props.videoTrimStart / vDur.value) * 100)
const vEndPct     = computed(() => (props.videoTrimEnd   / vDur.value) * 100)
const vPlayheadPct = computed(() => Math.max(0, Math.min(props.videoProgress * 100, 100)))

const videoTrimRangeText = computed(() => {
  if (!props.videoDuration) return ''
  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
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
  const s = pts[Math.min(props.trimStart, pts.length - 1)]
  const e = pts[Math.min(props.trimEnd,   pts.length - 1)]
  if (!s || !e) return ''
  const d1 = (s.cumDist / 1000).toFixed(1)
  const d2 = (e.cumDist / 1000).toFixed(1)
  // Also show time if available
  if (s.time && e.time) {
    return `${d1} km → ${d2} km  ·  ${fmtTime(e.time - s.time)}`
  }
  return `${d1} km → ${d2} km`
})

// ─── Canvas elevation drawing ─────────────────────────────────────────────────
const wrapRef      = ref(null)
const canvasRef    = ref(null)
const videoWrapRef = ref(null)
let ctx = null
let ro  = null

// Sample points for drawing performance
const sampled = computed(() => {
  const pts = props.points
  if (!pts.length) return []
  const step   = Math.max(1, Math.floor(pts.length / 400))
  const result = []
  for (let i = 0; i < pts.length; i += step) result.push({ i, ele: pts[i].ele })
  // Always include the last point for correct fill shape
  const last = pts.length - 1
  if (result[result.length - 1]?.i !== last) result.push({ i: last, ele: pts[last].ele })
  return result
})

function draw() {
  if (!ctx || !props.points.length || !canvasRef.value) return
  const pts = sampled.value
  const W   = canvasRef.value.width
  const H   = canvasRef.value.height

  const eleMin = pts.reduce((a, p) => Math.min(a, p.ele), Infinity)
  const eleMax = pts.reduce((a, p) => Math.max(a, p.ele), -Infinity)
  const range  = (eleMax - eleMin) || 1

  const toX = (i) => (i / N.value) * W
  const toY = (e) => H - 3 - ((e - eleMin) / range) * (H - 8)

  ctx.clearRect(0, 0, W, H)

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
  ctx.fillStyle = 'rgba(58,143,255,0.12)'
  ctx.fill()

  // Elevation line
  ctx.beginPath()
  pts.forEach((p, si) => {
    const x = toX(p.i)
    const y = toY(p.ele)
    si === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(58,143,255,0.55)'
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
  window.removeEventListener('mousemove', onVideoDragMove)
  window.removeEventListener('mouseup',   endVideoDrag)
  window.removeEventListener('touchmove', onVideoDragMove)
  window.removeEventListener('touchend',  endVideoDrag)
  window.removeEventListener('mousemove', onVideoScrubMove)
  window.removeEventListener('mouseup',   endVideoScrub)
  window.removeEventListener('touchmove', onVideoScrubMove)
  window.removeEventListener('touchend',  endVideoScrub)
})

watch(() => props.points, draw)

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

// ─── Video trim drag ──────────────────────────────────────────────────────────
let videoDragging = null

function beginVideoDrag(which, event) {
  videoDragging = which
  window.addEventListener('mousemove', onVideoDragMove)
  window.addEventListener('mouseup',   endVideoDrag)
  window.addEventListener('touchmove', onVideoDragMove, { passive: false })
  window.addEventListener('touchend',  endVideoDrag)
}

function onVideoDragMove(event) {
  if (!videoDragging || !videoWrapRef.value) return
  event.preventDefault()

  const rect    = videoWrapRef.value.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const rawPct  = (clientX - rect.left) / rect.width
  const rawSec  = Math.max(0, Math.min(1, rawPct)) * props.videoDuration
  const minGap  = Math.max(1, props.videoDuration * 0.01)

  if (videoDragging === 'start') {
    emit('update:videoTrimStart', Math.min(rawSec, props.videoTrimEnd - minGap))
  } else {
    emit('update:videoTrimEnd', Math.max(rawSec, props.videoTrimStart + minGap))
  }
}

function endVideoDrag() {
  videoDragging = null
  window.removeEventListener('mousemove', onVideoDragMove)
  window.removeEventListener('mouseup',   endVideoDrag)
  window.removeEventListener('touchmove', onVideoDragMove)
  window.removeEventListener('touchend',  endVideoDrag)
}

// ─── Video timeline scrub (click / drag anywhere on the strip) ────────────────
function _pctToSec(event, el) {
  const rect    = el.getBoundingClientRect()
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const pct     = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return pct * props.videoDuration
}

function beginVideoScrub(event) {
  if (!videoWrapRef.value) return
  // Handles stop their own events; this only fires on the bare strip
  const sec = _pctToSec(event, videoWrapRef.value)
  emit('seek', sec)
  window.addEventListener('mousemove', onVideoScrubMove)
  window.addEventListener('mouseup',   endVideoScrub)
  window.addEventListener('touchmove', onVideoScrubMove, { passive: false })
  window.addEventListener('touchend',  endVideoScrub)
}

function onVideoScrubMove(event) {
  if (!videoWrapRef.value) return
  event.preventDefault()
  emit('seek', _pctToSec(event, videoWrapRef.value))
}

function endVideoScrub() {
  window.removeEventListener('mousemove', onVideoScrubMove)
  window.removeEventListener('mouseup',   endVideoScrub)
  window.removeEventListener('touchmove', onVideoScrubMove)
  window.removeEventListener('touchend',  endVideoScrub)
}
</script>

<style scoped>
.sync-panel {
  background: var(--bg2);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: .75rem 1rem 0;
  margin-bottom: 1.25rem;
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

/* Elevation area */
.elev-wrap {
  position: relative;
  height: 72px;
  cursor: default;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #0a0a0a;
}
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
  width: 1.5px;
  background: rgba(255,255,255,0.7);
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
  width: 7px;
  height: 7px;
  background: #fff;
  border-radius: 50%;
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
.handle:hover::before { background: #fff; }
.handle:hover::after  { background: var(--accent-blue); }

/* Video timeline strip */
.video-wrap {
  position: relative;
  height: 36px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: linear-gradient(to right, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  cursor: ew-resize;
  margin-bottom: .5rem;
}

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
  accent-color: var(--accent-blue);
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
</style>
