<template>
  <div
    class="vloader"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="label">{{ fileName ?? 'Drop your GoPro video here or' }}</span>
    <button @click="fileInput.click()">{{ fileName ? 'Change' : 'Browse' }}</button>
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
  padding: .55rem 1rem;
  border-radius: var(--radius-md);
  border: 0.5px dashed var(--border2);
  background: var(--bg2);
  margin-bottom: 1rem;
  transition: border-color .2s, background .2s;
}
.vloader.dragging {
  border-color: var(--accent-blue);
  background: var(--bg3);
}
svg {
  width: 17px;
  height: 17px;
  color: var(--text2);
  flex-shrink: 0;
}
.label {
  font-size: 13px;
  color: var(--text2);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button {
  font-size: 12px;
  padding: .3rem .75rem;
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border2);
  background: var(--bg3);
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
}
button:hover { background: #2e2e2e; }
input { display: none; }
</style>
