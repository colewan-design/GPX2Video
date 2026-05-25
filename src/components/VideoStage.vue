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
      <div class="hud-stats">
        <div class="hud-stat speed-stat">
          <div class="h-val">{{ speed }}<span class="h-unit">km/h</span></div>
          <div class="h-lbl">Speed</div>
        </div>
        <div class="hud-stat elev-stat">
          <div class="h-val">{{ elev }}<span class="h-unit">m</span></div>
          <div class="h-lbl">Elevation</div>
        </div>
        <div class="hud-stat dist-stat">
          <div class="h-val">{{ dist }}<span class="h-unit">km</span></div>
          <div class="h-lbl">Distance</div>
        </div>
      </div>
      <div class="hud-progress">
        <span class="hud-time">{{ timeCur }}</span>
        <div class="hud-track">
          <div class="hud-fill" :style="{ width: barPct + '%' }" />
          <div class="hud-dot"  :style="{ left: barPct + '%' }" />
        </div>
        <span class="hud-time hud-time--end">{{ timeTotal }}</span>
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

  // Watermark
  const fontSize = props.videoSrc ? 11 : 13
  ctx.save()
  ctx.font      = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('salidumay.com', W - 10, 10)
  ctx.restore()
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
  padding: 3rem 1.25rem 0.9rem;
  background: linear-gradient(transparent, rgba(0,0,0,.9) 80%);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.hud-stats {
  display: flex;
  align-items: flex-end;
  gap: 1.6rem;
}
.hud-stat {
  padding-left: 8px;
  border-left: 2px solid;
}
.speed-stat { border-color: #06b6d4; }
.elev-stat  { border-color: #22c55e; }
.dist-stat  { border-color: #f97316; }
.h-val {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
  display: flex;
  align-items: baseline;
  gap: 3px;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
}
.h-unit {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255,255,255,.5);
  text-transform: uppercase;
  letter-spacing: .1em;
}
.h-lbl {
  font-size: 8px;
  font-weight: 700;
  color: rgba(255,255,255,.3);
  text-transform: uppercase;
  letter-spacing: .14em;
  margin-top: 5px;
  text-shadow: 0 1px 3px rgba(0,0,0,.9);
}
.hud-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hud-time {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,.45);
  font-variant-numeric: tabular-nums;
  letter-spacing: .03em;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0,0,0,.9);
  min-width: 38px;
}
.hud-time--end { text-align: right; }
.hud-track {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,.15);
  border-radius: 2px;
  position: relative;
}
.hud-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(255,255,255,.85);
  border-radius: 2px;
  transition: width .05s linear;
}
.hud-dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%,-50%);
  box-shadow: 0 0 6px rgba(0,0,0,.5);
  transition: left .05s linear;
}
</style>
