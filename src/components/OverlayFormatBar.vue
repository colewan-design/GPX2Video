<template>
  <div class="overlay-studio">
    <div class="studio-label">Template</div>
    <div class="template-grid">
      <button
        v-for="f in FORMATS"
        :key="f.id"
        class="template-card"
        :class="{ active: modelValue === f.id }"
        @click="$emit('update:modelValue', f.id)"
      >
        <div class="tc-preview" v-html="f.thumb" />
        <span class="tc-name">{{ f.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const FORMATS = [
  {
    id: 'classic',
    label: 'Race Dash',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- progress bar -->
      <rect x="0" y="0" width="160" height="2.5" fill="#1c1d26"/>
      <rect x="0" y="0" width="95" height="2.5" fill="#ffd60a" opacity=".85"/>
      <!-- speed box top-left -->
      <rect x="5" y="7" width="44" height="32" rx="3" fill="#0d0e14" opacity=".92"/>
      <rect x="9" y="11" width="36" height="12" rx="1.5" fill="#ffd60a" opacity=".12"/>
      <rect x="13" y="13" width="28" height="8" rx="1" fill="#ffd60a" opacity=".55"/>
      <rect x="9" y="26" width="22" height="2.5" rx="1" fill="#2a2b38"/>
      <rect x="9" y="31" width="16" height="2" rx="1" fill="#1e1f2a"/>
      <!-- right stats panel -->
      <rect x="112" y="7" width="43" height="10" rx="2" fill="#0d0e14" opacity=".9"/>
      <rect x="116" y="10" width="12" height="4" rx="1" fill="#ffd60a" opacity=".5"/>
      <rect x="130" y="10" width="20" height="2.5" rx="1" fill="#2a2b38"/>
      <rect x="112" y="20" width="43" height="10" rx="2" fill="#0d0e14" opacity=".9"/>
      <rect x="116" y="23" width="10" height="4" rx="1" fill="#3a8fff" opacity=".5"/>
      <rect x="128" y="23" width="22" height="2.5" rx="1" fill="#2a2b38"/>
      <rect x="112" y="33" width="43" height="10" rx="2" fill="#0d0e14" opacity=".9"/>
      <rect x="116" y="36" width="14" height="4" rx="1" fill="#ff7a3a" opacity=".5"/>
      <rect x="132" y="36" width="18" height="2.5" rx="1" fill="#2a2b38"/>
      <!-- elevation chart bottom -->
      <rect x="0" y="69" width="160" height="21" fill="#0d0e14" opacity=".88"/>
      <polyline points="0,87 18,83 35,80 55,77 75,74 95,76 115,73 135,75 160,78"
        fill="none" stroke="#ffd60a" stroke-width="1.5" opacity=".7"/>
      <polyline points="0,90 18,83 35,80 55,77 75,74 95,76 115,73 135,75 160,78 160,90"
        fill="#ffd60a" opacity=".07"/>
    </svg>`,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- bottom thin accent line -->
      <rect x="0" y="87.5" width="160" height="2.5" fill="#1c1d26"/>
      <rect x="0" y="87.5" width="60" height="2.5" fill="#ffd60a" opacity=".8"/>
      <!-- small speed badge bottom-left -->
      <rect x="6" y="64" width="38" height="22" rx="4" fill="#0d0e14" opacity=".9"/>
      <rect x="6" y="64" width="38" height="22" rx="4" fill="none" stroke="#ffd60a" stroke-width=".8" opacity=".3"/>
      <rect x="12" y="69" width="26" height="8" rx="1.5" fill="#ffd60a" opacity=".18"/>
      <rect x="14" y="70.5" width="22" height="5" rx="1" fill="#ffd60a" opacity=".6"/>
      <rect x="14" y="78" width="14" height="2" rx="1" fill="#2a2b38"/>
    </svg>`,
  },
  {
    id: 'gopro',
    label: 'GoPro',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- full-width bottom bar -->
      <rect x="0" y="63" width="160" height="27" fill="#000" opacity=".88"/>
      <line x1="40" y1="65" x2="40" y2="89" stroke="#222" stroke-width="1"/>
      <line x1="80" y1="65" x2="80" y2="89" stroke="#222" stroke-width="1"/>
      <line x1="120" y1="65" x2="120" y2="89" stroke="#222" stroke-width="1"/>
      <!-- col 1: speed -->
      <rect x="6" y="69" width="22" height="7" rx="1.5" fill="#fff" opacity=".18"/>
      <rect x="6" y="79" width="14" height="2.5" rx="1" fill="#555"/>
      <!-- col 2: hr -->
      <rect x="46" y="69" width="18" height="7" rx="1.5" fill="#ff6b6b" opacity=".22"/>
      <rect x="46" y="79" width="12" height="2.5" rx="1" fill="#555"/>
      <!-- col 3: power -->
      <rect x="86" y="69" width="22" height="7" rx="1.5" fill="#ffd60a" opacity=".18"/>
      <rect x="86" y="79" width="16" height="2.5" rx="1" fill="#555"/>
      <!-- col 4: elev -->
      <rect x="126" y="69" width="20" height="7" rx="1.5" fill="#3a8fff" opacity=".18"/>
      <rect x="126" y="79" width="12" height="2.5" rx="1" fill="#555"/>
    </svg>`,
  },
  {
    id: 'sport',
    label: 'Sport',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity=".92"/>
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="#0a0a0f"/>
      <rect x="0" y="35" width="160" height="55" fill="url(#sg)"/>
      <!-- large centered speed value -->
      <rect x="52" y="58" width="56" height="18" rx="3" fill="#ffd60a" opacity=".12"/>
      <rect x="57" y="61" width="46" height="12" rx="2" fill="#ffd60a" opacity=".45"/>
      <!-- unit label -->
      <rect x="65" y="77" width="30" height="3" rx="1.5" fill="#ffd60a" opacity=".3"/>
      <!-- accent line -->
      <rect x="28" y="83" width="104" height="1.5" rx="1" fill="#ffd60a" opacity=".35"/>
    </svg>`,
  },
  {
    id: 'cycling',
    label: 'Cycling',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- top bar -->
      <rect x="0" y="0" width="160" height="26" fill="#0d0e14" opacity=".95"/>
      <!-- power (wider, accent) -->
      <rect x="4" y="4" width="44" height="18" rx="2" fill="#ffd60a" opacity=".08"/>
      <rect x="4" y="4" width="44" height="18" rx="2" fill="none" stroke="#ffd60a" stroke-width=".8" opacity=".25"/>
      <rect x="8" y="8" width="22" height="10" rx="1.5" fill="#ffd60a" opacity=".5"/>
      <rect x="32" y="9" width="12" height="3" rx="1" fill="#2a2b38"/>
      <rect x="32" y="14" width="10" height="2" rx="1" fill="#1e1f2a"/>
      <!-- dividers -->
      <line x1="52" y1="5" x2="52" y2="23" stroke="#1c1d26" stroke-width="1"/>
      <line x1="90" y1="5" x2="90" y2="23" stroke="#1c1d26" stroke-width="1"/>
      <line x1="126" y1="5" x2="126" y2="23" stroke="#1c1d26" stroke-width="1"/>
      <!-- cadence -->
      <rect x="57" y="9" width="16" height="7" rx="1.5" fill="#fff" opacity=".12"/>
      <rect x="57" y="18" width="10" height="2" rx="1" fill="#2a2b38"/>
      <!-- hr -->
      <rect x="95" y="9" width="16" height="7" rx="1.5" fill="#ff6b6b" opacity=".2"/>
      <rect x="95" y="18" width="10" height="2" rx="1" fill="#2a2b38"/>
      <!-- speed -->
      <rect x="131" y="9" width="24" height="7" rx="1.5" fill="#fff" opacity=".1"/>
      <rect x="131" y="18" width="16" height="2" rx="1" fill="#2a2b38"/>
      <!-- elevation sparkline bottom -->
      <polyline points="0,90 25,82 50,76 80,72 110,68 140,71 160,73"
        fill="none" stroke="#ffd60a" stroke-width="1.2" opacity=".3"/>
    </svg>`,
  },
]

defineProps({ modelValue: { type: String, default: 'classic' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.overlay-studio { margin-bottom: .75rem; }
.studio-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text3);
  margin-bottom: .55rem;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: .4rem .35rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border2);
  background: var(--bg3);
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.template-card:hover {
  border-color: var(--accent-semi);
  background: rgba(255,214,10,.04);
}
.template-card.active {
  border-color: var(--accent);
  background: rgba(255,214,10,.08);
  box-shadow: 0 0 12px rgba(255,214,10,.12);
}
.tc-preview {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 4px;
  overflow: hidden;
  display: block;
  line-height: 0;
}
.tc-preview :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.tc-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text2);
  letter-spacing: .03em;
  text-align: center;
}
.active .tc-name { color: var(--accent); }
</style>
