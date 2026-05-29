<template>
  <div class="vtl" ref="vtlRef" @wheel="onWheel">

    <!-- ── Ruler ──────────────────────────────────────────────────────────── -->
    <div class="vtl-ruler-wrap" ref="rulerWrapRef">
      <canvas class="vtl-ruler-cv" ref="rulerCvRef" @mousedown="onRulerDown" />
      <!-- Playhead triangle marker (positioned in screen-space) -->
      <div
        v-show="videoDuration > 0"
        class="vtl-ph-head"
        :style="{ left: phScreenPx + 'px' }"
        @mousedown.stop.prevent="beginPhDrag"
      />
    </div>

    <!-- ── Scrollable track area ──────────────────────────────────────────── -->
    <div class="vtl-scroll" ref="scrollRef" @scroll.passive="onScroll">
      <div class="vtl-content" :style="{ width: totalWidthPx + 'px' }">

        <!-- Lane (click empty area to seek) -->
        <div class="vtl-lane" @mousedown.self="onLaneDown">

          <!-- Gap zones: double-click to merge adjacent clips -->
          <template v-for="(clip, i) in displayClips" :key="'gap-' + i">
            <div
              v-if="i > 0 && gapWidthPx(i) > 2"
              class="vtl-gap"
              :style="{ left: gapLeftPx(i) + 'px', width: gapWidthPx(i) + 'px' }"
              title="Double-click to merge clips"
              @dblclick.stop="$emit('merge-clips', i - 1)"
            />
          </template>

          <!-- Clip blocks -->
          <div
            v-for="(clip, i) in displayClips"
            :key="'vc-' + i"
            class="vtl-clip"
            :class="{
              'vtl-clip--active':   i === activeClipIdx,
              'vtl-clip--dragging': i === dragIdx
            }"
            :style="{
              left:  clipAbsPx(clip) + 'px',
              width: Math.max(8, clipWPx(clip)) + 'px'
            }"
            @mousedown.stop.prevent="startClipDrag(i, $event)"
          >
            <!-- Left trim handle -->
            <div class="vtl-clip-trim vtl-clip-trim--l"
                 @mousedown.stop.prevent="startClipTrim(i, 'left', $event)" />
            <div class="vtl-clip-top">
              <span class="vtl-clip-name">{{ segLabel(i) }}</span>
              <span class="vtl-clip-dur">{{ fmtSec(clip.end - clip.start) }}</span>
            </div>
            <!-- Thumbnail strip -->
            <div class="vtl-clip-body" :ref="el => { if (el) bodyRefs[i] = el }" />
            <!-- Right trim handle -->
            <div class="vtl-clip-trim vtl-clip-trim--r"
                 @mousedown.stop.prevent="startClipTrim(i, 'right', $event)" />
          </div>
        </div>

      </div>
    </div>

    <!-- Playhead line: lives in .vtl (position:relative, full height) so top/bottom work -->
    <div
      v-show="videoDuration > 0"
      class="vtl-ph-line"
      :style="{ left: phScreenPx + 'px' }"
    />

    <!-- Zoom hint -->
    <div class="vtl-zoom-badge" v-if="showZoomBadge">{{ zoomLabel }}</div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  clips:          { type: Array,  default: () => [] },
  segments:       { type: Array,  default: () => [] },
  videoDuration:  { type: Number, default: 0 },
  timelineShift:  { type: Number, default: 0 },
  videoProgress:  { type: Number, default: 0 },   // 0-1 absolute
  videoTrimStart: { type: Number, default: 0 },
  videoTrimEnd:   { type: Number, default: 0 },
  activeClipIdx:  { type: Number, default: 0 },
})
const emit = defineEmits(['seek', 'move-clip', 'select-clip', 'reorder-clips', 'trim-clip', 'merge-clips'])

// ── Zoom / scroll ─────────────────────────────────────────────────────────────
const tlZoom  = ref(1)
const scrollL = ref(0)
const ctnrW   = ref(800)
const BASE    = 60                                    // px / sec at zoom = 1

const pps          = computed(() => BASE * tlZoom.value)
const effectiveDur = computed(() => Math.max(1, props.videoDuration - props.timelineShift))
const totalWidthPx = computed(() => Math.max(ctnrW.value, effectiveDur.value * pps.value + 60))

// Zoom badge
const showZoomBadge = ref(false)
let zoomBadgeTimer  = null
const zoomLabel = computed(() => `${Math.round(tlZoom.value * 100)}%`)

// ── Playhead ──────────────────────────────────────────────────────────────────
const absSec  = computed(() => props.videoProgress * props.videoDuration)
const phAbsPx = computed(() => Math.max(0, (absSec.value - props.timelineShift) * pps.value))
const phScreenPx = computed(() =>
  Math.max(-6, Math.min(ctnrW.value - 6, phAbsPx.value - scrollL.value))
)

// ── Clip helpers ──────────────────────────────────────────────────────────────
const clipAbsPx = (clip) => (clip.start - props.timelineShift) * pps.value
const clipWPx   = (clip) => (clip.end - clip.start) * pps.value
const trimAbsPx = (sec)  => (sec - props.timelineShift) * pps.value

function fmtSec(s) {
  s = Math.max(0, Math.floor(s))
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const sc = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
}

function segLabel(i) {
  const clip = props.clips[i]
  if (!clip) return `Clip ${i + 1}`
  const seg = props.segments.find(
    s => clip.start >= s.offset && clip.start < s.offset + s.duration
  )
  return seg?.name || `Clip ${i + 1}`
}

// ── Refs ──────────────────────────────────────────────────────────────────────
const vtlRef      = ref(null)
const rulerWrapRef = ref(null)
const rulerCvRef  = ref(null)
const scrollRef   = ref(null)
const bodyRefs    = {}    // clip-body element map: index → DOM element

// ── Working clips (used during drag to show reordered state locally) ──────────
const workingClips = ref(null)
const displayClips = computed(() => workingClips.value ?? props.clips)

// ── Ruler drawing ─────────────────────────────────────────────────────────────
function tickInterval() {
  const p = pps.value
  if (p >= 400) return 1
  if (p >= 160) return 2
  if (p >= 65)  return 5
  if (p >= 28)  return 10
  if (p >= 10)  return 30
  if (p >= 4)   return 60
  if (p >= 1.5) return 120
  return 300
}

function drawRuler() {
  const cv = rulerCvRef.value
  if (!cv || !cv.width) return
  const ctx = cv.getContext('2d')
  const W = cv.width, H = cv.height
  const p = pps.value, sl = scrollL.value, sh = props.timelineShift

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, H)

  const tS = sl / p + sh
  const tE = (sl + W) / p + sh
  const iv  = tickInterval()
  const sub = iv >= 10 ? iv / 5 : (iv === 1 ? 0.5 : iv / 2)

  // Sub-ticks
  if (sub > 0 && p * sub > 5) {
    ctx.strokeStyle = 'rgba(255,255,255,.15)'
    ctx.lineWidth   = 1
    let t = Math.floor(tS / sub) * sub
    for (; t <= tE + sub; t += sub) {
      if (Math.abs(t % iv) < 1e-5) continue
      const x = (t - sh) * p - sl
      if (x < 0 || x > W) continue
      ctx.beginPath(); ctx.moveTo(x + 0.5, H - 6); ctx.lineTo(x + 0.5, H); ctx.stroke()
    }
  }

  // Major ticks + labels
  ctx.lineWidth = 1
  let t = Math.floor(tS / iv) * iv
  for (; t <= tE + iv; t += iv) {
    const x = (t - sh) * p - sl
    if (x < -80 || x > W + 80) continue
    ctx.strokeStyle = 'rgba(255,255,255,.38)'
    ctx.beginPath(); ctx.moveTo(x + 0.5, H - 12); ctx.lineTo(x + 0.5, H); ctx.stroke()
    if (t >= 0) {
      ctx.fillStyle  = 'rgba(255,255,255,.55)'
      ctx.font       = '9px -apple-system,sans-serif'
      ctx.textAlign  = 'left'
      ctx.fillText(fmtSec(t), x + 3, H - 13)
    }
  }

  // Playhead line on ruler
  const phX = phAbsPx.value - sl
  if (phX >= 0 && phX <= W) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(phX + 0.5, 0); ctx.lineTo(phX + 0.5, H); ctx.stroke()
  }

  // Bottom border
  ctx.fillStyle = 'rgba(255,255,255,.08)'
  ctx.fillRect(0, H - 1, W, 1)
}

function resizeRuler() {
  const cv = rulerCvRef.value
  const rw = rulerWrapRef.value
  if (!cv || !rw) return
  cv.width  = rw.clientWidth
  cv.height = 26
  drawRuler()
}

// ── Scroll ────────────────────────────────────────────────────────────────────
function onScroll() { scrollL.value = scrollRef.value?.scrollLeft ?? 0 }

// ── Ctrl+Wheel zoom ───────────────────────────────────────────────────────────
function onWheel(e) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const rect = scrollRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseInTl = e.clientX - rect.left + scrollL.value
  const oldPPS    = pps.value
  tlZoom.value    = Math.max(0.1, Math.min(100, tlZoom.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))

  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollLeft = mouseInTl * (pps.value / oldPPS) - (e.clientX - rect.left)
    }
  })

  // Zoom badge
  showZoomBadge.value = true
  clearTimeout(zoomBadgeTimer)
  zoomBadgeTimer = setTimeout(() => { showZoomBadge.value = false }, 900)
}

// ── Ruler click / drag (seek) ─────────────────────────────────────────────────
let rdrag = false
function onRulerDown(e) {
  rdrag = true
  seekFromEl(e, rulerWrapRef.value)
  window.addEventListener('mousemove', onRulerMove)
  window.addEventListener('mouseup',   endRulerDrag)
}
function onRulerMove(e) { if (rdrag) seekFromEl(e, rulerWrapRef.value) }
function endRulerDrag() {
  rdrag = false
  window.removeEventListener('mousemove', onRulerMove)
  window.removeEventListener('mouseup',   endRulerDrag)
}

function seekFromEl(e, el) {
  if (!el) return
  const x   = e.clientX - el.getBoundingClientRect().left + scrollL.value
  const sec = Math.max(0, Math.min(props.videoDuration, x / pps.value + props.timelineShift))
  emit('seek', sec)
}

// ── Lane empty-area click (seek) ──────────────────────────────────────────────
function onLaneDown(e) {
  if (!scrollRef.value) return
  const x   = e.clientX - scrollRef.value.getBoundingClientRect().left + scrollL.value
  const sec = Math.max(0, Math.min(props.videoDuration, x / pps.value + props.timelineShift))
  const inClip = props.clips.some(c => sec >= c.start && sec <= c.end)
  if (inClip) emit('seek', sec)
}

// ── Playhead drag ─────────────────────────────────────────────────────────────
let phdrag = false
function beginPhDrag() {
  phdrag = true
  window.addEventListener('mousemove', onPhMove)
  window.addEventListener('mouseup',   endPhDrag)
}
function onPhMove(e) {
  if (!phdrag || !rulerWrapRef.value) return
  seekFromEl(e, rulerWrapRef.value)
}
function endPhDrag() {
  phdrag = false
  window.removeEventListener('mousemove', onPhMove)
  window.removeEventListener('mouseup',   endPhDrag)
}

// ── Clip drag ─────────────────────────────────────────────────────────────────
const dragIdx = ref(-1)
let cds = null

function startClipDrag(i, e) {
  dragIdx.value = i
  workingClips.value = props.clips.map(c => ({ ...c }))
  cds = { i, sx: e.clientX, os: props.clips[i].start }
  emit('select-clip', i)
  window.addEventListener('mousemove', onClipMove)
  window.addEventListener('mouseup',   endClipDrag)
}

function onClipMove(e) {
  if (!cds || !workingClips.value) return
  const wc = workingClips.value
  const i  = cds.i
  const dragDur = wc[i].end - wc[i].start
  const newStart = cds.os + (e.clientX - cds.sx) / pps.value

  // Swap with left neighbor when dragged center crosses left center
  if (i > 0) {
    const leftDur = wc[i-1].end - wc[i-1].start
    if (newStart + dragDur / 2 < wc[i-1].start + leftDur / 2) {
      const aStart = wc[i-1].start
      const next = [...wc]
      // Spread to preserve segmentIdx / segStart; only override timeline positions
      next[i-1] = { ...wc[i],   start: aStart,                        end: aStart + dragDur }
      next[i]   = { ...wc[i-1], start: aStart + dragDur + 0.01,       end: aStart + dragDur + 0.01 + leftDur }
      workingClips.value = next
      cds = { i: i - 1, sx: e.clientX, os: next[i - 1].start }
      dragIdx.value = i - 1
      return
    }
  }

  // Swap with right neighbor when dragged center crosses right center
  if (i < wc.length - 1) {
    const rightDur = wc[i+1].end - wc[i+1].start
    if (newStart + dragDur / 2 > wc[i+1].start + rightDur / 2) {
      const aStart = wc[i].start
      const next = [...wc]
      next[i]   = { ...wc[i+1], start: aStart,                        end: aStart + rightDur }
      next[i+1] = { ...wc[i],   start: aStart + rightDur + 0.01,      end: aStart + rightDur + 0.01 + dragDur }
      workingClips.value = next
      cds = { i: i + 1, sx: e.clientX, os: next[i + 1].start }
      dragIdx.value = i + 1
      return
    }
  }

  // Free move with magnetic snap
  let clamped = Math.max(props.timelineShift || 0, newStart)
  const snapSec = 8 / pps.value
  for (let j = 0; j < wc.length; j++) {
    if (j === i) continue
    if (Math.abs(clamped - wc[j].end) < snapSec)             { clamped = wc[j].end; break }
    if (Math.abs(clamped + dragDur - wc[j].start) < snapSec) { clamped = wc[j].start - dragDur; break }
  }
  const next = [...wc]
  next[i] = { ...wc[i], start: clamped, end: clamped + dragDur }
  workingClips.value = next
}

function endClipDrag() {
  if (workingClips.value) {
    emit('reorder-clips', workingClips.value)
    emit('select-clip', dragIdx.value)
  }
  dragIdx.value = -1
  workingClips.value = null
  cds = null
  window.removeEventListener('mousemove', onClipMove)
  window.removeEventListener('mouseup',   endClipDrag)
}

// ── Per-clip trim drag ────────────────────────────────────────────────────────
const MIN_CLIP_DUR = 0.5
let clipTrimDs = null

function startClipTrim(i, side, e) {
  const clip = props.clips[i]
  clipTrimDs = { i, side, sx: e.clientX, orig: side === 'left' ? clip.start : clip.end }
  window.addEventListener('mousemove', onClipTrimMove)
  window.addEventListener('mouseup',   endClipTrim)
}

function onClipTrimMove(e) {
  if (!clipTrimDs) return
  const { i, side, sx, orig } = clipTrimDs
  const c    = props.clips
  const clip = c[i]
  const delta = (e.clientX - sx) / pps.value
  if (side === 'left') {
    const minStart = i > 0 ? c[i - 1].end : (props.timelineShift || 0)
    const newStart = Math.max(minStart, Math.min(clip.end - MIN_CLIP_DUR, orig + delta))
    emit('trim-clip', { index: i, start: newStart, end: clip.end })
  } else {
    const maxEnd = i < c.length - 1 ? c[i + 1].start : props.videoDuration
    const newEnd = Math.max(clip.start + MIN_CLIP_DUR, Math.min(maxEnd, orig + delta))
    emit('trim-clip', { index: i, start: clip.start, end: newEnd })
  }
}

function endClipTrim() {
  clipTrimDs = null
  window.removeEventListener('mousemove', onClipTrimMove)
  window.removeEventListener('mouseup',   endClipTrim)
}

// ── Gap layout helpers ────────────────────────────────────────────────────────
function gapLeftPx(i) {
  const prev = displayClips.value[i - 1]
  return clipAbsPx(prev) + Math.max(8, clipWPx(prev))
}
function gapWidthPx(i) {
  return clipAbsPx(displayClips.value[i]) - gapLeftPx(i)
}

// ── Thumbnails ────────────────────────────────────────────────────────────────
const thumbCache = new Map()
let offVid = null
let thumbBusy = false
const thumbQueue = []

function queueThumb(src, sec, cb) {
  const key = `${src}§${sec.toFixed(1)}`
  if (thumbCache.has(key)) { cb(thumbCache.get(key)); return }
  thumbQueue.push({ src, sec, key, cb })
  drainQueue()
}

async function drainQueue() {
  if (thumbBusy || !thumbQueue.length) return
  thumbBusy = true
  const task = thumbQueue.shift()
  if (thumbCache.has(task.key)) { task.cb(thumbCache.get(task.key)); thumbBusy = false; drainQueue(); return }
  try {
    const url = await captureFrame(task.src, task.sec)
    if (url) thumbCache.set(task.key, url)
    task.cb(url ?? null)
  } catch { task.cb(null) }
  thumbBusy = false
  drainQueue()
}

function captureFrame(src, sec) {
  return new Promise(resolve => {
    if (!offVid) {
      offVid = Object.assign(document.createElement('video'), { muted: true, playsInline: true })
    }
    const v = offVid
    const capture = () => {
      try {
        const c = Object.assign(document.createElement('canvas'), { width: 160, height: 90 })
        c.getContext('2d').drawImage(v, 0, 0, 160, 90)
        resolve(c.toDataURL('image/jpeg', 0.5))
      } catch { resolve(null) }
    }
    v.addEventListener('seeked', capture, { once: true })
    v.addEventListener('error',  () => resolve(null), { once: true })
    const doSeek = () => { v.currentTime = Math.max(0, Math.min(v.duration - 0.01, sec)) }
    if (v.src !== src) {
      v.src = src; v.load()
      v.addEventListener('loadedmetadata', doSeek, { once: true })
    } else if (v.readyState >= 1) {
      doSeek()
    } else {
      v.addEventListener('loadedmetadata', doSeek, { once: true })
    }
  })
}

function fillClipThumbs(i) {
  const clip = props.clips[i]
  const el   = bodyRefs[i]
  if (!clip || !el) return
  const seg  = props.segments.find(
    s => clip.start >= s.offset && clip.start < s.offset + s.duration
  )
  if (!seg) return

  const wPx   = Math.max(4, clipWPx(clip))
  const count = Math.max(1, Math.floor(wPx / 80))
  const dur   = clip.end - clip.start

  el.innerHTML = ''
  for (let j = 0; j < count; j++) {
    const rawT  = clip.start - seg.offset + (count === 1 ? dur * 0.1 : (j / Math.max(1, count - 1)) * dur)
    const clamp = Math.max(0, Math.min(seg.duration - 0.05, rawT))
    const slot  = document.createElement('div')
    slot.className = 'vtl-thumb-slot'
    el.appendChild(slot)
    queueThumb(seg.src, clamp, url => {
      if (!bodyRefs[i] || !url) return
      slot.style.backgroundImage = `url(${url})`
    })
  }
}

function fillAllThumbs() {
  nextTick(() => {
    for (let i = 0; i < props.clips.length; i++) fillClipThumbs(i)
  })
}

// ── Resize ────────────────────────────────────────────────────────────────────
let ro = null
function initResize() {
  ro = new ResizeObserver(entries => {
    ctnrW.value = entries[0].contentRect.width
    resizeRuler()
  })
  if (scrollRef.value) ro.observe(scrollRef.value)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  if (scrollRef.value) ctnrW.value = scrollRef.value.clientWidth
  resizeRuler()
  initResize()
  fillAllThumbs()
})

onUnmounted(() => {
  ro?.disconnect()
  clearTimeout(zoomBadgeTimer)
  window.removeEventListener('mousemove', onRulerMove);  window.removeEventListener('mouseup', endRulerDrag)
  window.removeEventListener('mousemove', onPhMove);     window.removeEventListener('mouseup', endPhDrag)
  window.removeEventListener('mousemove', onClipMove);      window.removeEventListener('mouseup', endClipDrag)
  window.removeEventListener('mousemove', onClipTrimMove);  window.removeEventListener('mouseup', endClipTrim)
  if (offVid) { offVid.src = ''; offVid = null }
})

// ── Watchers ──────────────────────────────────────────────────────────────────
watch([scrollL, pps, phAbsPx, () => props.timelineShift], drawRuler)
watch(() => props.clips, fillAllThumbs, { deep: true })
watch(pps, fillAllThumbs)
</script>

<style scoped>
.vtl {
  position: relative;
  background: #0c0c16;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 0.5px solid var(--border);
  user-select: none;
  margin-bottom: .5rem;
}

/* ── Ruler ──────────────────────────────────────────────────────────────────── */
.vtl-ruler-wrap {
  position: relative;
  height: 26px;
  background: #111827;
  flex-shrink: 0;
}
.vtl-ruler-cv {
  display: block;
  width: 100%;
  height: 26px;
  cursor: crosshair;
}

/* Playhead cap (CapCut style: rounded rect handle + line through ruler) */
.vtl-ph-head {
  position: absolute;
  top: 0;
  width: 14px;
  height: 26px;
  transform: translateX(-50%);
  cursor: ew-resize;
  z-index: 20;
  pointer-events: auto;
}
.vtl-ph-head::before {
  content: '';
  position: absolute;
  top: 2px; left: 50%;
  transform: translateX(-50%);
  width: 14px; height: 14px;
  background: #fff;
  border-radius: 3px;
}
.vtl-ph-head::after {
  content: '';
  position: absolute;
  top: 14px; left: 50%;
  transform: translateX(-50%);
  width: 2px; height: 12px;
  background: #fff;
}

/* ── Scrollable track area ──────────────────────────────────────────────────── */
.vtl-scroll {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.15) transparent;
}
.vtl-scroll::-webkit-scrollbar        { height: 5px; }
.vtl-scroll::-webkit-scrollbar-track  { background: transparent; }
.vtl-scroll::-webkit-scrollbar-thumb  { background: rgba(255,255,255,.15); border-radius: 3px; }
.vtl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.28); }

.vtl-content {
  position: relative;
  min-height: 76px;
}

/* ── Lane ──────────────────────────────────────────────────────────────────── */
.vtl-lane {
  position: absolute;
  inset: 4px 0;
  /* Subtle lane background */
}

/* ── Clip block ─────────────────────────────────────────────────────────────── */
.vtl-clip {
  position: absolute;
  top: 0; bottom: 0;
  border: 1.5px solid rgba(0,210,215,.55);
  border-radius: 3px;
  background: rgba(0,165,180,.1);
  overflow: hidden;
  cursor: grab;
  box-sizing: border-box;
  transition: border-color .12s, background .12s;
}
.vtl-clip:hover {
  border-color: rgba(0,230,235,.85);
  background: rgba(0,190,200,.18);
}
.vtl-clip--active {
  border-color: var(--accent);
  background: rgba(0,200,210,.2);
}
.vtl-clip--dragging {
  cursor: grabbing;
  border-color: #fff;
  background: rgba(255,255,255,.14);
  z-index: 8;
  box-shadow: 0 3px 18px rgba(0,0,0,.55);
}

.vtl-clip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 5px;
  background: rgba(0,180,195,.4);
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  flex-shrink: 0;
}
.vtl-clip-name {
  font-size: 9px;
  font-weight: 700;
  color: rgba(255,255,255,.88);
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: .02em;
}
.vtl-clip-dur {
  font-size: 9px;
  color: rgba(255,255,255,.5);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.vtl-clip-body {
  display: flex;
  overflow: hidden;
  height: calc(100% - 18px);
  gap: 1px;
}
.vtl-thumb-slot {
  flex: 0 0 80px;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-color: rgba(0,0,0,.4);
  opacity: .75;
}

/* ── Per-clip trim handles ──────────────────────────────────────────────────── */
.vtl-clip-trim {
  position: absolute;
  top: 0; bottom: 0;
  width: 10px;
  cursor: ew-resize;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .12s;
}
.vtl-clip:hover .vtl-clip-trim,
.vtl-clip--active .vtl-clip-trim { opacity: 1; }
.vtl-clip-trim--l { left: 0; }
.vtl-clip-trim--r { right: 0; }
.vtl-clip-trim::after {
  content: '';
  width: 3px;
  height: 60%;
  min-height: 16px;
  background: rgba(255,255,255,.85);
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(0,0,0,.6);
}
.vtl-clip-trim:hover::after { background: #fff; }

/* ── Gap zone between clips ─────────────────────────────────────────────────── */
.vtl-gap {
  position: absolute;
  top: 0; bottom: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(255,255,255,.04) 0px,
    rgba(255,255,255,.04) 1px,
    transparent 1px,
    transparent 8px
  );
  cursor: default;
  z-index: 1;
}
.vtl-gap:hover {
  background: rgba(0,210,215,.08);
  outline: 1px dashed rgba(0,210,215,.3);
}

/* ── Playhead line ──────────────────────────────────────────────────────────── */
.vtl-ph-line {
  position: absolute;
  top: 26px; /* start at ruler bottom */
  bottom: 0;
  width: 2px;
  background: #fff;
  pointer-events: none;
  z-index: 15;
  transform: translateX(-50%);
}

/* ── Zoom badge ─────────────────────────────────────────────────────────────── */
.vtl-zoom-badge {
  position: absolute;
  bottom: 6px; right: 8px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,.65);
  background: rgba(0,0,0,.55);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 20;
}
</style>
