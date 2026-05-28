<template>
  <div class="controls">
    <button class="ctrl-btn ctrl-play" :disabled="disabled" @click="$emit('toggle')">
      <svg v-if="!playing" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6.3 2.8A1.5 1.5 0 0 0 4 4.1v11.8a1.5 1.5 0 0 0 2.3 1.3l9.4-5.9a1.5 1.5 0 0 0 0-2.6L6.3 2.8z"/>
      </svg>
      <svg v-else viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
      </svg>
      <span>{{ playing ? 'Pause' : 'Play' }}</span>
    </button>

    <button class="ctrl-btn ctrl-ghost" :disabled="disabled" @click="$emit('reset')">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M3.5 6A7 7 0 1 1 3 10" stroke-linecap="round"/>
        <path d="M1 4l2.5 2L6 4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div v-if="!hasVideo" class="speed-select-wrap">
      <select class="speed-select" :value="speed" @change="$emit('speed', Number($event.target.value))">
        <option v-for="s in speeds" :key="s" :value="s">{{ s }}×</option>
      </select>
    </div>

    <span v-if="trackName" class="track-name">{{ trackName }}</span>
  </div>
</template>

<script setup>
defineProps({
  playing:   Boolean,
  speed:     Number,
  trackName: String,
  hasVideo:  { type: Boolean, default: false },
  disabled:  { type: Boolean, default: false },
})
defineEmits(['toggle', 'reset', 'speed'])
const speeds = [1, 2, 5, 10, 20]
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ctrl-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .5rem .85rem;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .03em;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--border2);
  background: var(--bg3);
  color: var(--text);
  transition: all .15s;
  white-space: nowrap;
}
.ctrl-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.ctrl-btn:disabled { opacity: .35; cursor: not-allowed; }

.ctrl-play {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  box-shadow: 0 0 16px rgba(255,214,10,.22);
}
.ctrl-play:hover:not(:disabled) {
  background: #ffe033;
  box-shadow: 0 0 24px rgba(255,214,10,.4);
}
.ctrl-play:active:not(:disabled) { transform: scale(.97); }

.ctrl-ghost {
  background: transparent;
  padding: .5rem .6rem;
}
.ctrl-ghost:hover:not(:disabled) {
  border-color: var(--accent-semi);
  color: var(--accent);
  background: var(--accent-dim);
}

.speed-select-wrap {
  border: 1px solid var(--border2);
  border-radius: var(--radius-md);
  background: var(--bg3);
  overflow: hidden;
}
.speed-select {
  font-size: 12px;
  font-weight: 600;
  padding: .48rem .7rem;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  outline: none;
}
.track-name {
  margin-left: auto;
  font-size: 11px;
  color: var(--text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
@media (max-width: 600px) {
  .track-name { display: none; }
  span { display: none; }
  .ctrl-play { padding: .5rem .65rem; }
}
</style>
