<template>
  <div class="sync-panel">

    <!-- ── GPX tab ─────────────────────────────────────────────────────────── -->
    <div v-show="timelineTab === 'gpx'">
      <div class="panel-header">
        <span class="panel-title">Track timeline</span>
        <span class="range-info range-info--hint">Ctrl+scroll to zoom</span>
        <span v-if="points.length" class="range-info">{{ trimRangeText }}</span>
      </div>

      <!-- Scrollable outer container -->
      <div
        class="elev-outer"
        ref="wrapRef"
        :class="{ 'is-draggable': useWindow }"
        @wheel.prevent="onGpxWheel"
        @scroll.passive="onGpxScroll"
        @mousedown.prevent="beginWindowPan"
        @touchstart.prevent="beginWindowPan"
      >
        <!-- Invisible inner div at virtual width — provides the scrollbar range -->
        <div class="elev-scroll-range" :style="{ width: gpxVirtualW + 'px' }" />

        <!-- Sticky viewport: canvas + overlays always at left:0 -->
        <div class="elev-viewport">
          <canvas ref="canvasRef" class="elev-canvas" />

          <template v-if="!useWindow">
            <div class="dim dim-left"  :style="{ width: startScreenPct + '%' }" />
            <div class="dim dim-right" :style="{ width: (100 - endScreenPct) + '%' }" />
          </template>

          <div
            class="playhead"
            :style="{ left: animScreenPct + '%' }"
            @mousedown.stop.prevent="beginPlayheadDrag"
            @touchstart.stop.prevent="beginPlayheadDrag"
          />

          <template v-if="!hasVideo">
            <div
              class="handle handle-start"
              :style="{ left: startScreenPct + '%' }"
              @mousedown.stop.prevent="beginDrag('start', $event)"
              @touchstart.stop.prevent="beginDrag('start', $event)"
            />
            <div
              class="handle handle-end"
              :style="{ left: endScreenPct + '%' }"
              @mousedown.stop.prevent="beginDrag('end', $event)"
              @touchstart.stop.prevent="beginDrag('end', $event)"
            />
          </template>

          <div v-if="showGpxZoom" class="gpx-zoom-badge">{{ gpxZoomLabel }}</div>
        </div>
      </div>
    </div>

    <!-- ── Video tab ───────────────────────────────────────────────────────── -->
    <div v-show="timelineTab === 'video'">
      <div class="panel-header">
        <span class="panel-title">Video timeline</span>
        <span v-if="hasVideo && videoDuration > 0" class="range-info range-info--hint">Ctrl+scroll to zoom · drag clips · drag playhead</span>
        <span v-if="hasVideo && videoDuration > 0" class="range-info">{{ videoTrimRangeText }}</span>
      </div>
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
          :video-start-time="videoStartTime"
          :captions="captions"
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
      <div
        v-else
        class="video-empty-drop video-empty-drop--always"
        :class="{ 'drop-over': dropOver }"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onVideoDrop"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10M6 9l4 4 4-4"/><rect x="2" y="15" width="16" height="2" rx="1"/></svg>
        Drop video here or use the Media panel
      </div>
    </div>

    <!-- ── Sync tab ────────────────────────────────────────────────────────── -->
    <div v-show="timelineTab === 'sync'">
      <template v-if="hasVideo && hasTimestamps">
        <div class="vst-row">
          <span class="sync-label">
            Time at this frame
            <span v-if="autoDetected" class="badge auto" :title="autoDetectSource === 'filedate' ? 'Detected from file date' : 'Detected from MP4 metadata'">
              {{ autoDetectSource === 'filedate' ? 'Auto (file date)' : 'Auto' }}
            </span>
            <span v-else class="badge manual">Manual</span>
          </span>
          <input
            class="vst-input"
            type="text"
            :value="currentFrameTimeInput"
            @change="onCurrentFrameTimeChange"
            placeholder="MM/DD/YYYY h:mm:ss AM"
            title="The real-world time of the current video frame. Edit to re-sync. Accepts: 6:57:22 PM · 18:57:22 · MM/DD/YYYY h:mm:ss AM"
          />
          <button
            v-if="!autoDetected"
            class="offset-reset vst-reset"
            title="Reset sync"
            @click="$emit('update:manualOffsetSec', 0)"
          >↺</button>
        </div>
        <div class="vst-hint">Pause on any frame and correct its timestamp — the whole track re-syncs instantly.</div>
        <div class="offset-row">
          <div class="offset-left">
            <span class="sync-label">Fine-tune</span>
          </div>
          <input
            class="offset-slider"
            type="range"
            min="-300"
            max="300"
            step="0.5"
            :value="manualOffsetSec"
            @input="$emit('update:manualOffsetSec', Number($event.target.value))"
            title="Fine-tune alignment. Positive = GPX starts later than video."
          />
          <span class="offset-val">{{ offsetDisplay }}</span>
          <button class="offset-reset" title="Reset fine-tune to zero" @click="$emit('update:manualOffsetSec', 0)">↺</button>
        </div>
        <div class="offset-hint">Use the slider for frame-level fine-tuning after setting the start time.</div>
      </template>
      <div v-else class="sync-empty">Load a video with GPX timestamps to use sync controls.</div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
  autoDetected:      { type: Boolean, default: false },
  autoDetectSource:  { type: String,  default: null },
  videoStartTime:    { type: Date,    default: null },
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
  timelineTab:     { type: String,  default: 'video' },
  captions:        { type: Array,   default: () => [] },
})

const emit = defineEmits([
  'update:trimStart', 'update:trimEnd', 'update:manualOffsetSec',
  'update:videoTrimStart', 'update:videoTrimEnd',
  'seek', 'seek-gpx', 'gpxWindowDrag', 'drop-video', 'move-clip', 'select-clip', 'reorder-clips', 'trim-clip', 'merge-clips',
  'set-current-frame-time',
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

// Shows the real-world time of the current video frame (mirrors what the overlay displays)
const currentFrameTimeInput = computed(() => {
  const p = props.points[props.animIdx]
  const d = p?.time
  if (!d) return ''
  const pad = n => String(n).padStart(2, '0')
  const mo = pad(d.getMonth() + 1), day = pad(d.getDate()), yr = d.getFullYear()
  let h = d.getHours(), mi = pad(d.getMinutes()), s = pad(d.getSeconds())
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${mo}/${day}/${yr} ${h}:${mi}:${s} ${ampm}`
})

// Accepts: "6:57:22 PM", "18:57:22", "MM/DD/YYYY h:mm:ss AM", "YYYY-MM-DDThh:mm:ss"
function parseFrameTime(val) {
  val = val.trim()
  if (!val) return null

  // ISO / datetime-local: "2026-05-30T18:57:22" or "2026-05-30 18:57:22"
  const isoM = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (isoM) {
    const [, y, mo, d, h, mi, s = '0'] = isoM
    const dt = new Date(+y, +mo - 1, +d, +h, +mi, +s)
    return isNaN(dt) ? null : dt
  }

  // "MM/DD/YYYY h:mm:ss AM/PM" or "MM/DD/YYYY HH:mm:ss"
  const mdyM = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (mdyM) {
    let [, mo, d, y, h, mi, s = '0', ampm] = mdyM
    h = +h; if (ampm) { if (/pm/i.test(ampm) && h !== 12) h += 12; else if (/am/i.test(ampm) && h === 12) h = 0 }
    const dt = new Date(+y, +mo - 1, +d, h, +mi, +s)
    return isNaN(dt) ? null : dt
  }

  // Time-only "h:mm:ss AM/PM" or "HH:mm:ss" — reuse date from current GPS point
  const timeM = val.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (timeM) {
    const base = props.points[props.animIdx]?.time
    if (!base) return null
    let [, h, mi, s = '0', ampm] = timeM
    h = +h; if (ampm) { if (/pm/i.test(ampm) && h !== 12) h += 12; else if (/am/i.test(ampm) && h === 12) h = 0 }
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, +mi, +s)
    return isNaN(dt) ? null : dt
  }

  return null
}

function onCurrentFrameTimeChange(e) {
  const date = parseFrameTime(e.target.value)
  if (!date) { e.target.value = currentFrameTimeInput.value; return }
  emit('set-current-frame-time', date)
}

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

// ─── GPX timeline zoom / scroll ───────────────────────────────────────────────
const gpxZoom      = ref(1)
const gpxScrollPx  = ref(0)
const gpxViewW     = ref(0)
const gpxVirtualW  = computed(() => Math.max(gpxViewW.value, gpxViewW.value * gpxZoom.value))
const showGpxZoom  = ref(false)
const gpxZoomLabel = computed(() => `${Math.round(gpxZoom.value * 100)}%`)
let gpxZoomTimer   = null

// Screen-space percentages for overlay elements (handles, playhead, dims)
function idxToScreenPct(idx) {
  if (!gpxViewW.value || !gpxVirtualW.value) return (idx / N.value) * 100
  const vx = (idx / N.value) * gpxVirtualW.value
  return ((vx - gpxScrollPx.value) / gpxViewW.value) * 100
}
const startScreenPct = computed(() => idxToScreenPct(props.trimStart))
const endScreenPct   = computed(() => idxToScreenPct(props.trimEnd))
const animScreenPct  = computed(() => idxToScreenPct(props.animIdx))

function onGpxWheel(e) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const rect = wrapRef.value?.getBoundingClientRect()
  if (!rect) return
  const mouseVX  = (e.clientX - rect.left) + gpxScrollPx.value
  const oldZoom  = gpxZoom.value
  gpxZoom.value  = Math.max(1, Math.min(80, gpxZoom.value * (e.deltaY < 0 ? 1.25 : 1 / 1.25)))
  const newScroll = mouseVX * (gpxZoom.value / oldZoom) - (e.clientX - rect.left)
  const maxScroll = gpxVirtualW.value - gpxViewW.value
  gpxScrollPx.value = Math.max(0, Math.min(maxScroll, newScroll))
  nextTick(() => { if (wrapRef.value) wrapRef.value.scrollLeft = gpxScrollPx.value })
  showGpxZoom.value = true
  clearTimeout(gpxZoomTimer)
  gpxZoomTimer = setTimeout(() => { showGpxZoom.value = false }, 900)
}

function onGpxScroll() {
  gpxScrollPx.value = wrapRef.value?.scrollLeft ?? 0
  draw()
}

// ─── Canvas elevation drawing ─────────────────────────────────────────────────
const wrapRef   = ref(null)
const canvasRef = ref(null)
let ctx = null
let ro  = null

function draw() {
  if (!ctx || !props.points.length || !canvasRef.value) return
  const pts = props.points
  const W   = canvasRef.value.width
  const H   = canvasRef.value.height
  const vW  = gpxVirtualW.value || W
  const sl  = gpxScrollPx.value

  // Visible index range
  const iStart = Math.max(0, Math.floor((sl / vW) * N.value) - 2)
  const iEnd   = Math.min(N.value, Math.ceil(((sl + W) / vW) * N.value) + 2)

  // Step for sampling (aim for ~400 points across visible range)
  const step = Math.max(1, Math.floor((iEnd - iStart) / 400))

  const visEleMin = Infinity, visEleMax = -Infinity
  let eMin = Infinity, eMax = -Infinity
  for (let i = 0; i <= N.value; i++) {
    const e = pts[i]?.ele ?? 0; if (e < eMin) eMin = e; if (e > eMax) eMax = e
  }
  const range = (eMax - eMin) || 1

  const toX = (i) => (i / N.value) * vW - sl
  const toY = (e) => H - 3 - ((e - eMin) / range) * (H - 8)

  ctx.clearRect(0, 0, W, H)

  // Window region highlight
  if (useWindow.value && props.windowEndIdx > props.windowStartIdx) {
    const wx1 = toX(props.windowStartIdx)
    const wx2 = toX(props.windowEndIdx)
    const cx1 = Math.max(0, wx1), cx2 = Math.min(W, wx2)
    if (cx2 > cx1) {
      ctx.fillStyle = 'rgba(255,214,10,0.07)'
      ctx.fillRect(cx1, 0, cx2 - cx1, H)
    }
    ctx.strokeStyle = 'rgba(255,214,10,0.30)'
    ctx.lineWidth = 1
    ctx.beginPath()
    if (wx1 >= 0 && wx1 <= W) { ctx.moveTo(wx1, 0); ctx.lineTo(wx1, H) }
    if (wx2 >= 0 && wx2 <= W) { ctx.moveTo(wx2, 0); ctx.lineTo(wx2, H) }
    ctx.stroke()
  }

  // Build sampled point list for the visible region
  const visible = []
  for (let i = iStart; i <= iEnd; i += step) visible.push(i)
  if (visible[visible.length - 1] !== iEnd) visible.push(iEnd)

  if (visible.length < 2) return

  // Filled area
  ctx.beginPath()
  visible.forEach((i, si) => {
    const x = toX(i), y = toY(pts[i]?.ele ?? eMin)
    si === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.lineTo(toX(visible[visible.length - 1]), H)
  ctx.lineTo(toX(visible[0]), H)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,214,10,0.06)'
  ctx.fill()

  // Elevation line
  ctx.beginPath()
  visible.forEach((i, si) => {
    const x = toX(i), y = toY(pts[i]?.ele ?? eMin)
    si === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,214,10,0.50)'
  ctx.lineWidth   = 1.5
  ctx.lineJoin    = 'round'
  ctx.stroke()
}

function onResize(entries) {
  const { width, height } = entries[0].contentRect
  gpxViewW.value         = Math.round(width)
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
  clearTimeout(gpxZoomTimer)
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
watch([gpxZoom, gpxScrollPx], draw)

// ─── Drag logic ───────────────────────────────────────────────────────────────
let dragging = null

function beginDrag(which, event) {
  dragging = which
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup',   endDrag)
  window.addEventListener('touchmove', onDragMove, { passive: false })
  window.addEventListener('touchend',  endDrag)
}

function beginPlayheadDrag(event) {
  dragging = 'playhead'
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
  const virtualX = (clientX - rect.left) + gpxScrollPx.value
  const vW       = Math.max(1, rect.width * gpxZoom.value)
  const rawIdx   = Math.round(Math.max(0, Math.min(1, virtualX / vW)) * N.value)
  const minGap   = 1
  if (dragging === 'start') {
    emit('update:trimStart', Math.min(rawIdx, props.trimEnd - minGap))
  } else if (dragging === 'end') {
    emit('update:trimEnd', Math.max(rawIdx, props.trimStart + minGap))
  } else if (dragging === 'playhead') {
    if (props.hasVideo && props.windowEndIdx > props.windowStartIdx) {
      const winLen = props.windowEndIdx - props.windowStartIdx
      const winPct = Math.max(0, Math.min(1, (rawIdx - props.windowStartIdx) / winLen))
      emit('seek', props.videoTrimStart + winPct * (props.videoTrimEnd - props.videoTrimStart))
    } else if (props.hasVideo) {
      emit('seek', (rawIdx / N.value) * props.videoDuration)
    } else {
      emit('seek-gpx', rawIdx)
    }
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
let panAnchor = null

function beginWindowPan(event) {
  if (!wrapRef.value) return
  const rect     = wrapRef.value.getBoundingClientRect()
  const clientX  = event.touches ? event.touches[0].clientX : event.clientX
  const virtualX = (clientX - rect.left) + gpxScrollPx.value
  const vW       = Math.max(1, rect.width * gpxZoom.value)
  const pct      = Math.max(0, Math.min(1, virtualX / vW))
  const clickedIdx = Math.round(pct * N.value)
  // Keep gpxViewW in sync so the canvas draw and zoom stay consistent
  if (rect.width > 0) gpxViewW.value = Math.round(rect.width)

  if (!useWindow.value) {
    // GPX-only: click or drag anywhere on the strip to seek
    emit('seek-gpx', clickedIdx)
    dragging = 'playhead'
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup',   endDrag)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend',  endDrag)
    return
  }

  if (clickedIdx >= props.windowStartIdx && clickedIdx <= props.windowEndIdx) {
    const winPct = (clickedIdx - props.windowStartIdx) / Math.max(1, props.windowEndIdx - props.windowStartIdx)
    emit('seek', props.videoTrimStart + winPct * (props.videoTrimEnd - props.videoTrimStart))
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
  const clientX   = event.touches ? event.touches[0].clientX : event.clientX
  // 1 screen pixel at current zoom = 1/gpxVirtualW of the full track
  const deltaFrac = (clientX - panAnchor.clientX) / gpxVirtualW.value
  const totalN    = Math.max(1, props.points.length - 1)
  const newStart  = panAnchor.windowStartIdx + Math.round(deltaFrac * totalN)
  emit('gpxWindowDrag', Math.max(0, Math.min(1, newStart / totalN)))
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

.sync-empty {
  padding: 1.2rem .5rem;
  font-size: 11px;
  color: rgba(255,255,255,.35);
  text-align: center;
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
.elev-outer {
  position: relative;
  height: 60px;
  cursor: default;
  border-radius: var(--radius-sm);
  overflow-x: scroll;
  overflow-y: hidden;
  background: var(--bg);
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.12) transparent;
}
.elev-outer::-webkit-scrollbar        { height: 4px; }
.elev-outer::-webkit-scrollbar-track  { background: transparent; }
.elev-outer::-webkit-scrollbar-thumb  { background: rgba(255,255,255,.18); border-radius: 2px; }
.elev-outer.is-draggable { cursor: grab; }
.elev-outer.is-draggable:active { cursor: grabbing; }

/* Invisible spacer providing virtual scroll width */
.elev-scroll-range {
  position: absolute;
  top: 0; left: 0;
  height: 1px;
  pointer-events: none;
}

/* Sticky layer: always fills the visible viewport */
.elev-viewport {
  position: sticky;
  left: 0; top: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
.elev-viewport .handle,
.elev-viewport .dim,
.elev-viewport .playhead { pointer-events: auto; }

.elev-canvas {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

.gpx-zoom-badge {
  position: absolute;
  bottom: 5px; right: 6px;
  font-size: 9px; font-weight: 600;
  color: rgba(255,255,255,.65);
  background: rgba(0,0,0,.55);
  padding: 1px 5px;
  border-radius: 3px;
  pointer-events: none;
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
  width: 14px;
  background: transparent;
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: ew-resize;
  z-index: 6;
}
.playhead::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0; bottom: 0;
  width: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
  transform: translateX(-50%);
  pointer-events: none;
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
  pointer-events: none;
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

/* Video start time row */
.vst-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .55rem 0 .3rem;
  border-top: 0.5px solid var(--border);
  margin-top: .5rem;
}
.vst-input {
  flex: 1;
  min-width: 0;
  padding: .28rem .5rem;
  background: var(--bg3, #1e1e1e);
  border: 0.5px solid var(--border2, rgba(255,255,255,0.1));
  border-radius: var(--radius-sm, 5px);
  color: var(--text, #e8e8e8);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color .12s;
  color-scheme: dark;
}
.vst-input:hover  { border-color: var(--border, rgba(255,255,255,0.18)); }
.vst-input:focus  { outline: none; border-color: var(--accent-blue, #3b82f6); }
.vst-reset { margin-left: 0; }
.vst-hint {
  font-size: 11px;
  color: var(--text3);
  padding: 0 0 .4rem;
  line-height: 1.5;
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
