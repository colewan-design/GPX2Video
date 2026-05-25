<template>
  <div class="stage" :class="{ 'has-video': !!videoSrc }" ref="stageRef">
    <!-- Actual video footage (background layer) -->
    <video
      v-if="videoSrc"
      ref="videoRef"
      class="video-bg"
      :src="videoSrc"
      preload="metadata"
      playsinline
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="$emit('ended')"
    />

    <!-- GPX map: fills stage in map-only mode, becomes small inset over video -->
    <canvas ref="canvasRef" :class="{ inset: !!videoSrc }" />

    <!-- HUD overlay -->
    <div class="hud">
      <div class="hud-row">
        <div class="hud-stat">
          <div class="h-val">{{ speed }}</div>
          <span class="h-unit">km/h</span>
          <div class="h-lbl">Speed</div>
        </div>
        <div class="hud-stat">
          <div class="h-val">{{ elev }}</div>
          <span class="h-unit">m</span>
          <div class="h-lbl">Elevation</div>
        </div>
        <div class="hud-stat">
          <div class="h-val">{{ dist }}</div>
          <span class="h-unit">km</span>
          <div class="h-lbl">Distance</div>
        </div>
        <div class="hud-bar-wrap">
          <div class="hud-bar-bg">
            <div class="hud-bar-fill" :style="{ width: barPct + '%' }" />
          </div>
          <div class="progress-time">
            <span>{{ timeCur }}</span>
            <span>{{ timeTotal }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { lerp, arrayMax, fmtTime } from '../utils/geo.js'

const props = defineProps({
  points:    { type: Array,   required: true },
  animIdx:   { type: Number,  required: true },
  trimStart: { type: Number,  default: 0 },
  progress:  { type: Number,  default: 0 },
  totalTime: { type: Number,  default: 0 },
  videoSrc:  { type: String,  default: null },
  playing:   { type: Boolean, default: false },
})

const emit = defineEmits(['timeupdate', 'ended', 'loadedmetadata'])

const stageRef  = ref(null)
const canvasRef = ref(null)
const videoRef  = ref(null)
let ctx     = null
let toXY    = null
let maxSpeed = 1

// --- Video control (driven by parent's playing prop) ---
watch(() => props.playing, async (val) => {
  if (!videoRef.value) return
  if (val) {
    try { await videoRef.value.play() } catch (_) { /* autoplay policy */ }
  } else {
    videoRef.value.pause()
  }
})

// When a new video src is loaded, reset to start
watch(() => props.videoSrc, () => {
  if (videoRef.value) videoRef.value.currentTime = 0
})

function handleTimeUpdate() {
  if (!videoRef.value) return
  emit('timeupdate', {
    currentTime: videoRef.value.currentTime,
    duration:    videoRef.value.duration || 0,
  })
}

function handleLoadedMetadata() {
  if (!videoRef.value) return
  emit('loadedmetadata', { duration: videoRef.value.duration || 0 })
}

defineExpose({
  seekTo(sec) { if (videoRef.value) videoRef.value.currentTime = sec },
  getVideoEl() { return videoRef.value },
})

// --- HUD computed values ---
const current = computed(() => props.points[props.animIdx])

const speed   = computed(() => current.value?.speedSmooth.toFixed(1) ?? '0.0')
const elev    = computed(() => Math.round(current.value?.ele ?? 0))
const dist    = computed(() => ((current.value?.cumDist ?? 0) / 1000).toFixed(2))
const barPct  = computed(() => (props.progress * 100).toFixed(1))

const timeCur = computed(() => {
  const p  = current.value
  const p0 = props.points[0]
  if (p?.time && p0?.time) return fmtTime(p.time - p0.time)
  return `${props.animIdx}pt`
})
const timeTotal = computed(() => {
  if (props.totalTime > 0) return fmtTime(props.totalTime)
  return `${props.points.length}pts`
})

// --- Canvas drawing ---
function setupProjection() {
  if (!canvasRef.value || !props.points.length) return
  const pts    = props.points
  const latMin = pts.reduce((a, p) => Math.min(a, p.lat),  Infinity)
  const latMax = pts.reduce((a, p) => Math.max(a, p.lat), -Infinity)
  const lonMin = pts.reduce((a, p) => Math.min(a, p.lon),  Infinity)
  const lonMax = pts.reduce((a, p) => Math.max(a, p.lon), -Infinity)

  maxSpeed = arrayMax(pts.map(p => p.speedSmooth)) || 1

  const pad = props.videoSrc ? 12 : 40  // tighter padding in inset mode
  const W   = canvasRef.value.width
  // In inset mode the HUD sits outside the canvas, so use full height
  const H   = props.videoSrc
    ? canvasRef.value.height
    : canvasRef.value.height - 80

  toXY = (lat, lon) => [
    pad + (lon - lonMin) / ((lonMax - lonMin) || 1) * (W - 2 * pad),
    pad + (1 - (lat - latMin) / ((latMax - latMin) || 1)) * (H - 2 * pad),
  ]
}

function draw() {
  if (!ctx || !toXY || !props.points.length) return
  const canvas = canvasRef.value
  const W      = canvas.width
  const H      = canvas.height
  const pts    = props.points
  const idx    = props.animIdx

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = props.videoSrc ? 'rgba(0,0,0,0.6)' : '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // Faint full trail
  ctx.beginPath()
  pts.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(255,255,255,.12)'
  ctx.lineWidth   = props.videoSrc ? 1 : 1.5
  ctx.stroke()

  // Traveled segment colored by speed — start from trimStart to avoid
  // iterating thousands of off-window points on long GPX tracks
  for (let i = Math.max(1, props.trimStart); i <= idx && i < pts.length; i++) {
    const t = pts[i].speedSmooth / maxSpeed
    const r = Math.round(lerp(30,  255, t))
    const g = Math.round(lerp(100,  80, t))
    const b = Math.round(lerp(255,  30, t))
    const [x0, y0] = toXY(pts[i - 1].lat, pts[i - 1].lon)
    const [x1, y1] = toXY(pts[i].lat,     pts[i].lon)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth   = props.videoSrc ? 2 : 2.5
    ctx.stroke()
  }

  // Current position dot
  if (idx < pts.length) {
    const [cx, cy] = toXY(pts[idx].lat, pts[idx].lon)
    const dotR = props.videoSrc ? 3.5 : 5
    ctx.beginPath()
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, dotR + 3.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,.35)'
    ctx.lineWidth   = 1.5
    ctx.stroke()
  }
}

// ResizeObserver keeps canvas pixel dimensions in sync with CSS layout
let ro = null

function onResize(entries) {
  const { width, height } = entries[0].contentRect
  canvasRef.value.width  = Math.round(width)
  canvasRef.value.height = Math.round(height)
  setupProjection()
  draw()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  ro  = new ResizeObserver(onResize)
  ro.observe(canvasRef.value)
})

onUnmounted(() => ro?.disconnect())

watch(() => props.points,  () => { setupProjection(); draw() })
watch(() => props.animIdx, draw)
watch(() => props.videoSrc, () => { setupProjection(); draw() })
</script>

<style scoped>
.stage {
  background: #0a0a0a;
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
  height: 320px;
  margin-bottom: 1rem;
  border: 0.5px solid var(--border);
}
.stage.has-video {
  height: auto;
  aspect-ratio: 16 / 9;
}
.video-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
/* Full-stage map (no video) */
canvas:not(.inset) {
  width: 100%;
  height: 100%;
  display: block;
}
/* Small inset map overlaid on video */
canvas.inset {
  position: absolute;
  bottom: 64px;
  right: 12px;
  width: 168px;
  height: 112px;
  border-radius: 8px;
  border: 0.5px solid rgba(255, 255, 255, .18);
  display: block;
}
.hud {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem 1.25rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, .82));
}
.hud-row { display: flex; gap: 1.5rem; align-items: flex-end; }
.hud-stat { text-align: center; }
.h-val  { font-size: 22px; font-weight: 500; color: #fff; line-height: 1; }
.h-unit { font-size: 11px; color: rgba(255,255,255,.55); display: block; margin-top: 2px; }
.h-lbl  { font-size: 10px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .05em; margin-top: 1px; }
.hud-bar-wrap { flex: 1; }
.hud-bar-bg   { height: 3px; background: rgba(255,255,255,.15); border-radius: 2px; }
.hud-bar-fill { height: 3px; background: #fff; border-radius: 2px; transition: width .05s linear; }
.progress-time { font-size: 11px; color: rgba(255,255,255,.45); display: flex; justify-content: space-between; margin-top: 4px; }
</style>
