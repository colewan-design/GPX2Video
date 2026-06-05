<template>
  <div class="ce-root">

    <!-- Model selector -->
    <div class="lp-section">
      <div class="lp-label">Whisper Model</div>
      <div class="ce-model-grid">
        <button
          v-for="m in models"
          :key="m.id"
          class="ce-model-btn"
          :class="{ active: modelSize === m.id }"
          @click="$emit('set-model', m.id)"
        >
          <span class="ce-model-name">{{ m.label }}</span>
          <span class="ce-model-note">{{ m.note }}</span>
        </button>
      </div>
      <p class="ce-hint">Runs locally · first run downloads the model.</p>
    </div>

    <div class="lp-divider" />

    <!-- Transcribe -->
    <div class="lp-section">
      <div v-if="!videoSrc" class="ce-hint">Load a video to transcribe.</div>
      <template v-else>
        <button
          class="ce-btn ce-btn--primary"
          :disabled="status === 'downloading' || status === 'transcribing'"
          @click="$emit('transcribe')"
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

    <div class="lp-divider" />

    <!-- Style -->
    <div class="lp-section">
      <div class="lp-label">Caption Style</div>
      <div class="ce-style-grid">
        <div class="ce-style-cell">
          <span class="ce-sublabel">Position</span>
          <div class="ce-seg">
            <button
              v-for="pos in ['bottom', 'top']"
              :key="pos"
              class="ce-seg-btn"
              :class="{ active: style.position === pos }"
              @click="$emit('update:style', { ...style, position: pos })"
            >{{ pos }}</button>
          </div>
        </div>
        <div class="ce-style-cell">
          <span class="ce-sublabel">Size</span>
          <div class="ce-seg">
            <button
              v-for="sz in ['small', 'medium', 'large']"
              :key="sz"
              class="ce-seg-btn"
              :class="{ active: style.fontSize === sz }"
              @click="$emit('update:style', { ...style, fontSize: sz })"
            >{{ sz }}</button>
          </div>
        </div>
      </div>
      <label class="ce-check">
        <input type="checkbox" :checked="style.background" @change="$emit('update:style', { ...style, background: $event.target.checked })" />
        Background box
      </label>
    </div>

    <div class="lp-divider" />

    <!-- Segments list -->
    <div class="lp-section">
      <div class="ce-seg-header">
        <span class="lp-label" style="margin:0">Captions</span>
        <span class="ce-count">{{ segments.length }}</span>
        <div class="ce-seg-actions">
          <button class="ce-icon-btn" title="Add caption" @click="$emit('add')">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>
          </button>
          <button v-if="segments.length" class="ce-icon-btn ce-icon-btn--danger" title="Clear all" @click="$emit('clear')">
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
          <input
            class="ce-time-input"
            type="number"
            step="0.1"
            min="0"
            :value="seg.start"
            @change="$emit('update', seg.id, { start: +$event.target.value })"
          />
          <span class="ce-time-sep">→</span>
          <input
            class="ce-time-input"
            type="number"
            step="0.1"
            min="0"
            :value="seg.end"
            @change="$emit('update', seg.id, { end: +$event.target.value })"
          />
          <button class="ce-icon-btn ce-icon-btn--danger ce-seg-del" @click="$emit('remove', seg.id)">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
          </button>
        </div>
        <textarea
          class="ce-text"
          :value="seg.text"
          rows="2"
          @input="$emit('update', seg.id, { text: $event.target.value })"
        />
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  videoSrc:  { type: String, default: null },
  style:     { type: Object, default: () => ({ position: 'bottom', fontSize: 'medium', background: true }) },
  status:    { type: String, default: 'idle' },
  progress:  { type: Number, default: 0 },
  error:     { type: String, default: null },
  segments:  { type: Array,  default: () => [] },
  modelSize: { type: String, default: 'tiny' },
})
defineEmits(['update:style', 'transcribe', 'add', 'remove', 'update', 'clear', 'set-model'])

const models = [
  { id: 'tiny',  label: 'Tiny',  note: '~75 MB · fast'    },
  { id: 'base',  label: 'Base',  note: '~145 MB · better' },
  { id: 'small', label: 'Small', note: '~466 MB · best'   },
]

const btnLabel = computed(() => {
  if (props.status === 'downloading')  return 'Downloading model…'
  if (props.status === 'transcribing') return 'Transcribing…'
  if (props.status === 'done')         return 'Re-transcribe'
  return 'Transcribe with Whisper'
})

const progressPct = computed(() => `${Math.round(props.progress * 100)}%`)

const progressLabel = computed(() => {
  if (props.status === 'transcribing') return 'Analyzing audio…'
  if (props.status === 'downloading') {
    return props.progress > 0 ? `Downloading model ${progressPct.value}` : 'Connecting…'
  }
  return ''
})
</script>

<style scoped>
.ce-root { display: flex; flex-direction: column; gap: 0; }

.ce-hint { font-size: 11px; color: var(--text-dim, #888); padding: 2px 0; line-height: 1.4; margin: 4px 0 0; }

/* Model grid */
.ce-model-grid { display: flex; gap: 4px; }
.ce-model-btn {
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 4px;
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim, #888);
  cursor: pointer;
  transition: all .15s;
  gap: 2px;
}
.ce-model-btn:hover { border-color: var(--text-dim, #888); color: var(--text, #e4e4f0); }
.ce-model-btn.active {
  border-color: var(--accent, #f59e0b);
  background: rgba(245,158,11,.12);
  color: var(--text, #e4e4f0);
  box-shadow: 0 0 0 1px rgba(245,158,11,.25);
}
.ce-model-name { font-size: 12px; font-weight: 600; }
.ce-model-note { font-size: 10px; opacity: .65; }

/* Transcribe button */
.ce-btn {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 8px 12px;
  border: none; border-radius: 6px;
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: opacity .15s;
  letter-spacing: .01em;
}
.ce-btn--primary { background: var(--accent, #f59e0b); color: #000; }
.ce-btn:disabled { opacity: .45; cursor: default; }
.ce-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

/* Progress */
.ce-progress-wrap {
  margin-top: 8px;
  position: relative;
  height: 20px;
  background: var(--surface2, #1e1e2e);
  border-radius: 4px;
  overflow: hidden;
}
.ce-progress-bar {
  position: absolute; inset: 0 auto 0 0;
  background: var(--accent, #f59e0b);
  opacity: .35;
  transition: width .3s;
}
.ce-progress-bar--indeterminate {
  width: 40% !important;
  animation: indeterminate 1.4s ease-in-out infinite;
}
@keyframes indeterminate {
  0%   { left: -40%; width: 40%; }
  60%  { left: 100%; width: 40%; }
  100% { left: 100%; width: 40%; }
}
.ce-progress-label {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600;
  color: var(--text, #e4e4f0);
}
.ce-error { font-size: 11px; color: #f87171; margin-top: 6px; line-height: 1.4; }

/* Style controls — 2-col grid */
.ce-style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-bottom: 8px;
}
.ce-style-cell { display: flex; flex-direction: column; gap: 5px; }
.ce-sublabel { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim, #888); }
.ce-seg { display: flex; gap: 2px; flex-wrap: wrap; }
.ce-seg-btn {
  padding: 3px 8px; font-size: 11px;
  border: 1px solid var(--border, #333); border-radius: 4px;
  background: transparent; color: var(--text-dim, #888);
  cursor: pointer; transition: all .15s;
}
.ce-seg-btn.active { background: var(--accent, #f59e0b); border-color: var(--accent, #f59e0b); color: #000; font-weight: 600; }
.ce-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text, #e4e4f0); cursor: pointer; }
.ce-check input { accent-color: var(--accent, #f59e0b); }

/* Segment list header */
.ce-seg-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ce-count {
  font-size: 10px; font-weight: 700;
  background: var(--surface2, #1e1e2e);
  border: 1px solid var(--border, #333);
  border-radius: 10px;
  padding: 1px 6px;
  color: var(--text-dim, #888);
  min-width: 20px; text-align: center;
}
.ce-seg-actions { display: flex; gap: 4px; margin-left: auto; }

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

/* Empty state */
.ce-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 20px 12px;
  border: 1px dashed var(--border, #333);
  border-radius: 8px;
  color: var(--text-dim, #888);
  font-size: 11px; text-align: center; line-height: 1.4;
}
.ce-empty svg { width: 28px; height: 28px; opacity: .4; }

/* Segment items */
.ce-seg-item {
  border: 1px solid var(--border, #333);
  border-left: 3px solid var(--accent, #f59e0b);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
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
