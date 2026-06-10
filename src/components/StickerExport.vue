<template>
  <div class="sticker-wrap" ref="wrapRef">
    <button class="sticker-btn" :class="{ 'sticker-btn--on': open }" @click="toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z"/>
      </svg>
      Sticker
    </button>

    <!-- ── Full-page sticker editor ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="open" ref="dialogRef" class="fp-shell">

        <!-- Header -->
        <div class="fp-header">
          <span class="fp-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
              <path d="M10 1.5l2 6.2H18l-5.2 3.8 2 6.2L10 14l-4.8 3.7 2-6.2L2 7.7h6z"/>
            </svg>
            Sticker
          </span>
          <div class="fp-header-actions">
            <button class="fp-dl-btn" @click="download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {{ bgImageSrc ? 'Download photo' : 'Download PNG' }}
            </button>
            <button class="fp-close" @click="toggle" title="Close">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- file input always-mounted -->
        <input ref="bgInputRef" type="file" accept="image/*" style="display:none" @change="onBgPick" />

        <!-- Body: sidebar + canvas -->
        <div class="fp-body">

          <!-- ── Desktop sidebar (hidden on mobile) ─────────────────────────── -->
          <aside class="fp-sidebar">

            <!-- Sub-tab bar -->
            <div class="fp-tab-bar">
              <button :class="['fp-tab', { 'fp-tab--on': sidebarTab === 'theme' }]" @click="sidebarTab = 'theme'">Theme</button>
              <button :class="['fp-tab', { 'fp-tab--on': sidebarTab === 'photo' }]" @click="sidebarTab = 'photo'">
                Photo
                <span v-if="bgImageSrc" class="fp-tab-dot" />
              </button>
            </div>

            <!-- ── Theme tab ── -->
            <div v-if="sidebarTab === 'theme'" class="fp-tab-content">

              <div v-if="!bgImageSrc" class="fp-section">
                <span class="fp-section-lbl">Canvas</span>
                <div class="sticker-orient">
                  <button
                    v-for="o in ORIENT_OPTIONS" :key="o.key"
                    :class="['orient-btn', { 'orient-btn--on': orientation === o.key }]"
                    :title="o.label"
                    @click="setOrientation(o.key)"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <rect :x="o.rx" :y="o.ry" :width="o.rw" :height="o.rh" rx="1.5"/>
                    </svg>
                    {{ o.label }}
                  </button>
                </div>
              </div>

              <div class="fp-section">
                <span class="fp-section-lbl">Theme</span>
                <div class="sticker-formats">
                  <button
                    v-for="f in FORMAT_OPTIONS" :key="f.key"
                    :class="['format-btn', { 'format-btn--on': stickerFormat === f.key }]"
                    @click="setFormat(f.key)"
                  >{{ f.label }}</button>
                </div>
              </div>

            </div>

            <!-- ── Photo tab ── -->
            <div v-if="sidebarTab === 'photo'" class="fp-tab-content">

              <div class="fp-section">
                <span class="fp-section-lbl">Background photo</span>
                <div
                  class="embed-upload"
                  :class="{ 'embed-upload--dragging': bgDragging, 'embed-upload--loaded': !!bgImageSrc }"
                  @click="bgInputRef.click()"
                  @dragover.prevent="bgDragging = true"
                  @dragleave="bgDragging = false"
                  @drop.prevent="onBgDrop"
                >
                  <template v-if="!bgImageSrc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M3 15l5-5 4 4 3-3 6 6"/>
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
                    </svg>
                    <span class="embed-upload-label">Drop a photo or <span class="embed-link">click to browse</span></span>
                    <span class="embed-upload-hint">Embed sticker into a photo — optional</span>
                  </template>
                  <template v-else>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                      <rect x="1" y="1" width="14" height="14" rx="2"/>
                      <path d="M1 10l4-3 3 2.5 3-4 5 4.5"/>
                    </svg>
                    <span class="embed-upload-label embed-upload-filename">{{ bgFileName }}&ensp;<span class="embed-link">change</span></span>
                    <button class="embed-clear-btn" @click.stop="clearBgImage" title="Remove photo">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                      </svg>
                    </button>
                  </template>
                </div>
              </div>

              <template v-if="bgImageSrc">
                <div class="fp-divider" />

                <div class="fp-section">
                  <span class="fp-section-lbl">Embed style</span>
                  <div class="embed-style-tabs embed-style-tabs--3">
                    <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'sticker' }]" @click="setEmbedStyle('sticker')">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <rect x="2" y="2" width="7" height="9" rx="1.5"/>
                        <rect x="7" y="5" width="7" height="9" rx="1.5" opacity=".5"/>
                      </svg>
                      Sticker
                    </button>
                    <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'integrated' }]" @click="setEmbedStyle('integrated')">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <rect x="1" y="1" width="14" height="14" rx="2"/>
                        <path d="M1 10l4-3 3 2.5 3-4 5 4.5" opacity=".5"/>
                        <rect x="1" y="10" width="14" height="5" rx="0" fill="currentColor" opacity=".25" stroke="none"/>
                        <line x1="4" y1="12" x2="4" y2="14.5" stroke-width="1.8"/>
                        <line x1="8" y1="12" x2="8" y2="14.5" stroke-width="1.8"/>
                        <line x1="12" y1="12" x2="12" y2="14.5" stroke-width="1.8"/>
                      </svg>
                      Overlay
                    </button>
                    <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'backdrop' }]" @click="setEmbedStyle('backdrop')">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <rect x="1" y="1" width="14" height="14" rx="2"/>
                        <circle cx="4.5" cy="5" r="1.4" fill="currentColor" stroke="none" opacity=".4"/>
                        <path d="M1 9.5l4-3.5 3.5 3 3-4 3.5 3" opacity=".4"/>
                        <line x1="3.5" y1="11.5" x2="3.5" y2="14.5" stroke-width="1.8"/>
                        <line x1="8" y1="11.5" x2="8" y2="14.5" stroke-width="1.8"/>
                        <line x1="12.5" y1="11.5" x2="12.5" y2="14.5" stroke-width="1.8"/>
                      </svg>
                      Full
                    </button>
                  </div>
                </div>

                <!-- Sticker sub-controls -->
                <template v-if="embedStyle === 'sticker'">
                  <div class="fp-divider" />
                  <div class="fp-section embed-controls">
                    <div class="embed-row">
                      <span class="embed-ctrl-label">Size&nbsp;<span class="embed-ctrl-val">{{ Math.round(stickerScale * 100) }}%</span></span>
                      <input class="embed-slider" type="range" min="15" max="70" step="1"
                        :value="Math.round(stickerScale * 100)"
                        @input="stickerScale = Number($event.target.value) / 100; nextTick(draw)" />
                    </div>
                    <div class="embed-row">
                      <span class="embed-ctrl-label">Snap</span>
                      <div class="pos-grid">
                        <button v-for="p in POSITIONS" :key="p"
                          :class="['pos-btn', { 'pos-btn--on': !dragPos && stickerPos === p }]"
                          :title="p.replace(/-/g,' ')" @click="snapTo(p)" />
                      </div>
                    </div>
                    <span class="embed-drag-hint">or drag the sticker on the preview</span>
                  </div>
                </template>

                <!-- Overlay sub-controls -->
                <template v-if="embedStyle === 'integrated'">
                  <div class="fp-divider" />
                  <div class="fp-section embed-controls">
                    <div class="embed-row">
                      <span class="embed-ctrl-label">Layout</span>
                      <div class="integrated-pos-tabs integrated-pos-tabs--wrap">
                        <button v-for="il in INTEGRATED_LAYOUTS" :key="il.key"
                          :class="['int-pos-btn', { 'int-pos-btn--on': integratedLayout === il.key }]"
                          @click="integratedLayout = il.key; nextTick(draw)">{{ il.label }}</button>
                      </div>
                    </div>
                    <div class="embed-row">
                      <span class="embed-ctrl-label">Position</span>
                      <div class="integrated-pos-tabs">
                        <button v-for="ip in INTEGRATED_POSITIONS" :key="ip.key"
                          :class="['int-pos-btn', { 'int-pos-btn--on': integratedPos === ip.key }]"
                          @click="integratedPos = ip.key; nextTick(draw)">{{ ip.label }}</button>
                      </div>
                    </div>
                    <div class="embed-row">
                      <span class="embed-ctrl-label">Route</span>
                      <label class="toggle-label">
                        <input type="checkbox" v-model="integratedRoute" @change="nextTick(draw)" />
                        <span class="toggle-track"><span class="toggle-thumb"/></span>
                        Show route
                      </label>
                    </div>
                  </div>
                </template>

              </template>

            </div>

          </aside>

          <!-- ── Canvas preview ────────────────────────────────────────────── -->
          <div class="fp-preview">
            <div class="fp-canvas-wrap" :style="bgImageSrc ? { background: '#080808' } : {}">
              <canvas
                ref="canvasRef"
                :width="embedCw"
                :height="embedCh"
                class="fp-canvas"
                :style="[
                  { width: embedPreviewW + 'px', ...(embedPreviewH ? { height: embedPreviewH + 'px' } : {}) },
                  bgImageSrc && embedStyle === 'sticker' ? { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' } : {},
                ]"
                @pointerdown="onCanvasPointerDown"
                @pointermove="onCanvasPointerMove"
                @pointerup="onCanvasPointerUp"
                @pointerleave="onCanvasPointerUp"
              />
            </div>
          </div>

        </div>

        <!-- ── Mobile: slide-up tool panel ───────────────────────────────────── -->
        <Transition name="sm-slide">
          <div v-if="activeTool" class="sm-panel">
            <div class="sm-panel-handle" />

            <div v-if="activeTool === 'orient'" class="sm-panel-body">
              <p class="sm-panel-lbl">Canvas size</p>
              <div class="sm-chips">
                <button v-for="o in ORIENT_OPTIONS" :key="o.key"
                  :class="['sm-chip', { on: orientation === o.key }]"
                  @click="setOrientation(o.key)">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <rect :x="o.rx" :y="o.ry" :width="o.rw" :height="o.rh" rx="1.5"/>
                  </svg>
                  {{ o.label }}
                </button>
              </div>
            </div>

            <div v-if="activeTool === 'format'" class="sm-panel-body">
              <p class="sm-panel-lbl">Style theme</p>
              <div class="sm-chips sm-chips--wrap">
                <button v-for="f in FORMAT_OPTIONS" :key="f.key"
                  :class="['sm-chip', { on: stickerFormat === f.key }]"
                  @click="setFormat(f.key)">{{ f.label }}</button>
              </div>
            </div>

            <div v-if="activeTool === 'photo'" class="sm-panel-body">
              <p class="sm-panel-lbl">Background photo</p>
              <div class="embed-upload"
                :class="{ 'embed-upload--dragging': bgDragging, 'embed-upload--loaded': !!bgImageSrc }"
                @click="bgInputRef.click()">
                <template v-if="!bgImageSrc">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 15l5-5 4 4 3-3 6 6"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
                  </svg>
                  <span class="embed-upload-label">Tap to add a photo</span>
                  <span class="embed-upload-hint">Embed the sticker into a photo</span>
                </template>
                <template v-else>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <rect x="1" y="1" width="14" height="14" rx="2"/>
                    <path d="M1 10l4-3 3 2.5 3-4 5 4.5"/>
                  </svg>
                  <span class="embed-upload-label embed-upload-filename">{{ bgFileName }}&ensp;<span class="embed-link">change</span></span>
                  <button class="embed-clear-btn" @click.stop="clearBgImage" title="Remove photo">
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                    </svg>
                  </button>
                </template>
              </div>
            </div>

            <div v-if="activeTool === 'style' && bgImageSrc" class="sm-panel-body">
              <p class="sm-panel-lbl">Embed style</p>
              <div class="embed-style-tabs embed-style-tabs--3">
                <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'sticker' }]" @click="setEmbedStyle('sticker')">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <rect x="2" y="2" width="7" height="9" rx="1.5"/>
                    <rect x="7" y="5" width="7" height="9" rx="1.5" opacity=".5"/>
                  </svg>
                  Sticker
                </button>
                <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'integrated' }]" @click="setEmbedStyle('integrated')">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <rect x="1" y="1" width="14" height="14" rx="2"/>
                    <path d="M1 10l4-3 3 2.5 3-4 5 4.5" opacity=".5"/>
                    <rect x="1" y="10" width="14" height="5" rx="0" fill="currentColor" opacity=".25" stroke="none"/>
                  </svg>
                  Overlay
                </button>
                <button :class="['embed-style-tab', { 'embed-style-tab--on': embedStyle === 'backdrop' }]" @click="setEmbedStyle('backdrop')">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <rect x="1" y="1" width="14" height="14" rx="2"/>
                    <circle cx="4.5" cy="5" r="1.4" fill="currentColor" stroke="none" opacity=".4"/>
                    <path d="M1 9.5l4-3.5 3.5 3 3-4 3.5 3" opacity=".4"/>
                    <line x1="3.5" y1="11.5" x2="3.5" y2="14.5" stroke-width="1.8"/>
                    <line x1="8" y1="11.5" x2="8" y2="14.5" stroke-width="1.8"/>
                    <line x1="12.5" y1="11.5" x2="12.5" y2="14.5" stroke-width="1.8"/>
                  </svg>
                  Full
                </button>
              </div>
              <template v-if="embedStyle === 'sticker'">
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Size <span class="sm-ctrl-val">{{ Math.round(stickerScale * 100) }}%</span></span>
                  <input class="embed-slider" type="range" min="15" max="70" step="1"
                    :value="Math.round(stickerScale * 100)"
                    @input="stickerScale = Number($event.target.value) / 100; nextTick(draw)" />
                </div>
                <div class="sm-ctrl-row sm-ctrl-row--top">
                  <span class="sm-ctrl-lbl">Snap</span>
                  <div class="pos-grid">
                    <button v-for="p in POSITIONS" :key="p"
                      :class="['pos-btn', { 'pos-btn--on': !dragPos && stickerPos === p }]"
                      :title="p.replace(/-/g,' ')" @click="snapTo(p)" />
                  </div>
                </div>
                <p class="sm-drag-hint">or drag the sticker on the preview</p>
              </template>
              <template v-if="embedStyle === 'integrated'">
                <div class="sm-ctrl-row sm-ctrl-row--top">
                  <span class="sm-ctrl-lbl">Layout</span>
                  <div class="integrated-pos-tabs integrated-pos-tabs--wrap">
                    <button v-for="il in INTEGRATED_LAYOUTS" :key="il.key"
                      :class="['int-pos-btn', { 'int-pos-btn--on': integratedLayout === il.key }]"
                      @click="integratedLayout = il.key; nextTick(draw)">{{ il.label }}</button>
                  </div>
                </div>
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Position</span>
                  <div class="integrated-pos-tabs">
                    <button v-for="ip in INTEGRATED_POSITIONS" :key="ip.key"
                      :class="['int-pos-btn', { 'int-pos-btn--on': integratedPos === ip.key }]"
                      @click="integratedPos = ip.key; nextTick(draw)">{{ ip.label }}</button>
                  </div>
                </div>
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Route</span>
                  <label class="toggle-label">
                    <input type="checkbox" v-model="integratedRoute" @change="nextTick(draw)" />
                    <span class="toggle-track"><span class="toggle-thumb"/></span>
                    Show route
                  </label>
                </div>
              </template>
              <template v-if="embedStyle === 'backdrop'">
                <div class="sm-chips sm-chips--wrap">
                  <button v-for="f in FORMAT_OPTIONS" :key="f.key"
                    :class="['sm-chip', { on: stickerFormat === f.key }]"
                    @click="setFormat(f.key)">{{ f.label }}</button>
                </div>
                <p class="sm-drag-hint">Your photo fills the full sticker area</p>
              </template>
            </div>

          </div>
        </Transition>

        <!-- ── Mobile: bottom navigation ─────────────────────────────────────── -->
        <nav class="sm-nav">
          <button v-if="!bgImageSrc" class="sm-nav-btn" :class="{ active: activeTool === 'orient' }" @click="toggleTool('orient')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="4" width="7" height="10" rx="1.5"/>
              <rect x="14" y="10" width="7" height="10" rx="1.5"/>
            </svg>
            <span>Canvas</span>
          </button>
          <button class="sm-nav-btn" :class="{ active: activeTool === 'format' }" @click="toggleTool('format')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
              <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
            <span>Theme</span>
          </button>
          <button class="sm-nav-btn" :class="{ active: activeTool === 'photo' }" @click="toggleTool('photo')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="8.5" cy="11.5" r="2"/>
              <path d="M3 18l5-5 4 3.5 3-3.5 6 5"/>
            </svg>
            <span>Photo</span>
          </button>
          <button v-if="bgImageSrc" class="sm-nav-btn" :class="{ active: activeTool === 'style' }" @click="toggleTool('style')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 15l5-4.5 4 3 3-4 6 4.5"/>
              <rect x="3" y="15" width="18" height="6" fill="currentColor" opacity=".18" stroke="none"/>
            </svg>
            <span>Style</span>
          </button>
          <button class="sm-nav-btn sm-nav-save" @click="download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Save</span>
          </button>
        </nav>

      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { lerp, arrayMax } from '../utils/geo.js'

const props = defineProps({
  points:      { type: Array,  required: true },
  stats:       { type: Object, default: null },
  trackName:   { type: String, default: 'Activity' },
  accentColor: { type: String, default: '#f59e0b' },
})

// ── Orientation ───────────────────────────────────────────────────────────────

const ORIENT_OPTIONS = [
  { key: 'portrait',  label: 'Portrait',  rx: 4, ry: 1, rw: 8,  rh: 14 },
  { key: 'square',    label: 'Square',    rx: 2, ry: 2, rw: 12, rh: 12 },
  { key: 'landscape', label: 'Landscape', rx: 1, ry: 4, rw: 14, rh: 8  },
]
const ORIENT_DIMS = {
  portrait:  { w: 480, h: 600, previewW: 480, mobilePreviewW: 300 },
  square:    { w: 480, h: 480, previewW: 520, mobilePreviewW: 320 },
  landscape: { w: 720, h: 400, previewW: 680, mobilePreviewW: 380 },
}

const orientation = ref('portrait')
const cw       = computed(() => ORIENT_DIMS[orientation.value].w)
const ch       = computed(() => ORIENT_DIMS[orientation.value].h)
const previewW = computed(() =>
  isMobile.value
    ? ORIENT_DIMS[orientation.value].mobilePreviewW
    : ORIENT_DIMS[orientation.value].previewW
)

function setOrientation(o) { orientation.value = o; nextTick(draw) }

// ── Format ────────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  { key: 'classic',  label: 'Classic'  },
  { key: 'dark',     label: 'Dark'     },
  { key: 'light',    label: 'Light'    },
  { key: 'gradient', label: 'Gradient' },
  { key: 'neon',     label: 'Neon'     },
  { key: 'minimal',  label: 'Minimal'  },
  { key: 'strava',   label: 'Strava'   },
  { key: 'glow',     label: 'Glow'     },
  { key: 'stats',    label: 'Stats'    },
  { key: 'film',     label: 'Film'     },
]

const stickerFormat = ref('classic')
function setFormat(f) { stickerFormat.value = f; nextTick(draw) }

// ── Panel state ───────────────────────────────────────────────────────────────

const open         = ref(false)
const sidebarTab   = ref('theme') // 'theme' | 'photo'
const canvasRef = ref(null)
const wrapRef   = ref(null)
const dialogRef = ref(null)

// ── Embed mode state ──────────────────────────────────────────────────────────
const bgInputRef   = ref(null)
const bgImage      = ref(null)
const bgImageSrc   = ref(null)
const bgFileName   = ref('')
const bgDragging   = ref(false)
const stickerPos   = ref('bottom-right')
const stickerScale = ref(0.38)
const dragPos      = ref(null)   // {x, y} in actual canvas px; null = use stickerPos preset
const isDragging   = ref(false)
const dragOffset   = ref({ x: 0, y: 0 })

// ── Embed style: 'sticker' or 'integrated' ────────────────────────────────────
const embedStyle      = ref('sticker')
const integratedPos   = ref('bottom')   // 'bottom' | 'top'
const integratedRoute = ref(true)

const INTEGRATED_POSITIONS = [
  { key: 'bottom', label: 'Bottom' },
  { key: 'top',    label: 'Top'    },
]

const INTEGRATED_LAYOUTS = [
  { key: 'bar',     label: 'Bar'   },
  { key: 'float',   label: 'Float' },
  { key: 'minimal', label: 'Clean' },
  { key: 'strip',   label: 'Strip' },
  { key: 'stats',   label: 'Stats' },
  { key: 'film',    label: 'Film'  },
]
const integratedLayout = ref('bar')

function setEmbedStyle(s) { embedStyle.value = s; nextTick(draw) }

const POSITIONS = [
  'top-left',    'top-center',    'top-right',
  'middle-left', 'center',        'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

const MAX_EMBED_DIM = 2000

const embedCw = computed(() => {
  if (bgImage.value) {
    const img = bgImage.value
    const scale = Math.min(1, MAX_EMBED_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    return Math.round(img.naturalWidth * scale)
  }
  return cw.value
})
const embedCh = computed(() => {
  if (bgImage.value) {
    const img = bgImage.value
    const scale = Math.min(1, MAX_EMBED_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    return Math.round(img.naturalHeight * scale)
  }
  return ch.value
})
const EMBED_PREVIEW_W        = 660
const EMBED_PREVIEW_W_MOBILE = 340
const embedPreviewW = computed(() => {
  if (!bgImage.value) return previewW.value
  if (window.innerWidth > 600) return EMBED_PREVIEW_W
  // On mobile constrain by 45dvh so portrait photos don't overflow the sheet
  const maxH = Math.round(window.innerHeight * 0.45)
  const maxW = (embedCw.value && embedCh.value)
    ? Math.round(maxH * embedCw.value / embedCh.value)
    : EMBED_PREVIEW_W_MOBILE
  return Math.min(EMBED_PREVIEW_W_MOBILE, maxW)
})
// Always compute height explicitly — canvas ignores height:auto in many browsers
const embedPreviewH = computed(() =>
  embedCw.value ? Math.round(embedPreviewW.value * embedCh.value / embedCw.value) : null
)

function onBgDrop(e) {
  bgDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) loadBgFile(file)
}
function onBgPick(e) {
  const file = e.target.files?.[0]
  if (file) loadBgFile(file)
  e.target.value = ''
}
function clearBgImage() {
  bgImageSrc.value = null
  bgImage.value = null
  bgFileName.value = ''
  dragPos.value = null
  nextTick(draw)
}

function loadBgFile(file) {
  sidebarTab.value = 'photo'
  bgFileName.value = file.name
  const reader = new FileReader()
  reader.onload = ev => {
    const src = ev.target.result
    bgImageSrc.value = src
    const img = new Image()
    img.onload = () => { bgImage.value = img; dragPos.value = null; nextTick(draw) }
    img.src = src
  }
  reader.readAsDataURL(file)
}

// ── Embed positioning ─────────────────────────────────────────────────────────
function getStickerXY(pos, W, H, sw, sh) {
  if (dragPos.value) return [dragPos.value.x, dragPos.value.y]
  const margin = Math.max(12, Math.round(W * 0.025))
  const map = {
    'top-left':      [margin,       margin],
    'top-center':    [(W-sw)/2,     margin],
    'top-right':     [W-sw-margin,  margin],
    'middle-left':   [margin,       (H-sh)/2],
    'center':        [(W-sw)/2,     (H-sh)/2],
    'middle-right':  [W-sw-margin,  (H-sh)/2],
    'bottom-left':   [margin,       H-sh-margin],
    'bottom-center': [(W-sw)/2,     H-sh-margin],
    'bottom-right':  [W-sw-margin,  H-sh-margin],
  }
  return map[pos] ?? map['bottom-right']
}

function snapTo(p) {
  stickerPos.value = p
  dragPos.value = null
  nextTick(draw)
}

// ── Canvas drag-to-position ───────────────────────────────────────────────────
function getStickerSize() {
  const W  = embedCw.value
  const sw = Math.round(W * stickerScale.value)
  const sh = Math.round(sw * (ch.value / cw.value))
  return { sw, sh }
}

function previewToCanvas(px, py) {
  const canvas = canvasRef.value
  if (!canvas) return [px, py]
  const rect = canvas.getBoundingClientRect()
  return [px * embedCw.value / rect.width, py * embedCh.value / rect.height]
}

function onCanvasPointerDown(e) {
  if (!bgImage.value) return
  const [mx, my] = previewToCanvas(e.offsetX, e.offsetY)
  const { sw, sh } = getStickerSize()
  const W = embedCw.value, H = embedCh.value
  const [sx, sy] = getStickerXY(stickerPos.value, W, H, sw, sh)
  if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
    isDragging.value = true
    dragOffset.value = { x: mx - sx, y: my - sy }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
}

function onCanvasPointerMove(e) {
  if (!isDragging.value) return
  const [mx, my] = previewToCanvas(e.offsetX, e.offsetY)
  const { sw, sh } = getStickerSize()
  const W = embedCw.value, H = embedCh.value
  const x = Math.max(0, Math.min(W - sw, mx - dragOffset.value.x))
  const y = Math.max(0, Math.min(H - sh, my - dragOffset.value.y))
  dragPos.value = { x, y }
  nextTick(draw)
}

function onCanvasPointerUp() {
  isDragging.value = false
}

// ── Mobile bottom-nav state ───────────────────────────────────────────────────
const isMobile   = ref(typeof window !== 'undefined' && window.innerWidth <= 600)
const activeTool = ref(null)

function toggleTool(name) {
  activeTool.value = activeTool.value === name ? null : name
  nextTick(draw)
}

function onWindowResize() { isMobile.value = window.innerWidth <= 600 }

function toggle() {
  open.value = !open.value
  if (!open.value) activeTool.value = null
  if (open.value) nextTick(draw)
}

function onClickOutside(e) {
  if (!open.value || isMobile.value) return
  const inWrap   = wrapRef.value?.contains(e.target)
  const inDialog = dialogRef.value?.contains(e.target)
  if (!inWrap && !inDialog) open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('resize', onWindowResize)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('resize', onWindowResize)
})

watch(
  () => [props.points, props.stats, props.accentColor, props.trackName],
  () => { if (open.value) nextTick(draw) },
  { deep: false },
)

watch(bgImageSrc, val => {
  if (!val && activeTool.value === 'style') activeTool.value = null
})

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !props.points.length) return
  const ctx = canvas.getContext('2d')

  if (bgImage.value && embedStyle.value === 'integrated') {
    drawIntegratedMode(ctx)
  } else if (bgImage.value && embedStyle.value === 'backdrop') {
    drawBackdropMode(ctx)
  } else if (bgImage.value) {
    drawEmbedMode(ctx)
  } else {
    ctx.clearRect(0, 0, cw.value, ch.value)
    render(ctx, props.points, props.stats, props.trackName, props.accentColor,
      cw.value, ch.value, orientation.value, stickerFormat.value)
  }
}

function drawEmbedMode(ctx) {
  const W = embedCw.value, H = embedCh.value
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(bgImage.value, 0, 0, W, H)

  // Render sticker to offscreen canvas
  const sw = Math.round(W * stickerScale.value)
  const sh = Math.round(sw * (ch.value / cw.value))
  const off = document.createElement('canvas')
  off.width = sw; off.height = sh
  render(off.getContext('2d'), props.points, props.stats, props.trackName, props.accentColor,
    sw, sh, orientation.value, stickerFormat.value)

  const [sx, sy] = getStickerXY(stickerPos.value, W, H, sw, sh)
  ctx.drawImage(off, sx, sy, sw, sh)
}

// ── Backdrop mode: full-size sticker with photo as background ─────────────────
function drawBackdropMode(ctx) {
  const W = embedCw.value, H = embedCh.value
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(bgImage.value, 0, 0, W, H)

  const { r: ar, g: ag, b: ab } = hexRgb(props.accentColor)
  const format = stickerFormat.value
  const theme  = buildBackdropTheme(format, W, H, ctx, props.accentColor, ar, ag, ab)
  const orient = W > H * 1.1 ? 'landscape' : (H > W * 1.1 ? 'portrait' : 'square')

  if (format === 'minimal') {
    renderMinimal(ctx, props.points, props.stats, props.trackName, props.accentColor, W, H, orient, theme)
  } else if (format === 'strava') {
    renderStrava(ctx, props.points, props.stats, props.trackName, props.accentColor, W, H, orient, theme)
  } else if (format === 'glow') {
    renderGlow(ctx, props.points, props.stats, props.trackName, props.accentColor, W, H, orient, theme)
  } else if (format === 'stats') {
    drawStatsPanel(ctx, props.points, props.stats, props.trackName, props.accentColor, ar, ag, ab, W, H, theme)
  } else if (format === 'film') {
    drawFilmComposition(ctx, props.points, props.stats, props.trackName, props.accentColor, ar, ag, ab, W, H, theme, true)
  } else {
    renderFull(ctx, props.points, props.stats, props.trackName, props.accentColor, W, H, orient, theme, ar, ag, ab)
  }

  drawFooter(ctx, W, H)
}

function buildBackdropTheme(format, W, H, ctx, accent, ar, ag, ab) {
  switch (format) {
    case 'light': {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, W, H)
      return {
        headerBg:    'rgba(255,255,255,0.86)',
        statsBg:     'rgba(255,255,255,0.82)',
        textPrimary: '#111',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        divider:     'rgba(0,0,0,0.08)',
        statLabel:   'rgba(0,0,0,0.38)',
        shadowColor: 'rgba(0,0,0,0.15)',
        routeHalo:   'rgba(160,160,160,0.35)',
        sparkBacking: false,
        isLight:     true,
      }
    }
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, W * 0.7, H)
      g.addColorStop(0, `rgba(${(ar*0.18)|0},${(ag*0.14)|0},${(ab*0.18)|0},0.55)`)
      g.addColorStop(1, 'rgba(0,0,0,0.30)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      return {
        headerBg:    `rgba(${(ar*0.14)|0},${(ag*0.12)|0},${(ab*0.14)|0},0.74)`,
        statsBg:     `rgba(${(ar*0.10)|0},${(ag*0.08)|0},${(ab*0.10)|0},0.70)`,
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.9)`,
        divider:     `rgba(${ar},${ag},${ab},0.18)`,
        statLabel:   `rgba(${ar},${ag},${ab},0.65)`,
        shadowColor: 'rgba(0,0,0,0.95)',
        routeHalo:   'rgba(0,0,0,0.55)',
        sparkBacking: true,
      }
    }
    case 'neon': {
      ctx.fillStyle = 'rgba(0,0,0,0.48)'; ctx.fillRect(0, 0, W, H)
      return {
        headerBg:    'rgba(0,0,0,0.65)',
        statsBg:     'rgba(0,0,0,0.65)',
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        divider:     `rgba(${ar},${ag},${ab},0.2)`,
        statLabel:   `rgba(${ar},${ag},${ab},0.7)`,
        shadowColor: `rgba(${ar},${ag},${ab},0.5)`,
        routeHalo:   `rgba(${ar},${ag},${ab},0.18)`,
        sparkBacking: true,
        isNeon:      true,
      }
    }
    case 'minimal':
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H)
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.9)`,
        statLabel:   'rgba(255,255,255,0.6)',
        shadowColor: 'rgba(0,0,0,0.95)',
        routeHalo:   'rgba(0,0,0,0.4)',
      }
    case 'strava': {
      const bg = ctx.createLinearGradient(0, H * 0.38, 0, H)
      bg.addColorStop(0,    'rgba(0,0,0,0)')
      bg.addColorStop(0.25, 'rgba(0,0,0,0.55)')
      bg.addColorStop(1,    'rgba(0,0,0,0.84)')
      ctx.fillStyle = bg; ctx.fillRect(0, H * 0.38, W, H * 0.62)
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        statLabel:   'rgba(255,255,255,0.55)',
        shadowColor: 'rgba(0,0,0,0.9)',
      }
    }
    case 'glow':
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H)
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.9)`,
        statLabel:   `rgba(${ar},${ag},${ab},0.5)`,
        shadowColor: `rgba(${ar},${ag},${ab},0.7)`,
        routeHalo:   `rgba(${ar},${ag},${ab},0.12)`,
        isGlow:      true,
      }
    case 'film':
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H)
      return {
        headerColor: 'rgba(255,255,255,0.52)',
        labelColor:  'rgba(255,255,255,0.38)',
        valueColor:  '#fff',
        unitColor:   `rgba(${ar},${ag},${ab},0.88)`,
        divider:     'rgba(255,255,255,0.10)',
        shadowColor: 'rgba(0,0,0,0.92)',
        acDim:       `rgba(${ar},${ag},${ab},0.80)`,
      }
    case 'stats':
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, W, H)
      return {
        cardBg:      'rgba(10,11,14,0.86)',
        cardBorder:  'rgba(255,255,255,0.07)',
        headerColor: 'rgba(255,255,255,0.45)',
        labelColor:  'rgba(255,255,255,0.40)',
        valueColor:  '#fff',
        unitColor:   `rgba(${ar},${ag},${ab},0.85)`,
        divider:     'rgba(255,255,255,0.06)',
        shadowColor: 'rgba(0,0,0,0.90)',
      }
    default: // classic, dark
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(0, 0, W, H)
      return {
        headerBg:    'rgba(0,0,0,0.60)',
        statsBg:     'rgba(0,0,0,0.60)',
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.78)`,
        divider:     'rgba(255,255,255,0.08)',
        statLabel:   'rgba(255,255,255,0.38)',
        shadowColor: 'rgba(0,0,0,0.95)',
        routeHalo:   'rgba(0,0,0,0.45)',
        sparkBacking: true,
      }
  }
}

function drawIntegratedMode(ctx) {
  const W = embedCw.value, H = embedCh.value
  const pts = props.points, stats = props.stats
  const accent = props.accentColor
  const { r: ar, g: ag, b: ab } = hexRgb(accent)

  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(bgImage.value, 0, 0, W, H)

  const atBottom = integratedPos.value === 'bottom'

  if      (integratedLayout.value === 'float')   drawIntFloat(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)
  else if (integratedLayout.value === 'minimal')  drawIntMinimal(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)
  else if (integratedLayout.value === 'strip')    drawIntStrip(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)
  else if (integratedLayout.value === 'stats')    drawIntStats(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)
  else if (integratedLayout.value === 'film')     drawIntFilm(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)
  else                                            drawIntBar(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)

  drawFooter(ctx, W, H)
}

// ── Integrated: Bar layout — cinematic full-width vignette ────────────────────
function drawIntBar(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const REF  = Math.min(W, H)
  const PAD  = Math.round(REF * 0.048)
  const sdw  = (b) => { ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = b }
  const nsdw = ()  => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  // Tall soft cinematic vignette — no hard bar edge
  const VIGN_H = Math.round(H * (isPortrait ? 0.62 : 0.50))
  const vignY  = atBottom ? H - VIGN_H : 0
  const vGrad  = ctx.createLinearGradient(0, atBottom ? vignY : 0, 0, atBottom ? H : VIGN_H)
  if (atBottom) {
    vGrad.addColorStop(0,    'rgba(0,0,0,0)')
    vGrad.addColorStop(0.35, 'rgba(0,0,0,0.20)')
    vGrad.addColorStop(1,    'rgba(0,0,0,0.88)')
  } else {
    vGrad.addColorStop(0,    'rgba(0,0,0,0.88)')
    vGrad.addColorStop(0.65, 'rgba(0,0,0,0.20)')
    vGrad.addColorStop(1,    'rgba(0,0,0,0)')
  }
  ctx.fillStyle = vGrad; ctx.fillRect(0, vignY, W, VIGN_H)

  const movingMs = computeMovingTime(pts)
  const grid4 = [
    { v: (stats?.totalDist ?? 0).toFixed(2), u: 'km',   l: 'Distance'  },
    { v: String(stats?.elevGain ?? 0),        u: 'm',    l: 'Elevation' },
    { v: fmtHMS(movingMs),                   u: '',     l: 'Time'      },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'Speed'     },
  ]

  const nameSz = Math.round(REF * 0.028)
  const dateSz = Math.round(nameSz * 0.78)
  const valSz  = Math.round(REF * (isPortrait ? 0.092 : 0.070))
  const unitSz = Math.round(valSz * 0.40)
  const lblSz  = Math.round(valSz * 0.27)

  // Route thumbnail in opposite corner
  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_SZ  = Math.round(REF * (isPortrait ? 0.20 : 0.22))
    const ROUTE_PAD = Math.round(REF * 0.030)
    const rx = W - ROUTE_SZ - ROUTE_PAD
    const ry = atBottom ? ROUTE_PAD : H - ROUTE_SZ - ROUTE_PAD
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ/2, ry + ROUTE_SZ/2, ROUTE_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }

  const startPt = pts.find(p => p.time)

  if (isPortrait) {
    // Name + date in upper portion of vignette zone
    const ZONE_H  = Math.round(H * 0.30)
    const zoneY   = atBottom ? H - ZONE_H : 0
    const textH   = nameSz * (startPt?.time ? 2.6 : 1.5) + lblSz * 1.6 + valSz * 1.6
    const nameY   = atBottom ? H - textH - PAD : PAD

    ctx.font = `300 ${nameSz}px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    let nameStr = props.trackName || 'Activity'
    while (ctx.measureText(nameStr).width > W * 0.68 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
    sdw(10); ctx.fillText(nameStr, PAD, nameY); nsdw()

    if (startPt?.time) {
      ctx.font = `300 ${dateSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.70)`
      sdw(6); ctx.fillText(startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), PAD, nameY + nameSz * 1.35); nsdw()
    }

    const statsY = nameY + nameSz * (startPt?.time ? 2.6 : 1.5)
    const colW   = (W - PAD * 2) / grid4.length

    grid4.forEach((s, i) => {
      const cx = PAD + i * colW + colW / 2
      // Thin vertical separator — no fill background
      if (i > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)'
        ctx.fillRect(PAD + i * colW, statsY, 1, lblSz + valSz * 1.7)
      }
      ctx.font = `400 ${lblSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.70)`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      sdw(4); ctx.fillText(s.l, cx, statsY); nsdw()

      const valY = statsY + lblSz * 1.6
      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.font = `600 ${unitSz}px ${FONT}`
      const uw = s.u ? ctx.measureText(s.u).width : 0
      const bw = vw + (uw ? uw + Math.round(valSz * 0.08) : 0)
      const sx = cx - bw / 2
      ctx.font = `800 ${valSz}px ${FONT}`
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      sdw(22); ctx.fillText(s.v, sx, valY); nsdw()
      if (s.u) {
        ctx.font = `600 ${unitSz}px ${FONT}`
        ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
        sdw(12); ctx.fillText(s.u, sx + vw + Math.round(valSz * 0.08), valY + valSz * 0.56); nsdw()
      }
    })

  } else {
    // Landscape: single stats row, name beside
    const colW  = W / grid4.length
    const cy    = atBottom ? H - Math.round(H * 0.13) : Math.round(H * 0.13)

    grid4.forEach((s, i) => {
      const cx = i * colW + colW / 2
      if (i > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(i * colW, atBottom ? cy - valSz * 0.25 : cy, 1, lblSz + valSz * 1.5)
      }
      ctx.font = `400 ${lblSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.70)`
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      sdw(4); ctx.fillText(s.l, cx, cy - Math.round(valSz * 0.08)); nsdw()

      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.font = `600 ${unitSz}px ${FONT}`
      const uw = s.u ? ctx.measureText(s.u).width : 0
      const bw = vw + (uw ? uw + Math.round(valSz * 0.08) : 0)
      const sx = cx - bw / 2
      ctx.font = `800 ${valSz}px ${FONT}`
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      sdw(20); ctx.fillText(s.v, sx, cy); nsdw()
      if (s.u) {
        ctx.font = `600 ${unitSz}px ${FONT}`
        ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
        sdw(10); ctx.fillText(s.u, sx + vw + Math.round(valSz * 0.08), cy + valSz * 0.56); nsdw()
      }
    })

    const nameY = atBottom ? PAD : H - nameSz * (startPt?.time ? 2.6 : 1.6) - PAD
    ctx.font = `300 ${nameSz}px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    let nameStr = props.trackName || 'Activity'
    while (ctx.measureText(nameStr).width > W * 0.55 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
    sdw(10); ctx.fillText(nameStr, PAD, nameY); nsdw()
    if (startPt?.time) {
      ctx.font = `300 ${dateSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`
      sdw(5); ctx.fillText(startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), PAD, nameY + nameSz * 1.35); nsdw()
    }
  }
}

// ── Integrated: Float layout — cinematic corner text, no card ─────────────────
function drawIntFloat(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const REF    = Math.min(W, H)
  const MARGIN = Math.round(REF * 0.042)
  const sdw    = (b) => { ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = b }
  const nsdw   = ()  => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const COL_W  = Math.round(REF * (isPortrait ? 0.54 : 0.42))
  const anchorX = W - MARGIN          // right edge of text column
  const nameSz  = Math.round(COL_W * 0.072)
  const heroSz  = Math.round(COL_W * 0.30)
  const heroUnitSz = Math.round(heroSz * 0.38)
  const subSz   = Math.round(COL_W * 0.115)
  const subUnitSz  = Math.round(subSz * 0.48)
  const lblSz   = Math.round(nameSz * 0.72)

  // Soft radial dark gradient behind the text — no hard box
  const totalTextH = nameSz * 1.5 + heroSz * 1.4 + subSz * 3 * 1.7 + MARGIN
  const anchorY    = atBottom ? H - totalTextH - MARGIN : MARGIN
  const radCX = anchorX - COL_W * 0.4, radCY = anchorY + totalTextH * 0.45
  const rGrad = ctx.createRadialGradient(radCX, radCY, 0, radCX, radCY, COL_W * 1.05)
  rGrad.addColorStop(0, 'rgba(0,0,0,0.52)')
  rGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.fillStyle = rGrad
  ctx.fillRect(anchorX - COL_W * 1.1, anchorY - MARGIN, COL_W * 1.3, totalTextH + MARGIN * 2)
  ctx.restore()

  let y = anchorY

  // Activity name — right-aligned, light weight
  ctx.font = `300 ${nameSz}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'
  let nameStr = props.trackName || 'Activity'
  while (ctx.measureText(nameStr).width > COL_W && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
  sdw(10); ctx.fillText(nameStr, anchorX, y); nsdw()
  y += nameSz * 1.5

  // Thin accent underline
  const ruleW = Math.min(ctx.measureText(nameStr).width, COL_W * 0.80)
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.55)`
  ctx.fillRect(anchorX - ruleW, Math.round(y), ruleW, Math.max(1, Math.round(REF * 0.003)))
  y += Math.round(nameSz * 0.55)

  // Hero stat: distance
  const distKm = (stats?.totalDist ?? 0).toFixed(2)
  ctx.font = `800 ${heroSz}px ${FONT}`
  const distW = ctx.measureText(distKm).width
  ctx.font = `600 ${heroUnitSz}px ${FONT}`
  const unitW = ctx.measureText('km').width
  const gap   = Math.round(heroSz * 0.07)
  const blockW = distW + unitW + gap
  const heroX  = anchorX - blockW

  ctx.font = `800 ${heroSz}px ${FONT}`
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  sdw(30); ctx.fillText(distKm, heroX, y); nsdw()
  ctx.font = `600 ${heroUnitSz}px ${FONT}`
  ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
  sdw(16); ctx.fillText('km', heroX + distW + gap, y + heroSz * 0.55); nsdw()
  y += heroSz * 1.35

  // Supporting stats stacked: Elevation, Time, Speed
  const movingMs = computeMovingTime(pts)
  const sub3 = [
    { l: 'Elevation', v: String(stats?.elevGain ?? 0),       u: 'm'    },
    { l: 'Time',      v: fmtHMS(movingMs),                   u: ''     },
    { l: 'Speed',     v: (stats?.avgSpeed ?? 0).toFixed(1), u: 'km/h' },
  ]
  sub3.forEach((s, i) => {
    // Thin separator
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(anchorX - COL_W * 0.72, Math.round(y - Math.round(subSz * 0.18)), COL_W * 0.72, 1)
    }

    // Label
    ctx.font = `400 ${lblSz}px ${FONT}`
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    sdw(5); ctx.fillText(s.l, anchorX, y); nsdw()
    y += lblSz * 1.25

    // Value + unit, right-aligned as a block
    ctx.font = `700 ${subSz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.font = `500 ${subUnitSz}px ${FONT}`
    const uw = s.u ? ctx.measureText(s.u).width : 0
    const g2 = s.u ? Math.round(subSz * 0.07) : 0
    const bw = vw + uw + g2
    const sx = anchorX - bw

    ctx.font = `700 ${subSz}px ${FONT}`
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    sdw(16); ctx.fillText(s.v, sx, y); nsdw()
    if (s.u) {
      ctx.font = `500 ${subUnitSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.85)`
      sdw(8); ctx.fillText(s.u, sx + vw + g2, y + subSz * 0.52); nsdw()
    }
    y += subSz * 1.55
  })

  // Route in opposite corner
  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_SZ  = Math.round(REF * (isPortrait ? 0.18 : 0.14))
    const rx = MARGIN, ry = atBottom ? MARGIN : H - ROUTE_SZ - MARGIN
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ/2, ry + ROUTE_SZ/2, ROUTE_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }
}

// ── Integrated: Clean layout (editorial text overlay) ────────────────────────
function drawIntMinimal(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const shadow   = (b = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const movingMs = computeMovingTime(pts)
  const distKm   = (stats?.totalDist ?? 0).toFixed(2)
  const PAD      = Math.round(W * 0.05)
  const heroSz   = Math.round(W * (isPortrait ? 0.16 : 0.10))
  const unitSz   = Math.round(heroSz * 0.38), subSz = Math.round(heroSz * 0.28)
  const lblSz    = Math.round(subSz * 0.65), nameSz = Math.round(W * (isPortrait ? 0.030 : 0.022))
  const totalH   = nameSz * 2.2 + heroSz * 1.2 + subSz * 2.2 + PAD * 2
  const zoneY    = atBottom ? H - totalH : 0

  const grad = ctx.createLinearGradient(0, zoneY, 0, zoneY + totalH)
  if (atBottom) {
    grad.addColorStop(0,    'rgba(0,0,0,0)')
    grad.addColorStop(0.25, 'rgba(0,0,0,0.45)')
    grad.addColorStop(1,    'rgba(0,0,0,0.72)')
  } else {
    grad.addColorStop(0,    'rgba(0,0,0,0.72)')
    grad.addColorStop(0.75, 'rgba(0,0,0,0.45)')
    grad.addColorStop(1,    'rgba(0,0,0,0)')
  }
  ctx.fillStyle = grad; ctx.fillRect(0, zoneY, W, totalH)

  let y = zoneY + PAD
  ctx.font = `700 ${nameSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  let nameStr = props.trackName || 'Activity'
  while (ctx.measureText(nameStr).width > W * 0.55 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
  shadow(8); ctx.fillText(nameStr, PAD, y); noShadow()

  const startPt = pts.find(p => p.time)
  if (startPt?.time) {
    ctx.font = `500 ${Math.round(nameSz * 0.82)}px ${FONT}`
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.85)`; shadow(5)
    ctx.fillText(startPt.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), PAD, y + nameSz * 1.3)
    noShadow()
  }
  y += nameSz * 2.2

  ctx.font = `800 ${heroSz}px ${FONT}`
  const distW = ctx.measureText(distKm).width
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(18); ctx.fillText(distKm, PAD, y); noShadow()
  ctx.font = `700 ${unitSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
  shadow(10); ctx.fillText('km', PAD + distW + Math.round(heroSz * 0.06), y + heroSz * 0.52); noShadow()
  y += heroSz * 1.1

  const sub3 = [
    { v: fmtHMS(movingMs),                  u: '',     l: 'Moving time' },
    { v: String(stats?.elevGain ?? 0),       u: 'm',    l: 'Elevation'  },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'Avg speed'  },
  ]
  const subColW = (W - PAD * 2) / 3
  sub3.forEach((s, i) => {
    const x = PAD + i * subColW
    ctx.font = `800 ${subSz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    shadow(10); ctx.fillText(s.v, x, y); noShadow()
    if (s.u) {
      ctx.font = `600 ${Math.round(subSz * 0.6)}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},0.9)`
      shadow(5); ctx.fillText(s.u, x + vw + 3, y + subSz * 0.52); noShadow()
    }
    ctx.font = `500 ${lblSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textBaseline = 'top'; ctx.fillText(s.l, x, y + subSz * 1.2)
  })

  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_SZ  = Math.round(W * (isPortrait ? 0.17 : 0.12))
    const ROUTE_PAD = Math.round(W * 0.03)
    const rx = W - ROUTE_SZ - ROUTE_PAD, ry = atBottom ? ROUTE_PAD : H - ROUTE_SZ - ROUTE_PAD
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ/2, ry + ROUTE_SZ/2, ROUTE_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.5)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }
}

// ── Integrated: Strip layout (thin full-width band) ───────────────────────────
function drawIntStrip(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const shadow   = (b = 6) => { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const STRIP_H = Math.round(H * (isPortrait ? 0.11 : 0.15))
  const stripY  = atBottom ? H - STRIP_H : 0
  const PAD     = Math.round(W * 0.03)

  const grad = ctx.createLinearGradient(0, stripY, 0, stripY + STRIP_H)
  if (atBottom) {
    grad.addColorStop(0, 'rgba(0,0,0,0.60)'); grad.addColorStop(1, 'rgba(0,0,0,0.88)')
  } else {
    grad.addColorStop(0, 'rgba(0,0,0,0.88)'); grad.addColorStop(1, 'rgba(0,0,0,0.60)')
  }
  ctx.fillStyle = grad; ctx.fillRect(0, stripY, W, STRIP_H)

  const cy     = stripY + STRIP_H / 2
  const valSz  = Math.round(STRIP_H * 0.28), lblSz = Math.round(valSz * 0.50)
  const unitSz = Math.round(valSz * 0.40),  nameSz = Math.round(STRIP_H * 0.21)

  ctx.font = `700 ${nameSz}px ${FONT}`; ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  let nameStr = props.trackName || 'Activity'
  while (ctx.measureText(nameStr).width > W * 0.20 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
  shadow(8); ctx.fillText(nameStr, PAD, cy - nameSz * 0.35); noShadow()

  const startPt = pts.find(p => p.time)
  if (startPt?.time) {
    ctx.font = `500 ${Math.round(nameSz * 0.72)}px ${FONT}`
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.8)`; shadow(5)
    ctx.fillText(startPt.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), PAD, cy + nameSz * 0.55)
    noShadow()
  }

  const hasRoute = integratedRoute.value && pts.length > 1
  const THUMB_SZ = hasRoute ? Math.round(STRIP_H * 0.70) : 0
  const THUMB_X  = hasRoute ? W - THUMB_SZ - PAD : W

  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W * 0.26, stripY + STRIP_H * 0.2); ctx.lineTo(W * 0.26, stripY + STRIP_H * 0.8); ctx.stroke()

  const movingMs  = computeMovingTime(pts)
  const stats4    = [
    { v: (stats?.totalDist ?? 0).toFixed(2), u: 'km',   l: 'Dist'  },
    { v: String(stats?.elevGain ?? 0),        u: 'm',    l: 'Elev'  },
    { v: fmtHMS(movingMs),                   u: '',     l: 'Time'  },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'Speed' },
  ]
  const statsStartX = W * 0.26 + PAD
  const colW        = (THUMB_X - PAD - statsStartX) / stats4.length

  stats4.forEach((s, i) => {
    const cx = statsStartX + i * colW + colW / 2
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(statsStartX + i * colW, stripY + STRIP_H * 0.2); ctx.lineTo(statsStartX + i * colW, stripY + STRIP_H * 0.8); ctx.stroke()
    }
    ctx.font = `600 ${lblSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},0.70)`
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    shadow(4); ctx.fillText(s.l, cx, cy - Math.round(valSz * 0.05)); noShadow()
    ctx.font = `800 ${valSz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.font = `600 ${unitSz}px ${FONT}`
    const blockW = vw + (s.u ? ctx.measureText(s.u).width + Math.round(valSz * 0.08) : 0)
    const startX = cx - blockW / 2
    ctx.font = `800 ${valSz}px ${FONT}`; ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    shadow(8); ctx.fillText(s.v, startX, cy + Math.round(valSz * 0.08)); noShadow()
    if (s.u) {
      ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      shadow(6); ctx.fillText(s.u, startX + vw + Math.round(valSz * 0.08), cy + valSz * 0.55); noShadow()
    }
  })

  if (hasRoute) {
    const ry = stripY + (STRIP_H - THUMB_SZ) / 2
    ctx.save()
    ctx.beginPath(); ctx.arc(THUMB_X + THUMB_SZ/2, ry + THUMB_SZ/2, THUMB_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, THUMB_X, ry, THUMB_SZ, THUMB_SZ, accent, { routeHalo: 'rgba(0,0,0,0.5)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }
}

function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  const a = document.createElement('a')
  if (bgImage.value) {
    const suffix = embedStyle.value === 'integrated' ? 'integrated' : stickerFormat.value
    a.download = `activity-${suffix}.jpg`
    a.href     = canvas.toDataURL('image/jpeg', 0.92)
  } else {
    a.download = `activity-sticker-${stickerFormat.value}-${orientation.value}.png`
    a.href     = canvas.toDataURL('image/png')
  }
  a.click()
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function render(ctx, pts, stats, name, accent, W, H, orient, format) {
  ctx.clearRect(0, 0, W, H)
  const { r: ar, g: ag, b: ab } = hexRgb(accent)
  const theme = buildTheme(format, W, H, ctx, accent, ar, ag, ab)

  if (format === 'classic') {
    renderClassic(ctx, pts, stats, name, accent, W, H, orient, theme, ar, ag, ab)
    return
  }
  if (format === 'minimal') {
    renderMinimal(ctx, pts, stats, name, accent, W, H, orient, theme)
    return
  }
  if (format === 'strava') {
    renderStrava(ctx, pts, stats, name, accent, W, H, orient, theme)
    return
  }
  if (format === 'glow') {
    renderGlow(ctx, pts, stats, name, accent, W, H, orient, theme)
    return
  }
  if (format === 'stats') {
    drawStatsPanel(ctx, pts, stats, name, accent, ar, ag, ab, W, H, theme)
    drawFooter(ctx, W, H)
    return
  }
  if (format === 'film') {
    drawFilmComposition(ctx, pts, stats, name, accent, ar, ag, ab, W, H, theme, false)
    return
  }
  renderFull(ctx, pts, stats, name, accent, W, H, orient, theme, ar, ag, ab)
}

// ── Theme builder — draws background and returns color tokens ─────────────────

function buildTheme(format, W, H, ctx, accent, ar, ag, ab) {
  switch (format) {
    case 'dark':
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      ctx.fillStyle = '#101010'; ctx.fill(); ctx.restore()
      return {
        headerBg:     'rgba(255,255,255,0.05)',
        statsBg:      'rgba(255,255,255,0.05)',
        textPrimary:  '#fff',
        acDim:        `rgba(${ar},${ag},${ab},0.8)`,
        divider:      'rgba(255,255,255,0.07)',
        statLabel:    'rgba(255,255,255,0.35)',
        shadowColor:  'rgba(0,0,0,0.9)',
        routeHalo:    'rgba(0,0,0,0.6)',
        sparkBacking: true,
      }

    case 'light':
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      ctx.fillStyle = '#f2f0eb'; ctx.fill(); ctx.restore()
      return {
        headerBg:     'rgba(255,255,255,0.88)',
        statsBg:      'rgba(255,255,255,0.82)',
        textPrimary:  '#111',
        acDim:        `rgba(${ar},${ag},${ab},1)`,
        divider:      'rgba(0,0,0,0.08)',
        statLabel:    'rgba(0,0,0,0.38)',
        shadowColor:  'rgba(0,0,0,0.12)',
        routeHalo:    'rgba(160,160,160,0.35)',
        sparkBacking: false,
        isLight:      true,
      }

    case 'gradient': {
      ctx.save(); rrect(ctx, 0, 0, W, H, 20); ctx.clip()
      const g = ctx.createLinearGradient(0, 0, W * 0.7, H)
      g.addColorStop(0,    `rgba(${(ar*0.28)|0},${(ag*0.22)|0},${(ab*0.28)|0},1)`)
      g.addColorStop(0.65, '#080812')
      g.addColorStop(1,    '#040408')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore()
      return {
        headerBg:     `rgba(${(ar*0.14)|0},${(ag*0.12)|0},${(ab*0.14)|0},0.72)`,
        statsBg:      `rgba(${(ar*0.10)|0},${(ag*0.08)|0},${(ab*0.10)|0},0.68)`,
        textPrimary:  '#fff',
        acDim:        `rgba(${ar},${ag},${ab},0.9)`,
        divider:      `rgba(${ar},${ag},${ab},0.18)`,
        statLabel:    `rgba(${ar},${ag},${ab},0.65)`,
        shadowColor:  'rgba(0,0,0,0.95)',
        routeHalo:    'rgba(0,0,0,0.55)',
        sparkBacking: true,
      }
    }

    case 'neon':
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      ctx.fillStyle = '#030305'; ctx.fill(); ctx.restore()
      return {
        headerBg:     'rgba(255,255,255,0.04)',
        statsBg:      'rgba(255,255,255,0.03)',
        textPrimary:  '#fff',
        acDim:        `rgba(${ar},${ag},${ab},1)`,
        divider:      `rgba(${ar},${ag},${ab},0.2)`,
        statLabel:    `rgba(${ar},${ag},${ab},0.7)`,
        shadowColor:  `rgba(${ar},${ag},${ab},0.5)`,
        routeHalo:    `rgba(${ar},${ag},${ab},0.18)`,
        sparkBacking: true,
        isNeon:       true,
      }

    case 'minimal':
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.9)`,
        statLabel:   'rgba(255,255,255,0.6)',
        shadowColor: 'rgba(0,0,0,0.95)',
        routeHalo:   'rgba(0,0,0,0.4)',
      }

    case 'strava': {
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      ctx.fillStyle = '#0d0d0d'; ctx.fill()
      const sg = ctx.createLinearGradient(0, H * 0.35, 0, H)
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.45)')
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.restore()
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        statLabel:   'rgba(255,255,255,0.55)',
        shadowColor: 'rgba(0,0,0,0.9)',
      }
    }

    case 'glow': {
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      const glowBg = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.85)
      glowBg.addColorStop(0, `rgba(${(ar * 0.16) | 0},${(ag * 0.10) | 0},${(ab * 0.06) | 0},1)`)
      glowBg.addColorStop(1, '#060504')
      ctx.fillStyle = glowBg; ctx.fill(); ctx.restore()
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},0.88)`,
        statLabel:   `rgba(${ar},${ag},${ab},0.48)`,
        shadowColor: `rgba(${ar},${ag},${ab},0.75)`,
        routeHalo:   `rgba(${ar},${ag},${ab},0.12)`,
        isGlow:      true,
      }
    }

    case 'film': {
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      const filmBg = ctx.createLinearGradient(0, 0, W * 0.4, H)
      filmBg.addColorStop(0, '#0a0b0e')
      filmBg.addColorStop(1, '#111318')
      ctx.fillStyle = filmBg; ctx.fill(); ctx.restore()
      return {
        headerColor: 'rgba(255,255,255,0.52)',
        labelColor:  'rgba(255,255,255,0.38)',
        valueColor:  '#fff',
        unitColor:   `rgba(${ar},${ag},${ab},0.88)`,
        divider:     'rgba(255,255,255,0.10)',
        shadowColor: 'rgba(0,0,0,0.92)',
        acDim:       `rgba(${ar},${ag},${ab},0.80)`,
      }
    }

    case 'stats':
      ctx.save(); rrect(ctx, 0, 0, W, H, 20)
      ctx.fillStyle = '#0d0e11'; ctx.fill(); ctx.restore()
      return {
        cardBg:      'transparent',
        cardBorder:  'transparent',
        headerColor: 'rgba(255,255,255,0.42)',
        labelColor:  'rgba(255,255,255,0.38)',
        valueColor:  '#fff',
        unitColor:   `rgba(${ar},${ag},${ab},0.85)`,
        divider:     'rgba(255,255,255,0.07)',
        shadowColor: 'rgba(0,0,0,0.90)',
      }

    default: // classic — clean athlete top-bar
      return {
        headerBg:     'rgba(8,9,12,0.82)',
        textPrimary:  '#fff',
        acDim:        `rgba(${ar},${ag},${ab},0.85)`,
        divider:      'rgba(255,255,255,0.12)',
        statLabel:    'rgba(255,255,255,0.38)',
        shadowColor:  'rgba(0,0,0,0.95)',
        routeHalo:    'rgba(0,0,0,0.45)',
        sparkBacking: false,
      }
  }
}

// ── Full layout (all formats except minimal) ──────────────────────────────────

function renderFull(ctx, pts, stats, name, accent, W, H, orient, theme, ar, ag, ab) {
  // REF = shorter canvas dimension — all sizes scale from this so backdrop mode looks good
  const isLS = orient === 'landscape'
  const REF  = Math.min(W, H)

  const PAD     = Math.round(REF * 0.042)
  const HDR     = Math.round(REF * 0.142)
  const nameSz  = Math.round(REF * 0.033)
  const dateSz  = Math.round(REF * 0.023)
  const badgeSz = Math.round(REF * 0.054)
  const valSz   = Math.round(REF * 0.038)
  const unitSz  = Math.round(REF * 0.021)
  const lblSz   = Math.round(REF * 0.019)

  const { textPrimary, acDim, headerBg, statsBg, divider, shadowColor } = theme
  const shadow   = (b = 8) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  // Header backdrop
  rrect(ctx, 0, 0, W, HDR, Math.round(REF * 0.033))
  ctx.fillStyle = headerBg; ctx.fill()
  ctx.fillStyle = accent
  ctx.fillRect(0, Math.round(HDR * 0.12), Math.round(REF * 0.006), Math.round(HDR * 0.76))

  // Track name
  ctx.save()
  ctx.font = `700 ${nameSz}px ${FONT}`
  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(10)
  let nameStr = name || 'Activity'
  const maxNW = W - PAD * 2 - Math.round(REF * 0.19)
  while (ctx.measureText(nameStr).width > maxNW && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (name || 'Activity')) nameStr += '…'
  ctx.fillText(nameStr, PAD + Math.round(REF * 0.017), Math.round(HDR * 0.13))
  noShadow(); ctx.restore()

  // Date
  const startPt = pts.find(p => p.time)
  if (startPt?.time) {
    ctx.font = `500 ${dateSz}px ${FONT}`; ctx.fillStyle = acDim
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; shadow(6)
    ctx.fillText(
      startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      PAD + Math.round(REF * 0.017), Math.round(HDR * 0.54),
    ); noShadow()
  }

  // Distance badge
  const distKm = (stats?.totalDist ?? 0).toFixed(2)
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; shadow(10)
  ctx.font = `700 ${badgeSz}px ${FONT}`; ctx.fillStyle = accent
  ctx.fillText(distKm, W - PAD, Math.round(HDR * 0.60))
  ctx.font = `600 ${dateSz}px ${FONT}`; ctx.fillStyle = acDim
  ctx.fillText('km', W - PAD, Math.round(HDR * 0.88)); noShadow()

  // Grid data
  const movingMs = computeMovingTime(pts)
  const grid6 = [
    { v: distKm,                            u: 'km',   l: 'DISTANCE'    },
    { v: String(stats?.elevGain ?? 0),       u: 'm',    l: 'ELEV GAIN'   },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'AVG SPEED'   },
    { v: fmtHMS(stats?.totalTime ?? 0),      u: '',     l: 'TOTAL TIME'  },
    { v: fmtHMS(movingMs),                   u: '',     l: 'MOVING TIME' },
    { v: String(stats?.elevLoss ?? 0),        u: 'm',    l: 'ELEV LOSS'   },
  ]

  if (isLS) {
    const CY = HDR + Math.round(REF * 0.015), CH_MAP = H - CY - Math.round(REF * 0.020)
    const SPLIT = Math.floor(W / 2) - Math.round(REF * 0.010)
    drawRoute(ctx, pts, PAD, CY, SPLIT - PAD, CH_MAP, accent, theme)
    drawElevSparkline(ctx, pts, PAD, CY, SPLIT - PAD, CH_MAP, accent, { r: ar, g: ag, b: ab }, theme)

    const SX = SPLIT + Math.round(REF * 0.020), SW = W - SPLIT - Math.round(REF * 0.020) - PAD
    const COL_W = SW / 2, ROW_H = CH_MAP / 3
    rrect(ctx, SX - Math.round(REF * 0.010), CY, SW + Math.round(REF * 0.010), CH_MAP, Math.round(REF * 0.029))
    ctx.fillStyle = statsBg; ctx.fill()
    drawGridDividers(ctx, SX, CY, SW, CH_MAP, 2, 3, divider)
    grid6.forEach((s, i) => drawStatCell(ctx, s,
      SX + (i % 2) * COL_W + COL_W / 2,
      CY + Math.floor(i / 2) * ROW_H + ROW_H / 2,
      theme, valSz, unitSz, lblSz))

  } else {
    const MAP_Y = HDR + Math.round(REF * 0.013)
    const MAP_H = Math.round(H * 0.483)
    drawRoute(ctx, pts, PAD, MAP_Y, W - PAD * 2, MAP_H, accent, theme)
    drawElevSparkline(ctx, pts, PAD, MAP_Y, W - PAD * 2, MAP_H, accent, { r: ar, g: ag, b: ab }, theme)

    const ST_Y = MAP_Y + MAP_H + Math.round(REF * 0.013), ST_H = H - ST_Y - Math.round(REF * 0.017)
    const COL_W = (W - PAD * 2) / 3, ROW_H = ST_H / 2
    rrect(ctx, 0, ST_Y, W, ST_H + Math.round(REF * 0.017), Math.round(REF * 0.029))
    ctx.fillStyle = statsBg; ctx.fill()
    drawGridDividers(ctx, PAD, ST_Y, W - PAD * 2, ST_H, 3, 2, divider)
    grid6.forEach((s, i) => drawStatCell(ctx, s,
      PAD + (i % 3) * COL_W + COL_W / 2,
      ST_Y + Math.floor(i / 3) * ROW_H + ROW_H / 2,
      theme, valSz, unitSz, lblSz))
  }

  drawFooter(ctx, W, H)
}

// ── Classic layout — clean athlete top-bar ────────────────────────────────────
// Single top bar: title + short date, then 4 inline stats (distance hero-sized).
// Mini-map in bottom-left. Watermark in bottom-right corner.

function renderClassic(ctx, pts, stats, name, accent, W, H, orient, theme, ar, ag, ab) {
  const isLS = orient === 'landscape'
  const REF  = Math.min(W, H)
  const PAD  = Math.round(REF * 0.042)
  const shadow   = (b = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  // ── Top bar: two rows ───────────────────────────────────────────────────────
  const TITLE_H = Math.round(REF * (isLS ? 0.082 : 0.072))
  const STATS_H = Math.round(REF * (isLS ? 0.118 : 0.106))
  const BAR_H   = TITLE_H + STATS_H
  const BAR_R   = Math.round(REF * 0.033)

  // Backdrop — clip so top corners are rounded, bottom edge is flat
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(BAR_R, 0)
  ctx.arcTo(W, 0, W, BAR_H, BAR_R)
  ctx.lineTo(W, BAR_H)
  ctx.lineTo(0, BAR_H)
  ctx.arcTo(0, 0, BAR_R, 0, BAR_R)
  ctx.closePath()
  ctx.fillStyle = theme.headerBg; ctx.fill()
  ctx.restore()

  // Thin accent left bar spanning title row
  const barW = Math.max(2, Math.round(REF * 0.005))
  ctx.fillStyle = accent
  ctx.fillRect(0, Math.round(TITLE_H * 0.14), barW, Math.round(TITLE_H * 0.72))

  // ── Title row ─────────────────────────────────────────────────────────────
  const nameSz = Math.round(TITLE_H * 0.40)
  const dateSz = Math.round(nameSz * 0.74)
  const nameX  = PAD + Math.round(REF * 0.014)
  const titleCY = Math.round(TITLE_H * 0.50)

  ctx.font = `600 ${nameSz}px ${FONT}`
  ctx.fillStyle = theme.textPrimary
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  let nameStr = name || 'Activity'
  const maxNW = W - PAD * 3 - Math.round(W * 0.22)
  while (ctx.measureText(nameStr).width > maxNW && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (name || 'Activity')) nameStr += '…'
  shadow(8); ctx.fillText(nameStr, nameX, titleCY); noShadow()

  const startPt = pts.find(p => p.time)
  if (startPt?.time) {
    const dateStr = startPt.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ctx.font = `500 ${dateSz}px ${FONT}`
    ctx.fillStyle = theme.acDim
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    shadow(5); ctx.fillText(dateStr, W - PAD, titleCY); noShadow()
  }

  // ── Stats row — 4 metrics, distance is hero-sized ────────────────────────
  const movingMs = computeMovingTime(pts)
  const stats4 = [
    { v: (stats?.totalDist ?? 0).toFixed(2), u: 'km',   hero: true  },
    { v: fmtHMS(movingMs),                   u: '',     hero: false },
    { v: String(stats?.elevGain ?? 0),       u: 'm↑',   hero: false },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', hero: false },
  ]

  const heroSz     = Math.round(STATS_H * 0.52)
  const subSz      = Math.round(STATS_H * 0.36)
  const heroUnitSz = Math.round(heroSz * 0.38)
  const subUnitSz  = Math.round(subSz * 0.56)
  const statsCY    = TITLE_H + Math.round(STATS_H * 0.52)
  const colW       = (W - PAD * 2) / stats4.length

  stats4.forEach((s, i) => {
    const cx   = PAD + i * colW + colW / 2
    const sz   = s.hero ? heroSz : subSz
    const usiz = s.hero ? heroUnitSz : subUnitSz

    if (i > 0) {
      ctx.fillStyle = theme.divider
      ctx.fillRect(PAD + i * colW, TITLE_H + Math.round(STATS_H * 0.16), 1, Math.round(STATS_H * 0.68))
    }

    ctx.font = `800 ${sz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.font = `${s.hero ? 700 : 600} ${usiz}px ${FONT}`
    const uw  = s.u ? ctx.measureText(s.u).width : 0
    const gap = s.u ? Math.round(sz * 0.07) : 0
    const bw  = vw + uw + gap
    const sx  = cx - bw / 2

    ctx.font = `800 ${sz}px ${FONT}`
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    shadow(s.hero ? 20 : 10); ctx.fillText(s.v, sx, statsCY); noShadow()

    if (s.u) {
      ctx.font = `${s.hero ? 700 : 600} ${usiz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
      shadow(s.hero ? 12 : 6)
      ctx.fillText(s.u, sx + vw + gap, statsCY + Math.round(sz * 0.28))
      noShadow()
    }
  })

  // ── Mini route map — bottom-left circle ──────────────────────────────────
  if (pts.length > 1) {
    const MAP_SZ  = Math.round(REF * (isLS ? 0.17 : 0.20))
    const MAP_PAD = Math.round(REF * 0.030)
    const mx = MAP_PAD, my = H - MAP_SZ - MAP_PAD
    ctx.save()
    ctx.beginPath(); ctx.arc(mx + MAP_SZ / 2, my + MAP_SZ / 2, MAP_SZ / 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, mx, my, MAP_SZ, MAP_SZ, accent, {
      routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false,
    })
    ctx.restore()
  }

  // ── Watermark — bottom-right corner, smaller + dimmer ────────────────────
  const ICON_H = Math.max(9, Math.round(REF * 0.022))
  const txtSz  = Math.max(7, Math.round(ICON_H * 0.70))
  const LABEL  = 'gpx2video'
  ctx.font     = `500 ${txtSz}px ${FONT}`
  const lw     = ctx.measureText(LABEL).width
  const WPAD   = Math.round(ICON_H * 0.55)
  const logoX  = W - WPAD - lw - Math.round(ICON_H * 0.28) - ICON_H
  const logoY  = H - WPAD - ICON_H
  drawLogoMark(ctx, logoX, logoY, ICON_H, 0.32)
  ctx.font = `500 ${txtSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.20)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = Math.round(ICON_H * 0.3)
  ctx.fillText(LABEL, logoX + ICON_H + Math.round(ICON_H * 0.28), logoY + ICON_H / 2)
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
}

// ── Minimal layout — route dominant, 3 floating stats ────────────────────────

function renderMinimal(ctx, pts, stats, name, accent, W, H, orient, theme) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 8) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const REF    = Math.min(W, H)
  const distKm = (stats?.totalDist ?? 0).toFixed(2)
  const stats3 = [
    { v: distKm,                          u: 'km', l: 'DISTANCE'  },
    { v: fmtHMS(stats?.totalTime ?? 0),   u: '',   l: 'TOTAL TIME' },
    { v: String(stats?.elevGain ?? 0),     u: 'm',  l: 'ELEV GAIN' },
  ]

  if (orient === 'landscape') {
    const PAD     = Math.round(REF * 0.040)
    const ROUTE_W = Math.floor(W * 0.58)
    drawRoute(ctx, pts, PAD, PAD, ROUTE_W - PAD, H - PAD * 2, accent, theme)

    const SX     = ROUTE_W + Math.round(REF * 0.030), SW = W - SX - PAD
    const ROW_H  = H / 3
    const valSz  = Math.round(REF * 0.070)
    const unitSz = Math.round(valSz * 0.43)
    const lblSz  = Math.round(REF * 0.023)

    stats3.forEach((s, i) => {
      const cy = i * ROW_H + ROW_H / 2
      shadow(10)
      ctx.font = `700 ${valSz}px ${FONT}`; ctx.fillStyle = textPrimary
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(s.v, SX + SW / 2, cy + Math.round(valSz * 0.14)); noShadow()
      if (s.u) {
        const vw = ctx.measureText(s.v).width
        ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = acDim
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.fillText(s.u, SX + SW / 2 + vw / 2 + Math.round(unitSz * 0.3), cy)
      }
      ctx.font = `700 ${lblSz}px ${FONT}`; ctx.fillStyle = statLabel
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(s.l, SX + SW / 2, cy + Math.round(valSz * 0.18))
    })

  } else {
    const PAD    = Math.round(REF * 0.033)
    const valSz  = Math.round(REF * 0.046)
    const unitSz = Math.round(valSz * 0.45)
    const lblSz  = Math.round(REF * 0.017)
    const nameSz = Math.round(REF * 0.023)
    const STAT_H = Math.round(REF * 0.117)
    const MAP_H  = H - PAD - STAT_H - Math.round(REF * 0.017)
    drawRoute(ctx, pts, PAD, PAD, W - PAD * 2, MAP_H, accent, theme)

    // Track name
    shadow(8); ctx.font = `600 ${nameSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(name || 'Activity', PAD + Math.round(REF * 0.008), PAD + Math.round(REF * 0.008)); noShadow()

    const COL_W = (W - PAD * 2) / 3, CY = H - STAT_H / 2 - Math.round(REF * 0.013)
    stats3.forEach((s, i) => {
      const cx = PAD + i * COL_W + COL_W / 2
      shadow(10); ctx.font = `700 ${valSz}px ${FONT}`; ctx.fillStyle = textPrimary
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(s.v, cx, CY + Math.round(valSz * 0.09)); noShadow()
      if (s.u) {
        const vw = ctx.measureText(s.v).width
        ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = acDim
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.fillText(s.u, cx + vw / 2 + Math.round(unitSz * 0.2), CY - Math.round(unitSz * 0.1))
      }
      ctx.font = `700 ${lblSz}px ${FONT}`; ctx.fillStyle = statLabel
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(s.l, cx, CY + Math.round(valSz * 0.10))
    })
  }

  drawFooter(ctx, W, H)
}

// ── Strava layout — transparent bg, name + 6-stat grid, no map ───────────────

function renderStrava(ctx, pts, stats, name, accent, W, H, orient, theme) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 10) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()       => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const isLS = orient === 'landscape'
  const REF  = Math.min(W, H)
  const PAD  = Math.round(REF * (isLS ? 0.052 : 0.056))

  const movingMs = computeMovingTime(pts)
  const fmtTime  = fmtHM(movingMs || (stats?.totalTime ?? 0))
  const elevGain = String(stats?.elevGain ?? 0)
  const distKm   = (stats?.totalDist ?? 0).toFixed(2)

  const nameSz = Math.round(REF * (isLS ? 0.054 : 0.058))
  const valSz  = Math.round(REF * (isLS ? 0.068 : 0.073))
  const unitSz = Math.round(valSz * 0.42)
  const lblSz  = Math.round(valSz * 0.36)
  const iconSz = Math.round(nameSz * 0.90)

  // Position content toward the bottom
  const contentH = iconSz * 1.55 + nameSz * 1.72 + lblSz * 1.55 + valSz * 1.6 + lblSz * 1.55 + valSz * 1.2
  let y = Math.max(PAD, H - contentH - PAD * 2)

  // Cycling icon + STRAVA text
  drawCyclingIcon(ctx, PAD, y, iconSz, '#fff')
  ctx.font = `800 ${Math.round(iconSz * 0.85)}px ${FONT}`
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  shadow(12); ctx.fillText('STRAVA', PAD + iconSz + Math.round(iconSz * 0.42), y + iconSz / 2); noShadow()
  y += iconSz * 1.55

  // Activity name
  ctx.font = `800 ${nameSz}px ${FONT}`
  let nameStr = name || 'Activity'
  while (ctx.measureText(nameStr).width > W - PAD * 2 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (name || 'Activity')) nameStr += '…'
  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(16); ctx.fillText(nameStr, PAD, y); noShadow()
  y += nameSz * 1.72

  const colW = (W - PAD * 2) / 2

  // Labels: Elev Gain | Time
  ctx.font = `500 ${lblSz}px ${FONT}`
  ctx.fillStyle = statLabel; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(4); ctx.fillText('Elev Gain', PAD, y); ctx.fillText('Time', PAD + colW, y); noShadow()
  y += lblSz * 1.55

  // Values: elevation | time
  ctx.font = `800 ${valSz}px ${FONT}`
  const elevW = ctx.measureText(elevGain).width
  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(14); ctx.fillText(elevGain, PAD, y); noShadow()
  ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = acDim
  shadow(8); ctx.fillText('m', PAD + elevW + Math.round(valSz * 0.08), y + valSz * 0.55); noShadow()

  ctx.font = `800 ${valSz}px ${FONT}`; ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(14); ctx.fillText(fmtTime, PAD + colW, y); noShadow()
  y += valSz * 1.6

  // Distance label
  ctx.font = `500 ${lblSz}px ${FONT}`; ctx.fillStyle = statLabel; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(4); ctx.fillText('Distance', PAD, y); noShadow()
  y += lblSz * 1.55

  // Distance value
  ctx.font = `800 ${valSz}px ${FONT}`
  const distW = ctx.measureText(distKm).width
  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(14); ctx.fillText(distKm, PAD, y); noShadow()
  ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = acDim
  shadow(8); ctx.fillText('km', PAD + distW + Math.round(valSz * 0.08), y + valSz * 0.55); noShadow()

  drawFooter(ctx, W, H)
}

// ── Glow layout — dark warm bg, stacked stats + single-color glowing route ────

function renderGlow(ctx, pts, stats, name, accent, W, H, orient, theme) {
  const { r: ar, g: ag, b: ab } = hexRgb(accent)
  const isLS = orient === 'landscape'
  const PAD  = Math.round(W * 0.075)

  const movingMs = computeMovingTime(pts)
  const rows = [
    { l: 'Distance',  v: (stats?.totalDist ?? 0).toFixed(2), u: 'km' },
    { l: 'Elev Gain', v: String(stats?.elevGain ?? 0),        u: 'm'  },
    { l: 'Time',      v: fmtHMS(movingMs || (stats?.totalTime ?? 0)), u: '' },
  ]

  const glowFn   = (b) => { ctx.shadowColor = `rgba(${ar},${ag},${ab},0.85)`; ctx.shadowBlur = b }
  const noShadow = ()  => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }
  const accentFull = `rgba(${ar},${ag},${ab},1)`
  const accentDim  = `rgba(${ar},${ag},${ab},0.48)`

  if (isLS) {
    // Stats on left half, route on right half
    const STATS_W = Math.round(W * 0.5)
    const rowH    = H / rows.length
    const valSz   = Math.round(Math.min(rowH * 0.50, STATS_W * 0.22))
    const unitSz  = Math.round(valSz * 0.38)
    const lblSz   = Math.round(valSz * 0.32)

    rows.forEach((s, i) => {
      const cy = i * rowH + rowH / 2

      ctx.font = `500 ${lblSz}px ${FONT}`
      ctx.fillStyle = accentDim; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      glowFn(5); ctx.fillText(s.l.toUpperCase(), PAD, cy - 2); noShadow()

      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      glowFn(26); ctx.fillText(s.v, PAD, cy + 2); noShadow()

      if (s.u) {
        ctx.font = `600 ${unitSz}px ${FONT}`
        ctx.fillStyle = accentFull; glowFn(14)
        ctx.fillText(s.u, PAD + vw + Math.round(valSz * 0.08), cy + valSz * 0.56)
        noShadow()
      }

      if (i < rows.length - 1) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.10)`
        ctx.fillRect(PAD, (i + 1) * rowH - 1, STATS_W - PAD * 2, 1)
      }
    })

    if (pts.length > 1) {
      drawGlowRoute(ctx, pts, STATS_W, 10, W - STATS_W - PAD * 0.5, H - 20, accent, ar, ag, ab)
    }

  } else {
    // Portrait: stats top ~58%, route bottom ~42%
    const ROUTE_FRAC = 0.42
    const STATS_H    = Math.round(H * (1 - ROUTE_FRAC))
    const ROUTE_Y    = STATS_H
    const ROUTE_H    = H - ROUTE_Y
    const rowH       = STATS_H / rows.length
    const valSz      = Math.round(Math.min(rowH * 0.52, W * 0.185))
    const unitSz     = Math.round(valSz * 0.38)
    const lblSz      = Math.round(valSz * 0.30)

    rows.forEach((s, i) => {
      const rowTop = i * rowH
      const cy     = rowTop + rowH / 2

      ctx.font = `500 ${lblSz}px ${FONT}`
      ctx.fillStyle = accentDim; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      glowFn(5); ctx.fillText(s.l.toUpperCase(), PAD, cy); noShadow()

      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      glowFn(30); ctx.fillText(s.v, PAD, cy + 2); noShadow()

      if (s.u) {
        ctx.font = `600 ${unitSz}px ${FONT}`
        ctx.fillStyle = accentFull; glowFn(16)
        ctx.fillText(s.u, PAD + vw + Math.round(valSz * 0.08), cy + valSz * 0.56)
        noShadow()
      }

      if (i < rows.length - 1) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.10)`
        ctx.fillRect(PAD, rowTop + rowH - 1, W - PAD * 2, 1)
      }
    })

    if (pts.length > 1) {
      drawGlowRoute(ctx, pts, PAD * 0.5, ROUTE_Y, W - PAD, ROUTE_H - 24, accent, ar, ag, ab)
    }
  }

  drawFooter(ctx, W, H)
}

function drawGlowRoute(ctx, pts, mx, my, mw, mh, accent, ar, ag, ab) {
  const lats   = pts.map(p => p.lat), lons = pts.map(p => p.lon)
  const latMin = Math.min(...lats), latMax = Math.max(...lats)
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons)
  const latR   = (latMax - latMin) || 0.001, lonR = (lonMax - lonMin) || 0.001
  const latMid = ((latMin + latMax) / 2) * Math.PI / 180
  const aspect  = (lonR * Math.cos(latMid)) / latR

  const mp = 14, avW = mw - 2 * mp, avH = mh - 2 * mp
  let fw = avW, fh = avH
  if (aspect > avW / avH) fh = avW / aspect; else fw = avH * aspect

  const offX = mx + mp + (avW - fw) / 2, offY = my + mp + (avH - fh) / 2
  const toXY = (lat, lon) => [
    offX + ((lon - lonMin) / lonR) * fw,
    offY + fh - ((lat - latMin) / latR) * fh,
  ]

  const buildPath = () => {
    ctx.beginPath()
    pts.forEach((p, i) => { const [x, y] = toXY(p.lat, p.lon); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) })
  }

  // Wide outer halo
  buildPath()
  ctx.save()
  ctx.shadowColor = `rgba(${ar},${ag},${ab},0.55)`; ctx.shadowBlur = 32
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.10)`
  ctx.lineWidth = 18; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()

  // Mid glow
  buildPath()
  ctx.save()
  ctx.shadowColor = `rgba(${ar},${ag},${ab},0.90)`; ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.40)`
  ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()

  // Crisp core
  buildPath()
  ctx.save()
  ctx.shadowColor = `rgba(${ar},${ag},${ab},1)`; ctx.shadowBlur = 5
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},1)`
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
  ctx.restore()
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function drawRoute(ctx, pts, mx, my, mw, mh, accent, theme) {
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon)
  const latMin = Math.min(...lats), latMax = Math.max(...lats)
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons)
  const latR = (latMax - latMin) || 0.001, lonR = (lonMax - lonMin) || 0.001

  const latMid = ((latMin + latMax) / 2) * Math.PI / 180
  const aspect = (lonR * Math.cos(latMid)) / latR

  const mp = 20, avW = mw - 2*mp, avH = mh - 2*mp - 36
  let fw = avW, fh = avH
  if (aspect > avW / avH) fh = avW / aspect; else fw = avH * aspect

  const offX = mx + mp + (avW - fw) / 2, offY = my + mp + (avH - fh) / 2
  const toXY = (lat, lon) => [
    offX + ((lon - lonMin) / lonR) * fw,
    offY + fh - ((lat - latMin) / latR) * fh,
  ]
  const maxSp = arrayMax(pts.map(p => p.speedSmooth)) || 1

  // Halo / glow base
  ctx.beginPath()
  pts.forEach((p, i) => { const [x,y] = toXY(p.lat,p.lon); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
  ctx.strokeStyle = theme.routeHalo
  ctx.lineWidth   = theme.isNeon ? 10 : 6
  ctx.lineJoin    = 'round'; ctx.lineCap = 'round'; ctx.stroke()

  // Neon wide outer glow
  if (theme.isNeon) {
    ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 18
    ctx.beginPath()
    pts.forEach((p, i) => { const [x,y] = toXY(p.lat,p.lon); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
    ctx.strokeStyle = `rgba(${hexRgb(accent).r},${hexRgb(accent).g},${hexRgb(accent).b},0.3)`
    ctx.lineWidth = 10; ctx.stroke(); ctx.restore()
  }

  // Speed-colored route
  for (let i = 1; i < pts.length; i++) {
    const t  = pts[i].speedSmooth / maxSp
    const rr = Math.round(lerp(30,255,t)), gg = Math.round(lerp(100,80,t)), bb = Math.round(lerp(255,30,t))
    const [x0,y0] = toXY(pts[i-1].lat, pts[i-1].lon)
    const [x1,y1] = toXY(pts[i].lat,   pts[i].lon)
    if (theme.isNeon) {
      ctx.save(); ctx.shadowColor = `rgb(${rr},${gg},${bb})`; ctx.shadowBlur = 7
    }
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1)
    ctx.strokeStyle = `rgb(${rr},${gg},${bb})`
    ctx.lineWidth   = theme.isNeon ? 2.5 : 3
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    if (theme.isNeon) ctx.restore()
  }

  // Start dot (green)
  const [sx,sy] = toXY(pts[0].lat, pts[0].lon)
  ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill()
  ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fillStyle='#22c55e'; ctx.fill()
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5; ctx.stroke()

  // End dot (accent)
  const [ex,ey] = toXY(pts[pts.length-1].lat, pts[pts.length-1].lon)
  ctx.beginPath(); ctx.arc(ex,ey,6,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill()
  ctx.beginPath(); ctx.arc(ex,ey,5,0,Math.PI*2); ctx.fillStyle=accent; ctx.fill()
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5; ctx.stroke()
}

function drawElevSparkline(ctx, pts, mx, my, mw, mh, accent, rgb, theme) {
  if (pts.length < 2) return
  const SH = 32, SY = my + mh - SH - 2, SX = mx + 2, SW = mw - 4
  const eles = pts.map(p => p.ele)
  const eMin = Math.min(...eles), eRange = (Math.max(...eles) - eMin) || 1
  const pad = 4
  const xOf = i   => SX + pad + (i / (pts.length-1)) * (SW - 2*pad)
  const yOf = ele => SY + SH - pad - ((ele - eMin) / eRange) * (SH - 2*pad)

  ctx.save(); ctx.beginPath(); ctx.rect(SX,SY,SW,SH); ctx.clip()

  if (theme.sparkBacking) {
    const bg = ctx.createLinearGradient(0,SY,0,SY+SH)
    bg.addColorStop(0, 'rgba(0,0,0,0)')
    bg.addColorStop(1, theme.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)')
    ctx.fillStyle = bg; ctx.fillRect(SX,SY,SW,SH)
  }

  ctx.beginPath()
  ctx.moveTo(xOf(0), SY+SH)
  for (let i = 0; i < pts.length; i++) ctx.lineTo(xOf(i), yOf(pts[i].ele))
  ctx.lineTo(xOf(pts.length-1), SY+SH); ctx.closePath()
  const fg = ctx.createLinearGradient(0,SY,0,SY+SH)
  fg.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${theme.isLight ? 0.2 : 0.3})`)
  fg.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.04)`)
  ctx.fillStyle = fg; ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    i===0 ? ctx.moveTo(xOf(0),yOf(pts[0].ele)) : ctx.lineTo(xOf(i),yOf(pts[i].ele))
  }
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${theme.isLight ? 0.5 : 0.55})`
  ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
}

function drawGridDividers(ctx, x, y, w, h, cols, rows, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1
  const cw = w / cols, rh = h / rows
  for (let r = 1; r < rows; r++) {
    ctx.beginPath(); ctx.moveTo(x, y+r*rh); ctx.lineTo(x+w, y+r*rh); ctx.stroke()
  }
  for (let c = 1; c < cols; c++) {
    ctx.beginPath(); ctx.moveTo(x+c*cw, y+8); ctx.lineTo(x+c*cw, y+h-8); ctx.stroke()
  }
}

function drawStatCell(ctx, s, cx, cy, theme, valSz = 18, unitSz = 10, lblSz = 9) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 6) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  shadow()
  ctx.font = `700 ${valSz}px ${FONT}`; ctx.fillStyle = textPrimary
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText(s.v, cx, cy + Math.round(valSz * 0.06)); noShadow()

  if (s.u) {
    const vw = ctx.measureText(s.v).width
    ctx.font = `600 ${unitSz}px ${FONT}`; ctx.fillStyle = acDim
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(s.u, cx + vw / 2 + Math.round(unitSz * 0.3), cy - Math.round(unitSz * 0.1))
  }

  ctx.font = `600 ${lblSz}px ${FONT}`; ctx.fillStyle = statLabel
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText(s.l, cx, cy + Math.round(lblSz * 0.6))
}

function drawCyclingIcon(ctx, x, y, size, color) {
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.072)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const wr  = size * 0.26
  const wcy = y + size * 0.69
  const lwx = x + size * 0.22
  const rwx = x + size * 0.78

  ctx.beginPath(); ctx.arc(lwx, wcy, wr, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(rwx, wcy, wr, 0, Math.PI * 2); ctx.stroke()

  const bbx = lwx + size * 0.18, bby = wcy
  const stx = lwx + size * 0.12, sty = y + size * 0.27
  const htx = rwx, hty = y + size * 0.31

  // Rear triangle
  ctx.beginPath(); ctx.moveTo(lwx, wcy); ctx.lineTo(stx, sty); ctx.lineTo(bbx, bby); ctx.closePath(); ctx.stroke()
  // Top tube + down tube
  ctx.beginPath(); ctx.moveTo(stx, sty); ctx.lineTo(htx, hty); ctx.lineTo(bbx, bby); ctx.stroke()
  // Fork
  ctx.beginPath(); ctx.moveTo(htx, hty); ctx.lineTo(rwx, wcy); ctx.stroke()
  // Handlebar
  ctx.beginPath(); ctx.moveTo(htx - size*0.05, hty - size*0.02); ctx.lineTo(htx + size*0.09, hty - size*0.02); ctx.stroke()
  // Seat post + saddle
  ctx.beginPath(); ctx.moveTo(stx, sty); ctx.lineTo(stx, sty - size*0.07); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(stx - size*0.09, sty - size*0.07); ctx.lineTo(stx + size*0.07, sty - size*0.07); ctx.stroke()

  // Rider: head (filled circle)
  ctx.beginPath(); ctx.arc(stx + size*0.08, sty - size*0.22, size * 0.09, 0, Math.PI * 2); ctx.fill()
  // Rider body (leaning toward handlebar)
  ctx.beginPath(); ctx.moveTo(stx + size*0.08, sty - size*0.13); ctx.lineTo(htx + size*0.02, hty - size*0.03); ctx.stroke()

  ctx.restore()
}

// ── Film / cinematic overlay ──────────────────────────────────────────────────

function drawHikerIcon(ctx, x, y, size, color) {
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const cx = x + size / 2
  ctx.beginPath(); ctx.arc(cx, y + size * 0.12, size * 0.11, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(cx, y + size * 0.23); ctx.lineTo(cx - size * 0.04, y + size * 0.55); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, y + size * 0.32); ctx.lineTo(cx - size * 0.20, y + size * 0.27); ctx.lineTo(cx - size * 0.28, y + size * 0.46); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, y + size * 0.32); ctx.lineTo(cx + size * 0.16, y + size * 0.39); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - size * 0.04, y + size * 0.55); ctx.lineTo(cx - size * 0.17, y + size * 0.77); ctx.lineTo(cx - size * 0.22, y + size * 0.92); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - size * 0.04, y + size * 0.55); ctx.lineTo(cx + size * 0.11, y + size * 0.75); ctx.lineTo(cx + size * 0.14, y + size * 0.92); ctx.stroke()
  ctx.restore()
}

function drawIntFilm(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const filmTheme = {
    headerColor: 'rgba(255,255,255,0.52)',
    labelColor:  'rgba(255,255,255,0.40)',
    valueColor:  '#fff',
    unitColor:   `rgba(${ar},${ag},${ab},0.88)`,
    divider:     'rgba(255,255,255,0.12)',
    shadowColor: 'rgba(0,0,0,0.92)',
    acDim:       `rgba(${ar},${ag},${ab},0.80)`,
  }
  drawFilmComposition(ctx, pts, stats, props.trackName, accent, ar, ag, ab, W, H, filmTheme, true)
  drawFooter(ctx, W, H)
}

function drawFilmComposition(ctx, pts, stats, name, accent, ar, ag, ab, W, H, theme, isPhoto) {
  const isLS   = W > H * 1.1
  const REF    = Math.min(W, H)
  const PAD    = Math.round(REF * 0.050)
  const RADIUS = Math.round(W * (isLS ? 0.028 : 0.038))

  // Glassmorphism border on standalone sticker
  if (!isPhoto) {
    const bG = ctx.createLinearGradient(0, 0, W * 0.5, H)
    bG.addColorStop(0, 'rgba(255,255,255,0.18)')
    bG.addColorStop(0.45, 'rgba(255,255,255,0.05)')
    bG.addColorStop(1, 'rgba(255,255,255,0.12)')
    rrect(ctx, 1.5, 1.5, W - 3, H - 3, RADIUS)
    ctx.strokeStyle = bG; ctx.lineWidth = 2; ctx.stroke()
  }

  // Layout zones
  const STRIP_H = Math.round(H * (isLS ? 0.215 : 0.260))
  const CHART_H = H - STRIP_H

  // Right inset card dimensions
  const INSET_W = Math.round(W * (isLS ? 0.170 : 0.250))
  const INSET_X = W - INSET_W - Math.round(PAD * 0.55)
  const INSET_Y = Math.round(PAD * 0.45)
  const IC_SZ   = Math.round(REF * (isLS ? 0.105 : 0.095))
  const IC_R    = Math.round(REF * 0.028)
  const MINI_Y  = INSET_Y + IC_SZ + Math.round(PAD * 0.32)
  const MINI_H  = CHART_H - MINI_Y - Math.round(PAD * 0.4)

  // ── Header gradient (top-left column area) ────────────────────────────────
  const CHART_LABEL_W = INSET_X - Math.round(PAD * 0.5)
  const HDR_H   = Math.round(CHART_H * 0.18)
  const hGrad   = ctx.createLinearGradient(0, 0, 0, HDR_H * 2.2)
  hGrad.addColorStop(0, 'rgba(0,0,0,0.72)')
  hGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hGrad; ctx.fillRect(0, 0, CHART_LABEL_W, HDR_H * 2.2)

  // Column headers + values
  const movingMs  = computeMovingTime(pts)
  const maxSpd    = pts.length ? Math.max(...pts.map(p => p.speedSmooth ?? 0)) : 0
  const cols = [
    { l: 'ELEVATION', v: String(stats?.elevGain ?? 0),             u: 'm'    },
    { l: 'DISTANCE',  v: (stats?.totalDist ?? 0).toFixed(1),       u: 'km'   },
    { l: 'AVG SPEED', v: (stats?.avgSpeed ?? 0).toFixed(1),        u: 'km/h' },
  ]
  const numCols = isLS ? 3 : 2
  const dispCols = cols.slice(0, numCols)
  const colW  = CHART_LABEL_W / dispCols.length
  const lblSz = Math.round(REF * (isLS ? 0.019 : 0.016))
  const valSz = Math.round(REF * (isLS ? 0.054 : 0.046))
  const uSz   = Math.round(valSz * 0.46)

  dispCols.forEach((c, i) => {
    const cx  = PAD + i * colW
    const topY = Math.round(PAD * 0.52)

    ctx.font = `500 ${lblSz}px ${FONT}`
    ctx.fillStyle = theme.headerColor
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(c.l, cx, topY)

    ctx.fillStyle = theme.divider
    ctx.fillRect(cx, topY + lblSz + Math.round(lblSz * 0.22), Math.round(colW * 0.55), 1)

    const numY = topY + lblSz + Math.round(lblSz * 0.52)
    ctx.font = `800 ${valSz}px ${FONT}`
    ctx.fillStyle = theme.valueColor
    ctx.shadowColor = theme.shadowColor; ctx.shadowBlur = 16
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    const vw = ctx.measureText(c.v).width
    ctx.fillText(c.v, cx, numY)
    ctx.shadowBlur = 0

    ctx.font = `500 ${uSz}px ${FONT}`
    ctx.fillStyle = theme.unitColor
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(c.u, cx + vw + Math.round(valSz * 0.07), numY + valSz * 0.52)
  })

  // ── Elevation profile chart ───────────────────────────────────────────────
  if (pts.length > 1) {
    const EX     = PAD
    const EW     = CHART_LABEL_W - PAD
    const ETOP   = HDR_H + Math.round(CHART_H * 0.04)
    const EBOT   = CHART_H - Math.round(PAD * 0.72)
    const EH     = EBOT - ETOP

    const eles   = pts.map(p => p.ele)
    const eMin   = Math.min(...eles)
    const eRange = (Math.max(...eles) - eMin) || 1

    const toX = i  => EX + (i / (pts.length - 1)) * EW
    const toY = e  => EBOT - ((e - eMin) / eRange) * EH * 0.82

    // Filled area
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(EX, EBOT)
    for (let i = 0; i < pts.length; i++) ctx.lineTo(toX(i), toY(pts[i].ele))
    ctx.lineTo(toX(pts.length - 1), EBOT); ctx.closePath()
    const fillG = ctx.createLinearGradient(0, ETOP, 0, EBOT)
    fillG.addColorStop(0, 'rgba(255,255,255,0.14)')
    fillG.addColorStop(0.7, `rgba(${ar},${ag},${ab},0.06)`)
    fillG.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fillG; ctx.fill(); ctx.restore()

    // White line
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      i === 0 ? ctx.moveTo(toX(0), toY(pts[0].ele)) : ctx.lineTo(toX(i), toY(pts[i].ele))
    }
    ctx.shadowColor = 'rgba(255,255,255,0.55)'; ctx.shadowBlur = 7
    ctx.strokeStyle = 'rgba(255,255,255,0.86)'
    ctx.lineWidth = Math.max(1.5, REF * 0.0038); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    ctx.restore()

    // X-axis distance labels + ticks
    const NUM_X    = isLS ? 7 : 5
    const xLblSz  = Math.round(REF * 0.016)
    for (let i = 0; i < NUM_X; i++) {
      const lx   = EX + (i / (NUM_X - 1)) * EW
      const dist = ((stats?.totalDist ?? 0) * (i / (NUM_X - 1))).toFixed(1)
      const lbl  = dist + 'k'
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(lx - 0.5, EBOT - Math.round(PAD * 0.22), 1, Math.round(PAD * 0.22))
      ctx.font = `400 ${xLblSz}px ${FONT}`
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.textAlign = i === 0 ? 'left' : (i === NUM_X - 1 ? 'right' : 'center')
      ctx.textBaseline = 'bottom'
      ctx.fillText(lbl, lx, CHART_H - Math.round(PAD * 0.15))
    }
  }

  // ── Top-right: activity icon card ─────────────────────────────────────────
  rrect(ctx, INSET_X, INSET_Y, IC_SZ, IC_SZ, IC_R)
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill()
  rrect(ctx, INSET_X, INSET_Y, IC_SZ, IC_SZ, IC_R)
  ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.lineWidth = 1; ctx.stroke()
  drawHikerIcon(ctx, INSET_X + IC_SZ * 0.22, INSET_Y + IC_SZ * 0.16, IC_SZ * 0.60, 'rgba(255,255,255,0.80)')

  // ── Top-right: mini route + stats card ────────────────────────────────────
  if (MINI_H > 40) {
    const MR = Math.round(REF * 0.020)
    rrect(ctx, INSET_X, MINI_Y, INSET_W, MINI_H, MR)
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill()
    rrect(ctx, INSET_X, MINI_Y, INSET_W, MINI_H, MR)
    ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.lineWidth = 1; ctx.stroke()

    const MP      = Math.round(REF * 0.013)
    const ROUTH   = Math.round(MINI_H * 0.52)

    if (pts.length > 1) {
      drawRoute(ctx, pts, INSET_X + MP, MINI_Y + MP, INSET_W - MP * 2, ROUTH - MP, accent, {
        routeHalo: 'rgba(0,0,0,0.50)', isNeon: false, sparkBacking: false,
      })
    }

    // Two stat rows
    const mISz  = Math.round(REF * 0.025)
    const mLblSz = Math.round(REF * 0.015)
    const r1Y    = MINI_Y + ROUTH + Math.round(MP * 0.9)
    const r2Y    = r1Y + Math.round(MINI_H * 0.205)

    const mRows = [
      { icon: 'distance',  v: (stats?.totalDist ?? 0).toFixed(1) + ' km' },
      { icon: 'elevation', v: (stats?.elevGain ?? 0) + ' m' },
    ]
    mRows.forEach((mr, i) => {
      const ry = i === 0 ? r1Y : r2Y
      drawStatsIcon(ctx, mr.icon, INSET_X + MP, ry, mISz, `rgba(${ar},${ag},${ab},0.72)`)
      ctx.font = `600 ${mLblSz}px ${FONT}`
      ctx.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,0.65)'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(mr.v, INSET_X + MP + mISz + Math.round(MP * 0.5), ry + mISz * 0.5)
    })
  }

  // ── Bottom timeline strip ─────────────────────────────────────────────────
  const SG = ctx.createLinearGradient(0, CHART_H, 0, H)
  SG.addColorStop(0, 'rgba(0,0,0,0.84)')
  SG.addColorStop(1, 'rgba(0,0,0,0.94)')
  ctx.fillStyle = SG; ctx.fillRect(0, CHART_H, W, STRIP_H)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, CHART_H, W, 1)

  const SCRUB_Y  = CHART_H + Math.round(STRIP_H * 0.30)
  const SCRUB_L  = PAD
  const SCRUB_R  = W - PAD
  const SCRUB_W  = SCRUB_R - SCRUB_L
  const TRK_H    = Math.max(2, Math.round(REF * 0.003))
  const DOT_R    = Math.round(REF * 0.014)

  // Track
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(SCRUB_L, SCRUB_Y - TRK_H / 2, SCRUB_W, TRK_H)
  // Progress fill (shows 62% as visual default)
  const PROG = 0.62
  ctx.fillStyle = 'rgba(255,255,255,0.68)'
  ctx.fillRect(SCRUB_L, SCRUB_Y - TRK_H / 2, Math.round(SCRUB_W * PROG), TRK_H)
  // Accent-coloured active segment dot
  const PH_X = SCRUB_L + Math.round(SCRUB_W * PROG)
  ctx.beginPath(); ctx.arc(PH_X, SCRUB_Y, DOT_R * 1.6, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill()
  // End dot
  ctx.beginPath(); ctx.arc(SCRUB_R, SCRUB_Y, DOT_R, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fill()
  // Start dot
  ctx.beginPath(); ctx.arc(SCRUB_L, SCRUB_Y, DOT_R, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.fill()

  // Time/distance markers
  const NUM_M   = isLS ? 8 : 5
  const MARK_Y  = SCRUB_Y + DOT_R * 2.2 + Math.round(REF * 0.010)
  const mSz     = Math.round(REF * 0.016)
  for (let i = 0; i < NUM_M; i++) {
    const fx  = SCRUB_L + (i / (NUM_M - 1)) * SCRUB_W
    const fi  = Math.round((i / (NUM_M - 1)) * (pts.length - 1))
    const pt  = pts[fi]
    let lbl   = ''
    if (pt?.time) {
      lbl = pt.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } else {
      lbl = ((stats?.totalDist ?? 0) * (i / (NUM_M - 1))).toFixed(1) + 'k'
    }
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fillRect(fx - 0.5, SCRUB_Y - DOT_R - Math.round(PAD * 0.22), 1, Math.round(PAD * 0.20))
    ctx.font = `400 ${mSz}px ${FONT}`
    ctx.fillStyle = i === 0 || i === Math.floor(NUM_M * PROG)
      ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.35)'
    ctx.textAlign = i === 0 ? 'left' : (i === NUM_M - 1 ? 'right' : 'center')
    ctx.textBaseline = 'top'
    ctx.fillText(lbl, fx, MARK_Y)
  }

  // Activity name + date in bottom-right of strip
  const startPt = pts.find(p => p.time)
  const aSz     = Math.round(REF * 0.018)
  ctx.font = `300 ${aSz}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
  let nameStr = name || 'Activity'
  if (ctx.measureText(nameStr).width > SCRUB_W * 0.38) {
    while (ctx.measureText(nameStr).width > SCRUB_W * 0.38 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    nameStr += '…'
  }
  ctx.fillText(nameStr, W - PAD, H - Math.round(PAD * 0.35))
  if (startPt?.time) {
    ctx.fillStyle = 'rgba(255,255,255,0.20)'
    const dateStr = startPt.time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    ctx.fillText(dateStr, W - PAD, H - Math.round(PAD * 0.35) - aSz - Math.round(aSz * 0.18))
  }

  if (!isPhoto) drawFooter(ctx, W, H)
}

// ── Activity Stats icon set ───────────────────────────────────────────────────

function drawStatsIcon(ctx, type, x, y, size, color) {
  ctx.save()
  const lw = Math.max(1.2, size * 0.10)
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const cx = x + size / 2, cy = y + size / 2

  switch (type) {
    case 'distance': {
      const py = y + size * 0.32, pr = size * 0.22
      ctx.beginPath(); ctx.arc(cx, py, pr, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - pr * 0.92, py)
      ctx.bezierCurveTo(cx - pr * 0.92, py + pr * 1.0, cx, y + size * 0.92, cx, y + size * 0.92)
      ctx.bezierCurveTo(cx + pr * 0.92, py + pr * 1.0, cx + pr * 0.92, py, cx + pr * 0.92, py)
      ctx.stroke()
      break
    }
    case 'duration': {
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - size * 0.24); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + size * 0.17, cy + size * 0.08); ctx.stroke()
      break
    }
    case 'elevation': {
      ctx.beginPath()
      ctx.moveTo(cx, y + size * 0.10)
      ctx.lineTo(x + size * 0.91, y + size * 0.88)
      ctx.lineTo(x + size * 0.09, y + size * 0.88)
      ctx.closePath(); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, y + size * 0.10)
      ctx.lineTo(cx + size * 0.14, y + size * 0.36)
      ctx.lineTo(cx - size * 0.14, y + size * 0.36)
      ctx.closePath()
      ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1
      break
    }
    case 'speed': {
      ctx.beginPath(); ctx.arc(cx, cy + size * 0.06, size * 0.40, Math.PI * 0.82, Math.PI * 0.18); ctx.stroke()
      const na = Math.PI * 1.38
      ctx.beginPath()
      ctx.moveTo(cx, cy + size * 0.06)
      ctx.lineTo(cx + Math.cos(na) * size * 0.28, cy + size * 0.06 + Math.sin(na) * size * 0.28)
      ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy + size * 0.06, lw * 1.4, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'maxspeed': {
      // Lightning bolt
      ctx.beginPath()
      ctx.moveTo(cx + size * 0.08, y + size * 0.06)
      ctx.lineTo(cx - size * 0.26, cy + size * 0.06)
      ctx.lineTo(cx + size * 0.02, cy - size * 0.02)
      ctx.lineTo(cx - size * 0.08, y + size * 0.94)
      ctx.lineTo(cx + size * 0.26, cy - size * 0.06)
      ctx.lineTo(cx - size * 0.02, cy + size * 0.02)
      ctx.closePath(); ctx.fill()
      break
    }
  }
  ctx.restore()
}

// ── Activity Stats panel (shared by standalone, overlay and full modes) ────────

function drawStatsPanel(ctx, pts, stats, name, accent, ar, ag, ab, W, H, theme) {
  const isLS     = W > H * 1.1
  const REF      = Math.min(W, H)
  const PAD      = Math.round(REF * 0.052)
  const RADIUS   = Math.round(REF * 0.038)
  const isSolid  = !theme.cardBg || theme.cardBg === 'transparent'

  const maxSpd = pts.length > 0 ? Math.max(...pts.map(p => p.speedSmooth ?? 0)) : 0
  const movingMs = computeMovingTime(pts)
  const rows = [
    { icon: 'distance',  l: 'Distance',      v: (stats?.totalDist ?? 0).toFixed(1),            u: 'km'   },
    { icon: 'duration',  l: 'Duration',       v: fmtHMS(stats?.totalTime ?? 0),                 u: ''     },
    { icon: 'elevation', l: 'Elevation Gain', v: String(stats?.elevGain ?? 0),                  u: 'm'    },
    { icon: 'speed',     l: 'Avg Speed',      v: (stats?.avgSpeed ?? 0).toFixed(1),             u: 'km/h' },
    { icon: 'maxspeed',  l: 'Max Speed',      v: (stats?.maxSpeed ?? maxSpd).toFixed(1),        u: 'km/h' },
  ]

  if (isLS) {
    // Landscape: left half = route, right half = stats card
    const ROUTE_W = Math.round(W * 0.46)
    const CARD_X  = ROUTE_W + PAD
    const CARD_W  = W - CARD_X - PAD
    const CARD_H  = H - PAD * 2

    drawRoute(ctx, pts, PAD, PAD, ROUTE_W - PAD, H - PAD * 2, accent, theme.routeTheme ?? {
      routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false,
    })

    if (!isSolid) {
      rrect(ctx, CARD_X, PAD, CARD_W, CARD_H, RADIUS)
      ctx.fillStyle = theme.cardBg; ctx.fill()
      rrect(ctx, CARD_X, PAD, CARD_W, CARD_H, RADIUS)
      ctx.strokeStyle = theme.cardBorder || 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke()
    }
    _drawStatsRows(ctx, rows, pts, stats, name, accent, ar, ag, ab, CARD_X, PAD, CARD_W, CARD_H, theme, RADIUS)

  } else {
    // Portrait/square: top = route thumbnail + header, bottom = rows
    const ROUTE_SZ  = Math.round(REF * 0.22)
    const HDR_H     = ROUTE_SZ + PAD * 2
    const CONTENT_Y = HDR_H
    const CONTENT_H = H - CONTENT_Y

    if (!isSolid) {
      rrect(ctx, 0, 0, W, H, RADIUS)
      ctx.fillStyle = theme.cardBg; ctx.fill()
      rrect(ctx, 0, 0, W, H, RADIUS)
      ctx.strokeStyle = theme.cardBorder || 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke()
    }

    // Route circle at top-right
    if (pts.length > 1) {
      const rx = W - ROUTE_SZ - PAD, ry = PAD
      ctx.save()
      ctx.beginPath(); ctx.arc(rx + ROUTE_SZ / 2, ry + ROUTE_SZ / 2, ROUTE_SZ / 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.08)`; ctx.fill(); ctx.clip()
      drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, {
        routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false,
      })
      ctx.restore()
    }

    // Header text at top-left
    const headerSz = Math.round(REF * 0.040)
    const titleSz  = Math.round(REF * 0.028)
    ctx.font = `700 ${headerSz}px ${FONT}`
    ctx.fillStyle = theme.valueColor || '#fff'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.shadowColor = theme.shadowColor || 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8
    let nameStr = name || 'Activity'
    while (ctx.measureText(nameStr).width > W - ROUTE_SZ - PAD * 3 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    if (nameStr !== (name || 'Activity')) nameStr += '…'
    ctx.fillText(nameStr, PAD, PAD)
    ctx.shadowBlur = 0

    ctx.font = `500 ${titleSz}px ${FONT}`
    ctx.fillStyle = theme.headerColor || 'rgba(255,255,255,0.42)'
    ctx.fillText('ACTIVITY STATS', PAD, PAD + headerSz * 1.35)

    // Accent rule
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.50)`
    ctx.fillRect(PAD, PAD + headerSz * 1.35 + titleSz + Math.round(titleSz * 0.35), Math.round(W * 0.14), Math.max(1, Math.round(REF * 0.003)))

    // Divider line before rows
    ctx.fillStyle = theme.divider || 'rgba(255,255,255,0.06)'
    ctx.fillRect(PAD, CONTENT_Y - 1, W - PAD * 2, 1)

    _drawStatsRows(ctx, rows, pts, stats, name, accent, ar, ag, ab, 0, CONTENT_Y, W, CONTENT_H, theme, 0)
  }
}

function _drawStatsRows(ctx, rows, pts, stats, name, accent, ar, ag, ab, x, y, w, h, theme, radius) {
  const PAD    = Math.round(Math.min(w, h) * 0.055)
  const rowH   = h / rows.length
  const valSz  = Math.round(Math.min(rowH * 0.42, w * 0.10))
  const lblSz  = Math.round(valSz * 0.52)
  const iconSz = Math.round(valSz * 0.72)
  const unitSz = Math.round(valSz * 0.52)

  rows.forEach((row, i) => {
    const ry = y + i * rowH
    const cy = ry + rowH / 2

    if (i > 0) {
      ctx.fillStyle = theme.divider || 'rgba(255,255,255,0.06)'
      ctx.fillRect(x + PAD, ry, w - PAD * 2, 1)
    }

    // Icon
    const iconX = x + PAD
    drawStatsIcon(ctx, row.icon, iconX, cy - iconSz / 2, iconSz, `rgba(${ar},${ag},${ab},0.70)`)

    // Label
    ctx.font = `400 ${lblSz}px ${FONT}`
    ctx.fillStyle = theme.labelColor || 'rgba(255,255,255,0.38)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(row.l, iconX + iconSz + Math.round(iconSz * 0.38), cy)

    // Value + unit right-aligned
    const rightX = x + w - PAD
    if (row.u) {
      ctx.font = `500 ${unitSz}px ${FONT}`
      ctx.fillStyle = theme.unitColor || `rgba(${ar},${ag},${ab},0.85)`
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(row.u, rightX, cy + Math.round(valSz * 0.09))
      const uW = ctx.measureText(row.u).width + Math.round(valSz * 0.08)
      ctx.font = `700 ${valSz}px ${FONT}`
      ctx.fillStyle = theme.valueColor || '#fff'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(row.v, rightX - uW, cy)
    } else {
      ctx.font = `700 ${valSz}px ${FONT}`
      ctx.fillStyle = theme.valueColor || '#fff'
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(row.v, rightX, cy)
    }
  })
}

// ── Integrated: Stats card floating over photo ────────────────────────────────

function drawIntStats(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isLS   = W > H * 1.1
  const REF    = Math.min(W, H)
  const PAD    = Math.round(REF * 0.038)
  const RADIUS = Math.round(REF * 0.030)

  const CARD_W = Math.round(W * (isLS ? 0.36 : 0.62))
  const CARD_H = Math.round(H * (isLS ? 0.78 : 0.52))
  const CARD_X = W - CARD_W - PAD
  const CARD_Y = atBottom ? H - CARD_H - PAD : PAD

  // Soft shadow behind the card
  const rg = ctx.createRadialGradient(
    CARD_X + CARD_W / 2, CARD_Y + CARD_H / 2, 0,
    CARD_X + CARD_W / 2, CARD_Y + CARD_H / 2, CARD_W * 0.95,
  )
  rg.addColorStop(0, 'rgba(0,0,0,0.40)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rg
  ctx.fillRect(CARD_X - PAD, CARD_Y - PAD, CARD_W + PAD * 2, CARD_H + PAD * 2)

  const cardTheme = {
    cardBg:      'rgba(10,11,14,0.84)',
    cardBorder:  'rgba(255,255,255,0.08)',
    headerColor: 'rgba(255,255,255,0.45)',
    labelColor:  'rgba(255,255,255,0.40)',
    valueColor:  '#fff',
    unitColor:   `rgba(${ar},${ag},${ab},0.85)`,
    divider:     'rgba(255,255,255,0.06)',
    shadowColor: 'rgba(0,0,0,0.80)',
  }

  // Card background
  rrect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, RADIUS)
  ctx.fillStyle = cardTheme.cardBg; ctx.fill()
  rrect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, RADIUS)
  ctx.strokeStyle = cardTheme.cardBorder; ctx.lineWidth = 1; ctx.stroke()

  // "ACTIVITY STATS" header inside card
  const innerPad = Math.round(REF * 0.030)
  const hdrSz    = Math.round(REF * 0.028)
  ctx.font = `500 ${hdrSz}px ${FONT}`
  ctx.fillStyle = cardTheme.headerColor
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillText('ACTIVITY STATS', CARD_X + innerPad, CARD_Y + innerPad)

  // Accent underline
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.50)`
  ctx.fillRect(CARD_X + innerPad, CARD_Y + innerPad + hdrSz + Math.round(hdrSz * 0.32), Math.round(CARD_W * 0.28), Math.max(1, Math.round(REF * 0.003)))

  const rowsY = CARD_Y + innerPad + hdrSz + Math.round(hdrSz * 0.32) + Math.round(hdrSz * 0.55)
  const rowsH = CARD_H - (rowsY - CARD_Y) - innerPad * 0.5

  const maxSpd = pts.length > 0 ? Math.max(...pts.map(p => p.speedSmooth ?? 0)) : 0
  const rows = [
    { icon: 'distance',  l: 'Distance',      v: (stats?.totalDist ?? 0).toFixed(1),              u: 'km'   },
    { icon: 'duration',  l: 'Duration',       v: fmtHMS(stats?.totalTime ?? 0),                   u: ''     },
    { icon: 'elevation', l: 'Elevation Gain', v: String(stats?.elevGain ?? 0),                    u: 'm'    },
    { icon: 'speed',     l: 'Avg Speed',      v: (stats?.avgSpeed ?? 0).toFixed(1),               u: 'km/h' },
    { icon: 'maxspeed',  l: 'Max Speed',      v: (stats?.maxSpeed ?? maxSpd).toFixed(1),          u: 'km/h' },
  ]

  _drawStatsRows(ctx, rows, pts, stats, null, accent, ar, ag, ab, CARD_X, rowsY, CARD_W, rowsH, cardTheme, 0)

  // Route thumbnail in opposite corner
  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_SZ = Math.round(REF * (isLS ? 0.16 : 0.14))
    const rx = PAD, ry = atBottom ? PAD : H - ROUTE_SZ - PAD
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ / 2, ry + ROUTE_SZ / 2, ROUTE_SZ / 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.45)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }
}

function drawFooter(ctx, W, H) {
  const ICON_H  = Math.max(10, Math.round(Math.min(W, H) * 0.029))
  const txtSz   = Math.max(8, Math.round(ICON_H * 0.71))
  const LABEL   = 'gpx2video'
  ctx.font      = `500 ${txtSz}px ${FONT}`
  const lw      = ctx.measureText(LABEL).width
  const totalW  = ICON_H + Math.round(ICON_H * 0.29) + lw
  const logoX   = W / 2 - totalW / 2
  const logoY   = H - Math.round(ICON_H * 0.14) - ICON_H
  drawLogoMark(ctx, logoX, logoY, ICON_H, 0.4)
  ctx.font = `500 ${txtSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = Math.round(ICON_H * 0.29)
  ctx.fillText(LABEL, logoX + ICON_H + Math.round(ICON_H * 0.29), logoY + ICON_H / 2)
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
}

// ── Utility ───────────────────────────────────────────────────────────────────

function computeMovingTime(pts) {
  let ms = 0
  for (let i = 1; i < pts.length; i++) {
    if (pts[i-1].time && pts[i].time && pts[i].speedSmooth > 0.5)
      ms += pts[i].time - pts[i-1].time
  }
  return ms
}

function fmtHMS(ms) {
  if (!ms || ms <= 0) return '--:--'
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

function fmtHM(ms) {
  if (!ms || ms <= 0) return '--'
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function hexRgb(hex) {
  const h = (hex || '#f59e0b').replace('#', '')
  return { r: parseInt(h.slice(0,2),16)||245, g: parseInt(h.slice(2,4),16)||158, b: parseInt(h.slice(4,6),16)||11 }
}

function drawLogoMark(ctx, x, y, size, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha
  const r = size * 0.22
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.arcTo(x+size,y,      x+size,y+size, r)
  ctx.arcTo(x+size,y+size, x,    y+size, r)
  ctx.arcTo(x,    y+size,  x,    y,      r)
  ctx.arcTo(x,    y,       x+size,y,     r)
  ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x+size*0.30,y+size*0.22)
  ctx.lineTo(x+size*0.30,y+size*0.78)
  ctx.lineTo(x+size*0.80,y+size*0.50)
  ctx.closePath(); ctx.fillStyle = '#ff7a3a'; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x+size*0.08,y+size*0.84)
  ctx.bezierCurveTo(x+size*0.22,y+size*0.72, x+size*0.38,y+size*0.78, x+size*0.52,y+size*0.64)
  ctx.bezierCurveTo(x+size*0.62,y+size*0.54, x+size*0.72,y+size*0.60, x+size*0.92,y+size*0.40)
  ctx.strokeStyle = '#3a8fff'; ctx.lineWidth = Math.max(1.5, size*0.09)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.restore()
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2)
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.arcTo(x+w,y,   x+w,y+h, r)
  ctx.arcTo(x+w,y+h, x,  y+h, r)
  ctx.arcTo(x,  y+h, x,  y,   r)
  ctx.arcTo(x,  y,   x+w,y,   r)
  ctx.closePath()
}
</script>

<style scoped>
.sticker-wrap {
  position: relative;
  flex-shrink: 0;
}

.sticker-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .45rem .85rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .04em;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
  white-space: nowrap;
}
.sticker-btn:hover { border-color: var(--accent-semi); color: var(--accent); }
.sticker-btn--on   { border-color: var(--accent-semi); color: var(--accent); background: var(--accent-dim); }
.sticker-btn svg   { width: 13px; height: 13px; flex-shrink: 0; }

/* ── Full-page sticker editor shell ──────────────────────────────────────── */
.fp-shell {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  background: #0d0d0d;
  color: var(--text, #e8e8e8);
}

/* Header */
.fp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  padding-top: max(0px, env(safe-area-inset-top, 0px));
  height: 52px;
  border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.09));
  background: var(--bg2, #161616);
  flex-shrink: 0;
  gap: 12px;
}
.fp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #e8e8e8);
  letter-spacing: .02em;
}
.fp-title svg { color: var(--accent, #f59e0b); }

.fp-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fp-dl-btn {
  display: none;
  align-items: center;
  gap: 6px;
  padding: .42rem 1rem;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-md, 8px);
  border: 0.5px solid var(--border2, rgba(255,255,255,0.1));
  background: var(--bg3, #222);
  color: var(--text2, #aaa);
  cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
  white-space: nowrap;
}
.fp-dl-btn:hover { background: var(--bg4, #2a2a2a); color: var(--text, #e8e8e8); border-color: var(--border, rgba(255,255,255,0.18)); }
.fp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border: none;
  background: var(--bg3, #222);
  border-radius: 50%;
  color: var(--text2, #aaa);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .12s, color .12s;
}
.fp-close:hover { background: var(--bg4, #2a2a2a); color: var(--text, #e8e8e8); }
.fp-close svg { width: 13px; height: 13px; }

/* Body: sidebar + preview */
.fp-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* Sidebar — hidden on mobile, visible on desktop */
.fp-sidebar {
  display: none;
}

/* Canvas preview area */
.fp-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #080808;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}
.fp-canvas-wrap {
  border-radius: 12px;
  overflow: hidden;
  border: 0.5px solid rgba(255,255,255,0.08);
  background-image: repeating-conic-gradient(rgba(255,255,255,0.035) 0% 25%, transparent 0% 50%);
  background-size: 14px 14px;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fp-canvas {
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - 52px - 40px);
  height: auto;
}

/* fp-section labels (used inside sidebar) */
.fp-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.fp-section-lbl {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--text3, #666);
}

/* ── Desktop layout (≥ 700 px) ───────────────────────────────────────────── */
@media (min-width: 700px) {
  .fp-dl-btn { display: flex; }

  .fp-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 320px;
    flex-shrink: 0;
    padding: 0;
    border-right: 0.5px solid var(--border, rgba(255,255,255,0.08));
    background: var(--bg2, #161616);
    overflow: hidden;
  }

  .fp-tab-bar {
    display: flex;
    gap: 0;
    padding: 10px 14px 0;
    border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.08));
    flex-shrink: 0;
    background: var(--bg2, #161616);
  }

  .fp-tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: .5rem .9rem;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: .01em;
    border: none;
    background: transparent;
    color: var(--text3, #555);
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    transition: color .14s;
    white-space: nowrap;
  }
  .fp-tab:hover { color: var(--text2, #aaa); }
  .fp-tab--on {
    color: var(--text, #e8e8e8);
  }
  .fp-tab--on::after {
    content: '';
    position: absolute;
    bottom: -0.5px;
    left: 0; right: 0;
    height: 2px;
    background: var(--accent, #f59e0b);
    border-radius: 2px 2px 0 0;
  }
  .fp-tab-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent, #f59e0b);
    flex-shrink: 0;
  }

  .fp-tab-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 16px 20px;
  }
  .fp-tab-content > .fp-section { margin-bottom: 16px; }
  .fp-tab-content > .fp-section:last-child { margin-bottom: 0; }

  .fp-divider {
    height: 0.5px;
    background: var(--border, rgba(255,255,255,0.08));
    margin: 4px 0 16px;
    flex-shrink: 0;
  }

  .fp-preview {
    padding: 32px 40px;
  }

  .fp-canvas {
    max-height: calc(100dvh - 52px - 64px);
    box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
  }

  /* Hide mobile-only elements */
  .sm-nav  { display: none !important; }
  .sm-panel { display: none !important; }
}

/* ── sm-panel / sm-nav kept for mobile ───────────────────────────────────── */
/* Header */
.sm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: max(12px, env(safe-area-inset-top, 0px));
  border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.1));
  background: var(--bg2, #1a1a1a);
  flex-shrink: 0;
}
.sm-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: .02em;
}
.sm-title svg { color: var(--accent, #f59e0b); }
.sm-close {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: none;
  background: var(--bg3, #222);
  border-radius: 50%;
  color: var(--text2);
  cursor: pointer;
  flex-shrink: 0;
}
.sm-close svg { width: 13px; height: 13px; }

/* Preview (mobile) */
.sm-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #0a0a0a;
  padding: 14px;
  min-height: 0;
}
.sm-canvas-wrap {
  border-radius: 10px;
  overflow: hidden;
  border: 0.5px solid rgba(255,255,255,0.08);
  background-image: repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%);
  background-size: 12px 12px;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sm-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

/* Tool panel */
.sm-panel {
  flex-shrink: 0;
  background: var(--bg2, #1a1a1a);
  border-top: 0.5px solid var(--border, rgba(255,255,255,0.1));
  padding: 0 16px 16px;
  max-height: 42vh;
  overflow-y: auto;
}
.sm-panel-handle {
  width: 36px; height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
  margin: 10px auto 14px;
  flex-shrink: 0;
}
.sm-panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sm-panel-lbl {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text3);
  margin: 0;
}

/* Chip row */
.sm-chips {
  display: flex;
  gap: 7px;
  flex-wrap: nowrap;
}
.sm-chips--wrap { flex-wrap: wrap; }
.sm-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: .42rem .9rem;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  border: 0.5px solid var(--border2, rgba(255,255,255,0.1));
  background: var(--bg3, #222);
  color: var(--text2);
  cursor: pointer;
  white-space: nowrap;
  transition: background .12s, color .12s, border-color .12s;
  flex: 1;
  justify-content: center;
}
.sm-chip:hover { color: var(--text); background: var(--bg4, #2a2a2a); }
.sm-chip.on {
  background: rgba(245,158,11,0.14);
  color: var(--accent, #f59e0b);
  border-color: rgba(245,158,11,0.38);
}

/* Control rows */
.sm-ctrl-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sm-ctrl-row--top { align-items: flex-start; }
.sm-ctrl-lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
  min-width: 52px;
}
.sm-ctrl-val { color: var(--text2); font-weight: 700; text-transform: none; }
.sm-drag-hint {
  font-size: 10px;
  color: var(--text3);
  text-align: center;
  margin-top: -4px;
}

/* Panel slide-up transition */
.sm-slide-enter-active { transition: transform .22s cubic-bezier(0.25,0.46,0.45,0.94), opacity .16s; }
.sm-slide-leave-active { transition: transform .18s cubic-bezier(0.55,0,1,0.45), opacity .14s; }
.sm-slide-enter-from,
.sm-slide-leave-to { transform: translateY(100%); opacity: 0; }

/* Bottom navigation */
.sm-nav {
  display: flex;
  align-items: stretch;
  background: var(--bg2, #1a1a1a);
  border-top: 0.5px solid var(--border, rgba(255,255,255,0.1));
  padding: 4px 6px;
  padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
  gap: 2px;
}
.sm-nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 4px 5px;
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 10px;
  transition: color .12s, background .12s;
  min-width: 0;
}
.sm-nav-btn svg { width: 21px; height: 21px; flex-shrink: 0; }
.sm-nav-btn span { line-height: 1; white-space: nowrap; }
.sm-nav-btn:hover { color: var(--text2); }
.sm-nav-btn.active {
  color: var(--accent, #f59e0b);
  background: rgba(245,158,11,0.1);
}
.sm-nav-save {
  color: var(--text);
  background: rgba(255,255,255,0.07);
}
.sm-nav-save:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* ── Mode tabs ───────────────────────────────────────────────────────────── */
/* ── Embed upload zone ────────────────────────────────────────────────────── */
.embed-upload {
  border: 1.5px dashed var(--border2);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  background: var(--bg3, #1e1e1e);
  transition: border-color .15s, background .15s;
  min-height: 80px;
  text-align: center;
}
.embed-upload:hover,
.embed-upload--dragging {
  border-color: var(--accent-blue);
  background: #1a2233;
}
.embed-upload--loaded {
  padding: .4rem .75rem;
  border-style: solid;
  border-color: var(--border);
  min-height: unset;
  flex-direction: row;
  gap: 6px;
  justify-content: flex-start;
}
.embed-upload--loaded svg {
  width: 14px;
  height: 14px;
  color: var(--text3);
  flex-shrink: 0;
}
.embed-upload svg {
  width: 22px; height: 22px;
  color: var(--text3);
}
.embed-upload-label {
  font-size: 12px;
  color: var(--text2);
}
.embed-upload-filename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.embed-link { color: var(--accent-blue); }
.embed-upload-hint {
  font-size: 10px;
  color: var(--text3);
}
.embed-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-radius: 50%;
  transition: background .12s, color .12s;
  padding: 0;
}
.embed-clear-btn:hover { background: rgba(255,255,255,0.08); color: var(--text); }
.embed-clear-btn svg { width: 10px; height: 10px; }
.embed-drag-hint {
  font-size: 10px;
  color: var(--text3);
  text-align: center;
  margin-top: -2px;
}
/* ── Embed style toggle ──────────────────────────────────────────────────── */
.embed-style-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg3, #1e1e1e);
  border-radius: var(--radius-md);
  padding: 3px;
  flex-wrap: nowrap;
}
.embed-style-tabs--3 .embed-style-tab { font-size: 10px; padding: .38rem .3rem; gap: 4px; }
.embed-style-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: .38rem .5rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .03em;
  border-radius: calc(var(--radius-md) - 2px);
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: background .12s, color .12s;
  white-space: nowrap;
}
.embed-style-tab svg { width: 14px; height: 14px; flex-shrink: 0; }
.embed-style-tab:hover { color: var(--text2); }
.embed-style-tab--on { background: var(--bg2, #1a1a1a); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.4); }

/* ── Integrated position tabs ─────────────────────────────────────────────── */
.integrated-pos-tabs { display: flex; gap: 4px; flex-wrap: nowrap; }
.integrated-pos-tabs--wrap { flex-wrap: wrap; }
.int-pos-btn {
  padding: .25rem .6rem;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border2);
  background: var(--bg3);
  color: var(--text3);
  cursor: pointer;
  transition: color .12s, background .12s;
}
.int-pos-btn:hover { color: var(--text2); }
.int-pos-btn--on {
  background: rgba(245,158,11,0.12);
  color: var(--accent, #f59e0b);
  border-color: rgba(245,158,11,0.35);
  font-weight: 700;
}

/* ── Toggle switch ────────────────────────────────────────────────────────── */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text2);
  cursor: pointer;
  user-select: none;
}
.toggle-label input { display: none; }
.toggle-track {
  width: 28px; height: 16px;
  background: var(--bg4, #2a2a2a);
  border: 0.5px solid var(--border2);
  border-radius: 8px;
  position: relative;
  transition: background .15s;
  flex-shrink: 0;
}
.toggle-label input:checked ~ .toggle-track { background: var(--accent-blue, #3b82f6); border-color: transparent; }
.toggle-thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #fff;
  transition: left .15s;
}
.toggle-label input:checked ~ .toggle-track .toggle-thumb { left: 14px; }

/* ── Embed controls ──────────────────────────────────────────────────────── */
.embed-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.embed-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.embed-ctrl-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .05em;
  white-space: nowrap;
  min-width: 58px;
}
.embed-ctrl-val {
  color: var(--text2);
  font-weight: 700;
  text-transform: none;
}
.embed-slider {
  flex: 1;
  accent-color: var(--accent-blue);
  cursor: pointer;
}
.embed-change-btn {
  font-size: 10px;
  padding: .28rem .6rem;
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border2);
  background: var(--bg3);
  color: var(--text3);
  cursor: pointer;
  align-self: flex-start;
  transition: color .12s;
}
.embed-change-btn:hover { color: var(--text2); }

/* ── Position picker grid ────────────────────────────────────────────────── */
.pos-grid {
  display: grid;
  grid-template-columns: repeat(3, 20px);
  gap: 3px;
}
.pos-btn {
  width: 20px; height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border2);
  background: var(--bg3);
  cursor: pointer;
  transition: background .1s, border-color .1s;
}
.pos-btn:hover { background: var(--bg4, #252525); border-color: var(--border); }
.pos-btn--on   { background: var(--accent-blue); border-color: var(--accent-blue); }

/* ── Orientation ─────────────────────────────────────────────────────────── */
.sticker-orient {
  display: flex;
  gap: 5px;
}

.orient-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: .45rem .35rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border2);
  background: var(--bg3, #1e1e1e);
  color: var(--text3);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.orient-btn svg   { width: 16px; height: 16px; flex-shrink: 0; }
.orient-btn:hover { color: var(--text2); background: var(--bg4, #252525); }
.orient-btn--on   { background: var(--bg4, #252525); color: var(--text); border-color: var(--border); }

/* ── Format ──────────────────────────────────────────────────────────────── */
.sticker-formats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.format-btn {
  flex: 1 1 calc(33% - 3px);
  min-width: 0;
  padding: .32rem .3rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  text-align: center;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border2);
  background: var(--bg3, #1e1e1e);
  color: var(--text3);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.format-btn:hover { color: var(--text2); background: var(--bg4, #252525); }
.format-btn--on   {
  background: rgba(245,158,11,0.12);
  color: var(--accent, #f59e0b);
  border-color: rgba(245,158,11,0.35);
  font-weight: 700;
}

/* ── Preview ─────────────────────────────────────────────────────────────── */
.sticker-preview-wrap {
  border-radius: 8px;
  overflow: hidden;
  border: 0.5px solid var(--border2, rgba(255,255,255,0.07));
  background-image: repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%);
  background-size: 12px 12px;
}

.sticker-canvas {
  display: block;
  height: auto;
  /* On mobile the panel fills the screen width — let the canvas fill it */
  max-width: 100%;
}

.sticker-panel-actions {
  display: flex;
}

.sticker-dl-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .5rem 1rem;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border2);
  background: var(--bg3, #222);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
  justify-content: center;
}
.sticker-dl-btn:hover { background: var(--bg4, #2a2a2a); }
.sticker-dl-btn svg   { width: 13px; height: 13px; flex-shrink: 0; }
</style>
