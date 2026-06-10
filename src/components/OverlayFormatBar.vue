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
  {
    id: 'dashboard',
    label: 'Dashboard',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- bottom dash bar -->
      <rect x="0" y="54" width="160" height="30" fill="#000" opacity=".82"/>
      <line x1="0" y1="54" x2="160" y2="54" stroke="#ffffff" stroke-width=".5" opacity=".1"/>
      <!-- left stat panel -->
      <rect x="0" y="54" width="24" height="30" fill="none"/>
      <line x1="24" y1="54" x2="24" y2="84" stroke="#ffffff" stroke-width=".5" opacity=".08"/>
      <rect x="3" y="58" width="10" height="4" rx="1" fill="#ffd60a" opacity=".7"/>
      <rect x="3" y="64" width="7" height="2" rx="1" fill="#444"/>
      <line x1="0" y1="68" x2="24" y2="68" stroke="#ffffff" stroke-width=".5" opacity=".06"/>
      <rect x="3" y="71" width="8" height="3.5" rx="1" fill="#ffd60a" opacity=".6"/>
      <rect x="3" y="76" width="6" height="2" rx="1" fill="#444"/>
      <!-- center-left panel -->
      <line x1="48" y1="54" x2="48" y2="84" stroke="#ffffff" stroke-width=".5" opacity=".08"/>
      <rect x="27" y="58" width="8" height="3.5" rx="1" fill="#ffd60a" opacity=".5"/>
      <rect x="27" y="63" width="6" height="2" rx="1" fill="#444"/>
      <rect x="27" y="71" width="10" height="3.5" rx="1" fill="#ffd60a" opacity=".5"/>
      <rect x="27" y="76" width="7" height="2" rx="1" fill="#444"/>
      <!-- elevation chart center -->
      <line x1="112" y1="54" x2="112" y2="84" stroke="#ffffff" stroke-width=".5" opacity=".08"/>
      <polyline points="48,80 60,74 72,68 82,65 92,62 100,63 112,60"
        fill="none" stroke="#ffd60a" stroke-width="1.5" opacity=".8" stroke-linecap="round"/>
      <polyline points="48,84 60,74 72,68 82,65 92,62 100,63 112,60 112,84"
        fill="#ffd60a" opacity=".06"/>
      <!-- right panel -->
      <line x1="136" y1="54" x2="136" y2="84" stroke="#ffffff" stroke-width=".5" opacity=".08"/>
      <rect x="115" y="58" width="8" height="3.5" rx="1" fill="#ffd60a" opacity=".5"/>
      <rect x="115" y="63" width="6" height="2" rx="1" fill="#444"/>
      <rect x="115" y="71" width="10" height="3.5" rx="1" fill="#ffd60a" opacity=".5"/>
      <rect x="115" y="76" width="7" height="2" rx="1" fill="#444"/>
      <!-- far-right panel -->
      <rect x="139" y="58" width="12" height="5" rx="1" fill="#ffd60a" opacity=".65"/>
      <rect x="139" y="65" width="8" height="2" rx="1" fill="#444"/>
      <rect x="139" y="71" width="10" height="3.5" rx="1" fill="#ffd60a" opacity=".55"/>
      <rect x="139" y="76" width="7" height="2" rx="1" fill="#444"/>
      <!-- progress bar -->
      <rect x="0" y="84" width="160" height="6" fill="#111"/>
      <rect x="0" y="84" width="95" height="3" fill="#ffd60a" opacity=".85"/>
      <!-- tick labels -->
      <rect x="25" y="87" width="6" height="1.5" rx=".75" fill="#555"/>
      <rect x="55" y="87" width="6" height="1.5" rx=".75" fill="#555"/>
      <rect x="85" y="87" width="6" height="1.5" rx=".75" fill="#555"/>
      <rect x="115" y="87" width="6" height="1.5" rx=".75" fill="#555"/>
    </svg>`,
  },
  {
    id: 'sticker1',
    label: 'Finisher',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <rect x="80" y="0" width="80" height="90" fill="#000" opacity=".88"/>
      <defs>
        <linearGradient id="s1tg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="20%" stop-color="#000" stop-opacity=".8"/>
        </linearGradient>
      </defs>
      <rect x="80" y="0" width="80" height="90" fill="url(#s1tg)"/>
      <!-- distance badge -->
      <text x="120" y="35" font-family="sans-serif" font-size="18" font-weight="900" fill="#ffd60a" text-anchor="middle" opacity=".95">228.86</text>
      <text x="120" y="45" font-family="sans-serif" font-size="7" font-weight="900" fill="#ffd60a" text-anchor="middle" letter-spacing="1">KM</text>
      <text x="120" y="53" font-family="sans-serif" font-size="5" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="2">FINISHER</text>
      <!-- divider -->
      <rect x="100" y="57" width="40" height=".5" fill="#fff" opacity=".2"/>
      <!-- stat rows -->
      <rect x="100" y="61" width="7" height="7" rx="1.5" fill="#ffd60a" opacity=".5"/>
      <rect x="110" y="62" width="28" height="2.5" rx="1" fill="#fff" opacity=".55"/>
      <rect x="110" y="67" width="20" height="2" rx="1" fill="#2a2b38"/>
      <rect x="100" y="72" width="7" height="7" rx="1.5" fill="#ffd60a" opacity=".5"/>
      <rect x="110" y="73" width="22" height="2.5" rx="1" fill="#fff" opacity=".55"/>
      <rect x="110" y="78" width="16" height="2" rx="1" fill="#2a2b38"/>
      <rect x="100" y="83" width="7" height="7" rx="1.5" fill="#ffd60a" opacity=".5"/>
    </svg>`,
  },
  {
    id: 'sticker2',
    label: 'Route',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#000814"/>
      <!-- route glow -->
      <polyline points="18,76 28,62 44,52 58,43 72,36 88,30 100,36 116,27 136,20"
        fill="none" stroke="#ffd60a" stroke-width="5" opacity=".12" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- route line -->
      <polyline points="18,76 28,62 44,52 58,43 72,36 88,30 100,36 116,27 136,20"
        fill="none" stroke="#ffd60a" stroke-width="1.5" opacity=".75" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- start (green) -->
      <circle cx="18" cy="76" r="4" fill="#00e676"/>
      <circle cx="18" cy="76" r="7" fill="none" stroke="#00e676" stroke-width="1" opacity=".35"/>
      <!-- end (red) -->
      <circle cx="136" cy="20" r="4" fill="#ff5252"/>
      <circle cx="136" cy="20" r="7" fill="none" stroke="#ff5252" stroke-width="1" opacity=".35"/>
      <!-- start badge -->
      <rect x="2" y="64" width="34" height="12" rx="2" fill="#000" opacity=".7"/>
      <rect x="2" y="64" width="34" height="12" rx="2" fill="none" stroke="#00e676" stroke-width=".5" opacity=".4"/>
      <text x="19" y="73" font-family="sans-serif" font-size="5.5" font-weight="800" fill="#fff" text-anchor="middle" opacity=".9">START</text>
      <!-- end badge -->
      <rect x="116" y="8" width="42" height="12" rx="2" fill="#000" opacity=".7"/>
      <rect x="116" y="8" width="42" height="12" rx="2" fill="none" stroke="#ff5252" stroke-width=".5" opacity=".4"/>
      <text x="137" y="17" font-family="sans-serif" font-size="5.5" font-weight="800" fill="#fff" text-anchor="middle" opacity=".9">END</text>
      <!-- stats box -->
      <rect x="106" y="58" width="50" height="28" rx="3" fill="#000" opacity=".75"/>
      <rect x="110" y="63" width="20" height="2.5" rx="1" fill="#555"/>
      <rect x="134" y="63" width="16" height="2.5" rx="1" fill="#ffd60a" opacity=".7"/>
      <rect x="110" y="70" width="14" height="2.5" rx="1" fill="#555"/>
      <rect x="134" y="70" width="16" height="2.5" rx="1" fill="#ffd60a" opacity=".7"/>
      <rect x="110" y="77" width="22" height="2.5" rx="1" fill="#555"/>
      <rect x="134" y="77" width="16" height="2.5" rx="1" fill="#ffd60a" opacity=".7"/>
    </svg>`,
  },
  {
    id: 'magene',
    label: 'Magene',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- Top-left: brand text -->
      <rect x="4" y="5" width="42" height="3" rx="1.5" fill="#fff" opacity=".6"/>
      <rect x="4" y="10" width="34" height="2" rx="1" fill="#fff" opacity=".35"/>
      <!-- Top-right: G-force box -->
      <rect x="133" y="4" width="23" height="23" rx="2" fill="#000" opacity=".5" stroke="rgba(255,255,255,.25)" stroke-width=".5"/>
      <line x1="133" y1="15.5" x2="156" y2="15.5" stroke="rgba(255,255,255,.15)" stroke-width=".4"/>
      <line x1="144.5" y1="4" x2="144.5" y2="27" stroke="rgba(255,255,255,.15)" stroke-width=".4"/>
      <circle cx="150" cy="11" r="4" fill="#ffd60a"/>
      <rect x="137" y="29" width="14" height="2" rx="1" fill="#fff" opacity=".5"/>
      <!-- Left stats: 3 blocks -->
      <rect x="4" y="28" width="22" height="2" rx="1" fill="#fff" opacity=".4"/>
      <rect x="4" y="32" width="16" height="5" rx="1.5" fill="#fff" opacity=".75"/>
      <rect x="4" y="42" width="22" height="2" rx="1" fill="#fff" opacity=".4"/>
      <rect x="4" y="46" width="14" height="5" rx="1.5" fill="#fff" opacity=".75"/>
      <rect x="4" y="56" width="28" height="2" rx="1" fill="#fff" opacity=".4"/>
      <rect x="4" y="60" width="20" height="5" rx="1.5" fill="#fff" opacity=".75"/>
      <!-- Right stats: 2 blocks -->
      <rect x="110" y="28" width="22" height="2" rx="1" fill="#fff" opacity=".4"/>
      <rect x="116" y="32" width="16" height="5" rx="1.5" fill="#fff" opacity=".75"/>
      <rect x="110" y="42" width="22" height="2" rx="1" fill="#fff" opacity=".4"/>
      <rect x="116" y="46" width="18" height="5" rx="1.5" fill="#fff" opacity=".75"/>
      <!-- Bottom-left: map square -->
      <rect x="4" y="68" width="22" height="22" rx="2" fill="#000" opacity=".55"/>
      <polyline points="6,88 10,82 14,76 18,80 24,73" fill="none" stroke="#ffd60a" stroke-width="1" opacity=".7" stroke-linecap="round"/>
      <rect x="5" y="87" width="8" height="1.5" rx=".75" fill="#fff" opacity=".5"/>
      <!-- Bottom-center: heading arc -->
      <path d="M 62 88 A 18 18 0 0 1 98 88" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="80" y1="72" x2="80" y2="78" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-linecap="round"/>
      <rect x="72" y="82" width="16" height="3" rx="1.5" fill="#fff" opacity=".6"/>
      <!-- Bottom-right: speed gauge (4-color arc) -->
      <circle cx="138" cy="96" r="26" fill="rgba(0,0,0,.55)"/>
      <circle cx="138" cy="96" r="26" fill="none" stroke="#22c55e" stroke-width="5" stroke-dasharray="30.63 132.73" stroke-dashoffset="0" stroke-linecap="butt" transform="rotate(-135 138 96)"/>
      <circle cx="138" cy="96" r="26" fill="none" stroke="#eab308" stroke-width="5" stroke-dasharray="30.63 132.73" stroke-dashoffset="-30.63" stroke-linecap="butt" transform="rotate(-135 138 96)"/>
      <circle cx="138" cy="96" r="26" fill="none" stroke="#f97316" stroke-width="5" stroke-dasharray="30.63 132.73" stroke-dashoffset="-61.26" stroke-linecap="butt" transform="rotate(-135 138 96)"/>
      <circle cx="138" cy="96" r="26" fill="none" stroke="#ef4444" stroke-width="5" stroke-dasharray="30.63 132.73" stroke-dashoffset="-91.89" stroke-linecap="butt" transform="rotate(-135 138 96)"/>
      <polygon points="138,71 135,79 141,79" fill="white" opacity=".9" transform="rotate(67.5 138 96)"/>
      <text x="138" y="99" font-family="sans-serif" font-size="10" font-weight="800" fill="white" text-anchor="middle">37</text>
    </svg>`,
  },
  {
    id: 'tac',
    label: 'Tactical',
    thumb: `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect width="160" height="90" fill="#0a0a0f"/>
      <!-- outer frame -->
      <rect x="1" y="1" width="158" height="88" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="0.7"/>
      <!-- corner brackets -->
      <polyline points="1,13 1,1 13,1" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.5"/>
      <polyline points="147,1 159,1 159,13" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.5"/>
      <polyline points="1,77 1,89 13,89" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.5"/>
      <polyline points="147,89 159,89 159,77" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.5"/>
      <!-- left panel bg -->
      <rect x="1" y="1" width="40" height="78" fill="rgba(0,0,0,0.6)"/>
      <!-- speed label + value -->
      <text x="5" y="11" font-family="sans-serif" font-size="4.5" font-weight="700" fill="rgba(255,255,255,0.42)" letter-spacing="1.5">SPEED</text>
      <text x="5" y="32" font-family="sans-serif" font-size="20" font-weight="800" fill="white">24</text>
      <text x="5" y="38" font-family="sans-serif" font-size="4" font-weight="700" fill="rgba(255,255,255,0.38)" letter-spacing="1.5">KM/H</text>
      <!-- mini sep -->
      <line x1="4" y1="43" x2="38" y2="43" stroke="rgba(255,255,255,0.14)" stroke-width="0.7"/>
      <!-- grade / pace rows -->
      <text x="5" y="50" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.32)" letter-spacing="0.8">GRADE</text>
      <text x="38" y="50" font-family="sans-serif" font-size="4.5" font-weight="700" fill="rgba(255,255,255,0.82)" text-anchor="end">+2.4%</text>
      <text x="5" y="57" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.32)" letter-spacing="0.8">PACE</text>
      <text x="38" y="57" font-family="sans-serif" font-size="4.5" font-weight="700" fill="rgba(255,255,255,0.82)" text-anchor="end">4:52</text>
      <!-- dist sep -->
      <line x1="4" y1="61" x2="38" y2="61" stroke="rgba(255,255,255,0.14)" stroke-width="0.7"/>
      <text x="5" y="68" font-family="sans-serif" font-size="4.5" font-weight="700" fill="rgba(255,255,255,0.42)" letter-spacing="1.5">DISTANCE</text>
      <text x="5" y="78" font-family="sans-serif" font-size="9" font-weight="800" fill="white">17.3</text>
      <!-- left vline -->
      <line x1="41" y1="4" x2="41" y2="79" stroke="rgba(255,255,255,0.22)" stroke-width="0.7"/>
      <!-- right panel bg -->
      <rect x="119" y="1" width="40" height="78" fill="rgba(0,0,0,0.6)"/>
      <!-- right vline -->
      <line x1="119" y1="4" x2="119" y2="79" stroke="rgba(255,255,255,0.22)" stroke-width="0.7"/>
      <!-- elevation -->
      <text x="122" y="13" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.38)" letter-spacing="0.8">ELEVATION</text>
      <text x="122" y="23" font-family="sans-serif" font-size="9" font-weight="800" fill="white">486</text>
      <line x1="120" y1="26" x2="158" y2="26" stroke="rgba(255,255,255,0.1)" stroke-width="0.7"/>
      <!-- remain -->
      <text x="122" y="34" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.38)" letter-spacing="0.8">REMAIN</text>
      <text x="122" y="44" font-family="sans-serif" font-size="9" font-weight="800" fill="white">8.2</text>
      <line x1="120" y1="47" x2="158" y2="47" stroke="rgba(255,255,255,0.1)" stroke-width="0.7"/>
      <!-- hr -->
      <text x="122" y="55" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.38)" letter-spacing="0.8">HEART RATE</text>
      <text x="122" y="65" font-family="sans-serif" font-size="9" font-weight="800" fill="white">145</text>
      <line x1="120" y1="68" x2="158" y2="68" stroke="rgba(255,255,255,0.1)" stroke-width="0.7"/>
      <!-- cadence -->
      <text x="122" y="76" font-family="sans-serif" font-size="3.8" font-weight="700" fill="rgba(255,255,255,0.38)" letter-spacing="0.8">CADENCE</text>
      <!-- bottom strip -->
      <rect x="1" y="79" width="158" height="10" fill="rgba(0,0,0,0.52)"/>
      <line x1="1" y1="79" x2="159" y2="79" stroke="rgba(255,255,255,0.14)" stroke-width="0.5"/>
      <line x1="6" y1="83" x2="154" y2="83" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
      <line x1="6" y1="83" x2="76" y2="83" stroke="rgba(255,255,255,0.72)" stroke-width="0.8"/>
      <text x="6"   y="88" font-family="sans-serif" font-size="3.5" font-weight="600" fill="rgba(255,255,255,0.42)">00:34</text>
      <text x="80"  y="88" font-family="sans-serif" font-size="3.5" font-weight="600" fill="rgba(255,255,255,0.42)" text-anchor="middle">25.5 KM</text>
      <text x="154" y="88" font-family="sans-serif" font-size="3.5" font-weight="600" fill="rgba(255,255,255,0.42)" text-anchor="end">01:08</text>
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
