<template>
  <div class="gpx-loader">
    <!-- Current file / loaded state -->
    <div class="gpx-source" :class="{ loaded }">
      <div class="gpx-icon">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 10a7 7 0 1 0 14 0 7 7 0 0 0-14 0z"/>
          <path d="M10 7v3l2 2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="gpx-info">
        <span class="gpx-label">{{ fileName ?? (loaded ? 'Strava activity' : 'No GPX loaded') }}</span>
        <span class="gpx-sub">{{ loaded ? 'GPX track' : 'Drop file or browse' }}</span>
      </div>
      <div v-if="loaded" class="gpx-loaded-dot" />
      <button v-if="loaded" class="gpx-btn gpx-btn-remove" title="Remove GPX" @click="$emit('remove')">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M2 2l8 8M10 2l-8 8"/>
        </svg>
      </button>
      <button class="gpx-btn" @click="fileInput.click()">
        {{ loaded ? 'Change' : 'Browse' }}
      </button>
    </div>

    <!-- Drop overlay -->
    <div
      v-if="!loaded"
      class="gpx-drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="fileInput.click()"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M8 3v7M5 7l3-4 3 4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 13h12" stroke-linecap="round"/>
      </svg>
      <span>Drag .gpx here</span>
    </div>

    <!-- Strava toggle -->
    <button class="strava-toggle" :class="{ active: stravaOpen }" @click="$emit('toggle-strava')">
      <svg class="strava-s" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z"/>
        <path d="M11.321 13.828H8.332L15.387 0l3.441 6.814h-3.046l-4.461-8.814v.001z" opacity=".55"/>
      </svg>
      Import from Strava
      <svg class="chevron" :class="{ open: stravaOpen }" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <input ref="fileInput" type="file" accept=".gpx" @change="onPick" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  fileName:   { type: String,  default: null },
  loaded:     { type: Boolean, default: false },
  stravaOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['file', 'remove', 'toggle-strava'])
const fileInput = ref(null)
const dragging  = ref(false)

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
.gpx-loader {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Source row (file name + buttons) */
.gpx-source {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: .6rem .7rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border2);
  background: var(--bg3);
  transition: border-color .2s;
}
.gpx-source.loaded {
  border-style: solid;
  border-color: rgba(255,214,10,.22);
}
.gpx-icon {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg4);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.gpx-icon svg { width: 14px; height: 14px; color: var(--text3); }
.loaded .gpx-icon svg { color: var(--accent); }
.gpx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.gpx-label {
  font-size: 11px; font-weight: 600; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpx-sub { font-size: 10px; color: var(--text3); }
.gpx-loaded-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-glow);
  flex-shrink: 0;
}
.gpx-btn {
  flex-shrink: 0;
  font-size: 10px; font-weight: 700;
  letter-spacing: .05em; text-transform: uppercase;
  padding: .28rem .6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border2);
  background: var(--bg4);
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.gpx-btn:hover { border-color: var(--accent-semi); color: var(--accent); }
.gpx-btn-remove {
  padding: .28rem .4rem;
  color: var(--text3);
}
.gpx-btn-remove svg { width: 10px; height: 10px; display: block; }
.gpx-btn-remove:hover { border-color: rgba(255,80,80,.4); color: #ff5050; }

/* Drop zone (shown when no file) */
.gpx-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: .5rem;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  text-transform: uppercase;
}
.gpx-drop svg { width: 12px; height: 12px; }
.gpx-drop:hover,
.gpx-drop.dragging {
  border-color: var(--accent-semi);
  color: var(--accent);
  background: var(--accent-dim);
}

/* Strava toggle */
.strava-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .45rem .7rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  width: 100%;
}
.strava-toggle:hover {
  border-color: rgba(252,76,2,.35);
  color: #FC4C02;
  background: rgba(252,76,2,.06);
}
.strava-toggle.active {
  border-color: rgba(252,76,2,.45);
  color: #FC4C02;
  background: rgba(252,76,2,.08);
}
.strava-s { width: 13px; height: 13px; color: #FC4C02; flex-shrink: 0; }
.chevron {
  width: 10px; height: 10px;
  margin-left: auto;
  transition: transform .2s;
}
.chevron.open { transform: rotate(180deg); }

input { display: none; }
</style>
