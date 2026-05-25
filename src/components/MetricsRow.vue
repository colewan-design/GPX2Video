<template>
  <div class="metrics">
    <div class="metric">
      <div class="lbl">Total distance</div>
      <div class="val">{{ stats.totalDist.toFixed(2) }}<span class="unit">km</span></div>
    </div>
    <div class="metric">
      <div class="lbl">Elevation gain</div>
      <div class="val">{{ stats.elevGain }}<span class="unit">m</span></div>
    </div>
    <div class="metric">
      <div class="lbl">Avg speed</div>
      <div class="val">{{ stats.avgSpeed.toFixed(1) }}<span class="unit">km/h</span></div>
    </div>
    <div class="metric">
      <div class="lbl">Max speed</div>
      <div class="val">{{ stats.maxSpeed.toFixed(1) }}<span class="unit">km/h</span></div>
    </div>
  </div>
</template>

<script setup>
defineProps({ stats: { type: Object, required: true } })
</script>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 1.5rem 0;
}
.metric {
  background: var(--bg2);
  border-radius: var(--radius-md);
  padding: .75rem 1rem;
  border: 0.5px solid var(--border);
}
.lbl { font-size: 11px; color: var(--text2); margin-bottom: .3rem; }
.val { font-size: 20px; font-weight: 500; color: var(--text); }
.unit { font-size: 11px; color: var(--text3); margin-left: 3px; }
</style>
