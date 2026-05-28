<template>
  <div class="color-bar">
    <span class="color-label">Color</span>
    <div class="color-swatches">
      <button
        v-for="c in PRESETS"
        :key="c"
        class="swatch"
        :class="{ active: modelValue === c }"
        :style="{ background: c }"
        :title="c"
        @click="$emit('update:modelValue', c)"
      >
        <svg v-if="modelValue === c" class="check" viewBox="0 0 12 12">
          <polyline points="2,6 5,9 10,3" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Custom color input -->
      <label class="swatch swatch-custom" title="Custom color">
        <input
          type="color"
          :value="modelValue"
          class="color-input"
          @input="$emit('update:modelValue', $event.target.value)"
        />
        <svg viewBox="0 0 16 16" class="palette-icon">
          <circle cx="5"  cy="5"  r="1.5" fill="#ef4444"/>
          <circle cx="11" cy="5"  r="1.5" fill="#22c55e"/>
          <circle cx="8"  cy="10" r="1.5" fill="#3b82f6"/>
          <path d="M8 1.5A6.5 6.5 0 1 0 14.5 8" stroke="rgba(255,255,255,0.7)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        </svg>
      </label>
    </div>
  </div>
</template>

<script setup>
const PRESETS = [
  '#f59e0b', // amber
  '#00c8ff', // cyan
  '#00e5c0', // teal
  '#22c55e', // green
  '#ef4444', // red
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#ffffff',  // white
]
defineProps({ modelValue: { type: String, default: '#f59e0b' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.color-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: .75rem;
  flex-wrap: wrap;
}
.color-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .12em;
  flex-shrink: 0;
  width: 100%;
}
.color-swatches {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  align-items: center;
}
.swatch {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.15);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
  transition: transform .1s, border-color .1s, box-shadow .1s;
  flex-shrink: 0;
}
.swatch:hover { transform: scale(1.15); border-color: rgba(255,255,255,0.5); }
.swatch.active {
  border-color: rgba(255,255,255,0.85);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
}
.check { width: 10px; height: 10px; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }

/* Custom picker swatch */
.swatch-custom {
  background: var(--bg3);
  border: 1.5px solid var(--border2);
  position: relative;
  cursor: pointer;
}
.swatch-custom:hover { border-color: rgba(255,255,255,0.5); }
.color-input {
  position: absolute; inset: 0;
  opacity: 0;
  width: 100%; height: 100%;
  cursor: pointer;
  border: none; padding: 0;
}
.palette-icon { width: 12px; height: 12px; flex-shrink: 0; pointer-events: none; }
</style>
