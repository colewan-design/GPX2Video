<template>
  <div class="chart-row">
    <div class="chart-card">
      <div class="chart-label">Elevation profile</div>
      <div class="chart-wrap"><canvas ref="elevRef" /></div>
    </div>
    <div class="chart-card">
      <div class="chart-label">Speed over distance</div>
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

const elevRef = ref(null)
const speedRef = ref(null)
let elevChart = null
let speedChart = null

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { display: false },
    y: {
      ticks: { font: { size: 10 }, color: '#666', maxTicksLimit: 4 },
      grid: { color: 'rgba(255,255,255,.06)' },
      border: { display: false },
    },
  },
  animation: false,
}

function buildCharts(pts) {
  const step = Math.max(1, Math.floor(pts.length / 200))
  const sampled = pts.filter((_, i) => i % step === 0)
  const labels = sampled.map(p => (p.cumDist / 1000).toFixed(2))

  if (elevChart) elevChart.destroy()
  elevChart = new Chart(elevRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: sampled.map(p => p.ele),
        borderColor: '#3a8fff',
        backgroundColor: 'rgba(58,143,255,.12)',
        fill: true,
        pointRadius: 0,
        tension: 0.3,
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
        borderColor: '#ff7a3a',
        backgroundColor: 'rgba(255,122,58,.1)',
        fill: true,
        pointRadius: 0,
        tension: 0.3,
        borderWidth: 1.5,
      }],
    },
    options: CHART_OPTS,
  })
}

// Bug fix: watch points (not deep) — triggered when gpxPoints.value is replaced
watch(() => props.points, pts => {
  if (pts.length) buildCharts(pts)
})

onUnmounted(() => {
  elevChart?.destroy()
  speedChart?.destroy()
})
</script>

<style scoped>
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 1.5rem;
}
.chart-card {
  background: var(--bg2);
  border-radius: var(--radius-lg);
  padding: 1rem;
  border: 0.5px solid var(--border);
}
.chart-label {
  font-size: 11px;
  color: var(--text2);
  margin-bottom: .5rem;
  font-weight: 500;
  letter-spacing: .02em;
}
.chart-wrap {
  position: relative;
  height: 130px;
}
</style>
