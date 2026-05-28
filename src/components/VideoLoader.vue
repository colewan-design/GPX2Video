<template>
  <div
    class="vloader"
    :class="{ dragging, loaded: !!fileName }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="vl-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="vl-info">
      <span class="vl-label">{{ fileName ?? 'Video file' }}</span>
      <span class="vl-sub">{{ fileName ? 'loaded' : 'GoPro, phone, MP4 — drag &amp; drop' }}</span>
    </div>
    <div class="vl-status" v-if="fileName">
      <span class="loaded-dot" />
    </div>
    <button class="vl-btn" @click="fileInput.click()">
      {{ fileName ? 'Change' : 'Browse' }}
    </button>
    <input ref="fileInput" type="file" accept="video/*" @change="onPick" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ fileName: { type: String, default: null } })
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
.vloader {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: .7rem .9rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border2);
  background: var(--bg3);
  transition: border-color .2s, background .2s;
  cursor: default;
}
.vloader.dragging,
.vloader:hover {
  border-color: rgba(255,214,10,.35);
  background: rgba(255,214,10,.04);
}
.vloader.loaded {
  border-style: solid;
  border-color: rgba(255,214,10,.25);
}
.vl-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg4);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.vl-icon svg { width: 15px; height: 15px; color: var(--text2); }
.loaded .vl-icon svg { color: var(--accent); }
.vl-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.vl-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vl-sub { font-size: 10px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vl-status { flex-shrink: 0; }
.loaded-dot {
  display: block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent-green);
  box-shadow: 0 0 6px rgba(34,197,94,.5);
}
.vl-btn {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: .3rem .7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border2);
  background: var(--bg4);
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
  letter-spacing: .03em;
  text-transform: uppercase;
}
.vl-btn:hover {
  border-color: var(--accent-semi);
  color: var(--accent);
}
input { display: none; }
</style>
