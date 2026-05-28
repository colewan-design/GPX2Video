<template>
  <div
    class="drop-zone"
    :class="{ dragging }"
    @click="fileInput.click()"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="dz-inner">
      <div class="dz-icon-wrap">
        <svg class="dz-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" opacity=".35"/>
          <path d="M24 14v14M17 21l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 33h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/>
        </svg>
      </div>
      <div class="dz-copy">
        <p class="dz-title">Drop your GPX file</p>
        <p class="dz-sub">Strava · Garmin · Komoot · any <strong>.gpx</strong></p>
      </div>
      <span class="dz-btn">Browse file</span>
    </div>
    <input ref="fileInput" type="file" accept=".gpx" @change="onPick" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['file'])
const fileInput = ref(null)
const dragging = ref(false)

function onDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) emit('file', file)
}

function onPick(e) {
  const file = e.target.files[0]
  if (file) emit('file', file)
  e.target.value = ''
}
</script>

<style scoped>
.drop-zone {
  border: 1px dashed var(--border2);
  border-radius: var(--radius-lg);
  padding: 2.5rem 1.5rem;
  cursor: pointer;
  transition: border-color .2s, background .2s;
  background: var(--glass-bg);
  user-select: none;
  position: relative;
  overflow: hidden;
}
.drop-zone::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(255,214,10,0.04) 0%, transparent 70%);
  pointer-events: none;
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--accent);
  background: rgba(255,214,10,0.04);
}
.drop-zone.dragging {
  box-shadow: 0 0 0 1px var(--accent), 0 0 30px rgba(255,214,10,0.08);
}
.dz-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}
.dz-icon-wrap {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg3);
  border-radius: 50%;
  border: 1px solid var(--border2);
}
.dz-icon {
  width: 36px;
  height: 36px;
  color: var(--accent);
}
.dz-copy { text-align: center; }
.dz-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: .35rem;
}
.dz-sub {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.5;
}
.dz-sub strong { color: var(--accent); font-weight: 600; }
.dz-btn {
  display: inline-block;
  padding: .45rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-semi);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
  transition: background .15s, box-shadow .15s;
}
.drop-zone:hover .dz-btn {
  background: var(--accent-dim);
  box-shadow: 0 0 12px var(--accent-glow);
}
input { display: none; }
</style>
