<template>
  <div class="ce-root">

    <!-- Tab bar — Style first -->
    <div class="ce-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="ce-tab"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >
        {{ t.label }}
        <span v-if="t.id === 'captions' && segments.length" class="ce-tab-badge">{{ segments.length }}</span>
      </button>
    </div>

    <!-- ── Style tab ─────────────────────────────────────────────────────── -->
    <div v-show="activeTab === 'style'" class="ce-panel">

      <!-- Live preview -->
      <div class="ce-preview-wrap">
        <span class="ce-preview-text" :style="previewTextStyle">Sample caption text</span>
      </div>

      <!-- Placement -->
      <div class="ce-section">
        <div class="ce-section-label">Placement</div>
        <div class="ce-pos-grid">
          <button
            v-for="p in placements"
            :key="p"
            class="ce-pos-cell"
            :class="{ active: (style.placement ?? 'bot-center') === p }"
            @click="emit('update:style', { ...style, placement: p })"
          />
        </div>
      </div>

      <!-- Typography -->
      <div class="ce-section">
        <div class="ce-section-label">Typography</div>
        <div class="ce-font-strip">
          <button
            v-for="f in fonts"
            :key="f.id"
            class="ce-font-chip"
            :class="{ active: style.fontFamily === f.id }"
            :style="{ fontFamily: f.family }"
            @click="emit('update:style', { ...style, fontFamily: f.id })"
          >{{ f.label }}</button>
        </div>
        <div class="ce-size-row">
          <span class="ce-sublabel">Size</span>
          <input
            type="range" class="ce-slider" min="10" max="40"
            :value="style.fontSize ?? 15"
            @input="emit('update:style', { ...style, fontSize: +$event.target.value })"
          />
          <span class="ce-size-val">{{ style.fontSize ?? 15 }}px</span>
        </div>
        <div class="ce-deco-row">
          <button class="ce-deco-btn" :class="{ active: style.bold }"
            @click="emit('update:style', { ...style, bold: !style.bold })" title="Bold">
            <b>B</b>
          </button>
          <button class="ce-deco-btn" :class="{ active: style.allCaps }"
            @click="emit('update:style', { ...style, allCaps: !style.allCaps, lowercase: false })" title="Uppercase">
            AA
          </button>
          <button class="ce-deco-btn ce-deco-btn--lower" :class="{ active: style.lowercase }"
            @click="emit('update:style', { ...style, lowercase: !style.lowercase, allCaps: false })" title="Lowercase">
            aa
          </button>
        </div>
      </div>

      <!-- Color & Effects -->
      <div class="ce-section">
        <div class="ce-section-label">Color & Effects</div>
        <div class="ce-color-row">
          <button
            v-for="col in colors"
            :key="col.value"
            class="ce-swatch"
            :class="{ active: style.color === col.value }"
            :style="{ background: col.value }"
            :title="col.label"
            @click="emit('update:style', { ...style, color: col.value })"
          />
          <div class="ce-hex-wrap">
            <span class="ce-hex-hash">#</span>
            <input
              class="ce-hex-input" type="text" maxlength="6" spellcheck="false"
              :value="hexValue"
              @change="onHexInput($event.target.value)"
              @keydown.enter="onHexInput($event.target.value)"
            />
          </div>
        </div>

        <label class="ce-toggle-row">
          <span class="ce-toggle-wrap">
            <input type="checkbox" :checked="style.background"
              @change="emit('update:style', { ...style, background: $event.target.checked })" />
            <span class="ce-toggle-track"><span class="ce-toggle-thumb" /></span>
          </span>
          <span class="ce-toggle-label">Background</span>
          <template v-if="style.background">
            <input
              type="range" class="ce-slider ce-slider--flex" min="10" max="90"
              :value="style.bgOpacity ?? 55"
              @input="emit('update:style', { ...style, bgOpacity: +$event.target.value })"
            />
            <span class="ce-size-val">{{ style.bgOpacity ?? 55 }}%</span>
          </template>
        </label>

        <label class="ce-toggle-row">
          <span class="ce-toggle-wrap">
            <input type="checkbox" :checked="style.outline"
              @change="emit('update:style', { ...style, outline: $event.target.checked })" />
            <span class="ce-toggle-track"><span class="ce-toggle-thumb" /></span>
          </span>
          <span class="ce-toggle-label">Text outline</span>
        </label>
      </div>

    </div>

    <!-- ── Transcribe tab ─────────────────────────────────────────────────── -->
    <div v-show="activeTab === 'transcribe'" class="ce-panel">
      <div class="lp-section">
        <div class="lp-label">Model</div>
        <div class="ce-model-grid">
          <button
            v-for="m in models"
            :key="m.id"
            class="ce-model-btn"
            :class="{ active: modelSize === m.id }"
            @click="emit('set-model', m.id)"
          >
            <span class="ce-model-name">{{ m.label }}</span>
            <span class="ce-model-note">{{ m.note }}</span>
          </button>
        </div>
        <p class="ce-hint">Runs locally · first run downloads the model.</p>
      </div>

      <div class="lp-divider" />

      <div class="lp-section">
        <div v-if="!videoSrc" class="ce-hint">Load a video to transcribe.</div>
        <template v-else>
          <button
            class="ce-btn ce-btn--primary"
            :disabled="status === 'downloading' || status === 'transcribing'"
            @click="emit('transcribe')"
          >
            <svg v-if="status === 'idle' || status === 'done' || status === 'error'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/>
              <path d="M4 11a6 6 0 0 0 12 0M10 17v2M7 19h6"/>
            </svg>
            <svg v-else class="spin" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M10 3a7 7 0 1 1-4.95 2.05" stroke-linecap="round"/>
            </svg>
            {{ btnLabel }}
          </button>

          <div v-if="status === 'downloading' || status === 'transcribing'" class="ce-progress-wrap">
            <div
              class="ce-progress-bar"
              :class="{ 'ce-progress-bar--indeterminate': progress === 0 && status === 'downloading' }"
              :style="progress > 0 ? { width: progressPct } : {}"
            ></div>
            <span class="ce-progress-label">{{ progressLabel }}</span>
          </div>

          <div v-if="status === 'error'" class="ce-error">{{ error }}</div>
        </template>
      </div>
    </div>

    <!-- ── Captions tab ─────────────────────────────────────────────────── -->
    <div v-show="activeTab === 'captions'" class="ce-panel">
      <div class="lp-section">
        <div class="ce-seg-header">
          <div class="ce-seg-actions">
            <button class="ce-icon-btn" title="Add caption" @click="emit('add')">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
            </button>
            <button v-if="segments.length" class="ce-icon-btn ce-icon-btn--danger" title="Clear all" @click="emit('clear')">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg>
            </button>
          </div>
        </div>

        <div v-if="!segments.length" class="ce-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M7 9h10M7 13h6"/>
          </svg>
          <span>No captions yet. Transcribe or add manually.</span>
        </div>

        <div v-for="seg in segments" :key="seg.id" class="ce-seg-item">
          <div class="ce-seg-times">
            <input class="ce-time-input" type="number" step="0.1" min="0" :value="seg.start"
              @change="emit('update', seg.id, { start: +$event.target.value })" />
            <span class="ce-time-sep">→</span>
            <input class="ce-time-input" type="number" step="0.1" min="0" :value="seg.end"
              @change="emit('update', seg.id, { end: +$event.target.value })" />
            <button class="ce-icon-btn ce-icon-btn--danger ce-seg-del" @click="emit('remove', seg.id)">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
            </button>
          </div>
          <textarea class="ce-text" :value="seg.text" rows="2"
            @input="emit('update', seg.id, { text: $event.target.value })" />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  videoSrc:  { type: String, default: null },
  style:     { type: Object, default: () => ({
    placement: 'bot-center', fontSize: 15, fontFamily: 'sans',
    color: '#ffffff', bold: true, allCaps: false, lowercase: false,
    background: true, bgOpacity: 55, outline: false,
  })},
  status:    { type: String, default: 'idle' },
  progress:  { type: Number, default: 0 },
  error:     { type: String, default: null },
  segments:  { type: Array,  default: () => [] },
  modelSize: { type: String, default: 'tiny' },
})

const emit = defineEmits(['update:style', 'transcribe', 'add', 'remove', 'update', 'clear', 'set-model'])

const activeTab = ref('style')

const tabs = [
  { id: 'style',      label: 'Style' },
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'captions',   label: 'Captions' },
]

// 3×3 placement grid (row-major: top → mid → bot, left → center → right)
const placements = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'mid-center', 'mid-right',
  'bot-left', 'bot-center', 'bot-right',
]

const colors = [
  { value: '#ffffff', label: 'White' },
  { value: '#facc15', label: 'Yellow' },
  { value: '#22d3ee', label: 'Cyan' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#f87171', label: 'Red' },
  { value: '#000000', label: 'Black' },
]

const fonts = [
  { id: 'sans',       label: 'Default',    family: 'Inter, Arial, sans-serif' },
  { id: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { id: 'impact',     label: 'Impact',     family: "Impact, 'Arial Narrow', sans-serif" },
  { id: 'oswald',     label: 'Oswald',     family: "'Oswald', sans-serif" },
  { id: 'bebas',      label: 'Bebas Neue', family: "'Bebas Neue', Impact, sans-serif" },
]

const models = [
  { id: 'tiny',  label: 'Tiny',  note: '~75 MB · fast'    },
  { id: 'base',  label: 'Base',  note: '~145 MB · better' },
  { id: 'small', label: 'Small', note: '~466 MB · best'   },
]

const hexValue = computed(() => (props.style.color ?? '#ffffff').replace('#', ''))

const previewTextStyle = computed(() => {
  const s = props.style
  const f = fonts.find(f => f.id === (s.fontFamily ?? 'sans'))
  return {
    fontFamily:    f?.family ?? 'Inter, Arial, sans-serif',
    fontSize:      (s.fontSize ?? 15) + 'px',
    fontWeight:    s.bold !== false ? 'bold' : 'normal',
    textTransform: s.allCaps ? 'uppercase' : s.lowercase ? 'lowercase' : 'none',
    color:         s.color ?? '#ffffff',
    textShadow:    s.outline ? '-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000' : 'none',
    background:    s.background ? `rgba(0,0,0,${(s.bgOpacity ?? 55) / 100})` : 'transparent',
    padding:       s.background ? '5px 12px' : '0',
    borderRadius:  '5px',
    display:       'inline-block',
    lineHeight:    '1.3',
    transition:    'all .15s',
  }
})

function onHexInput(val) {
  const clean = val.replace(/[^0-9a-fA-F]/g, '')
  if (clean.length === 6 || clean.length === 3) {
    emit('update:style', { ...props.style, color: '#' + clean })
  }
}

const btnLabel = computed(() => {
  if (props.status === 'downloading')  return 'Downloading model…'
  if (props.status === 'transcribing') return 'Transcribing…'
  if (props.status === 'done')         return 'Re-transcribe'
  return 'Auto-Transcribe'
})

const progressPct   = computed(() => `${Math.round(props.progress * 100)}%`)
const progressLabel = computed(() => {
  if (props.status === 'transcribing') return 'Analyzing audio…'
  if (props.status === 'downloading')  return props.progress > 0 ? `Downloading model ${progressPct.value}` : 'Connecting…'
  return ''
})
</script>

<style scoped>
.ce-root { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

/* ── Tab bar ── */
.ce-tabs {
  display: flex;
  border-bottom: 1px solid var(--border, #333);
  padding: 0 12px;
  flex-shrink: 0;
}
.ce-tab {
  position: relative;
  display: flex; align-items: center; gap: 5px;
  padding: 10px 10px;
  font-size: 12px; font-weight: 500;
  color: var(--text-dim, #888);
  background: none; border: none; cursor: pointer;
  transition: color .15s; white-space: nowrap;
}
.ce-tab::after {
  content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
  height: 2px; background: var(--accent, #f59e0b);
  opacity: 0; transition: opacity .15s;
}
.ce-tab:hover { color: var(--text, #e4e4f0); }
.ce-tab.active { color: var(--text, #e4e4f0); }
.ce-tab.active::after { opacity: 1; }
.ce-tab-badge {
  font-size: 9px; font-weight: 700;
  background: var(--accent, #f59e0b); color: #000;
  border-radius: 8px; padding: 1px 5px; line-height: 1.4;
}

/* ── Panel ── */
.ce-panel { flex: 1; overflow-y: auto; padding-top: 4px; min-width: 0; }

/* ── Shared ── */
.ce-hint { font-size: 11px; color: var(--text-dim, #888); line-height: 1.4; margin: 10px 0 0; }
.ce-sublabel { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim, #888); flex-shrink: 0; }

/* ── Live preview ── */
.ce-preview-wrap {
  margin: 8px 12px;
  min-height: 56px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  padding: 10px 12px;
}
.ce-preview-text { text-align: center; }

/* ── Sections ── */
.ce-section { padding: 10px 12px 4px; border-bottom: 1px solid var(--border, #2a2a3a); }
.ce-section:last-child { border-bottom: none; }
.ce-section-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text-dim, #666);
  margin-bottom: 10px;
}

/* ── Placement 3×3 grid ── */
.ce-pos-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 4px; width: 90px;
}
.ce-pos-cell {
  width: 100%; aspect-ratio: 1;
  border: 1px solid var(--border, #333); border-radius: 4px;
  background: transparent; cursor: pointer; transition: all .15s;
}
.ce-pos-cell:hover { background: rgba(255,255,255,.08); border-color: #555; }
.ce-pos-cell.active { background: var(--accent, #f59e0b); border-color: var(--accent, #f59e0b); }

/* ── Font strip ── */
.ce-font-strip {
  display: flex; gap: 4px; flex-wrap: wrap;
  margin-bottom: 10px;
}
.ce-font-chip {
  flex-shrink: 0; padding: 4px 10px; font-size: 12px;
  border: 1px solid var(--border, #333); border-radius: 5px;
  background: transparent; color: var(--text-dim, #888);
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.ce-font-chip:hover { color: var(--text, #e4e4f0); border-color: #555; }
.ce-font-chip.active { background: var(--accent, #f59e0b); border-color: var(--accent, #f59e0b); color: #000; font-weight: 700; }

/* ── Size slider row ── */
.ce-size-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ce-size-val { font-size: 11px; color: var(--text-dim, #888); min-width: 32px; text-align: right; flex-shrink: 0; }

/* ── Decoration buttons ── */
.ce-deco-row { display: flex; gap: 4px; }
.ce-deco-btn {
  width: 34px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border, #333); border-radius: 5px;
  background: transparent; color: var(--text-dim, #888);
  cursor: pointer; transition: all .15s; font-size: 13px;
}
.ce-deco-btn:hover { color: var(--text, #e4e4f0); border-color: #555; }
.ce-deco-btn.active { background: var(--accent, #f59e0b); border-color: var(--accent, #f59e0b); color: #000; }
.ce-deco-btn--lower { font-size: 11px; }

/* ── Color row ── */
.ce-color-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.ce-swatch {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: transform .15s; flex-shrink: 0;
  outline: none; box-shadow: 0 0 0 1px rgba(255,255,255,.12);
}
.ce-swatch:hover { transform: scale(1.15); }
.ce-swatch.active { border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,.5); }
.ce-hex-wrap {
  display: flex; align-items: center; gap: 2px;
  background: var(--surface2, #1e1e2e);
  border: 1px solid var(--border, #333); border-radius: 5px;
  padding: 3px 6px; min-width: 0;
}
.ce-hex-hash { font-size: 11px; color: var(--text-dim, #888); flex-shrink: 0; }
.ce-hex-input {
  width: 52px; background: none; border: none; outline: none;
  font-size: 11px; font-family: monospace; color: var(--text, #e4e4f0);
  padding: 0; letter-spacing: .04em;
}

/* ── Toggle rows ── */
.ce-toggle-row {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; margin-bottom: 8px; min-width: 0;
}
.ce-toggle-row:last-child { margin-bottom: 0; }
.ce-toggle-wrap { flex-shrink: 0; position: relative; display: inline-flex; }
.ce-toggle-wrap input { display: none; }
.ce-toggle-track {
  width: 30px; height: 16px; border-radius: 8px;
  background: var(--border, #444); display: block;
  transition: background .2s; flex-shrink: 0; position: relative;
}
.ce-toggle-wrap input:checked ~ .ce-toggle-track { background: var(--accent, #f59e0b); }
.ce-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: #fff; transition: left .2s;
}
.ce-toggle-wrap input:checked ~ .ce-toggle-track .ce-toggle-thumb { left: 16px; }
.ce-toggle-label { font-size: 12px; color: var(--text, #e4e4f0); flex-shrink: 0; }
.ce-slider--flex { flex: 1; min-width: 0; }

/* ── Slider ── */
.ce-slider {
  flex: 1; min-width: 0; height: 4px;
  accent-color: var(--accent, #f59e0b);
  cursor: pointer;
}

/* ── Transcribe tab ── */
.ce-model-grid { display: flex; gap: 6px; margin-top: 8px; }
.ce-model-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 10px 6px; gap: 4px;
  border: 1px solid var(--border, #333); border-radius: 6px;
  background: transparent; color: var(--text-dim, #888);
  cursor: pointer; transition: all .15s;
}
.ce-model-btn:hover { border-color: var(--text-dim, #888); color: var(--text, #e4e4f0); }
.ce-model-btn.active {
  border-color: var(--accent, #f59e0b); background: rgba(245,158,11,.12);
  color: var(--text, #e4e4f0); box-shadow: 0 0 0 1px rgba(245,158,11,.25);
}
.ce-model-name { font-size: 13px; font-weight: 600; }
.ce-model-note { font-size: 10px; opacity: .65; margin-top: 1px; }
.ce-btn {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 10px 14px;
  border: none; border-radius: 6px;
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: opacity .15s;
}
.ce-btn--primary { background: var(--accent, #f59e0b); color: #000; }
.ce-btn:disabled { opacity: .45; cursor: default; }
.ce-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.ce-progress-wrap {
  margin-top: 8px; position: relative;
  height: 20px; background: var(--surface2, #1e1e2e);
  border-radius: 4px; overflow: hidden;
}
.ce-progress-bar {
  position: absolute; inset: 0 auto 0 0;
  background: var(--accent, #f59e0b); opacity: .35; transition: width .3s;
}
.ce-progress-bar--indeterminate { width: 40% !important; animation: indeterminate 1.4s ease-in-out infinite; }
@keyframes indeterminate {
  0%   { left: -40%; width: 40%; }
  60%  { left: 100%; width: 40%; }
  100% { left: 100%; width: 40%; }
}
.ce-progress-label {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; color: var(--text, #e4e4f0);
}
.ce-error { font-size: 11px; color: #f87171; margin-top: 6px; line-height: 1.4; }

/* ── Captions tab ── */
.ce-seg-header { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.ce-seg-actions { display: flex; gap: 4px; }
.ce-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border: 1px solid var(--border, #333); border-radius: 4px;
  background: transparent; color: var(--text-dim, #888);
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.ce-icon-btn:hover { color: var(--text, #e4e4f0); border-color: var(--text-dim, #888); }
.ce-icon-btn--danger:hover { color: #f87171; border-color: #f87171; }
.ce-icon-btn svg { width: 11px; height: 11px; }
.ce-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 20px 12px; border: 1px dashed var(--border, #333); border-radius: 8px;
  color: var(--text-dim, #888); font-size: 11px; text-align: center; line-height: 1.4;
}
.ce-empty svg { width: 28px; height: 28px; opacity: .4; }
.ce-seg-item {
  border: 1px solid var(--border, #333); border-left: 3px solid var(--accent, #f59e0b);
  border-radius: 6px; padding: 8px; margin-bottom: 6px;
  background: var(--surface2, #1e1e2e);
}
.ce-seg-times { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.ce-time-input {
  width: 64px; padding: 3px 6px;
  background: var(--surface, #13131e);
  border: 1px solid var(--border, #333); border-radius: 4px;
  color: var(--text, #e4e4f0); font-size: 11px; font-family: monospace; outline: none;
}
.ce-time-input:focus { border-color: var(--accent, #f59e0b); }
.ce-time-sep { font-size: 11px; color: var(--text-dim, #888); }
.ce-seg-del { margin-left: auto; }
.ce-text {
  width: 100%; box-sizing: border-box;
  background: var(--surface, #13131e);
  border: 1px solid var(--border, #333); border-radius: 4px;
  color: var(--text, #e4e4f0); font-size: 12px; line-height: 1.4;
  padding: 5px 8px; resize: vertical; outline: none; font-family: inherit;
}
.ce-text:focus { border-color: var(--accent, #f59e0b); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
