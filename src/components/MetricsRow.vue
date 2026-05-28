<template>
  <div class="live-stats">
    <div class="stat-card" v-for="s in statCards" :key="s.key" :class="{ highlight: s.highlight }">
      <div class="stat-top">
        <span class="stat-icon" v-html="s.icon" />
        <span class="stat-label">{{ s.label }}</span>
      </div>
      <div class="stat-value-row">
        <span class="stat-value">{{ s.value }}</span>
        <span class="stat-unit">{{ s.unit }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stats: { type: Object, required: true } })

const duration = computed(() => {
  const ms = props.stats.totalTime
  if (!ms) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
})

const statCards = computed(() => [
  {
    key: 'speed',
    label: 'MAX SPEED',
    value: props.stats.maxSpeed.toFixed(1),
    unit: 'km/h',
    highlight: true,
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5" stroke-linecap="round"/></svg>`,
  },
  {
    key: 'avgspeed',
    label: 'AVG SPEED',
    value: props.stats.avgSpeed.toFixed(1),
    unit: 'km/h',
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12 L8 5 L14 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key: 'dist',
    label: 'DISTANCE',
    value: props.stats.totalDist.toFixed(2),
    unit: 'km',
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8h12M10 5l4 3-4 3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key: 'elev',
    label: 'ELEV GAIN',
    value: props.stats.elevGain,
    unit: 'm',
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13l4-6 4 3 4-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  ...(duration.value ? [{
    key: 'time',
    label: 'DURATION',
    value: duration.value,
    unit: '',
    icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3h2.5" stroke-linecap="round"/></svg>`,
  }] : []),
])
</script>

<style scoped>
.live-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: .7rem .85rem;
  transition: border-color .2s;
}
.stat-card.highlight {
  border-color: var(--accent-semi);
  background: rgba(255,214,10,.05);
}
.stat-top {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: .3rem;
}
.stat-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  display: flex;
  color: var(--text3);
}
.stat-icon :deep(svg) { width: 12px; height: 12px; }
.highlight .stat-icon { color: var(--accent); }
.stat-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .12em;
  color: var(--text3);
  text-transform: uppercase;
}
.highlight .stat-label { color: var(--accent); opacity: .7; }
.stat-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}
.highlight .stat-value { color: var(--accent); }
.stat-unit {
  font-size: 10px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .06em;
}
.highlight .stat-unit { color: var(--accent); opacity: .6; }
</style>
