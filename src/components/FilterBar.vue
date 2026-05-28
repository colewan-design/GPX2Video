<template>
  <div class="filter-chips">
    <button
      v-for="f in FILTERS"
      :key="f.id"
      class="filter-chip"
      :class="{ active: modelValue === f.id }"
      @click="$emit('update:modelValue', f.id)"
    >
      <div class="chip-thumb">
        <div class="thumb-swatch" :style="{ filter: f.cssFilter }" />
        <div v-if="f.id === 'bw'" class="thumb-bw-overlay" />
      </div>
      <span class="chip-label">{{ f.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { VIDEO_FILTERS } from '../utils/filters.js'

const CSS_FILTERS = {
  none:      'none',
  clarity:   'contrast(1.25) saturate(1.45) brightness(0.97)',
  vivid:     'brightness(1.05) contrast(1.12) saturate(1.65)',
  cinematic: 'brightness(0.90) contrast(1.28) saturate(0.78)',
  warm:      'brightness(1.08) sepia(0.32) saturate(1.40)',
  cool:      'brightness(1.03) contrast(1.05) hue-rotate(20deg) saturate(1.20)',
  bw:        'grayscale(1) contrast(1.22)',
  vintage:   'brightness(1.10) contrast(0.85) saturate(0.70) sepia(0.60)',
  fade:      'brightness(1.20) contrast(0.80) saturate(0.68)',
}

const FILTERS = VIDEO_FILTERS.map(f => ({ ...f, cssFilter: CSS_FILTERS[f.id] ?? 'none' }))

defineProps({ modelValue: { type: String, default: 'none' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.filter-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 5px;
  border-radius: 7px;
  border: 1px solid var(--border2);
  background: var(--bg2);
  cursor: pointer;
  transition: border-color .15s, background .15s;
  width: 52px;
}
.filter-chip:hover {
  border-color: var(--accent-semi);
  background: var(--bg3);
}
.filter-chip.active {
  border-color: var(--accent-semi);
  background: var(--accent-dim);
  box-shadow: 0 0 8px var(--accent-glow);
}

.chip-thumb {
  width: 44px;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

/* Photo-like gradient: sky → forest → ground */
.thumb-swatch {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    170deg,
    #0d1f36 0%,
    #1a4a7a 22%,
    #2d7a5f 46%,
    #4a9e3a 64%,
    #8b6914 82%,
    #3d2008 100%
  );
}

.chip-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--text2);
  text-transform: uppercase;
  white-space: nowrap;
}
.filter-chip.active .chip-label {
  color: var(--accent);
}
</style>
