<template>
  <div class="export-wrap">
    <button
      class="export-btn"
      :disabled="exporting || !canExport"
      @click="$emit('export')"
    >
      <svg v-if="!exporting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span v-if="exporting" class="spinner" />
      {{ exporting ? `Exporting… ${Math.round(progress * 100)}%` : 'Export MP4' }}
    </button>
    <p v-if="exporting" class="export-hint">
      Playing through for export — keep this tab active
    </p>
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
defineEmits(['export'])
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
.spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(255,255,255,.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.export-hint  { font-size: 11px; color: var(--text3); white-space: nowrap; }
.export-error { font-size: 12px; color: #ff5a5a; }
</style>
