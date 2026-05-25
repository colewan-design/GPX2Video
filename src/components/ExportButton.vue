<template>
  <div class="export-wrap">
    <button
      v-if="!exporting"
      class="export-btn"
      :disabled="!canExport"
      @click="$emit('export')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Export MP4
    </button>

    <template v-else>
      <div class="export-progress-wrap">
        <span class="spinner" />
        <span class="export-pct">{{ Math.round(progress * 100) }}%</span>
        <div class="export-bar-track">
          <div class="export-bar-fill" :style="{ width: Math.round(progress * 100) + '%' }" />
        </div>
      </div>
      <button class="cancel-btn" @click="$emit('cancel')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/>
        </svg>
        Cancel
      </button>
    </template>

    <p v-if="exporting" class="export-hint">Keep this tab active</p>
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
  gap: 10px;
}
.export-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: .5rem .9rem;
  font-size: 13px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--bg2);
  border: 0.5px solid var(--border2);
  color: var(--text);
  transition: background .15s;
  white-space: nowrap;
}
.export-btn:hover:not(:disabled) { background: var(--bg3); }
.export-btn:disabled { opacity: .45; cursor: not-allowed; }
svg { width: 15px; height: 15px; flex-shrink: 0; }

.export-progress-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
}
.spinner {
  width: 13px; height: 13px;
  border: 1.5px solid rgba(255,255,255,.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.export-pct {
  font-size: 12px; font-weight: 600;
  color: var(--text); white-space: nowrap;
  min-width: 32px;
}
.export-bar-track {
  width: 80px; height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.export-bar-fill {
  height: 100%;
  background: var(--accent-blue, #06b6d4);
  border-radius: 2px;
  transition: width .1s linear;
}

.cancel-btn {
  display: flex; align-items: center; gap: 5px;
  padding: .4rem .75rem;
  font-size: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  border: 0.5px solid rgba(255, 90, 90, .45);
  color: #ff7070;
  transition: background .15s, border-color .15s;
  white-space: nowrap;
}
.cancel-btn:hover { background: rgba(255,90,90,.1); border-color: #ff7070; }
.cancel-btn svg { width: 13px; height: 13px; }

.export-hint  { font-size: 11px; color: var(--text3); white-space: nowrap; }
.export-error { font-size: 12px; color: #ff5a5a; }
</style>
