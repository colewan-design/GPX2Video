<template>
  <div class="aspect-groups">
    <div class="aspect-group">
      <span class="group-label">Landscape</span>
      <div class="aspect-chips">
        <button
          v-for="r in LANDSCAPE"
          :key="r.id"
          class="aspect-chip"
          :class="{ active: modelValue === r.id }"
          @click="$emit('update:modelValue', r.id)"
        >
          <svg class="ratio-thumb" viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
            <rect
              :x="r.thumb.x" :y="r.thumb.y"
              :width="r.thumb.w" :height="r.thumb.h"
              rx="1.5"
              fill="currentColor" class="thumb-rect"
            />
          </svg>
          <span class="chip-label">{{ r.label }}</span>
        </button>
      </div>
    </div>
    <div class="aspect-group">
      <span class="group-label">Portrait</span>
      <div class="aspect-chips">
        <button
          v-for="r in PORTRAIT"
          :key="r.id"
          class="aspect-chip"
          :class="{ active: modelValue === r.id }"
          @click="$emit('update:modelValue', r.id)"
        >
          <svg class="ratio-thumb" viewBox="0 0 40 30" xmlns="http://www.w3.org/2000/svg">
            <rect
              :x="r.thumb.x" :y="r.thumb.y"
              :width="r.thumb.w" :height="r.thumb.h"
              rx="1.5"
              fill="currentColor" class="thumb-rect"
            />
          </svg>
          <span class="chip-label">{{ r.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
function thumb(wRatio, hRatio) {
  const maxW = 38, maxH = 28
  let w, h
  if (wRatio / hRatio > maxW / maxH) {
    w = maxW; h = maxW * (hRatio / wRatio)
  } else {
    h = maxH; w = maxH * (wRatio / hRatio)
  }
  return { x: (40 - w) / 2, y: (30 - h) / 2, w, h }
}

const LANDSCAPE = [
  { id: '1:1',   label: '1:1',   thumb: thumb(1,  1)  },
  { id: '4:3',   label: '4:3',   thumb: thumb(4,  3)  },
  { id: '3:2',   label: '3:2',   thumb: thumb(3,  2)  },
  { id: '16:10', label: '16:10', thumb: thumb(16, 10) },
  { id: '16:9',  label: '16:9',  thumb: thumb(16, 9)  },
  { id: '21:9',  label: '21:9',  thumb: thumb(21, 9)  },
  { id: '32:9',  label: '32:9',  thumb: thumb(32, 9)  },
]
const PORTRAIT = [
  { id: '9:16', label: '9:16', thumb: thumb(9, 16) },
  { id: '9:21', label: '9:21', thumb: thumb(9, 21) },
]

defineProps({ modelValue: { type: String, default: '16:9' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.aspect-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.aspect-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.group-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text3);
}
.aspect-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.aspect-chip {
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
  width: 46px;
}
.aspect-chip:hover {
  border-color: var(--accent-semi);
  background: var(--bg3);
}
.aspect-chip.active {
  border-color: var(--accent-semi);
  background: var(--accent-dim);
  box-shadow: 0 0 8px var(--accent-glow);
}

.ratio-thumb {
  width: 40px;
  height: 30px;
  flex-shrink: 0;
  color: var(--border2);
}
.aspect-chip.active .ratio-thumb { color: var(--accent-semi); }
.aspect-chip:hover .ratio-thumb   { color: var(--border2); }

.thumb-rect {
  transition: fill .15s;
}

.chip-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .04em;
  color: var(--text2);
  text-transform: uppercase;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.aspect-chip.active .chip-label { color: var(--accent); }
</style>
