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
  gap: 6px;
}
.ctrl-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: .3rem .7rem;
  height: 30px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--border2);
  background: var(--bg3);
  color: var(--text2);
  transition: border-color .15s, color .15s, background .15s;
  white-space: nowrap;
}
.ctrl-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
.ctrl-btn:disabled { opacity: .35; cursor: not-allowed; }

.ctrl-play {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
  font-weight: 600;
  padding: .3rem .9rem;
}
.ctrl-play:hover:not(:disabled) {
  background: var(--export-hover);
  border-color: var(--export-hover);
}
.ctrl-play:active:not(:disabled) { transform: scale(.97); }

.ctrl-ghost {
  background: transparent;
  border-color: var(--border);
  padding: .3rem .5rem;
}
.ctrl-ghost:hover:not(:disabled) {
  border-color: var(--border3);
  color: var(--text);
  background: var(--bg4);
}

.speed-select-wrap {
  border: 1px solid var(--border2);
  border-radius: var(--radius-md);
  background: var(--bg3);
  overflow: hidden;
  height: 30px;
  display: flex;
  align-items: center;
}
.speed-select {
  font-size: 12px;
  font-weight: 500;
  padding: 0 .65rem;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  outline: none;
  height: 100%;
}
.track-name {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
@media (max-width: 600px) {
  .track-name { display: none; }
  span { display: none; }
}
</style>
