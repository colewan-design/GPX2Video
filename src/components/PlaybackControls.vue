<template>
  <div class="controls">
    <button @click="$emit('toggle')">
      <svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
      {{ playing ? 'Pause' : 'Play' }}
    </button>
    <button @click="$emit('reset')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
      Reset
    </button>
    <select v-if="!hasVideo" :value="speed" @change="$emit('speed', Number($event.target.value))">
      <option v-for="s in speeds" :key="s" :value="s">{{ s }}×</option>
    </select>
    <span class="track-name">{{ trackName }}</span>
  </div>
</template>

<script setup>
defineProps({
  playing:  Boolean,
  speed:    Number,
  trackName: String,
  hasVideo: { type: Boolean, default: false },
})
defineEmits(['toggle', 'reset', 'speed'])

const speeds = [1, 2, 5, 10, 20]
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.5rem;
}
button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .5rem .9rem;
  font-size: 13px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--bg2);
  border: 0.5px solid var(--border2);
  color: var(--text);
  transition: background .15s;
}
button:hover { background: var(--bg3); }
button:active { transform: scale(.97); }
button svg { width: 16px; height: 16px; }
select {
  font-size: 13px;
  padding: .45rem .7rem;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border2);
  background: var(--bg2);
  color: var(--text);
  cursor: pointer;
}
.track-name {
  margin-left: auto;
  font-size: 12px;
  color: var(--text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
</style>
