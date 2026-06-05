<template>
  <div class="lp">

    <!-- ── Nav ────────────────────────────────────────── -->
    <nav class="nav">
      <a class="nav-logo" href="#">GPX2VIDEO</a>
      <ul class="nav-links">
        <li><a href="#features" @click.prevent="scrollTo('features')">Features</a></li>
        <li><a href="#overlays" @click.prevent="scrollTo('overlays')">Overlays</a></li>
        <li><a href="#how"      @click.prevent="scrollTo('how')">How it works</a></li>
      </ul>
      <a class="nav-cta" @click.prevent="$emit('launch')">LAUNCH APP</a>
    </nav>

    <!-- ── Hero ───────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-content">
        <p class="hero-eyebrow">Browser-based GPS video editor</p>
        <h1 class="hero-title">
          Your ride.<br>Your data.<br><span>Your story.</span>
        </h1>
        <p class="hero-sub">
          Overlay speed, elevation and a live route map onto any video.
          Export H.264 MP4. Fully in your browser — nothing leaves your device.
        </p>
        <div class="hero-actions">
          <a class="btn-white" @click.prevent="$emit('launch')">OPEN THE EDITOR</a>
          <a class="btn-outline" href="#features" @click.prevent="scrollTo('features')">EXPLORE FEATURES</a>
        </div>
      </div>
      <div class="hero-video-wrap">
        <video
          class="hero-video"
          src="/photos/gpxdemo.mp4"
          autoplay
          loop
          muted
          playsinline
        />
      </div>
      <div class="hero-scroll-hint">
        <span>SCROLL</span>
        <div class="hero-scroll-line" />
      </div>
    </section>

    <!-- ── Feature cards (Revolution-style grid) ─────── -->
    <section id="features" class="cards-section">
      <div class="cards-header">
        <p class="section-eyebrow">Four core capabilities</p>
        <h2 class="section-title">Everything you need<br>to tell your story.</h2>
      </div>
      <div class="cards-grid">
        <div v-for="c in cards" :key="c.title" class="feature-card" :class="c.class">
          <div class="feature-card-content">
            <p class="fc-tag">{{ c.tag }}</p>
            <h3 class="fc-title">{{ c.headline }}</h3>
            <p class="fc-body">{{ c.body }}</p>
            <a class="fc-link" href="#how">Learn more →</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Privacy split ──────────────────────────────── -->
    <section class="split-section">
      <div class="split-text">
        <p class="section-eyebrow">Privacy first</p>
        <h2 class="split-title">Your footage.<br>Never leaves<br>your device.</h2>
        <p class="split-body">
          GPX2Video runs entirely on WebCodecs — the browser's native video engine.
          No upload. No account. No cloud storage. Just your files, your browser,
          and a finished MP4.
        </p>
        <a class="btn-white" @click.prevent="$emit('launch')">TRY IT FREE</a>
      </div>
      <div class="split-visual">
        <img src="/photos/activity-integrated.jpg" alt="GPX2Video app preview" class="split-img" />
      </div>
    </section>

    <!-- ── Overlays showcase ──────────────────────────── -->
    <section id="overlays" class="overlays-section">
      <div class="overlays-header">
        <p class="section-eyebrow">Five overlay styles</p>
        <h2 class="section-title">Built for every sport.</h2>
      </div>
      <div class="overlays-strip">
        <div v-for="o in overlays" :key="o.name" class="overlay-card">
          <div class="oc-thumb" :class="o.bg">
            <div class="oc-svg-overlay" v-html="o.thumb" />
          </div>
          <div class="oc-footer">
            <span class="oc-name">{{ o.name }}</span>
            <span class="oc-sport">{{ o.sport }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Stats row ──────────────────────────────────── -->
    <div class="stats-row">
      <div v-for="s in stats" :key="s.label" class="stat-item">
        <div class="si-num">{{ s.num }}</div>
        <div class="si-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- ── How it works ───────────────────────────────── -->
    <section id="how" class="how-section">
      <div class="how-header">
        <p class="section-eyebrow">Simple workflow</p>
        <h2 class="section-title">From raw footage<br>to finished video.</h2>
      </div>
      <div class="how-steps">
        <div v-for="(s, i) in steps" :key="s.title" class="how-step">
          <div class="hs-number">{{ String(i + 1).padStart(2, '0') }}</div>
          <div class="hs-divider" />
          <h3 class="hs-title">{{ s.title }}</h3>
          <p class="hs-body">{{ s.body }}</p>
        </div>
      </div>
    </section>

    <!-- ── CTA ────────────────────────────────────────── -->
    <section class="cta-section">
      <p class="section-eyebrow">Ready to start?</p>
      <h2 class="cta-title">Drop your files.<br>Export your ride.</h2>
      <p class="cta-sub">Works in Chrome and Edge. No account. No upload. Always free.</p>
      <a class="btn-white cta-btn" @click.prevent="$emit('launch')">OPEN GPX2VIDEO</a>
    </section>

    <!-- ── Footer ─────────────────────────────────────── -->
    <footer class="site-footer">
      <div class="footer-top">
        <span class="footer-logo">GPX2VIDEO</span>
        <nav class="footer-nav">
          <a href="#features" @click.prevent="scrollTo('features')">Features</a>
          <a href="#overlays" @click.prevent="scrollTo('overlays')">Overlays</a>
          <a href="#how"      @click.prevent="scrollTo('how')">How it works</a>
          <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
        </nav>
      </div>
      <div class="footer-bottom">
        <span>© 2025 GPX2Video — built in the browser, for the browser.</span>
        <span>No server. No upload. No account.</span>
      </div>
    </footer>

  </div>
</template>

<script setup>
defineEmits(['launch'])

function scrollTo(id) {
  const el = document.getElementById(id)
  if (!el) return
  const navH = document.querySelector('.nav')?.offsetHeight ?? 64
  const top = el.getBoundingClientRect().top + window.scrollY - navH
  window.scrollTo({ top, behavior: 'smooth' })
}

const cards = [
  {
    tag: '01 — GPS Sync',
    headline: 'Auto-synced.\nZero effort.',
    body: 'Reads your video\'s MP4 creation time and matches it with your GPX recording start. No manual scrubbing required.',
    class: 'fc--gps',
  },
  {
    tag: '02 — Video Editor',
    headline: 'Cut.\nTrim.\nReorder.',
    body: 'Multi-clip timeline editor. Split, trim, delete and rearrange clips. Every cut is honoured frame-accurately in the export.',
    class: 'fc--edit',
  },
  {
    tag: '03 — Live HUD',
    headline: 'Speed.\nElevation.\nDistance.',
    body: 'Five HUD styles render your GPS stats in real time — with a heading-up route map inset in the corner of every frame.',
    class: 'fc--hud',
  },
  {
    tag: '04 — Export',
    headline: 'H.264.\nMP4.\nYour device.',
    body: 'WebCodecs encodes every frame with the overlay burned in. Crisp 1080p MP4 downloads directly — nothing is uploaded.',
    class: 'fc--export',
  },
]

const overlays = [
  {
    name: 'Race Dash', sport: 'All sports', bg: 'ov-classic', color: '#ffd60a',
    thumb: `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs><linearGradient id="c-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".82"/></linearGradient></defs>
      <rect x="0" y="0" width="90" height="1.5" fill="#1c1d26"/>
      <rect x="0" y="0" width="55" height="1.5" fill="#ffd60a"/>
      <rect x="68" y="3" width="20" height="15" rx="2" fill="rgba(0,0,0,.6)" stroke="rgba(255,255,255,.2)" stroke-width=".5"/>
      <polyline points="70,16 73,12 76,14 79,9 82,11 86,9" fill="none" stroke="rgba(255,255,255,.15)" stroke-width=".8"/>
      <polyline points="70,16 73,12 76,14 79,9" fill="none" stroke="#ffd60a" stroke-width="1.2"/>
      <circle cx="79" cy="9" r="1.2" fill="white"/>
      <rect x="0" y="2" width="24" height="30" fill="rgba(0,0,0,.55)"/>
      <rect x="2" y="4" width="14" height="1.5" rx=".5" fill="rgba(255,255,255,.3)"/>
      <rect x="2" y="8" width="20" height="2.5" rx=".5" fill="#ffd60a" opacity=".75"/>
      <rect x="2" y="13" width="20" height="2" rx=".5" fill="rgba(255,255,255,.25)"/>
      <rect x="2" y="17" width="20" height="2" rx=".5" fill="rgba(255,255,255,.2)"/>
      <rect x="2" y="21" width="20" height="2" rx=".5" fill="rgba(255,255,255,.15)"/>
      <rect x="2" y="25" width="20" height="2" rx=".5" fill="rgba(255,255,255,.1)"/>
      <rect x="27" y="4" width="20" height="4" rx=".5" fill="rgba(255,255,255,.65)"/>
      <rect x="27" y="10" width="12" height="2" rx=".5" fill="rgba(255,255,255,.25)"/>
      <polyline points="27,28 33,24 41,20 50,17 58,19 65,15" fill="none" stroke="rgba(255,214,10,.4)" stroke-width=".9"/>
      <polyline points="27,28 33,24 41,20 50,17" fill="none" stroke="#ffd60a" stroke-width="1.2"/>
      <circle cx="50" cy="17" r="1.5" fill="#ffd60a"/>
      <circle cx="5" cy="43" r="3" fill="none" stroke="#ffd60a" stroke-width=".7"/>
      <circle cx="5" cy="43" r="1.2" fill="none" stroke="#ffd60a" stroke-width=".7"/>
      <rect x="11" y="41" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <polygon points="5,52 3,56 7,56" fill="none" stroke="#ffd60a" stroke-width=".7"/>
      <rect x="11" y="51" width="12" height="2.2" rx=".5" fill="rgba(255,255,255,.65)"/>
      <rect x="11" y="54.5" width="12" height="2.2" rx=".5" fill="rgba(255,255,255,.5)"/>
      <path d="M4.5,63 L6,60 L6,62.5 L7.5,62.5 L6,66 L6,63.5 Z" fill="#ffd60a" opacity=".75"/>
      <rect x="11" y="62" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <circle cx="5" cy="74" r="3" fill="none" stroke="#ffd60a" stroke-width=".7"/>
      <line x1="5" y1="74" x2="5" y2="72" stroke="#ffd60a" stroke-width=".7"/>
      <line x1="5" y1="74" x2="7.5" y2="74" stroke="#ffd60a" stroke-width=".7"/>
      <rect x="11" y="72" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <rect x="67" y="41" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <path d="M81.5,41 L80,44 L81.5,44 L79.5,48 L79.5,44 L78,44 Z" fill="#ffd60a" opacity=".75"/>
      <rect x="67" y="51" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <rect x="81" y="51" width="5" height="5" rx=".5" fill="#ffd60a" opacity=".45"/>
      <rect x="67" y="61" width="8" height="3" rx=".5" fill="rgba(255,255,255,.4)"/>
      <circle cx="83" cy="63" r="2.8" fill="none" stroke="#ffd60a" stroke-width=".7"/>
      <circle cx="83" cy="63" r="1.2" fill="none" stroke="#ffd60a" stroke-width=".6"/>
      <rect x="67" y="71" width="12" height="3" rx=".5" fill="rgba(255,255,255,.7)"/>
      <path d="M81,71.5 Q82,70 83,71.5 Q84,70 85,71.5 L83,74.5 Z" fill="#ffd60a" opacity=".75"/>
      <rect x="0" y="82" width="90" height="48" fill="url(#c-fade)"/>
      <circle cx="17" cy="121" r="13" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2.5" stroke-dasharray="61.26 20.42" stroke-linecap="round" transform="rotate(-135 17 121)"/>
      <circle cx="17" cy="121" r="13" fill="none" stroke="#ffd60a" stroke-width="2.5" stroke-dasharray="32.65 49.03" stroke-linecap="round" transform="rotate(-135 17 121)"/>
      <text x="17" y="124" fill="white" font-size="6.5" font-weight="700" text-anchor="middle" font-family="sans-serif">32</text>
      <text x="17" y="129" fill="rgba(255,255,255,.45)" font-size="3" text-anchor="middle" font-family="sans-serif">km/h</text>
      <text x="45" y="97" fill="rgba(255,255,255,.4)" font-size="3.5" text-anchor="middle" font-family="sans-serif">TEMPO</text>
      <rect x="33" y="115" width="3.5" height="8" rx=".5" fill="rgba(255,255,255,.15)"/>
      <rect x="37.5" y="112" width="3.5" height="11" rx=".5" fill="rgba(255,255,255,.15)"/>
      <rect x="42" y="106" width="3.5" height="17" rx=".5" fill="#ffd60a" opacity=".8"/>
      <rect x="46.5" y="110" width="3.5" height="13" rx=".5" fill="rgba(255,255,255,.15)"/>
      <rect x="51" y="113" width="3.5" height="10" rx=".5" fill="rgba(255,255,255,.15)"/>
      <circle cx="73" cy="121" r="13" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2.5" stroke-dasharray="61.26 20.42" stroke-linecap="round" transform="rotate(-135 73 121)"/>
      <circle cx="73" cy="121" r="13" fill="none" stroke="#ffd60a" stroke-width="2.5" stroke-dasharray="36.76 44.92" stroke-linecap="round" transform="rotate(-135 73 121)"/>
      <text x="73" y="124" fill="white" font-size="6.5" font-weight="700" text-anchor="middle" font-family="sans-serif">78</text>
      <text x="73" y="129" fill="rgba(255,255,255,.45)" font-size="3" text-anchor="middle" font-family="sans-serif">rpm</text>
    </svg>`,
  },
  {
    name: 'Minimal', sport: 'Running', bg: 'ov-minimal', color: '#ffd60a',
    thumb: `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="0" y="100" width="90" height="30" fill="rgba(10,10,20,.88)"/>
      <rect x="0" y="100" width="90" height=".8" fill="rgba(255,255,255,.1)"/>
      <line x1="22.5" y1="103" x2="22.5" y2="128" stroke="rgba(255,255,255,.12)" stroke-width=".7"/>
      <line x1="45" y1="103" x2="45" y2="128" stroke="rgba(255,255,255,.12)" stroke-width=".7"/>
      <line x1="67.5" y1="103" x2="67.5" y2="128" stroke="rgba(255,255,255,.12)" stroke-width=".7"/>
      <text x="11.25" y="115" fill="white" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">32</text>
      <text x="11.25" y="121" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">km/h</text>
      <text x="11.25" y="126" fill="rgba(255,255,255,.35)" font-size="3" text-anchor="middle" font-family="sans-serif">Speed</text>
      <text x="33.75" y="115" fill="white" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">748</text>
      <text x="33.75" y="121" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">m</text>
      <text x="33.75" y="126" fill="rgba(255,255,255,.35)" font-size="3" text-anchor="middle" font-family="sans-serif">Elevation</text>
      <text x="56.25" y="115" fill="white" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">14.2</text>
      <text x="56.25" y="121" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">km</text>
      <text x="56.25" y="126" fill="rgba(255,255,255,.35)" font-size="3" text-anchor="middle" font-family="sans-serif">Distance</text>
      <text x="78.75" y="115" fill="white" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">+2%</text>
      <text x="78.75" y="126" fill="rgba(255,255,255,.35)" font-size="3" text-anchor="middle" font-family="sans-serif">Grade</text>
    </svg>`,
  },
  {
    name: 'GoPro', sport: 'MTB / Moto', bg: 'ov-gopro', color: '#ffd60a',
    thumb: `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="3" y="8" fill="rgba(255,255,255,.55)" font-size="3.5" font-family="sans-serif">41°23'15.2" N</text>
      <text x="3" y="13" fill="rgba(255,255,255,.55)" font-size="3.5" font-family="sans-serif">002°10'02.5" E</text>
      <polygon points="45,3 47,11 45,9.5 43,11" fill="#ffd60a"/>
      <polygon points="45,18 47,10 45,11.5 43,10" fill="rgba(255,255,255,.3)"/>
      <text x="45" y="24" fill="rgba(255,255,255,.7)" font-size="4.5" text-anchor="middle" font-family="sans-serif" font-weight="600">245° SW</text>
      <rect x="2" y="38" width="26" height="56" rx="2" fill="rgba(0,0,0,.55)"/>
      <polygon points="15,43 11,50 19,50" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.2"/>
      <line x1="15" y1="46" x2="15" y2="50" stroke="rgba(255,255,255,.75)" stroke-width="1"/>
      <text x="15" y="55" fill="rgba(255,255,255,.5)" font-size="3" text-anchor="middle" font-family="sans-serif" letter-spacing=".5">SLOPE</text>
      <text x="15" y="64" fill="white" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">8%</text>
      <line x1="4" y1="69" x2="26" y2="69" stroke="rgba(255,255,255,.12)" stroke-width=".7"/>
      <polygon points="15,73 11,79 19,79" fill="rgba(255,255,255,.75)"/>
      <text x="15" y="84" fill="rgba(255,255,255,.5)" font-size="3" text-anchor="middle" font-family="sans-serif" letter-spacing=".3">ELEVATION</text>
      <text x="15" y="92" fill="white" font-size="6" font-weight="700" text-anchor="middle" font-family="sans-serif">748 M</text>
      <circle cx="58" cy="118" r="22" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3" stroke-dasharray="103.67 34.56" stroke-linecap="round" transform="rotate(-135 58 118)"/>
      <circle cx="58" cy="118" r="22" fill="none" stroke="#ffd60a" stroke-width="3" stroke-dasharray="55.26 83.0" stroke-linecap="round" transform="rotate(-135 58 118)"/>
      <text x="37" y="130" fill="rgba(255,255,255,.4)" font-size="3.5" font-family="sans-serif">0</text>
      <text x="75" y="130" fill="rgba(255,255,255,.4)" font-size="3.5" text-anchor="end" font-family="sans-serif">60</text>
      <text x="58" y="122" fill="white" font-size="14" font-weight="700" text-anchor="middle" font-family="sans-serif">32</text>
      <text x="58" y="129" fill="rgba(255,255,255,.6)" font-size="3.5" text-anchor="middle" font-family="sans-serif" letter-spacing="1">KM/H</text>
    </svg>`,
  },
  {
    name: 'Sport', sport: 'Triathlon', bg: 'ov-sport', color: '#ffd60a',
    thumb: `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <text x="4" y="12" fill="white" font-size="12" font-weight="700" font-family="sans-serif">14.2</text>
      <text x="4" y="18" fill="#ffd60a" font-size="4" font-weight="700" font-family="sans-serif" letter-spacing="1">KM</text>
      <text x="87" y="9" fill="rgba(255,255,255,.45)" font-size="3.5" font-family="sans-serif" text-anchor="end">41°23'15.2" N</text>
      <text x="87" y="14" fill="rgba(255,255,255,.45)" font-size="3.5" font-family="sans-serif" text-anchor="end">002°10'02.5" E</text>
      <text x="4" y="52" fill="rgba(255,255,255,.5)" font-size="3.5" font-weight="700" font-family="sans-serif" letter-spacing="1">SLOPE</text>
      <text x="4" y="65" fill="white" font-size="13" font-weight="700" font-family="sans-serif">2.45</text>
      <text x="4" y="71" fill="#ffd60a" font-size="4.5" font-weight="700" font-family="sans-serif">%</text>
      <circle cx="62" cy="100" r="24" fill="rgba(0,12,28,.8)"/>
      <line x1="62" y1="76.5" x2="62" y2="79" stroke="rgba(255,214,10,.25)" stroke-width=".8"/>
      <line x1="80.5" y1="81.5" x2="79" y2="83.3" stroke="rgba(255,214,10,.25)" stroke-width=".8"/>
      <line x1="85.5" y1="100" x2="83" y2="100" stroke="rgba(255,214,10,.25)" stroke-width=".8"/>
      <line x1="43.5" y1="81.5" x2="45" y2="83.3" stroke="rgba(255,214,10,.25)" stroke-width=".8"/>
      <line x1="38.5" y1="100" x2="41" y2="100" stroke="rgba(255,214,10,.25)" stroke-width=".8"/>
      <circle cx="62" cy="100" r="20" fill="none" stroke="rgba(255,214,10,.15)" stroke-width="2.5" stroke-dasharray="94.25 31.42" stroke-linecap="round" transform="rotate(135 62 100)"/>
      <circle cx="62" cy="100" r="20" fill="none" stroke="#ffd60a" stroke-width="2.5" stroke-dasharray="16.78 108.89" stroke-linecap="round" transform="rotate(135 62 100)"/>
      <text x="42" y="121" fill="rgba(255,214,10,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">0</text>
      <text x="62" y="81" fill="rgba(255,214,10,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">90</text>
      <text x="82" y="121" fill="rgba(255,214,10,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif">180</text>
      <text x="62" y="96" fill="#ffd60a" font-size="3.5" font-weight="700" text-anchor="middle" font-family="sans-serif" letter-spacing="1">SPEED</text>
      <text x="62" y="107" fill="white" font-size="12" font-weight="700" text-anchor="middle" font-family="sans-serif">32</text>
      <text x="62" y="114" fill="#ffd60a" font-size="3.5" font-weight="700" text-anchor="middle" font-family="sans-serif" letter-spacing="1">KM/H</text>
    </svg>`,
  },
  {
    name: 'Cycling', sport: 'Road / Gravel', bg: 'ov-cycling', color: '#ffd60a',
    thumb: `<svg viewBox="0 0 90 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <rect x="0" y="0" width="90" height="22" fill="rgba(13,14,20,.95)"/>
      <line x1="30" y1="2" x2="30" y2="20" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>
      <line x1="60" y1="2" x2="60" y2="20" stroke="rgba(255,255,255,.1)" stroke-width=".7"/>
      <text x="15" y="9" fill="rgba(255,255,255,.45)" font-size="3" text-anchor="middle" font-family="sans-serif" letter-spacing=".5">ELEVATION</text>
      <text x="15" y="18" fill="white" font-size="7" font-weight="700" text-anchor="middle" font-family="sans-serif">748 M</text>
      <circle cx="45" cy="11" r="7" fill="none" stroke="rgba(255,255,255,.2)" stroke-width=".7"/>
      <text x="45" y="7.5" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif" font-weight="700">N</text>
      <text x="45" y="17.5" fill="rgba(255,255,255,.3)" font-size="3" text-anchor="middle" font-family="sans-serif">S</text>
      <text x="39.5" y="13" fill="rgba(255,255,255,.3)" font-size="3" text-anchor="middle" font-family="sans-serif">W</text>
      <text x="50.5" y="13" fill="rgba(255,255,255,.3)" font-size="3" text-anchor="middle" font-family="sans-serif">E</text>
      <polygon points="45,5 46.5,10 45,9 43.5,10" fill="#ffd60a"/>
      <polygon points="45,17 46.5,12 45,13 43.5,12" fill="rgba(255,255,255,.3)"/>
      <text x="75" y="9" fill="rgba(255,255,255,.45)" font-size="3" text-anchor="middle" font-family="sans-serif" letter-spacing=".3">TOTAL DIST</text>
      <text x="75" y="18" fill="white" font-size="7" font-weight="700" text-anchor="middle" font-family="sans-serif">14.2 KM</text>
      <text x="26" y="33" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif" letter-spacing="1">SPEED</text>
      <circle cx="26" cy="108" r="28" fill="none" stroke="rgba(255,214,10,.15)" stroke-width="5" stroke-dasharray="131.95 43.98" stroke-linecap="round" transform="rotate(135 26 108)"/>
      <circle cx="26" cy="108" r="28" fill="none" stroke="#ffd60a" stroke-width="5" stroke-dasharray="70.34 105.59" stroke-linecap="round" transform="rotate(135 26 108)"/>
      <text x="3" y="101" fill="rgba(255,214,10,.45)" font-size="3.5" font-family="sans-serif">0</text>
      <text x="49" y="101" fill="rgba(255,214,10,.45)" font-size="3.5" font-family="sans-serif">60</text>
      <text x="26" y="88" fill="white" font-size="20" font-weight="700" text-anchor="middle" font-family="sans-serif">32</text>
      <text x="26" y="96" fill="#ffd60a" font-size="3.5" font-weight="700" text-anchor="middle" font-family="sans-serif" letter-spacing="1">KM/H</text>
      <text x="68" y="50" fill="rgba(255,255,255,.5)" font-size="3.5" text-anchor="middle" font-family="sans-serif" letter-spacing="1">SLOPE</text>
      <text x="68" y="78" fill="white" font-size="20" font-weight="700" text-anchor="middle" font-family="sans-serif">2.45</text>
      <text x="68" y="88" fill="#ffd60a" font-size="5" font-weight="700" text-anchor="middle" font-family="sans-serif">%</text>
      <text x="45" y="122" fill="rgba(255,255,255,.35)" font-size="3.5" text-anchor="middle" font-family="sans-serif">002°10'02.5" E</text>
      <text x="45" y="128" fill="rgba(255,255,255,.35)" font-size="3.5" text-anchor="middle" font-family="sans-serif">41°23'15.2" N</text>
    </svg>`,
  },
]

const stats = [
  { num: '100%', label: 'Client-side processing' },
  { num: '5',    label: 'Overlay styles' },
  { num: '1080p',label: 'Export resolution' },
  { num: '0',    label: 'Uploads required' },
]

const steps = [
  { title: 'Load your files',   body: 'Drop a .gpx from Strava, Garmin or Komoot. Drop your video — any format your browser can play.' },
  { title: 'Sync is automatic', body: 'The app reads the MP4 creation timestamp and your GPS start. Offset computed instantly.' },
  { title: 'Edit and style',    body: 'Trim clips on the timeline, pick an overlay style, apply a WebGL color grade. Preview live.' },
  { title: 'Export and share',  body: 'Hit Export. A crisp H.264 MP4 downloads to your device. No waiting room, no server queue.' },
]
</script>

<style scoped>
/* ── Reset + base ──────────────────────────────────── */
.lp {
  background: #fff;
  color: #1d1d1f;
  font-family: 'Montserrat', sans-serif;
  line-height: 1.55;
  overflow-x: hidden;
}

/* ── Nav ───────────────────────────────────────────── */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 5vw; height: 64px;
  background: rgba(0,0,0,.75);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.nav-logo {
  font-size: .8rem; font-weight: 800; letter-spacing: .18em;
  color: #fff; text-decoration: none;
}
.nav-links {
  display: flex; gap: 2.5rem; list-style: none;
}
.nav-links a {
  font-size: .72rem; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(255,255,255,.45);
  text-decoration: none; transition: color .15s;
}
.nav-links a:hover { color: #fff; }
.nav-cta {
  font-size: .72rem; font-weight: 800; letter-spacing: .1em;
  color: #000; background: #ffd60a;
  padding: .5rem 1.2rem; border-radius: 2px;
  text-decoration: none; cursor: pointer;
  transition: background .15s, transform .15s;
}
.nav-cta:hover { background: #ffe033; transform: translateY(-1px); }

/* ── Buttons ───────────────────────────────────────── */
.btn-white {
  display: inline-block; cursor: pointer;
  background: #ffd60a; color: #000;
  font-size: .75rem; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; text-decoration: none;
  padding: .85rem 2rem; border-radius: 2px;
  transition: background .15s, transform .15s;
}
.btn-white:hover { background: #ffe033; transform: translateY(-1px); }

.btn-outline {
  display: inline-block; cursor: pointer;
  background: transparent; color: #fff;
  font-size: .75rem; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; text-decoration: none;
  padding: .85rem 2rem; border-radius: 2px;
  border: 1.5px solid rgba(255,255,255,.28);
  transition: border-color .15s, transform .15s;
}
.btn-outline:hover { border-color: #fff; transform: translateY(-1px); }

/* ── Hero ──────────────────────────────────────────── */
.hero {
  position: relative; min-height: 100vh;
  display: grid; grid-template-columns: 1fr 1fr;
  align-items: center; padding: 120px 0 80px;
  background: #050505;
  overflow: hidden;
}

.hero-content {
  padding: 0 6vw 0 10vw;
  position: relative; z-index: 1;
}

.hero-video-wrap {
  display: flex; align-items: center; justify-content: center;
  padding: 0 4vw 0 1vw;
  position: relative; z-index: 1;
}

.hero-video {
  width: 100%; max-width: 800px;
  border-radius: 12px;
  box-shadow: 0 40px 120px rgba(0,0,0,.6);
  display: block;
}

.hero-eyebrow {
  font-size: .7rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: #ffd60a;
  margin-bottom: 1.75rem;
}
.hero-title {
  font-size: clamp(3.5rem, 8vw, 7.5rem);
  font-weight: 900; line-height: .95; letter-spacing: -.03em;
  color: #fff;
  margin-bottom: 2rem;
}
.hero-title span { color: rgba(255,255,255,.28); }
.hero-sub {
  font-size: clamp(.95rem, 1.5vw, 1.15rem);
  color: rgba(255,255,255,.45); max-width: 480px;
  margin-bottom: 2.5rem; line-height: 1.7;
}
.hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }

.hero-scroll-hint {
  position: absolute; bottom: 2.5rem; left: 10vw; z-index: 1;
  display: flex; align-items: center; gap: 1rem;
  font-size: .65rem; font-weight: 700; letter-spacing: .14em;
  color: rgba(255,255,255,.2); text-transform: uppercase;
}
.hero-scroll-line {
  width: 48px; height: 1px; background: rgba(255,255,255,.15);
}

/* ── Section shared ────────────────────────────────── */
.section-eyebrow {
  font-size: .68rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(0,0,0,.35);
  margin-bottom: 1rem;
}
.section-title {
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 900; line-height: 1.05; letter-spacing: -.025em;
  margin-bottom: 1rem;
  color: #1d1d1f;
}

/* ── Feature cards grid ────────────────────────────── */
.cards-section {
  background: #fff;
  border-top: 1px solid rgba(0,0,0,.06);
}
.cards-header {
  padding: 6rem 10vw 4rem;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.feature-card {
  position: relative; aspect-ratio: 3/4;
  overflow: hidden;
  border-top: 1px solid rgba(255,255,255,.07);
  border-left: 1px solid rgba(255,255,255,.07);
  display: flex; align-items: flex-end;
  background: #111;
  cursor: default;
}
.feature-card:first-child { border-left: none; }

.feature-card::before {
  content: ''; position: absolute; inset: 0;
  transition: opacity .4s; opacity: 0;
}
.fc--gps::before    { background: radial-gradient(ellipse at 30% 80%, rgba(0,200,255,.18), transparent 65%); }
.fc--edit::before   { background: radial-gradient(ellipse at 30% 80%, rgba(255,80,60,.14), transparent 65%); }
.fc--hud::before    { background: radial-gradient(ellipse at 30% 80%, rgba(255,214,10,.14), transparent 65%); }
.fc--export::before { background: radial-gradient(ellipse at 30% 80%, rgba(160,80,255,.14), transparent 65%); }
.feature-card:hover::before { opacity: 1; }

.feature-card-content {
  position: relative; z-index: 1;
  padding: 2.5rem 2rem;
}
.fc-tag {
  font-size: .62rem; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: rgba(255,255,255,.3);
  margin-bottom: 1.25rem;
}
.fc-title {
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  font-weight: 900; line-height: 1.1; letter-spacing: -.02em;
  margin-bottom: 1rem; white-space: pre-line; color: #fff;
}
.fc-body {
  font-size: .82rem; color: rgba(255,255,255,.4); line-height: 1.7;
  margin-bottom: 1.5rem;
}
.fc-link {
  font-size: .68rem; font-weight: 700; letter-spacing: .08em;
  color: #ffd60a; text-decoration: none;
  transition: color .15s;
}
.fc-link:hover { color: #ffe033; }

/* ── Split section ─────────────────────────────────── */
.split-section {
  display: grid; grid-template-columns: 1fr 1fr;
  min-height: 80vh;
}

.split-text {
  padding: 8rem 8vw 8rem 10vw;
  display: flex; flex-direction: column; justify-content: center;
  background: #fff;
}
.split-title {
  font-size: clamp(2.4rem, 4vw, 4rem);
  font-weight: 900; line-height: 1.05; letter-spacing: -.03em;
  margin-bottom: 1.5rem; color: #1d1d1f;
}
.split-body {
  font-size: .95rem; color: rgba(0,0,0,.5);
  max-width: 400px; line-height: 1.75; margin-bottom: 2.5rem;
}

/* btn-white on light bg needs dark variant */
.split-text .btn-white {
  background: #1d1d1f; color: #fff;
}
.split-text .btn-white:hover { background: #333; }

.split-visual {
  display: flex; align-items: center; justify-content: center;
  padding: 4rem;
  background: #111;
  overflow: hidden;
}

.split-img {
  width: 100%; max-width: 520px;
  border-radius: 10px;
  box-shadow: 0 32px 80px rgba(0,0,0,.6);
  display: block;
  object-fit: cover;
}

/* ── Overlays showcase ─────────────────────────────── */
.overlays-section {
  background: #f5f5f7;
  border-top: 1px solid rgba(0,0,0,.06);
  padding-bottom: 0;
}
.overlays-header {
  padding: 6rem 10vw 4rem;
}
.overlays-header .section-eyebrow { color: rgba(0,0,0,.4); }
.overlays-strip {
  display: grid; grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid rgba(0,0,0,.07);
}
.overlay-card {
  border-right: 1px solid rgba(0,0,0,.07);
  cursor: default;
  background: #f5f5f7;
  overflow: hidden;
}
.overlay-card:last-child { border-right: none; }

.oc-thumb {
  aspect-ratio: 9/13; position: relative;
  overflow: hidden; display: flex; align-items: flex-end;
}
.oc-thumb::before {
  content: ''; position: absolute; inset: 0;
  background-size: cover; background-position: center;
  transition: transform .45s cubic-bezier(.25,.46,.45,.94);
}
.overlay-card:hover .oc-thumb::before { transform: scale(1.07); }
.ov-classic::before { background-image: url('/photos/classic.jpeg'); }
.ov-minimal::before { background-image: url('/photos/running.jpeg'); }
.ov-gopro::before   { background-image: url('/photos/mtbike.jpeg'); }
.ov-sport::before   { background-image: url('/photos/triathlon.jpeg'); }
.ov-cycling::before { background-image: url('/photos/gravel.jpeg'); }

.oc-svg-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: stretch;
}
.oc-svg-overlay :deep(svg) {
  width: 100%; height: 100%; display: block;
}

.oc-footer {
  padding: 1rem .9rem;
  border-top: 1px solid rgba(0,0,0,.07);
  display: flex; flex-direction: column; gap: .2rem;
}
.oc-name  { font-size: .78rem; font-weight: 800; letter-spacing: .04em; color: #1d1d1f; }
.oc-sport { font-size: .62rem; color: rgba(0,0,0,.38); letter-spacing: .1em; text-transform: uppercase; }

/* ── Stats row ─────────────────────────────────────── */
.stats-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: #050505;
  border-top: none;
}
.stat-item {
  padding: 3.5rem 4vw;
  border-right: 1px solid rgba(255,255,255,.07);
  text-align: center;
}
.stat-item:last-child { border-right: none; }
.si-num {
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 900; letter-spacing: -.04em; line-height: 1;
  margin-bottom: .5rem; color: #ffd60a;
}
.si-lbl {
  font-size: .7rem; color: rgba(255,255,255,.35);
  text-transform: uppercase; letter-spacing: .08em; font-weight: 600;
}

/* ── How it works ──────────────────────────────────── */
.how-section {
  background: #fff;
  border-top: 1px solid rgba(0,0,0,.06);
}
.how-header {
  padding: 6rem 10vw 4rem;
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.how-steps {
  display: grid; grid-template-columns: repeat(4, 1fr);
}
.how-step {
  padding: 3rem 3vw;
  border-right: 1px solid rgba(0,0,0,.06);
}
.how-step:last-child { border-right: none; }
.hs-number {
  font-size: .65rem; font-weight: 800; letter-spacing: .1em;
  color: #ffd60a; margin-bottom: 1.25rem;
}
.hs-divider {
  width: 28px; height: 1.5px;
  background: rgba(0,0,0,.1); margin-bottom: 1.25rem;
}
.hs-title {
  font-size: 1.1rem; font-weight: 800; letter-spacing: -.01em;
  margin-bottom: .75rem; color: #1d1d1f;
}
.hs-body { font-size: .82rem; color: rgba(0,0,0,.48); line-height: 1.7; }

/* ── CTA section ───────────────────────────────────── */
.cta-section {
  padding: 10rem 10vw;
  text-align: center;
  background: #050505;
}
.cta-section .section-eyebrow { color: rgba(255,255,255,.3); }
.cta-title {
  font-size: clamp(3rem, 7vw, 6.5rem);
  font-weight: 900; line-height: .95; letter-spacing: -.04em;
  margin-bottom: 1.5rem; color: #fff;
}
.cta-sub {
  font-size: .9rem; color: rgba(255,255,255,.35);
  letter-spacing: .04em; margin-bottom: 3rem;
}
.cta-btn { font-size: .8rem; padding: 1rem 2.5rem; }

/* ── Footer ────────────────────────────────────────── */
.site-footer {
  border-top: 1px solid rgba(255,255,255,.07);
  padding: 3rem 10vw;
  background: #111;
}
.footer-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 2.5rem; padding-bottom: 2.5rem;
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.footer-logo {
  font-size: .78rem; font-weight: 900; letter-spacing: .2em; color: #fff;
}
.footer-nav { display: flex; gap: 2rem; }
.footer-nav a {
  font-size: .68rem; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(255,255,255,.3);
  text-decoration: none; transition: color .15s;
}
.footer-nav a:hover { color: #fff; }
.footer-bottom {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem;
  font-size: .68rem; color: rgba(255,255,255,.2); letter-spacing: .04em;
}

/* ── Responsive ────────────────────────────────────── */
@media (max-width: 1024px) {
  .hero           { grid-template-columns: 1fr; padding: 120px 10vw 80px; }
  .hero-content   { padding: 0; }
  .hero-video-wrap { display: none; }
  .cards-grid     { grid-template-columns: repeat(2, 1fr); }
  .overlays-strip { grid-template-columns: repeat(3, 1fr); }
  .overlay-card:nth-child(3) { border-right: none; }
  .overlay-card:nth-child(4) { border-top: 1px solid rgba(0,0,0,.07); }
  .how-steps      { grid-template-columns: repeat(2, 1fr); }
  .how-step:nth-child(2) { border-right: none; }
  .how-step:nth-child(3) { border-top: 1px solid rgba(0,0,0,.06); }
}
@media (max-width: 768px) {
  .nav-links      { display: none; }
  .split-section  { grid-template-columns: 1fr; }
  .split-text     { padding: 5rem 6vw; }
  .split-visual   { padding: 2rem 6vw 4rem; }
  .stats-row      { grid-template-columns: repeat(2, 1fr); }
  .stat-item:nth-child(2) { border-right: none; }
  .stat-item:nth-child(3) { border-top: 1px solid rgba(255,255,255,.07); }
  .overlays-strip { grid-template-columns: repeat(2, 1fr); }
  .overlay-card:nth-child(2) { border-right: none; }
  .overlay-card:nth-child(3),
  .overlay-card:nth-child(4),
  .overlay-card:nth-child(5) { border-top: 1px solid rgba(0,0,0,.07); }
  .how-steps      { grid-template-columns: 1fr; }
  .how-step       { border-right: none; border-top: 1px solid rgba(0,0,0,.06); }
  .how-step:first-child { border-top: none; }
  .footer-top     { flex-direction: column; gap: 1.5rem; text-align: center; }
  .footer-nav     { flex-wrap: wrap; justify-content: center; }
  .footer-bottom  { flex-direction: column; text-align: center; }
  .cards-grid     { grid-template-columns: 1fr; }
  .feature-card   { aspect-ratio: unset; border-left: none; }
}
</style>
