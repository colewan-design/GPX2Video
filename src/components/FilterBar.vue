<template>
  <div class="filter-bar">
    <span class="filter-label">Filter</span>
    <div class="filter-chips">
      <button
        v-for="f in VIDEO_FILTERS"
        :key="f.id"
        class="filter-chip"
        :class="{ active: modelValue === f.id }"
        @click="$emit('update:modelValue', f.id)"
      >
        {{ f.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { VIDEO_FILTERS } from '../utils/filters.js'
defineProps({ modelValue: { type: String, default: 'none' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: .75rem;
}
.filter-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .05em;
  flex-shrink: 0;
}
.filter-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: .28rem .65rem;
  font-size: 12px;
  border-radius: 20px;
  border: 0.5px solid var(--border2);
  background: var(--bg2);
  color: var(--text2);
  cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
  white-space: nowrap;
}
.filter-chip:hover { background: var(--bg3); color: var(--text); }
.filter-chip.active {
  background: rgba(245,158,11,0.15);
  border-color: rgba(245,158,11,0.45);
  color: #f59e0b;
  font-weight: 600;
}
</style>
