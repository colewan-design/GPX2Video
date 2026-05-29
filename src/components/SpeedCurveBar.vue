<template>
  <div class="speed-curve-bar">
    <button
      v-for="(preset, key) in SPEED_PRESETS"
      :key="key"
      :class="['curve-btn', { active: modelValue === key }]"
      :title="curveLabel(preset)"
      @click="$emit('update:modelValue', key)"
    >
      <svg class="curve-icon" viewBox="0 0 40 22" fill="none">
        <polyline
          :points="curvePoints(preset.keyframes)"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <!-- 1× reference line (dashed) -->
        <line x1="0" :y1="yOf(1)" x2="40" :y2="yOf(1)"
              stroke="currentColor" stroke-width="0.6"
              stroke-dasharray="2,2" opacity="0.35" />
      </svg>
      <span class="curve-label">{{ preset.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { SPEED_PRESETS, evalSpeed } from '../utils/speedCurve.js'

defineProps({ modelValue: { type: String, default: 'normal' } })
defineEmits(['update:modelValue'])

const MIN_SPD = 0.08
const MAX_SPD = 2.0
const PAD = 2
const W = 40 - PAD * 2
const H = 22 - PAD * 2

function yOf(speed) {
  // map speed range to SVG coords (top = fast, bottom = slow)
  return PAD + H - ((speed - MIN_SPD) / (MAX_SPD - MIN_SPD)) * H
}

function curvePoints(keyframes) {
  const steps = 20
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const s = evalSpeed(keyframes, t)
    pts.push(`${PAD + t * W},${yOf(s)}`)
  }
  return pts.join(' ')
}

function curveLabel(preset) {
  const spds = preset.keyframes.map(([, s]) => s)
  const lo = Math.min(...spds), hi = Math.max(...spds)
  if (lo === hi) return `${preset.label} — ${lo}×`
  return `${preset.label} — ${lo}×–${hi}×`
}
</script>

<style scoped>
.speed-curve-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.curve-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 6px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text3);
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  min-width: 50px;
}
.curve-btn:hover {
  border-color: var(--accent-semi);
  color: var(--text1);
}
.curve-btn.active {
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--accent);
}

.curve-icon {
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.curve-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
