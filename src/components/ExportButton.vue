<template>
  <div class="export-wrap">
    <button
      v-if="!exporting"
      class="export-btn"
      :disabled="!canExport"
      @click="$emit('export')"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M10 3v10M6 9l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 16h12" stroke-linecap="round"/>
      </svg>
      Export MP4
    </button>

    <template v-else>
      <div class="export-progress-wrap">
        <span class="spinner" />
        <div class="export-bar-track">
          <div class="export-bar-fill" :style="{ width: Math.round(progress * 100) + '%' }" />
        </div>
        <span class="export-pct">{{ Math.round(progress * 100) }}%</span>
      </div>
      <button class="cancel-btn" @click="$emit('cancel')">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 5l10 10M15 5L5 15" stroke-linecap="round"/>
        </svg>
      </button>
    </template>

    <p v-if="exporting" class="export-hint">Keep tab active</p>
    <p v-if="error" class="export-error">{{ error }}</p>
  </div>
</template>

<script setup>
defineProps({
  exporting:  { type: Boolean, default: false },
  progress:   { type: Number,  default: 0 },
  canExport:  { type: Boolean, default: false },
  error:      { type: String,  default: null },
})
defineEmits(['export', 'cancel'])
</script>

<style scoped>
.export-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: .5rem 1rem;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--accent-semi);
  color: var(--accent);
  transition: all .15s;
  white-space: nowrap;
}
.export-btn:hover:not(:disabled) {
  background: var(--accent-dim);
  border-color: var(--accent);
  box-shadow: 0 0 18px rgba(255,214,10,.2);
}
.export-btn:disabled { opacity: .35; cursor: not-allowed; }
.export-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

.export-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.spinner {
  width: 12px; height: 12px;
  border: 1.5px solid var(--border2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .65s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.export-bar-track {
  width: 72px; height: 3px;
  background: var(--border2);
  border-radius: 2px;
  overflow: hidden;
}
.export-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width .1s linear;
  box-shadow: 0 0 6px var(--accent-glow);
}
.export-pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  min-width: 30px;
}
.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  padding: 0;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 77, 77, .35);
  background: transparent;
  color: #ff6b6b;
  cursor: pointer;
  transition: background .15s;
}
.cancel-btn:hover { background: rgba(255,77,77,.12); }
.cancel-btn svg { width: 12px; height: 12px; }
.export-hint { font-size: 10px; color: var(--text3); white-space: nowrap; }
.export-error { font-size: 11px; color: var(--red); }
</style>
