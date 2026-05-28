<template>
  <div class="sticker-wrap" ref="wrapRef">
    <button class="sticker-btn" :class="{ 'sticker-btn--on': open }" @click="toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z"/>
      </svg>
      Sticker
    </button>

    <Teleport to="body">
      <div v-if="open && !isMobile" class="sticker-backdrop" @click.self="toggle" />
    </Teleport>

    <Teleport to="body">
      <div v-if="open && !isMobile" class="sticker-dialog" ref="dialogRef">

        <!-- Dialog header -->
        <div class="dialog-header">
          <span class="dialog-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10 1.5l2 6.2H18l-5.2 3.8 2 6.2L10 14l-4.8 3.7 2-6.2L2 7.7h6z"/>
            </svg>
            Sticker
          </span>
          <button class="dialog-close" @click="toggle" title="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </div>

        <div class="dialog-body">
          <!-- Left column: controls -->
          <div class="dialog-controls">

            <!-- Orientation -->
            <div class="ctrl-section">
              <span class="ctrl-section-label">Orientation</span>
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

            <!-- Format -->
            <div class="ctrl-section">
              <span class="ctrl-section-label">Format</span>
              <div class="sticker-formats">
                <button
                  v-for="f in FORMAT_OPTIONS" :key="f.key"
                  :class="['format-btn', { 'format-btn--on': stickerFormat === f.key }]"
                  @click="setFormat(f.key)"
                >{{ f.label }}</button>
              </div>
            </div>

            <!-- Photo upload -->
            <div class="ctrl-section">
              <span class="ctrl-section-label">Photo</span>
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
                  <span class="embed-upload-label">{{ bgFileName }}&ensp;<span class="embed-link">change</span></span>
                </template>
                <input ref="bgInputRef" type="file" accept="image/*" style="display:none" @change="onBgPick" />
              </div>
            </div>

            <!-- Embed style toggle — only when photo loaded -->
            <div v-if="bgImageSrc" class="ctrl-section">
              <span class="ctrl-section-label">Style</span>
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

            <!-- Sticker controls -->
            <div v-if="bgImageSrc && embedStyle === 'sticker'" class="ctrl-section embed-controls">
              <div class="embed-row">
                <span class="embed-ctrl-label">Size&nbsp;<span class="embed-ctrl-val">{{ Math.round(stickerScale * 100) }}%</span></span>
                <input
                  class="embed-slider"
                  type="range" min="15" max="70" step="1"
                  :value="Math.round(stickerScale * 100)"
                  @input="stickerScale = Number($event.target.value) / 100; nextTick(draw)"
                />
              </div>
              <div class="embed-row">
                <span class="embed-ctrl-label">Snap</span>
                <div class="pos-grid">
                  <button
                    v-for="p in POSITIONS" :key="p"
                    :class="['pos-btn', { 'pos-btn--on': !dragPos && stickerPos === p }]"
                    :title="p.replace(/-/g,' ')"
                    @click="snapTo(p)"
                  />
                </div>
              </div>
              <span class="embed-drag-hint">or drag the sticker on the preview</span>
            </div>

            <!-- Integrated controls -->
            <div v-if="bgImageSrc && embedStyle === 'integrated'" class="ctrl-section embed-controls">
              <div class="embed-row">
                <span class="embed-ctrl-label">Layout</span>
                <div class="integrated-pos-tabs integrated-pos-tabs--wrap">
                  <button
                    v-for="il in INTEGRATED_LAYOUTS" :key="il.key"
                    :class="['int-pos-btn', { 'int-pos-btn--on': integratedLayout === il.key }]"
                    @click="integratedLayout = il.key; nextTick(draw)"
                  >{{ il.label }}</button>
                </div>
              </div>
              <div class="embed-row">
                <span class="embed-ctrl-label">Position</span>
                <div class="integrated-pos-tabs">
                  <button
                    v-for="ip in INTEGRATED_POSITIONS" :key="ip.key"
                    :class="['int-pos-btn', { 'int-pos-btn--on': integratedPos === ip.key }]"
                    @click="integratedPos = ip.key; nextTick(draw)"
                  >{{ ip.label }}</button>
                </div>
              </div>
              <div class="embed-row">
                <span class="embed-ctrl-label">Route</span>
                <label class="toggle-label">
                  <input type="checkbox" v-model="integratedRoute" @change="nextTick(draw)" />
                  <span class="toggle-track"><span class="toggle-thumb"/></span>
                  Show
                </label>
              </div>
            </div>

            <!-- Download -->
            <div class="sticker-panel-actions">
              <button class="sticker-dl-btn" @click="download">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {{ bgImageSrc ? 'Download photo' : 'Download sticker PNG' }}
              </button>
            </div>

          </div>

          <!-- Right column: canvas preview -->
          <div class="dialog-preview">
            <div class="sticker-preview-wrap" :style="bgImageSrc ? { background: '#111' } : {}">
              <canvas
                ref="canvasRef"
                :width="embedCw"
                :height="embedCh"
                class="sticker-canvas"
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

      </div>
    </Teleport>

    <!-- ── Mobile: full-screen editor ─────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="open && isMobile" class="sm-shell">

        <!-- Header -->
        <div class="sm-header">
          <span class="sm-title">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
              <path d="M10 1.5l2 6.2H18l-5.2 3.8 2 6.2L10 14l-4.8 3.7 2-6.2L2 7.7h6z"/>
            </svg>
            Sticker
          </span>
          <button class="sm-close" @click="toggle">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </div>

        <!-- Always-mounted file input (outside panels so ref stays live) -->
        <input ref="bgInputRef" type="file" accept="image/*" style="display:none" @change="onBgPick" />

        <!-- Preview -->
        <div class="sm-preview">
          <div class="sm-canvas-wrap" :style="bgImageSrc ? { background: '#0a0a0a' } : {}">
            <canvas
              ref="canvasRef"
              :width="embedCw"
              :height="embedCh"
              class="sm-canvas"
              :style="bgImageSrc && embedStyle === 'sticker' ? { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' } : {}"
              @pointerdown="onCanvasPointerDown"
              @pointermove="onCanvasPointerMove"
              @pointerup="onCanvasPointerUp"
              @pointerleave="onCanvasPointerUp"
            />
          </div>
        </div>

        <!-- Tool panel — slides up above nav when a tool is active -->
        <Transition name="sm-slide">
          <div v-if="activeTool" class="sm-panel">
            <div class="sm-panel-handle" />

            <!-- Canvas size / orientation -->
            <div v-if="activeTool === 'orient'" class="sm-panel-body">
              <p class="sm-panel-lbl">Canvas size</p>
              <div class="sm-chips">
                <button
                  v-for="o in ORIENT_OPTIONS" :key="o.key"
                  :class="['sm-chip', { on: orientation === o.key }]"
                  @click="setOrientation(o.key)"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <rect :x="o.rx" :y="o.ry" :width="o.rw" :height="o.rh" rx="1.5"/>
                  </svg>
                  {{ o.label }}
                </button>
              </div>
            </div>

            <!-- Format -->
            <div v-if="activeTool === 'format'" class="sm-panel-body">
              <p class="sm-panel-lbl">Style theme</p>
              <div class="sm-chips sm-chips--wrap">
                <button
                  v-for="f in FORMAT_OPTIONS" :key="f.key"
                  :class="['sm-chip', { on: stickerFormat === f.key }]"
                  @click="setFormat(f.key)"
                >{{ f.label }}</button>
              </div>
            </div>

            <!-- Photo -->
            <div v-if="activeTool === 'photo'" class="sm-panel-body">
              <p class="sm-panel-lbl">Background photo</p>
              <div
                class="embed-upload"
                :class="{ 'embed-upload--dragging': bgDragging, 'embed-upload--loaded': !!bgImageSrc }"
                @click="bgInputRef.click()"
              >
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
                  <span class="embed-upload-label">{{ bgFileName }}&ensp;<span class="embed-link">change</span></span>
                </template>
              </div>
            </div>

            <!-- Style + controls (photo must be loaded) -->
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

              <!-- Sticker controls -->
              <template v-if="embedStyle === 'sticker'">
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Size <span class="sm-ctrl-val">{{ Math.round(stickerScale * 100) }}%</span></span>
                  <input
                    class="embed-slider"
                    type="range" min="15" max="70" step="1"
                    :value="Math.round(stickerScale * 100)"
                    @input="stickerScale = Number($event.target.value) / 100; nextTick(draw)"
                  />
                </div>
                <div class="sm-ctrl-row sm-ctrl-row--top">
                  <span class="sm-ctrl-lbl">Snap</span>
                  <div class="pos-grid">
                    <button
                      v-for="p in POSITIONS" :key="p"
                      :class="['pos-btn', { 'pos-btn--on': !dragPos && stickerPos === p }]"
                      :title="p.replace(/-/g,' ')"
                      @click="snapTo(p)"
                    />
                  </div>
                </div>
                <p class="sm-drag-hint">or drag the sticker on the preview</p>
              </template>

              <!-- Integrated controls -->
              <template v-if="embedStyle === 'integrated'">
                <div class="sm-ctrl-row sm-ctrl-row--top">
                  <span class="sm-ctrl-lbl">Layout</span>
                  <div class="integrated-pos-tabs integrated-pos-tabs--wrap">
                    <button
                      v-for="il in INTEGRATED_LAYOUTS" :key="il.key"
                      :class="['int-pos-btn', { 'int-pos-btn--on': integratedLayout === il.key }]"
                      @click="integratedLayout = il.key; nextTick(draw)"
                    >{{ il.label }}</button>
                  </div>
                </div>
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Position</span>
                  <div class="integrated-pos-tabs">
                    <button
                      v-for="ip in INTEGRATED_POSITIONS" :key="ip.key"
                      :class="['int-pos-btn', { 'int-pos-btn--on': integratedPos === ip.key }]"
                      @click="integratedPos = ip.key; nextTick(draw)"
                    >{{ ip.label }}</button>
                  </div>
                </div>
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Route</span>
                  <label class="toggle-label">
                    <input type="checkbox" v-model="integratedRoute" @change="nextTick(draw)" />
                    <span class="toggle-track"><span class="toggle-thumb"/></span>
                    Show
                  </label>
                </div>
              </template>

              <!-- Full / Backdrop controls -->
              <template v-if="embedStyle === 'backdrop'">
                <div class="sm-ctrl-row">
                  <span class="sm-ctrl-lbl">Theme</span>
                </div>
                <div class="sm-chips sm-chips--wrap">
                  <button
                    v-for="f in FORMAT_OPTIONS" :key="f.key"
                    :class="['sm-chip', { on: stickerFormat === f.key }]"
                    @click="setFormat(f.key)"
                  >{{ f.label }}</button>
                </div>
                <p class="sm-drag-hint">Your photo fills the full sticker area</p>
              </template>
            </div>

          </div>
        </Transition>

        <!-- Bottom navigation -->
        <nav class="sm-nav">
          <!-- Canvas size — only when no photo loaded -->
          <button
            v-if="!bgImageSrc"
            class="sm-nav-btn"
            :class="{ active: activeTool === 'orient' }"
            @click="toggleTool('orient')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="4" width="7" height="10" rx="1.5"/>
              <rect x="14" y="10" width="7" height="10" rx="1.5"/>
            </svg>
            <span>Canvas</span>
          </button>

          <!-- Format -->
          <button
            class="sm-nav-btn"
            :class="{ active: activeTool === 'format' }"
            @click="toggleTool('format')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>
              <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
            <span>Theme</span>
          </button>

          <!-- Photo -->
          <button
            class="sm-nav-btn"
            :class="{ active: activeTool === 'photo' }"
            @click="toggleTool('photo')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <circle cx="8.5" cy="11.5" r="2"/>
              <path d="M3 18l5-5 4 3.5 3-3.5 6 5"/>
            </svg>
            <span>Photo</span>
          </button>

          <!-- Style (only when photo loaded) -->
          <button
            v-if="bgImageSrc"
            class="sm-nav-btn"
            :class="{ active: activeTool === 'style' }"
            @click="toggleTool('style')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 15l5-4.5 4 3 3-4 6 4.5"/>
              <rect x="3" y="15" width="18" height="6" fill="currentColor" opacity=".18" stroke="none"/>
            </svg>
            <span>Style</span>
          </button>

          <!-- Save -->
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
  portrait:  { w: 480, h: 600, previewW: 340 },
  square:    { w: 480, h: 480, previewW: 380 },
  landscape: { w: 720, h: 400, previewW: 520 },
}

const orientation = ref('portrait')
const cw       = computed(() => ORIENT_DIMS[orientation.value].w)
const ch       = computed(() => ORIENT_DIMS[orientation.value].h)
const previewW = computed(() => ORIENT_DIMS[orientation.value].previewW)

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
]

const stickerFormat = ref('classic')
function setFormat(f) { stickerFormat.value = f; nextTick(draw) }

// ── Panel state ───────────────────────────────────────────────────────────────

const open      = ref(false)
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
const EMBED_PREVIEW_W        = 480
const EMBED_PREVIEW_W_MOBILE = 360
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
function loadBgFile(file) {
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
    case 'strava':
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        statLabel:   'rgba(255,255,255,0.55)',
        shadowColor: 'rgba(0,0,0,0.9)',
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
  else                                            drawIntBar(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom)

  drawFooter(ctx, W, H)
}

// ── Integrated: Bar layout (full-width gradient bar) ──────────────────────────
function drawIntBar(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const BAR_H = isPortrait ? Math.round(W * 0.46) : Math.round(H * 0.22)
  const barY  = atBottom ? H - BAR_H : 0

  const grad = ctx.createLinearGradient(0, barY, 0, barY + BAR_H)
  if (atBottom) {
    grad.addColorStop(0,    'rgba(0,0,0,0)')
    grad.addColorStop(0.25, 'rgba(0,0,0,0.60)')
    grad.addColorStop(1,    'rgba(0,0,0,0.88)')
  } else {
    grad.addColorStop(0,    'rgba(0,0,0,0.88)')
    grad.addColorStop(0.75, 'rgba(0,0,0,0.60)')
    grad.addColorStop(1,    'rgba(0,0,0,0)')
  }
  ctx.fillStyle = grad; ctx.fillRect(0, barY, W, BAR_H)

  ctx.fillStyle = accent; ctx.globalAlpha = 0.75
  ctx.fillRect(0, atBottom ? barY : barY + BAR_H - 2, W, 2)
  ctx.globalAlpha = 1

  const shadow   = (b = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }
  const namePad  = Math.round(W * 0.035)

  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_PAD = Math.round(W * 0.03)
    const ROUTE_SZ  = isPortrait ? Math.round(W * 0.20) : Math.round(Math.min(W, H) * 0.28)
    const rx = W - ROUTE_SZ - ROUTE_PAD
    const ry = atBottom ? ROUTE_PAD : H - ROUTE_SZ - ROUTE_PAD
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ/2, ry + ROUTE_SZ/2, ROUTE_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.5)', isNeon: false, sparkBacking: false })
    ctx.restore()
  }

  const movingMs = computeMovingTime(pts)
  const grid4 = [
    { v: (stats?.totalDist ?? 0).toFixed(2), u: 'km',   l: 'Distance'    },
    { v: String(stats?.elevGain ?? 0),        u: 'm',    l: 'Elevation'   },
    { v: fmtHMS(movingMs),                   u: '',     l: 'Moving Time' },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'Avg Speed'   },
  ]

  if (isPortrait) {
    const nameSz  = Math.round(W * 0.044)
    const dateSz  = Math.round(nameSz * 0.72)
    const HDR_H   = Math.round(BAR_H * 0.33)
    const hdrTop  = atBottom ? barY           : barY + BAR_H - HDR_H
    const gridTop = atBottom ? barY + HDR_H   : barY
    const gridH   = BAR_H - HDR_H
    const nameY   = hdrTop + Math.round(HDR_H * (atBottom ? 0.14 : 0.10))

    ctx.font = `700 ${nameSz}px ${FONT}`
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    let nameStr = props.trackName || 'Activity'
    while (ctx.measureText(nameStr).width > W * 0.60 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
    shadow(10); ctx.fillText(nameStr, namePad, nameY); noShadow()

    const startPt = pts.find(p => p.time)
    if (startPt?.time) {
      ctx.font = `500 ${dateSz}px ${FONT}`
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.95)`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; shadow(6)
      ctx.fillText(startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), namePad, nameY + nameSz * 1.28)
      noShadow()
    }

    const colW   = W / 2, rowH = gridH / 2
    const valSz  = Math.round(Math.min(W * 0.09, colW * 0.40))
    const unitSz = Math.round(valSz * 0.44), lblSz = Math.round(valSz * 0.34)

    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W / 2, gridTop + rowH * 0.15); ctx.lineTo(W / 2, gridTop + gridH - rowH * 0.15); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W * 0.08, gridTop + rowH); ctx.lineTo(W * 0.92, gridTop + rowH); ctx.stroke()
    ctx.restore()

    grid4.forEach((s, i) => {
      const cx     = (i % 2) * colW + colW / 2
      const cellCy = gridTop + Math.floor(i / 2) * rowH + rowH / 2
      ctx.font = `600 ${lblSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      shadow(5); ctx.fillText(s.l, cx, cellCy - Math.round(valSz * 0.1)); noShadow()
      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.font = `600 ${unitSz}px ${FONT}`
      const blockW = vw + (s.u ? ctx.measureText(s.u).width + Math.round(valSz * 0.1) : 0)
      const startX = cx - blockW / 2
      ctx.font = `800 ${valSz}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      shadow(10); ctx.fillText(s.v, startX, cellCy + Math.round(valSz * 0.06)); noShadow()
      if (s.u) {
        ctx.font = `700 ${unitSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        shadow(7); ctx.fillText(s.u, startX + vw + Math.round(valSz * 0.1), cellCy + valSz * 0.56); noShadow()
      }
    })

  } else {
    const colW   = W / grid4.length
    const valSz  = Math.round(Math.min(H * 0.065, colW * 0.36))
    const unitSz = Math.round(valSz * 0.42), lblSz = Math.round(valSz * 0.36)
    const cy     = atBottom ? barY + BAR_H * 0.62 : barY + BAR_H * 0.42

    grid4.forEach((s, i) => {
      const cx = i * colW + colW / 2
      ctx.font = `600 ${lblSz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      shadow(6); ctx.fillText(s.l, cx, cy - 4); noShadow()
      ctx.font = `800 ${valSz}px ${FONT}`
      const vw = ctx.measureText(s.v).width
      ctx.font = `600 ${unitSz}px ${FONT}`
      const blockW = vw + (s.u ? ctx.measureText(s.u).width + Math.round(valSz * 0.1) : 0)
      const startX = cx - blockW / 2
      ctx.font = `800 ${valSz}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      shadow(12); ctx.fillText(s.v, startX, cy + 2); noShadow()
      if (s.u) {
        ctx.font = `700 ${unitSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        shadow(8); ctx.fillText(s.u, startX + vw + Math.round(valSz * 0.1), cy + valSz * 0.55); noShadow()
      }
    })

    const nameSz = Math.round(H * 0.028)
    const nameY  = atBottom ? barY + nameSz * 0.8 : barY + BAR_H - nameSz * 1.6
    ctx.font = `700 ${nameSz}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    let nameStr = props.trackName || 'Activity'
    while (ctx.measureText(nameStr).width > W * 0.6 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
    if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
    shadow(10); ctx.fillText(nameStr, namePad, nameY); noShadow()
    const startPt = pts.find(p => p.time)
    if (startPt?.time) {
      ctx.font = `500 ${Math.round(nameSz * 0.78)}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},0.95)`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; shadow(6)
      ctx.fillText(startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), namePad, nameY + nameSz * 1.25)
      noShadow()
    }
  }
}

// ── Integrated: Float layout (corner card) ────────────────────────────────────
function drawIntFloat(ctx, W, H, pts, stats, accent, ar, ag, ab, atBottom) {
  const isPortrait = H > W * 1.1
  const shadow   = (b = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const MARGIN = Math.round(W * 0.04)
  const CARD_W = Math.round(W * (isPortrait ? 0.52 : 0.38))
  const PAD    = Math.round(CARD_W * 0.08)
  const nameSz = Math.round(CARD_W * 0.075)
  const valSz  = Math.round(Math.min(CARD_W * 0.15, CARD_W / 2 * 0.42))
  const unitSz = Math.round(valSz * 0.44), lblSz = Math.round(valSz * 0.34)
  const rowH   = Math.round(valSz * 2.2)
  const CARD_H = PAD + Math.round(nameSz * 1.5) + 6 + rowH * 2 + PAD
  const cardX  = W - CARD_W - MARGIN
  const cardY  = atBottom ? H - CARD_H - MARGIN : MARGIN

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 20
  rrect(ctx, cardX, cardY, CARD_W, CARD_H, Math.round(CARD_W * 0.07))
  ctx.fillStyle = 'rgba(6,6,8,0.84)'; ctx.fill()
  ctx.restore()

  ctx.save()
  rrect(ctx, cardX, cardY, CARD_W, CARD_H, Math.round(CARD_W * 0.07)); ctx.clip()
  ctx.fillStyle = accent; ctx.globalAlpha = 0.85
  ctx.fillRect(cardX, cardY + CARD_H * 0.12, 3, CARD_H * 0.76)
  ctx.globalAlpha = 1; ctx.restore()

  ctx.font = `700 ${nameSz}px ${FONT}`; ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  let nameStr = props.trackName || 'Activity'
  while (ctx.measureText(nameStr).width > CARD_W - PAD * 2 - 6 && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (props.trackName || 'Activity')) nameStr += '…'
  shadow(8); ctx.fillText(nameStr, cardX + PAD + 5, cardY + PAD); noShadow()

  const divY = cardY + PAD + nameSz * 1.4
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.35)`
  ctx.fillRect(cardX + PAD, Math.round(divY), CARD_W - PAD * 2, 1)

  const movingMs = computeMovingTime(pts)
  const grid4 = [
    { v: (stats?.totalDist ?? 0).toFixed(2), u: 'km',   l: 'Distance'  },
    { v: String(stats?.elevGain ?? 0),        u: 'm',    l: 'Elevation' },
    { v: fmtHMS(movingMs),                   u: '',     l: 'Time'      },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),  u: 'km/h', l: 'Speed'     },
  ]
  const gridTop = divY + 8, colW = (CARD_W - PAD * 2) / 2

  grid4.forEach((s, i) => {
    const cx = cardX + PAD + (i % 2) * colW + colW / 2
    const cy = gridTop + Math.floor(i / 2) * rowH + rowH / 2
    ctx.font = `600 ${lblSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},0.75)`
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    shadow(4); ctx.fillText(s.l, cx, cy - Math.round(valSz * 0.1)); noShadow()
    ctx.font = `800 ${valSz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.font = `600 ${unitSz}px ${FONT}`
    const blockW = vw + (s.u ? ctx.measureText(s.u).width + Math.round(valSz * 0.1) : 0)
    const startX = cx - blockW / 2
    ctx.font = `800 ${valSz}px ${FONT}`; ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    shadow(10); ctx.fillText(s.v, startX, cy + Math.round(valSz * 0.06)); noShadow()
    if (s.u) {
      ctx.font = `700 ${unitSz}px ${FONT}`; ctx.fillStyle = `rgba(${ar},${ag},${ab},1)`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      shadow(7); ctx.fillText(s.u, startX + vw + Math.round(valSz * 0.1), cy + valSz * 0.56); noShadow()
    }
  })

  if (integratedRoute.value && pts.length > 1) {
    const ROUTE_SZ  = Math.round(W * (isPortrait ? 0.18 : 0.12))
    const rx = MARGIN, ry = atBottom ? MARGIN : H - ROUTE_SZ - MARGIN
    ctx.save()
    ctx.beginPath(); ctx.arc(rx + ROUTE_SZ/2, ry + ROUTE_SZ/2, ROUTE_SZ/2, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.clip()
    drawRoute(ctx, pts, rx, ry, ROUTE_SZ, ROUTE_SZ, accent, { routeHalo: 'rgba(0,0,0,0.5)', isNeon: false, sparkBacking: false })
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
  ctx.fillStyle = accent; ctx.globalAlpha = 0.6
  ctx.fillRect(0, atBottom ? zoneY : zoneY + totalH - 2, W, 2)
  ctx.globalAlpha = 1

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
  ctx.fillStyle = accent; ctx.globalAlpha = 0.70
  ctx.fillRect(0, atBottom ? stripY : stripY + STRIP_H - 2, W, 2)
  ctx.globalAlpha = 1

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

  if (format === 'minimal') {
    renderMinimal(ctx, pts, stats, name, accent, W, H, orient, theme)
    return
  }
  if (format === 'strava') {
    renderStrava(ctx, pts, stats, name, accent, W, H, orient, theme)
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

    case 'strava':
      return {
        textPrimary: '#fff',
        acDim:       `rgba(${ar},${ag},${ab},1)`,
        statLabel:   'rgba(255,255,255,0.55)',
        shadowColor: 'rgba(0,0,0,0.9)',
      }

    default: // classic — transparent bg
      return {
        headerBg:     'rgba(0,0,0,0.62)',
        statsBg:      'rgba(0,0,0,0.62)',
        textPrimary:  '#fff',
        acDim:        `rgba(${ar},${ag},${ab},0.75)`,
        divider:      'rgba(255,255,255,0.08)',
        statLabel:    'rgba(255,255,255,0.38)',
        shadowColor:  'rgba(0,0,0,0.95)',
        routeHalo:    'rgba(0,0,0,0.45)',
        sparkBacking: true,
      }
  }
}

// ── Full layout (all formats except minimal) ──────────────────────────────────

function renderFull(ctx, pts, stats, name, accent, W, H, orient, theme, ar, ag, ab) {
  const PAD = 20
  const HDR = orient === 'portrait' ? 68 : 60
  const { textPrimary, acDim, headerBg, statsBg, divider, shadowColor } = theme

  const shadow   = (b = 8) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  // Header backdrop
  rrect(ctx, 0, 0, W, HDR, 16); ctx.fillStyle = headerBg; ctx.fill()
  ctx.fillStyle = accent; ctx.fillRect(0, 8, 3, HDR - 16)

  // Track name
  ctx.save()
  ctx.font = `700 ${orient === 'portrait' ? 16 : 14}px ${FONT}`
  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(10)
  let nameStr = name || 'Activity'
  const maxNW = W - PAD * 2 - 90
  while (ctx.measureText(nameStr).width > maxNW && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (name || 'Activity')) nameStr += '…'
  ctx.fillText(nameStr, PAD + 8, 10); noShadow(); ctx.restore()

  // Date
  const startPt = pts.find(p => p.time)
  if (startPt?.time) {
    ctx.font = `500 11px ${FONT}`; ctx.fillStyle = acDim
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; shadow(6)
    ctx.fillText(
      startPt.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      PAD + 8, orient === 'portrait' ? 33 : 30,
    ); noShadow()
  }

  // Distance badge
  const distKm = (stats?.totalDist ?? 0).toFixed(2)
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; shadow(10)
  ctx.font = `700 ${orient === 'portrait' ? 26 : 22}px ${FONT}`; ctx.fillStyle = accent
  ctx.fillText(distKm, W - PAD, HDR / 2 + (orient === 'portrait' ? 10 : 8))
  ctx.font = `600 11px ${FONT}`; ctx.fillStyle = acDim
  ctx.fillText('km', W - PAD, HDR / 2 + (orient === 'portrait' ? 24 : 20)); noShadow()

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

  if (orient === 'landscape') {
    const CY = HDR + 6, CH_MAP = H - CY - 8
    const SPLIT = Math.floor(W / 2) - 4
    drawRoute(ctx, pts, PAD, CY, SPLIT - PAD, CH_MAP, accent, theme)
    drawElevSparkline(ctx, pts, PAD, CY, SPLIT - PAD, CH_MAP, accent, { r: ar, g: ag, b: ab }, theme)

    const SX = SPLIT + 8, SW = W - SPLIT - 8 - PAD
    const COL_W = SW / 2, ROW_H = CH_MAP / 3
    rrect(ctx, SX - 4, CY, SW + 4, CH_MAP, 14); ctx.fillStyle = statsBg; ctx.fill()
    drawGridDividers(ctx, SX, CY, SW, CH_MAP, 2, 3, divider)
    grid6.forEach((s, i) => drawStatCell(ctx, s,
      SX + (i % 2) * COL_W + COL_W / 2,
      CY + Math.floor(i / 2) * ROW_H + ROW_H / 2,
      theme))

  } else {
    const MAP_Y = HDR + 6, MAP_H = orient === 'portrait' ? 290 : 230
    drawRoute(ctx, pts, PAD, MAP_Y, W - PAD * 2, MAP_H, accent, theme)
    drawElevSparkline(ctx, pts, PAD, MAP_Y, W - PAD * 2, MAP_H, accent, { r: ar, g: ag, b: ab }, theme)

    const ST_Y = MAP_Y + MAP_H + 6, ST_H = H - ST_Y - 8
    const COL_W = (W - PAD * 2) / 3, ROW_H = ST_H / 2
    rrect(ctx, 0, ST_Y, W, ST_H + 8, 14); ctx.fillStyle = statsBg; ctx.fill()
    drawGridDividers(ctx, PAD, ST_Y, W - PAD * 2, ST_H, 3, 2, divider)
    grid6.forEach((s, i) => drawStatCell(ctx, s,
      PAD + (i % 3) * COL_W + COL_W / 2,
      ST_Y + Math.floor(i / 3) * ROW_H + ROW_H / 2,
      theme))
  }

  drawFooter(ctx, W, H)
}

// ── Minimal layout — route dominant, 3 floating stats ────────────────────────

function renderMinimal(ctx, pts, stats, name, accent, W, H, orient, theme) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 8) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const distKm = (stats?.totalDist ?? 0).toFixed(2)
  const stats3 = [
    { v: distKm,                          u: 'km', l: 'DISTANCE'  },
    { v: fmtHMS(stats?.totalTime ?? 0),   u: '',   l: 'TOTAL TIME' },
    { v: String(stats?.elevGain ?? 0),     u: 'm',  l: 'ELEV GAIN' },
  ]

  if (orient === 'landscape') {
    const PAD = 16, ROUTE_W = Math.floor(W * 0.58)
    drawRoute(ctx, pts, PAD, PAD, ROUTE_W - PAD, H - PAD * 2, accent, theme)

    const SX = ROUTE_W + 12, SW = W - SX - PAD
    const ROW_H = H / 3
    stats3.forEach((s, i) => {
      const cy = i * ROW_H + ROW_H / 2
      shadow(10)
      ctx.font = `700 28px ${FONT}`; ctx.fillStyle = textPrimary
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(s.v, SX + SW / 2, cy + 4); noShadow()
      if (s.u) {
        const vw = ctx.measureText(s.v).width
        ctx.font = `600 12px ${FONT}`; ctx.fillStyle = acDim
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.fillText(s.u, SX + SW / 2 + vw / 2 + 3, cy)
      }
      ctx.font = `700 9px ${FONT}`; ctx.fillStyle = statLabel
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(s.l, SX + SW / 2, cy + 7)
    })

  } else {
    const PAD = 16, STAT_H = 56
    const MAP_H = H - PAD - STAT_H - 8
    drawRoute(ctx, pts, PAD, PAD, W - PAD * 2, MAP_H, accent, theme)

    // Track name
    shadow(8); ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(name || 'Activity', PAD + 4, PAD + 4); noShadow()

    const COL_W = (W - PAD * 2) / 3, CY = H - STAT_H / 2 - 6
    stats3.forEach((s, i) => {
      const cx = PAD + i * COL_W + COL_W / 2
      shadow(10); ctx.font = `700 22px ${FONT}`; ctx.fillStyle = textPrimary
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(s.v, cx, CY + 2); noShadow()
      if (s.u) {
        const vw = ctx.measureText(s.v).width
        ctx.font = `600 10px ${FONT}`; ctx.fillStyle = acDim
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.fillText(s.u, cx + vw / 2 + 2, CY - 1)
      }
      ctx.font = `700 8px ${FONT}`; ctx.fillStyle = statLabel
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(s.l, cx, CY + 5)
    })
  }

  drawFooter(ctx, W, H)
}

// ── Strava layout — transparent bg, name + 6-stat grid, no map ───────────────

function renderStrava(ctx, pts, stats, name, accent, W, H, orient, theme) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 10) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()       => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  const PAD    = orient === 'landscape' ? 18 : 22
  const isLS   = orient === 'landscape'
  const valSz  = isLS ? 28 : 34
  const unitSz = Math.round(valSz * 0.38)
  const lblSz  = isLS ? 10 : 11

  // Activity name
  const nameSz = isLS ? 18 : 22
  const maxNW  = W - PAD * 2
  ctx.font = `800 ${nameSz}px ${FONT}`
  let nameStr = name || 'Activity'
  while (ctx.measureText(nameStr).width > maxNW && nameStr.length > 3) nameStr = nameStr.slice(0, -1)
  if (nameStr !== (name || 'Activity')) nameStr += '…'

  ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  shadow(14); ctx.fillText(nameStr, PAD, PAD); noShadow()

  // Thin accent underline beneath name
  const nameH = nameSz * 1.3
  const lineW = Math.min(ctx.measureText(nameStr).width, maxNW)
  ctx.fillStyle = accent; ctx.globalAlpha = 0.7
  ctx.fillRect(PAD, PAD + nameH + 3, lineW, 2)
  ctx.globalAlpha = 1

  // Stats grid
  const movingMs = computeMovingTime(pts)
  const grid = [
    { v: (stats?.totalDist ?? 0).toFixed(2),  u: 'km',   l: 'Distance'      },
    { v: String(stats?.elevGain ?? 0),          u: 'm',    l: 'Elevation Gain' },
    { v: fmtHMS(movingMs),                     u: '',     l: 'Moving Time'   },
    { v: (stats?.avgSpeed ?? 0).toFixed(1),    u: 'km/h', l: 'Avg Speed'     },
    { v: String(stats?.elevLoss ?? 0),          u: 'm',    l: 'Elev Loss'     },
    { v: (stats?.maxSpeed ?? 0).toFixed(1),    u: 'km/h', l: 'Max Speed'     },
  ]

  const COLS   = isLS ? 3 : 2
  const gridW  = W - PAD * 2
  const cw     = gridW / COLS
  const gridTop = PAD + nameH + 14
  const gridH  = H - gridTop - PAD - 18
  const rh     = gridH / Math.ceil(grid.length / COLS)

  grid.forEach((s, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cx  = PAD + col * cw + cw / 2
    const cy  = gridTop + row * rh + rh / 2

    // Label above
    ctx.font = `600 ${lblSz}px ${FONT}`
    ctx.fillStyle = statLabel; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    shadow(6); ctx.fillText(s.l, cx, cy - 2); noShadow()

    // Measure value width with val font before drawing
    ctx.font = `800 ${valSz}px ${FONT}`
    const vw = ctx.measureText(s.v).width
    ctx.font = `600 ${unitSz}px ${FONT}`
    const uw = s.u ? ctx.measureText(s.u).width : 0
    const totalW = vw + (uw ? uw + 3 : 0)
    const startX = cx - totalW / 2

    // Value
    ctx.font = `800 ${valSz}px ${FONT}`
    ctx.fillStyle = textPrimary; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    shadow(12); ctx.fillText(s.v, startX, cy + 1); noShadow()

    // Unit superscript
    if (s.u) {
      ctx.font = `600 ${unitSz}px ${FONT}`
      ctx.fillStyle = acDim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      shadow(8); ctx.fillText(s.u, startX + vw + 3, cy + valSz * 0.55); noShadow()
    }
  })

  drawFooter(ctx, W, H)
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

function drawStatCell(ctx, s, cx, cy, theme) {
  const { textPrimary, acDim, statLabel, shadowColor } = theme
  const shadow   = (b = 6) => { ctx.shadowColor = shadowColor; ctx.shadowBlur = b }
  const noShadow = ()      => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0 }

  shadow()
  ctx.font = `700 18px ${FONT}`; ctx.fillStyle = textPrimary
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText(s.v, cx, cy + 1); noShadow()

  if (s.u) {
    const vw = ctx.measureText(s.v).width
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = acDim
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(s.u, cx + vw / 2 + 3, cy - 1)
  }

  ctx.font = `600 9px ${FONT}`; ctx.fillStyle = statLabel
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText(s.l, cx, cy + 5)
}

function drawFooter(ctx, W, H) {
  const ICON_H = 14, LABEL = 'gpx2video'
  ctx.font = `500 10px ${FONT}`
  const lw = ctx.measureText(LABEL).width, totalW = ICON_H + 4 + lw
  const logoX = W / 2 - totalW / 2, logoY = H - 2 - ICON_H
  drawLogoMark(ctx, logoX, logoY, ICON_H, 0.4)
  ctx.font = `500 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4
  ctx.fillText(LABEL, logoX + ICON_H + 4, logoY + ICON_H / 2)
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

/* ── Backdrop ────────────────────────────────────────────────────────────── */
.sticker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 299;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
}

/* ── Dialog (desktop) ────────────────────────────────────────────────────── */
.sticker-dialog {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  width: min(900px, calc(100vw - 32px));
  max-height: min(680px, calc(100dvh - 32px));
  margin: auto;
  background: var(--bg2, #1a1a1a);
  border: 0.5px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 0.5px solid var(--border, rgba(255,255,255,0.08));
  flex-shrink: 0;
}
.dialog-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: .02em;
}
.dialog-title svg { color: var(--accent, #f59e0b); }
.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.dialog-close:hover { background: var(--bg3); color: var(--text); }
.dialog-close svg { width: 14px; height: 14px; }

.dialog-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left controls column */
.dialog-controls {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-right: 0.5px solid var(--border, rgba(255,255,255,0.08));
  overflow-y: auto;
}

.ctrl-section { display: flex; flex-direction: column; gap: 6px; }
.ctrl-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text3);
}

/* Right preview column */
.dialog-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg1, #141414);
  overflow: hidden;
}
.dialog-preview .sticker-preview-wrap {
  border-radius: 10px;
  overflow: hidden;
  border: 0.5px solid var(--border2, rgba(255,255,255,0.07));
  background-image: repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%);
  background-size: 12px 12px;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog-preview .sticker-canvas {
  display: block;
  max-width: 100%;
  max-height: calc(min(680px, 100dvh - 32px) - 64px - 32px);
  height: auto;
}

/* ── Mobile full-screen sticker editor ───────────────────────────────────── */
.sm-shell {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  background: #0d0d0d;
}

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

/* Preview */
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
.embed-link { color: var(--accent-blue); }
.embed-upload-hint {
  font-size: 10px;
  color: var(--text3);
}
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
.int-pos-btn--on { background: var(--bg4, #252525); color: var(--text); border-color: var(--border); }

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
.format-btn--on   { background: var(--bg4, #252525); color: var(--text); border-color: var(--border); }

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
