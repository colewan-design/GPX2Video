<template>
  <div class="chart-row">
    <div class="chart-track">
      <div class="chart-track-header">
        <span class="track-dot elev-dot" />
        <span class="track-label">Elevation</span>
      </div>
      <div class="chart-wrap"><canvas ref="elevRef" /></div>
    </div>
    <div class="chart-track">
      <div class="chart-track-header">
        <span class="track-dot speed-dot" />
        <span class="track-label">Speed</span>
      </div>
      <div class="chart-wrap"><canvas ref="speedRef" /></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { Chart } from 'chart.js/auto'

const props = defineProps({
  points: { type: Array, required: true },
})

const elevRef  = ref(null)
const speedRef = ref(null)
let elevChart  = null
let speedChart = null

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { display: false },
    y: {
      ticks: { font: { size: 9, family: 'Inter, sans-serif' }, color: '#3a3a4a', maxTicksLimit: 3 },
      grid: { color: 'rgba(255,255,255,.04)' },
      border: { display: false },
    },
  },
  animation: false,
  elements: {
    line: { tension: 0.35 },
  },
}

function buildCharts(pts) {
  const step    = Math.max(1, Math.floor(pts.length / 300))
  const sampled = pts.filter((_, i) => i % step === 0)
  const labels  = sampled.map(p => (p.cumDist / 1000).toFixed(2))

  if (elevChart) elevChart.destroy()
  elevChart = new Chart(elevRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: sampled.map(p => p.ele),
        borderColor: '#ffd60a',
        backgroundColor: 'rgba(255,214,10,0.07)',
        fill: true,
        pointRadius: 0,
        tension: 0.35,
        borderWidth: 1.5,
      }],
    },
    options: CHART_OPTS,
  })

  if (speedChart) speedChart.destroy()
  speedChart = new Chart(speedRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: sampled.map(p => p.speedSmooth.toFixed(1)),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.07)',
        fill: true,
        pointRadius: 0,
        tension: 0.35,
        borderWidth: 1.5,
      }],
    },
    options: CHART_OPTS,
  })
}

watch(() => props.points, pts => { if (pts.length) buildCharts(pts) })

onUnmounted(() => {
  elevChart?.destroy()
  speedChart?.destroy()
})
</script>

<style scoped>
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
}
@media (max-width: 600px) {
  .chart-row { grid-template-columns: 1fr; }
}
.chart-track {
  background: var(--bg2);
  padding: .6rem .75rem .5rem;
}
.chart-track-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: .4rem;
}
.track-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.elev-dot  { background: #ffd60a; box-shadow: 0 0 5px rgba(255,214,10,.5); }
.speed-dot { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,.5); }
.track-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text3);
}
.chart-wrap {
  position: relative;
  height: 60px;
}
</style>
