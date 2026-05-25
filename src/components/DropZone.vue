<template>
  <div
    class="drop-zone"
    :class="{ dragging }"
    @click="fileInput.click()"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M12 8v8M8 12l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p>Drop your GPX file here or <span class="link">click to upload</span></p>
    <p class="hint">Strava, Garmin, Komoot, or any standard .gpx file</p>
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
  border: 1.5px dashed var(--border2);
  border-radius: var(--radius-lg);
  padding: 3rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: background .2s, border-color .2s;
  background: var(--bg2);
  user-select: none;
}
.drop-zone:hover,
.drop-zone.dragging {
  background: var(--bg3);
  border-color: var(--accent-blue);
}
.icon {
  width: 40px;
  height: 40px;
  color: var(--text2);
  margin: 0 auto .75rem;
  display: block;
}
p {
  color: var(--text2);
  font-size: 14px;
  line-height: 1.6;
}
.link { color: var(--accent-blue); }
.hint { font-size: 12px; color: var(--text3); margin-top: .3rem; }
input { display: none; }
</style>
