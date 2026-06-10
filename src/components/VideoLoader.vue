<template>
  <div
    class="vpicker"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <!-- Thumbnail grid -->
    <div v-if="videos.length" class="vp-grid">
      <div
        v-for="(v, i) in videos"
        :key="v.url"
        class="vp-thumb"
        :class="{ active: i === activeIdx }"
        draggable="true"
        @click="selectVideo(i)"
        @dragstart="onDragStart(i, $event)"
        @dragend="onDragEnd"
      >
        <video :src="v.url" :ref="el => setThumbRef(el, i)" class="vp-thumb-video" muted preload="metadata" @loadedmetadata="seekThumb(i)" />
        <div class="vp-thumb-overlay">
          <span class="vp-thumb-dur">{{ v.dur }}</span>
        </div>
        <div v-if="i === activeIdx" class="vp-thumb-active-ring" />
        <button class="vp-thumb-remove" @click.stop="removeVideo(i)" title="Remove">×</button>
      </div>
      <!-- Add more button -->
      <div class="vp-thumb vp-add" @click="fileInput.click()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Add</span>
      </div>
    </div>

    <!-- Empty drop zone -->
    <div v-else class="vp-empty" @click="fileInput.click()">
      <div class="vp-empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="vp-empty-label">Browse or drop videos</span>
      <span class="vp-empty-sub">MP4, MOV, GoPro</span>
    </div>

    <!-- File name bar when a video is selected -->
    <div v-if="videos.length" class="vp-bar">
      <span class="vp-bar-name">{{ videos[activeIdx]?.name }}</span>
      <button class="vp-bar-btn" @click="fileInput.click()">Browse</button>
    </div>

    <input ref="fileInput" type="file" accept="video/*" multiple @change="onPick" />
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useDraggedVideo } from '../composables/useDraggedVideo.js'


const emit = defineEmits(['file', 'append', 'select', 'clear'])
const { draggedFile, isDragging } = useDraggedVideo()

const fileInput = ref(null)
const dragging  = ref(false)
const videos    = ref([])    // { file, name, url, dur }
const activeIdx = ref(0)
const thumbRefs = ref({})

function setThumbRef(el, i) {
  if (el) thumbRefs.value[i] = el
}

function seekThumb(i) {
  const el = thumbRefs.value[i]
  if (!el) return
  if (!videos.value[i]?.dur) videos.value[i].dur = fmtDur(el.duration)
  el.currentTime = 1
}

function fmtDur(sec) {
  if (!isFinite(sec) || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = String(Math.floor(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function addFiles(files) {
  const isFirst = videos.value.length === 0
  for (const file of files) {
    const url = URL.createObjectURL(file)
    videos.value.push({ file, name: file.name, url, dur: '' })
  }
  if (isFirst) {
    activeIdx.value = 0
    emit('file', videos.value[0].file)
    if (files.length > 1) {
      emit('append', Array.from(files).slice(1))
    }
  } else {
    emit('append', Array.from(files))
  }
}

function selectVideo(i) {
  activeIdx.value = i
  emit('select', i)
}

function removeVideo(i) {
  const wasActive = i === activeIdx.value
  URL.revokeObjectURL(videos.value[i].url)
  videos.value.splice(i, 1)
  if (videos.value.length === 0) {
    activeIdx.value = 0
    emit('clear')
  } else if (wasActive) {
    // Removed the selected clip — clear the stage; user can click another to resume
    activeIdx.value = -1
    emit('clear')
  } else {
    // Adjust index if a clip before the active one was removed
    if (i < activeIdx.value) activeIdx.value--
    // Stage stays on the currently-playing clip — no emit needed
  }
}

function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('video/') || f.name.toLowerCase().endsWith('.mp4') || f.name.toLowerCase().endsWith('.mov'))
  if (files.length) addFiles(files)
}

function onPick(e) {
  const files = [...e.target.files]
  if (files.length) addFiles(files)
  e.target.value = ''
}

function onDragStart(i, e) {
  isDragging.value  = true
  draggedFile.value = videos.value[i].file
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/plain', String(i))
}

function onDragEnd() {
  isDragging.value  = false
  draggedFile.value = null
}

function clearCache() {
  videos.value.forEach(v => URL.revokeObjectURL(v.url))
  videos.value  = []
  activeIdx.value = 0
}

onBeforeUnmount(() => {
  videos.value.forEach(v => URL.revokeObjectURL(v.url))
})

defineExpose({ clearCache })
</script>

<style scoped>
.vpicker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Grid ── */
.vp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.vp-thumb {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 16/9;
  background: var(--bg4);
  cursor: pointer;
  border: 1px solid var(--border);
  transition: border-color .15s;
}
.vp-thumb:hover { border-color: rgba(255,214,10,.35); }
.vp-thumb.active { border-color: var(--accent); }
.vp-thumb[draggable="true"] { cursor: grab; }
.vp-thumb[draggable="true"]:active { cursor: grabbing; }

.vp-thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.vp-thumb-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,.7));
  padding: 6px 5px 3px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
.vp-thumb-dur {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  letter-spacing: .04em;
  font-variant-numeric: tabular-nums;
}

.vp-thumb-remove {
  position: absolute;
  top: 4px; right: 4px;
  width: 18px; height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,.7);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .15s, background .15s;
  padding: 0;
}
.vp-thumb:hover .vp-thumb-remove { opacity: 1; }
.vp-thumb-remove:hover { background: var(--red); }

.vp-thumb-active-ring {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255,214,10,.15);
}

/* Add more cell */
.vp-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-style: dashed !important;
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  transition: border-color .15s, color .15s;
}
.vp-add:hover { border-color: rgba(255,214,10,.4) !important; color: var(--accent); }
.vp-add svg { width: 18px; height: 18px; opacity: .6; }

/* ── Empty state ── */
.vp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 1.4rem .9rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border2);
  background: var(--bg3);
  cursor: pointer;
  transition: border-color .2s, background .2s;
  text-align: center;
}
.vp-empty:hover,
.vpicker.dragging .vp-empty {
  border-color: rgba(255,214,10,.35);
  background: rgba(255,214,10,.04);
}
.vp-empty-icon {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg4);
  border-radius: var(--radius-sm);
}
.vp-empty-icon svg { width: 17px; height: 17px; color: var(--text2); }
.vp-empty-label { font-size: 11px; font-weight: 600; color: var(--text2); }
.vp-empty-sub { font-size: 10px; color: var(--text3); }

/* ── Bottom bar ── */
.vp-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .35rem .5rem;
  border-radius: var(--radius-sm);
  background: var(--bg3);
  border: 1px solid var(--border);
}
.vp-bar-name {
  flex: 1;
  font-size: 10px;
  color: var(--text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vp-bar-btn {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border2);
  background: var(--bg4);
  color: var(--text2);
  cursor: pointer;
  letter-spacing: .03em;
  text-transform: uppercase;
  transition: border-color .15s, color .15s;
}
.vp-bar-btn:hover { border-color: var(--accent-semi); color: var(--accent); }

input { display: none; }
</style>
