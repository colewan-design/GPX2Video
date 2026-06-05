<template>
  <div class="stage" :class="{ 'has-video': !!videoSrc }" ref="stageRef" :style="stageStyle">
    <video
      v-if="videoSrc"
      ref="videoRef"
      class="video-bg"
      :src="videoSrc"
      :style="glReady ? { opacity: 0, pointerEvents: 'none' } : {}"
      preload="metadata"
      playsinline
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @canplay="handleCanPlay"
      @ended="$emit('ended')"
    />

    <!-- Hidden preload for next segment — eliminates the pause on segment switch -->
    <video v-if="nextVideoSrc" :src="nextVideoSrc" preload="auto" style="display:none" muted playsinline />

    <!-- WebGL output canvas — replaces video display when shader is ready -->
    <canvas
      v-if="videoSrc"
      ref="glCanvasRef"
      class="video-bg gl-canvas"
      :style="{ opacity: glReady ? 1 : 0 }"
    />

    <!-- Map canvas: full stage in map-only mode, small inset top-right over video -->
    <canvas ref="canvasRef" :class="{ inset: !!videoSrc }" />

    <!-- ── Video HUD overlay root (scales up in portrait mode) ───────────── -->
    <div class="hud-overlay-root" v-if="videoSrc && points.length">

    <!-- ── Full HUD (video mode only) ────────────────────────────────────── -->
    <template v-if="overlayFormat === 'classic'">



      <!-- Lap times box (top-left) -->
      <div class="hud-laps" v-if="totalLaps > 0">
        <div class="lap-header">1 mile lap {{ currentLapN }}/{{ totalLaps }}</div>
        <div
          v-for="lap in displayLaps"
          :key="lap.n"
          class="lap-row"
          :class="{ 'lap-current': lap.current }"
        >
          <span class="lap-n">{{ lap.n }}/</span>
          <span class="lap-t"> {{ lap.time }}</span>
          <span class="lap-d" v-if="lap.delta"> {{ lap.delta }}</span>
        </div>
      </div>

      <!-- Top-center info: temperature + distance -->
      <div class="hud-top-info">
        <div class="hud-temp-block" v-if="tempC !== null">
          <svg class="hud-icon-sm" viewBox="0 0 24 24"><path fill="currentColor" d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0z"/></svg>
          <span>{{ tempC }}°C</span>
        </div>
        <div class="hud-dist-block">
          <span class="hud-dist-val">{{ distKmHud }}</span><span class="hud-dist-unit"> km</span>
          <div class="hud-dist-total">Total: {{ totalDistKm }}</div>
        </div>
      </div>

      <!-- Elevation chart (center-top) -->
      <canvas class="hud-elev-canvas" ref="elevChartRef" />

      <!-- Left stats panel -->
      <div class="hud-panel-left">
        <div class="hud-stat-row">
          <svg class="hud-stat-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 4a8 8 0 1 0 0 16A8 8 0 0 0 12 4zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
          </svg>
          <span class="hud-stat-val">{{ cadDisplay }}</span>
        </div>
        <div class="hud-stat-row">
          <svg class="hud-stat-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2 9 8h6L12 2zm0 20 3-6H9l3 6zM2 12l6-3v6L2 12zm20 0-6 3V9l6 3z"/>
          </svg>
          <div class="hud-stat-multi">
            <div>Gain:&nbsp;{{ elevGainMNow }} m</div>
            <div>Loss:&nbsp;{{ elevLossMNow }} m</div>
          </div>
        </div>
        <div class="hud-stat-row">
          <svg class="hud-stat-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>
          </svg>
          <span class="hud-stat-val">{{ powerDisplay }}</span>
        </div>
        <div class="hud-stat-row">
          <svg class="hud-stat-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
          </svg>
          <span class="hud-stat-val">{{ paceDisplay }}/km</span>
        </div>
      </div>

      <!-- Right stats panel -->
      <div class="hud-panel-right">
        <div class="hud-stat-row-r">
          <span class="hud-stat-val-r">{{ kcalDisplay }} kcal</span>
          <svg class="hud-stat-icon-r" viewBox="0 0 24 24"><path fill="currentColor" d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
        </div>
        <div class="hud-stat-row-r">
          <span class="hud-stat-val-r">{{ gradeDisplay }}</span>
          <svg class="hud-stat-icon-r" viewBox="0 0 24 24"><path fill="currentColor" d="M14 6l-1-2H5v17h2v-7h5l1 2h7V6h-6zm4 8h-4l-1-2H7V6h5l1 2h5v6z"/></svg>
        </div>
        <div class="hud-stat-row-r">
          <span class="hud-stat-val-r">-- - --</span>
          <svg class="hud-stat-icon-r" viewBox="0 0 24 24"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.33.07-.67.07-1.08s-.03-.75-.07-1.08l2.32-1.8c.21-.16.27-.46.13-.7l-2.2-3.81c-.14-.24-.42-.32-.66-.24l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08L14.8 2.28C14.74 2.02 14.5 1.83 14.22 1.83h-4.43c-.28 0-.52.19-.57.46L8.88 4.9c-.68.27-1.29.64-1.86 1.08L4.28 4.88c-.25-.09-.52 0-.66.24L1.42 8.93c-.14.24-.09.54.13.7l2.32 1.8C3.83 11.76 3.8 12.1 3.8 12.5s.03.74.07 1.08l-2.32 1.8c-.21.16-.27.46-.13.7l2.2 3.81c.14.24.42.32.66.24l2.74-1.1c.57.44 1.18.81 1.86 1.08l.36 2.63c.05.26.29.45.57.45h4.43c.28 0 .52-.19.57-.46l.36-2.62c.68-.27 1.29-.64 1.86-1.08l2.74 1.1c.25.09.52 0 .66-.24l2.2-3.81c.14-.24.09-.54-.13-.7l-2.32-1.8z"/></svg>
        </div>
        <div class="hud-stat-row-r">
          <span class="hud-stat-val-r">{{ hrDisplay }} bpm</span>
          <svg class="hud-stat-icon-r" viewBox="0 0 24 24"><path fill="currentColor" d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </div>
      </div>

      <!-- Bottom row: speed gauge | power zones | rpm gauge -->
      <div class="hud-bottom-row">

        <!-- Speed gauge -->
        <div class="hud-gauge">
          <svg viewBox="0 0 100 80" class="gauge-svg">
            <circle cx="50" cy="47" r="36" fill="none"
              stroke="rgba(255,255,255,0.12)" stroke-width="5"
              stroke-dasharray="169.65 226.19" stroke-linecap="round"
              transform="rotate(-135 50 47)" />
            <circle cx="50" cy="47" r="36" fill="none"
              :stroke="overlayColor" stroke-width="5"
              :stroke-dasharray="speedDash"
              stroke-linecap="round"
              transform="rotate(-135 50 47)" />
            <text x="6"  y="77" fill="rgba(255,255,255,0.45)" font-size="7" font-family="sans-serif">0</text>
            <text x="84" y="77" fill="rgba(255,255,255,0.45)" font-size="7" font-family="sans-serif">60</text>
            <text x="50" y="53" fill="white" font-size="18" font-weight="700"
              text-anchor="middle" font-family="sans-serif">{{ speedKmhGauge }}</text>
          </svg>
          <div class="gauge-lbl">km/h</div>
        </div>

        <!-- Power zones -->
        <div class="hud-zones">
          <div class="zones-title">{{ zoneName }}</div>
          <div class="zones-bars">
            <div
              v-for="z in zoneData"
              :key="z.label"
              class="zone-col"
              :class="{ 'zone-active': z.active }"
            >
              <div class="zone-bar-wrap">
                <div class="zone-bar-fill" :style="{ height: z.pct + '%' }" />
              </div>
              <div class="zone-range">{{ z.label }}</div>
            </div>
          </div>
        </div>

        <!-- RPM gauge -->
        <div class="hud-gauge">
          <svg viewBox="0 0 100 80" class="gauge-svg">
            <circle cx="50" cy="47" r="36" fill="none"
              stroke="rgba(255,255,255,0.12)" stroke-width="5"
              stroke-dasharray="169.65 226.19" stroke-linecap="round"
              transform="rotate(-135 50 47)" />
            <circle cx="50" cy="47" r="36" fill="none"
              :stroke="overlayColor" stroke-width="5"
              :stroke-dasharray="rpmDash"
              stroke-linecap="round"
              transform="rotate(-135 50 47)" />
            <text x="6"  y="77" fill="rgba(255,255,255,0.45)" font-size="7" font-family="sans-serif">0</text>
            <text x="70" y="77" fill="rgba(255,255,255,0.45)" font-size="7" font-family="sans-serif">130</text>
            <text x="50" y="53" fill="white" font-size="18" font-weight="700"
              text-anchor="middle" font-family="sans-serif">{{ cadDisplay }}</text>
          </svg>
          <div class="gauge-lbl">rpm</div>
        </div>

      </div><!-- /hud-bottom-row -->
    </template>

    <!-- ── Minimal HUD (video mode) ─────────────────────────────────────── -->
    <template v-if="overlayFormat === 'minimal'">
      <div class="minimal-bottom">
        <div class="mini-card">
          <div class="mini-val">{{ speedKmhGauge }}</div>
          <div class="mini-unit">km/h</div>
          <div class="mini-lbl">Speed</div>
        </div>
        <div class="mini-divider" />
        <div class="mini-card">
          <div class="mini-val">{{ currentElevM }}</div>
          <div class="mini-unit">m</div>
          <div class="mini-lbl">Elevation</div>
        </div>
        <div class="mini-divider" />
        <div class="mini-card">
          <div class="mini-val">{{ distKmHud }}</div>
          <div class="mini-unit">km</div>
          <div class="mini-lbl">Distance</div>
        </div>
        <div class="mini-divider" />
        <div class="mini-card">
          <div class="mini-val">{{ gradeDisplay }}</div>
          <div class="mini-unit">&nbsp;</div>
          <div class="mini-lbl">Grade</div>
        </div>
        <template v-if="hrDisplay !== '--'">
          <div class="mini-divider" />
          <div class="mini-card">
            <div class="mini-val">{{ hrDisplay }}</div>
            <div class="mini-unit">bpm</div>
            <div class="mini-lbl">Heart Rate</div>
          </div>
        </template>
      </div>
    </template>

    <!-- ── GoPro HUD (video mode) ─────────────────────────────────────── -->
    <template v-if="overlayFormat === 'gopro'">

      <!-- GPS coordinates top-left -->
      <div class="gopro-coords">{{ latStr }}&nbsp;&nbsp;&nbsp;{{ lonStr }}</div>

      <!-- Compass bearing top-center -->
      <div class="gopro-bearing">
        <svg class="gopro-compass" viewBox="0 0 20 24">
          <polygon points="10,1 13.5,15 10,12.5 6.5,15" :fill="overlayColor"/>
          <polygon points="10,23 13.5,9 10,11.5 6.5,9" fill="rgba(255,255,255,0.3)"/>
        </svg>
        <span class="gopro-bearing-val">{{ bearingDeg }}°{{ bearingCard }}</span>
      </div>

      <!-- Left panel: slope + elevation -->
      <div class="gopro-left-panel">
        <div class="gopro-stat-block">
          <div class="gopro-stat-head">
            <svg class="gopro-icon" viewBox="0 0 20 18">
              <polygon points="10,1 19,17 1,17" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.8"/>
              <line x1="10" y1="9" x2="10" y2="17" stroke="rgba(255,255,255,0.75)" stroke-width="1.5"/>
            </svg>
            <span class="gopro-stat-lbl">SLOPE</span>
          </div>
          <div class="gopro-stat-val">{{ slopeDisplay }}</div>
        </div>
        <div class="gopro-stat-block">
          <div class="gopro-stat-head">
            <svg class="gopro-icon" viewBox="0 0 20 18">
              <polygon points="10,1 19,17 1,17" fill="rgba(255,255,255,0.75)"/>
            </svg>
            <span class="gopro-stat-lbl">ELEVATION</span>
          </div>
          <div class="gopro-stat-val">{{ currentElevM }} <span class="gopro-stat-unit">M</span></div>
        </div>
        <div v-if="goproDateTime" class="gopro-datetime-block">
          <div class="gopro-datetime-time">{{ goproDateTime.time }}</div>
          <div class="gopro-datetime-date">{{ goproDateTime.date }}</div>
        </div>
      </div>

      <!-- Bottom-center large speed gauge -->
      <div class="gopro-gauge-wrap">
        <svg viewBox="0 0 160 110" class="gopro-gauge-svg">
          <circle cx="80" cy="82" r="60" fill="none"
            stroke="rgba(255,255,255,0.12)" stroke-width="6"
            stroke-dasharray="282.74 376.99" stroke-linecap="round"
            transform="rotate(-135 80 82)" />
          <circle cx="80" cy="82" r="60" fill="none"
            :stroke="overlayColor" stroke-width="6"
            :stroke-dasharray="goProSpeedDash"
            stroke-linecap="round"
            transform="rotate(-135 80 82)" />
          <text x="9"  y="106" fill="rgba(255,255,255,0.45)" font-size="9" font-family="sans-serif">0</text>
          <text x="136" y="106" fill="rgba(255,255,255,0.45)" font-size="9" font-family="sans-serif">60</text>
          <text x="80" y="91" fill="white" font-size="30" font-weight="700"
            text-anchor="middle" font-family="sans-serif">{{ speedKmhGauge }}</text>
        </svg>
        <div class="gopro-speed-unit">KM/H</div>
      </div>
    </template>

    <!-- ── Sport HUD (video mode) ───────────────────────────────────────── -->
    <template v-if="overlayFormat === 'sport'">

      <!-- Top-left: distance -->
      <div class="sport-top-left">
        <div class="sport-dist-val">{{ distKmHud }}</div>
        <div class="sport-dist-unit">KM</div>
      </div>

      <!-- Top-right: GPS coordinates (under the canvas inset) -->
      <div class="sport-coords">
        <div class="sport-coord-line">{{ latStr }}</div>
        <div class="sport-coord-line">{{ lonStr }}</div>
      </div>

      <!-- Center-left: slope -->
      <div class="sport-slope-block">
        <div class="sport-slope-lbl">SLOPE</div>
        <div class="sport-slope-val">{{ gradeRaw }}</div>
        <div class="sport-slope-unit">%</div>
      </div>

      <!-- Bottom-left: circular speed gauge -->
      <div class="sport-gauge-wrap">
        <svg viewBox="0 0 160 160" class="sport-gauge-svg">
          <!-- Dark circle background -->
          <circle cx="80" cy="80" r="74" fill="rgba(0,12,28,0.8)" />
          <!-- Tick marks around arc (18 ticks every 15°) -->
          <g :stroke="ocFaint" stroke-width="1">
            <line v-for="i in 19" :key="i"
              :x1="80 + 66 * Math.cos(((225 + (i-1)*15 - 90) * Math.PI / 180))"
              :y1="80 + 66 * Math.sin(((225 + (i-1)*15 - 90) * Math.PI / 180))"
              :x2="80 + 72 * Math.cos(((225 + (i-1)*15 - 90) * Math.PI / 180))"
              :y2="80 + 72 * Math.sin(((225 + (i-1)*15 - 90) * Math.PI / 180))"
            />
          </g>
          <!-- Background arc -->
          <circle cx="80" cy="80" r="62" fill="none"
            :stroke="ocFaint" stroke-width="4"
            stroke-dasharray="292.17 97.39" stroke-linecap="round"
            transform="rotate(135 80 80)" />
          <!-- Value arc -->
          <circle cx="80" cy="80" r="62" fill="none"
            :stroke="overlayColor" stroke-width="4"
            :stroke-dasharray="sportSpeedDash"
            stroke-linecap="round"
            transform="rotate(135 80 80)" />
          <!-- Arc end-cap glow dot -->
          <text x="28"  y="138" :fill="ocDim" font-size="9"  text-anchor="middle" font-family="sans-serif">0</text>
          <text x="80"  y="22"  :fill="ocDim" font-size="9"  text-anchor="middle" font-family="sans-serif">90</text>
          <text x="132" y="138" :fill="ocDim" font-size="9"  text-anchor="middle" font-family="sans-serif">180</text>
          <!-- SPEED label -->
          <text x="80" y="63" :fill="overlayColor" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif" letter-spacing="2">SPEED</text>
          <!-- Speed number -->
          <text x="80" y="97" fill="white" font-size="34" font-weight="700" text-anchor="middle" font-family="sans-serif">{{ speedKmhGauge }}</text>
          <!-- KM/H label -->
          <text x="80" y="114" :fill="overlayColor" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif" letter-spacing="2">KM/H</text>
        </svg>
      </div>
    </template>

    <!-- ── Cycling HUD (video mode) ───────────────────────────────────────── -->
    <template v-if="overlayFormat === 'cycling'">

      <!-- Top bar: ELEVATION | compass | TOTAL DISTANCE -->
      <div class="cyc-top-bar">
        <div class="cyc-stat cyc-stat--left">
          <div class="cyc-stat-lbl">ELEVATION</div>
          <div class="cyc-stat-val">{{ currentElevM }} <span class="cyc-stat-unit">M</span></div>
        </div>

        <!-- Compass rose -->
        <div class="cyc-compass">
          <svg viewBox="0 0 40 40" class="cyc-compass-svg">
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <text x="20" y="10" fill="rgba(255,255,255,0.5)" font-size="6" text-anchor="middle" font-family="sans-serif" font-weight="700">N</text>
            <text x="20" y="36" fill="rgba(255,255,255,0.3)" font-size="5" text-anchor="middle" font-family="sans-serif">S</text>
            <text x="8"  y="23" fill="rgba(255,255,255,0.3)" font-size="5" text-anchor="middle" font-family="sans-serif">W</text>
            <text x="33" y="23" fill="rgba(255,255,255,0.3)" font-size="5" text-anchor="middle" font-family="sans-serif">E</text>
            <!-- North arrow -->
            <polygon points="20,7 22,17 20,15 18,17" :fill="overlayColor"/>
            <polygon points="20,33 22,23 20,25 18,23" fill="rgba(255,255,255,0.3)"/>
          </svg>
        </div>

        <div class="cyc-stat cyc-stat--right">
          <div class="cyc-stat-lbl">TOTAL DISTANCE</div>
          <div class="cyc-stat-val">{{ distKmHud }} <span class="cyc-stat-unit">KM</span></div>
        </div>
      </div>

      <!-- Center: arc speed gauge (left) + slope (right) -->
      <div class="cyc-center">
        <!-- Speed gauge (D-shape arc, bottom cropped) -->
        <div class="cyc-gauge-wrap">
          <div class="cyc-gauge-label">SPEED</div>
          <svg viewBox="0 0 160 95" class="cyc-gauge-svg">
            <!-- Background arc -->
            <circle cx="80" cy="105" r="65" fill="none"
              :stroke="ocFaint" stroke-width="8"
              stroke-dasharray="306.31 102.10" stroke-linecap="round"
              transform="rotate(135 80 105)" />
            <!-- Value arc -->
            <circle cx="80" cy="105" r="65" fill="none"
              :stroke="overlayColor" stroke-width="8"
              :stroke-dasharray="cyclingSpeedDash"
              stroke-linecap="round"
              transform="rotate(135 80 105)" />
            <!-- Min/max labels -->
            <text x="14" y="92" :fill="ocDim" font-size="9" text-anchor="middle" font-family="sans-serif">0</text>
            <text x="146" y="92" :fill="ocDim" font-size="9" text-anchor="middle" font-family="sans-serif">60</text>
            <!-- Speed number -->
            <text x="80" y="72" fill="white" font-size="46" font-weight="700" text-anchor="middle" font-family="sans-serif">{{ speedKmhGauge }}</text>
          </svg>
          <div class="cyc-gauge-unit">KM/H</div>
        </div>

        <!-- Slope (right) -->
        <div class="cyc-slope-block">
          <div class="cyc-slope-lbl">SLOPE</div>
          <div class="cyc-slope-val">{{ gradeRaw }}</div>
          <div class="cyc-slope-unit">%</div>
        </div>
      </div>

      <!-- Bottom: GPS coordinates -->
      <div class="cyc-gps">
        <span class="cyc-gps-val">{{ lonStr }}</span>
        <span class="cyc-gps-val">{{ latStr }}</span>
      </div>
    </template>


    <!-- ── Location name ────────────────────────────────────────────────── -->
    <div v-if="locationName" class="hud-location" :style="locationStyle">
      <svg viewBox="0 0 12 16" fill="currentColor" class="hud-location-pin"><path d="M6 0a5 5 0 0 1 5 5c0 4-5 11-5 11S1 9 1 5a5 5 0 0 1 5-5zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
      <span class="hud-location-lines">
        <span v-for="(part, i) in locationParts" :key="i">{{ part.trim() }}</span>
      </span>
    </div>

    <!-- ── Logo watermark ──────────────────────────────────────────────── -->
    <div class="logo-wm">
      <img src="/icon.svg" class="logo-wm-icon" />
      <span class="logo-wm-text">gpx2video</span>
    </div>

    </div><!-- /hud-overlay-root -->

    <!-- ── Simple HUD (map-only mode) ───────────────────────────────────── -->
    <div class="hud hud-simple" v-if="!videoSrc && points.length">
      <div class="hud-stats">
        <div class="hud-stat speed-stat">
          <div class="h-val">{{ speedKph }}<span class="h-unit">km/h</span></div>
          <div class="h-lbl">Speed</div>
        </div>
        <div class="hud-stat elev-stat">
          <div class="h-val">{{ elevM }}<span class="h-unit">m</span></div>
          <div class="h-lbl">Elevation</div>
        </div>
        <div class="hud-stat dist-stat">
          <div class="h-val">{{ distKm }}<span class="h-unit">km</span></div>
          <div class="h-lbl">Distance</div>
        </div>
      </div>
      <div class="hud-progress">
        <span class="hud-time">{{ timeCur }}</span>
        <div class="hud-track">
          <div class="hud-fill" :style="{ width: barPct + '%' }" />
          <div class="hud-dot"  :style="{ left:  barPct + '%' }" />
        </div>
        <span class="hud-time hud-time--end">{{ timeTotal }}</span>
      </div>
    </div>

    <!-- ── Caption overlay ───────────────────────────────────────────────── -->
    <div
      v-if="videoSrc && currentCaption"
      class="caption-overlay"
      :class="[
        `caption--${captionStyle.fontSize}`,
        { 'caption--bg': captionStyle.background },
        { 'caption--bottom': capY === null && captionStyle.position === 'bottom' },
        { 'caption--top':    capY === null && captionStyle.position === 'top' },
        { 'caption--active': capDragging || capResizing },
      ]"
      :style="capOverlayStyle"
      @mousedown.stop.prevent="startCapDrag"
    >
      {{ currentCaption }}
      <div class="cap-resize-handle" @mousedown.stop.prevent="startCapResize" title="Resize" />
    </div>

    <!-- ── Fullscreen toggle button ─────────────────────────────────────── -->
    <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'">
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { lerp, arrayMax, fmtTime } from '../utils/geo.js'
import { useVideoShader } from '../composables/useVideoShader.js'
import { SHADER_PARAMS } from '../utils/filters.js'

const props = defineProps({
  points:        { type: Array,   required: true },
  animIdx:       { type: Number,  required: true },
  trimStart:     { type: Number,  default: 0 },
  progress:      { type: Number,  default: 0 },
  totalTime:     { type: Number,  default: 0 },
  videoSrc:      { type: String,  default: null },
  nextVideoSrc:  { type: String,  default: null },
  playing:       { type: Boolean, default: false },
  filterId:      { type: String,  default: 'none' },
  overlayFormat: { type: String,  default: 'classic' },
  overlayColor:  { type: String,  default: '#f59e0b' },
  playerAspect:  { type: String,  default: '16:9' },
  locationName:     { type: String,  default: '' },
  captionSegments:  { type: Array,   default: () => [] },
  captionStyle:     { type: Object,  default: () => ({ position: 'bottom', fontSize: 'medium', background: true }) },
})

const emit = defineEmits(['timeupdate', 'ended', 'loadedmetadata', 'update:captionStyle'])

// ── Caption helpers ───────────────────────────────────────────────────────────
// videoCurrentTimeSec is updated by handleTimeUpdate — always in seconds,
// matching Whisper's timestamp format directly.
const videoCurrentTimeSec = ref(0)

const currentCaption = computed(() => {
  const t = videoCurrentTimeSec.value
  const seg = props.captionSegments.find(s => t >= s.start && t < s.end)
  return seg?.text ?? null
})

// ── Caption drag / resize ─────────────────────────────────────────────────────
const capX        = ref(props.captionStyle.capX ?? 50)   // center-x %
const capY        = ref(props.captionStyle.capY ?? null) // top-y % (null = use CSS class)
const capW        = ref(props.captionStyle.capW ?? 80)   // width %
const capDragging = ref(false)
const capResizing = ref(false)

// Reset to class-based position when the top/bottom button is clicked
watch(() => props.captionStyle.position, () => { capY.value = null; capX.value = 50 })

const capOverlayStyle = computed(() => {
  const base = { width: capW.value + '%', maxWidth: 'none' }
  if (capY.value !== null) {
    return { ...base, left: capX.value + '%', top: capY.value + '%', bottom: 'auto', transform: 'translateX(-50%)' }
  }
  return { ...base, left: '50%', transform: 'translateX(-50%)' }
})

let capDragDs = null

function startCapDrag(e) {
  if (e.target.classList.contains('cap-resize-handle')) return
  const stageRect = stageRef.value.getBoundingClientRect()
  const elRect    = e.currentTarget.getBoundingClientRect()
  // Snapshot current visual center-x and top-y before switching to inline positioning
  const curCX = ((elRect.left + elRect.width / 2) - stageRect.left) / stageRect.width  * 100
  const curTY = (elRect.top - stageRect.top) / stageRect.height * 100
  capX.value = Math.max(5, Math.min(95, curCX))
  capY.value = Math.max(0, Math.min(95, curTY))
  capDragDs = { stageRect, sx: e.clientX, sy: e.clientY, ox: capX.value, oy: capY.value }
  capDragging.value = true
  window.addEventListener('mousemove', onCapDragMove)
  window.addEventListener('mouseup',   endCapDrag)
}

function onCapDragMove(e) {
  if (!capDragDs) return
  const { stageRect, sx, sy, ox, oy } = capDragDs
  capX.value = Math.max(5,  Math.min(95, ox + (e.clientX - sx) / stageRect.width  * 100))
  capY.value = Math.max(0,  Math.min(95, oy + (e.clientY - sy) / stageRect.height * 100))
}

function endCapDrag() {
  capDragging.value = false; capDragDs = null
  window.removeEventListener('mousemove', onCapDragMove)
  window.removeEventListener('mouseup',   endCapDrag)
  emit('update:captionStyle', { ...props.captionStyle, capX: capX.value, capY: capY.value, capW: capW.value })
}

let capResizeDs = null

function startCapResize(e) {
  const stageRect = stageRef.value.getBoundingClientRect()
  capResizeDs = { stageRect, sx: e.clientX, ow: capW.value }
  capResizing.value = true
  window.addEventListener('mousemove', onCapResizeMove)
  window.addEventListener('mouseup',   endCapResize)
}

function onCapResizeMove(e) {
  if (!capResizeDs) return
  const { stageRect, sx, ow } = capResizeDs
  // Expand symmetrically from center → drag right = wider
  const dw = (e.clientX - sx) / stageRect.width * 100 * 2
  capW.value = Math.max(15, Math.min(98, ow + dw))
}

function endCapResize() {
  capResizing.value = false; capResizeDs = null
  window.removeEventListener('mousemove', onCapResizeMove)
  window.removeEventListener('mouseup',   endCapResize)
  emit('update:captionStyle', { ...props.captionStyle, capX: capX.value, capY: capY.value, capW: capW.value })
}

// ── Accent-color helpers ──────────────────────────────────────────────────────
function parseOc(hex) {
  const h = (hex || '#f59e0b').replace('#', '')
  return {
    r: parseInt(h.slice(0,2), 16) || 245,
    g: parseInt(h.slice(2,4), 16) || 158,
    b: parseInt(h.slice(4,6), 16) || 11,
  }
}
const ocRgb   = computed(() => parseOc(props.overlayColor))
const ocDim   = computed(() => { const {r,g,b} = ocRgb.value; return `rgba(${r},${g},${b},0.55)` })
const ocFaint = computed(() => { const {r,g,b} = ocRgb.value; return `rgba(${r},${g},${b},0.15)` })
// Scale HUD elements up in portrait so they stay proportional to stage height.
// Baseline is 16:9. For portrait ratios (h > w) this will be > 1.
const hudScale = computed(() => {
  const [w, h] = props.playerAspect.split(':').map(Number)
  if (!w || !h) return 1
  const baseline = Math.sqrt(9 / 16)   // 16:9 reference
  const current  = Math.sqrt(h / w)
  return Math.max(1, current / baseline)
})

const stageStyle = computed(() => {
  const {r,g,b} = ocRgb.value
  const style = {
    '--oc':        props.overlayColor,
    '--oc-dim':    `rgba(${r},${g},${b},0.55)`,
    '--oc-semi':   `rgba(${r},${g},${b},0.45)`,
    '--oc-faint':  `rgba(${r},${g},${b},0.15)`,
    '--hud-scale': hudScale.value.toFixed(4),
  }
  if (props.videoSrc) {
    style.aspectRatio = videoNativeW.value && videoNativeH.value
      ? `${videoNativeW.value} / ${videoNativeH.value}`
      : props.playerAspect.replace(':', ' / ')
  }
  return style
})

const stageRef     = ref(null)
const canvasRef    = ref(null)
const glCanvasRef  = ref(null)
const videoRef     = ref(null)
const elevChartRef = ref(null)
const videoNativeW = ref(0)
const videoNativeH = ref(0)
const glReady      = ref(false)

const shader = useVideoShader()
let roStage  = null

let ctx      = null
let elevCtx  = null
let toXY     = null
let maxSpeed = 1
let ro       = null
let roElev   = null

// ── Video control ────────────────────────────────────────────────────────────
watch(() => props.playing, async (val) => {
  if (!videoRef.value) return
  if (val) { try { await videoRef.value.play() } catch (_) {} }
  else videoRef.value.pause()
})
watch(() => props.videoSrc, () => {
  if (videoRef.value) videoRef.value.currentTime = 0
  if (!props.videoSrc) {
    videoNativeW.value = 0; videoNativeH.value = 0
    shader.stopLoop(); shader.destroy()
    glReady.value = false
  }
})

function handleTimeUpdate() {
  if (!videoRef.value) return
  videoCurrentTimeSec.value = videoRef.value.currentTime
  emit('timeupdate', { currentTime: videoRef.value.currentTime, duration: videoRef.value.duration || 0 })
}
async function handleLoadedMetadata() {
  if (!videoRef.value) return
  videoNativeW.value = videoRef.value.videoWidth
  videoNativeH.value = videoRef.value.videoHeight
  emit('loadedmetadata', { duration: videoRef.value.duration || 0, videoWidth: videoRef.value.videoWidth, videoHeight: videoRef.value.videoHeight })

  // Initialise WebGL — wait for v-if canvas to appear in DOM
  await nextTick()
  if (glCanvasRef.value && !glReady.value) {
    const ok = shader.setup(glCanvasRef.value, videoRef.value, {
      onContextLost: () => { glReady.value = false },
    })
    if (ok) {
      glReady.value = true
      shader.setFilter(SHADER_PARAMS[props.filterId] ?? SHADER_PARAMS.none)
      shader.startLoop()
      // Also set up a ResizeObserver on the stage so the GL canvas stays crisp
      roStage?.disconnect()
      roStage = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect
        shader.resize(Math.round(width), Math.round(height))
      })
      roStage.observe(stageRef.value)
    }
  }
}
// Resume playback after a segment switch (videoSrc changed while playing=true)
function handleCanPlay() {
  if (props.playing && videoRef.value?.paused) {
    videoRef.value.play().catch(() => {})
  }
}

defineExpose({
  seekTo(sec) { if (videoRef.value) videoRef.value.currentTime = sec },
  getVideoEl() { return videoRef.value },
})

// ── Fullscreen ────────────────────────────────────────────────────────────────
const isFullscreen = ref(false)

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    stageRef.value?.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function onKeyDown(e) {
  if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

// ── Current point ────────────────────────────────────────────────────────────
const current = computed(() => props.points[props.animIdx])
const barPct  = computed(() => (props.progress * 100).toFixed(1))

// ── Simple HUD (map-only mode) ───────────────────────────────────────────────
const speedKph = computed(() => current.value?.speedSmooth.toFixed(1) ?? '0.0')
const elevM    = computed(() => Math.round(current.value?.ele ?? 0))
const distKm   = computed(() => ((current.value?.cumDist ?? 0) / 1000).toFixed(2))
const timeCur  = computed(() => {
  const p = current.value, p0 = props.points[0]
  if (p?.time && p0?.time) return fmtTime(p.time - p0.time)
  return `${props.animIdx}pt`
})
const timeTotal = computed(() => props.totalTime > 0 ? fmtTime(props.totalTime) : `${props.points.length}pts`)

// ── Full HUD — metric stats ───────────────────────────────────────────────────
const speedKmhGauge = computed(() => (current.value?.speedSmooth ?? 0).toFixed(0))
const distKmHud   = computed(() => ((current.value?.cumDist ?? 0) / 1000).toFixed(1))
const totalDistKm = computed(() => {
  if (!props.points.length) return '0.0'
  const last = props.points[props.points.length - 1]
  return (last.cumDist / 1000).toFixed(1)
})

const elevGainMNow = computed(() => Math.round(current.value?.cumElevGain ?? 0))
const elevLossMNow = computed(() => Math.round(current.value?.cumElevLoss ?? 0))

const gradeDisplay = computed(() => {
  const g = current.value?.grade ?? 0
  return `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`
})
const hrDisplay  = computed(() => {
  const v = current.value?.hrSmooth; return v != null ? Math.round(v) : '--'
})
const cadDisplay = computed(() => {
  const v = current.value?.cadSmooth; return v != null ? Math.round(v) : '--'
})
const powerDisplay = computed(() => {
  const v = current.value?.powerSmooth; return v != null ? `${Math.round(v)}W` : '--'
})
const paceDisplay = computed(() => {
  const spd = current.value?.speedSmooth ?? 0
  if (spd < 0.5) return '--:--'
  const mpm = 60 / spd
  const m = Math.floor(mpm), s = Math.round((mpm - m) * 60)
  return `${m}:${String(s).padStart(2,'0')}`
})
const kcalDisplay = computed(() => {
  const pt = current.value, p0 = props.points[0]
  if (!pt?.time || !p0?.time) return '--'
  const hrs = (pt.time - p0.time) / 3_600_000
  if (hrs < 0.01) return '0'
  const avgKmh = (pt.cumDist / 1000) / hrs
  return Math.round((350 + 12 * avgKmh) * hrs)
})
const tempC = computed(() => {
  const t = current.value?.atemp; return t != null ? Math.round(t) : null
})

// ── GoPro / Minimal extra computed values ────────────────────────────────────
const currentElevM = computed(() => Math.round(current.value?.ele ?? 0))

function _fmtDateTime(d) {
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { time, date }
}

const goproDateTime = computed(() => {
  // Smooth interpolation: anchor to the GPS time at trimStart, then add video elapsed ms.
  // This makes the clock tick every second even when GPS points are 30 s apart.
  const p0 = props.points[props.trimStart]
  if (p0?.time && props.totalTime > 0) {
    return _fmtDateTime(new Date(p0.time.getTime() + Math.round(props.progress * props.totalTime)))
  }
  // Fallback: snap to current GPS point (low-res GPS, no video, or no timestamps)
  const t = current.value?.time
  if (!t) return null
  const d = t instanceof Date ? t : new Date(t)
  return isNaN(d) ? null : _fmtDateTime(d)
})

const slopeDisplay = computed(() => {
  const g = current.value?.grade ?? 0
  return `${Math.round(Math.abs(g))}%`
})

const latStr = computed(() => {
  const lat = current.value?.lat
  if (lat == null) return '--'
  const d = Math.floor(Math.abs(lat))
  const m = Math.floor((Math.abs(lat) - d) * 60)
  const s = (((Math.abs(lat) - d) * 60 - m) * 60).toFixed(2)
  return `${d}°${String(m).padStart(2,'0')}'${s}" ${lat >= 0 ? 'N' : 'S'}`
})
const lonStr = computed(() => {
  const lon = current.value?.lon
  if (lon == null) return '--'
  const d = Math.floor(Math.abs(lon))
  const m = Math.floor((Math.abs(lon) - d) * 60)
  const s = (((Math.abs(lon) - d) * 60 - m) * 60).toFixed(2)
  return `${d}°${String(m).padStart(2,'0')}'${s}" ${lon >= 0 ? 'E' : 'W'}`
})

const bearingData = computed(() => {
  const pts = props.points, idx = props.animIdx
  if (!pts.length || idx < 2) return { deg: 0, cardinal: 'N' }
  const look = Math.min(10, idx)
  const p0 = pts[idx - look], p1 = pts[idx]
  const dLon = (p1.lon - p0.lon) * Math.PI / 180
  const lat0 = p0.lat * Math.PI / 180
  const lat1 = p1.lat * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat1)
  const x = Math.cos(lat0) * Math.sin(lat1) - Math.sin(lat0) * Math.cos(lat1) * Math.cos(dLon)
  let deg = Math.atan2(y, x) * 180 / Math.PI
  deg = (deg + 360) % 360
  const cards = ['N','NE','E','SE','S','SW','W','NW']
  return { deg: Math.round(deg), cardinal: cards[Math.round(deg / 45) % 8] }
})
const bearingDeg  = computed(() => bearingData.value.deg)
const bearingCard = computed(() => bearingData.value.cardinal)

// GoPro gauge: r=60, 270° arc
const GOPRO_CIRC = 376.99, GOPRO_ARC = 282.74
const goProSpeedDash = computed(() => {
  const p = Math.max(0, Math.min(1, (parseFloat(speedKmhGauge.value) || 0) / 60))
  const f = GOPRO_ARC * p
  return `${f.toFixed(2)} ${(GOPRO_CIRC - f).toFixed(2)}`
})

// Sport gauge: r=62, 270° arc, max 180 km/h
const SPORT_CIRC = 389.56, SPORT_ARC = 292.17
const sportSpeedDash = computed(() => {
  const p = Math.max(0, Math.min(1, (parseFloat(speedKmhGauge.value) || 0) / 180))
  const f = SPORT_ARC * p
  return `${f.toFixed(2)} ${(SPORT_CIRC - f).toFixed(2)}`
})

// Cycling gauge: r=65, 270° arc, max 60 km/h
const CYCLING_CIRC = 408.41, CYCLING_ARC = 306.31
const cyclingSpeedDash = computed(() => {
  const p = Math.max(0, Math.min(1, (parseFloat(speedKmhGauge.value) || 0) / 60))
  const f = CYCLING_ARC * p
  return `${f.toFixed(2)} ${(CYCLING_CIRC - f).toFixed(2)}`
})

const gradeRaw = computed(() => {
  const g = current.value?.grade ?? 0
  return g.toFixed(2)
})

// ── Arc gauge dash (270° sweep, r=38, circ≈238.76) ──────────────────────────
const CIRC = 226.195, ARC = 169.646
function arcDash(val, maxVal) {
  const p = Math.max(0, Math.min(1, (parseFloat(val) || 0) / maxVal))
  const f = ARC * p
  return `${f.toFixed(2)} ${(CIRC - f).toFixed(2)}`
}
const speedDash = computed(() => arcDash(speedKmhGauge.value, 60))
const rpmDash   = computed(() => arcDash(cadDisplay.value, 130))

// ── Laps (1-km auto) ─────────────────────────────────────────────────────────
const LAP_KM = 1.0
const lapMarkerIndices = computed(() => {
  const pts = props.points
  if (!pts.length) return [0]
  const m = [0]; let next = LAP_KM
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].cumDist / 1000 >= next) { m.push(i); next += LAP_KM }
  }
  return m
})
const currentLapN = computed(() => {
  const d = (current.value?.cumDist ?? 0) / 1000; return Math.floor(d / LAP_KM) + 1
})
const totalLaps = computed(() => {
  if (!props.points.length) return 0
  const last = props.points[props.points.length - 1]
  return Math.floor((last.cumDist / 1000) / LAP_KM)
})
const completedLapTimes = computed(() => {
  const markers = lapMarkerIndices.value, pts = props.points, out = []
  for (let i = 0; i < markers.length - 1; i++) {
    if (markers[i+1] > props.animIdx) break
    const p0 = pts[markers[i]], p1 = pts[markers[i+1]]
    const ms = (p0?.time && p1?.time) ? p1.time - p0.time : null
    out.push({ n: i+1, ms })
  }
  return out
})
const bestLapMs = computed(() => {
  const ts = completedLapTimes.value.filter(l => l.ms != null).map(l => l.ms)
  return ts.length ? Math.min(...ts) : null
})
const currentLapElapsedMs = computed(() => {
  const markers = lapMarkerIndices.value, lapIdx = currentLapN.value - 1
  if (lapIdx >= markers.length) return 0
  const p0 = props.points[markers[lapIdx]], pc = current.value
  if (!p0?.time || !pc?.time) return 0
  return pc.time - p0.time
})
function fmtLapTime(ms) {
  if (!ms || ms < 0) return '--'
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60)
  const frac = String(Math.floor((ms % 1000) / 10)).padStart(3, '0')
  return `${m}:${String(s % 60).padStart(2,'0')}.${frac}`
}
const displayLaps = computed(() => {
  const rows = completedLapTimes.value.slice(-5).map(l => ({
    n: l.n,
    time: l.ms ? fmtLapTime(l.ms) : '--',
    delta: l.ms && bestLapMs.value && l.ms > bestLapMs.value
      ? `+${fmtLapTime(l.ms - bestLapMs.value)}` : null,
    current: false,
  }))
  const curMs = currentLapElapsedMs.value
  rows.unshift({ n: currentLapN.value, time: fmtLapTime(curMs), delta: null, current: true })
  return rows.slice(0, 6)
})

// ── Power zones ──────────────────────────────────────────────────────────────
const ZONES = [
  { label:'100-149', min:100, max:150 },
  { label:'150-199', min:150, max:200 },
  { label:'200-237', min:200, max:238 },
  { label:'238-274', min:238, max:275 },
  { label:'275-374', min:275, max:375 },
  { label:'375-499', min:375, max:500 },
  { label:'500+',    min:500, max:Infinity },
]
const ZONE_NAMES = ['Recovery','Endurance','Tempo','Threshold','VO2max','Anaerobic','Neuromuscular']

const zoneData = computed(() => {
  const pts = props.points, n = props.animIdx
  const counts = ZONES.map(() => 0)
  let activeZ = -1
  const curPw = current.value?.powerSmooth ?? null

  for (let i = 0; i <= n && i < pts.length; i++) {
    const pw = pts[i].powerSmooth
    if (pw != null) {
      for (let z = 0; z < ZONES.length; z++) {
        if (pw >= ZONES[z].min && pw < ZONES[z].max) { counts[z]++; break }
      }
    }
  }
  if (curPw != null) {
    for (let z = 0; z < ZONES.length; z++) {
      if (curPw >= ZONES[z].min && curPw < ZONES[z].max) { activeZ = z; break }
    }
  }
  const maxC = Math.max(...counts, 1)
  return ZONES.map((z, i) => ({ label: z.label, pct: (counts[i] / maxC) * 100, active: i === activeZ }))
})

const zoneName = computed(() => {
  const curPw = current.value?.powerSmooth
  if (curPw != null) {
    for (let z = 0; z < ZONES.length; z++) {
      if (curPw >= ZONES[z].min && curPw < ZONES[z].max) return ZONE_NAMES[z]
    }
  }
  // Fallback: most-used zone
  const d = zoneData.value, maxP = Math.max(...d.map(z => z.pct))
  const idx = d.findIndex(z => z.pct === maxP)
  return idx >= 0 ? ZONE_NAMES[idx] : 'Power Zones'
})

// ── Map canvas drawing ────────────────────────────────────────────────────────
function setupProjection() {
  if (!canvasRef.value || !props.points.length) return
  const pts = props.points
  const latMin = pts.reduce((a,p) => Math.min(a,p.lat),  Infinity)
  const latMax = pts.reduce((a,p) => Math.max(a,p.lat), -Infinity)
  const lonMin = pts.reduce((a,p) => Math.min(a,p.lon),  Infinity)
  const lonMax = pts.reduce((a,p) => Math.max(a,p.lon), -Infinity)
  maxSpeed = arrayMax(pts.map(p => p.speedSmooth)) || 1
  const pad = 12, W = canvasRef.value.width, H = canvasRef.value.height
  toXY = (lat, lon) => [
    pad + (lon - lonMin) / ((lonMax - lonMin) || 1) * (W - 2*pad),
    pad + (1 - (lat - latMin) / ((latMax - latMin) || 1)) * (H - 2*pad),
  ]
}

// Degrees of latitude to show above/below current position in inset (≈220m radius)
const INSET_LAT_R = 0.002

function draw() {
  if (!ctx || !props.points.length) return
  const canvas = canvasRef.value
  if (!canvas) return
  const W = canvas.width, H = canvas.height
  const pts = props.points, idx = props.animIdx
  ctx.clearRect(0, 0, W, H)

  if (props.videoSrc) {
    // ── Zoomed, heading-up inset ─────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    const cp   = pts[idx]
    const latR = INSET_LAT_R
    const lonR = latR * (W / H)   // preserve canvas aspect ratio

    const toC = (lat, lon) => [
      ((lon - cp.lon) / (lonR * 2)) * W + W / 2,
      -((lat - cp.lat) / (latR * 2)) * H + H / 2,
    ]

    // Bearing: average recent-point direction so it doesn't jitter
    let heading = 0
    const look = Math.min(20, idx)
    if (look >= 2) {
      const p0 = pts[idx - look]
      heading = Math.atan2(cp.lon - p0.lon, cp.lat - p0.lat)
    }

    // Draw track with heading rotation
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-heading)
    ctx.translate(-W / 2, -H / 2)

    // Full faint trail
    ctx.beginPath()
    pts.forEach((p, i) => {
      const [x, y] = toC(p.lat, p.lon)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Speed-colored traveled portion
    for (let i = Math.max(1, props.trimStart); i <= idx && i < pts.length; i++) {
      const t = pts[i].speedSmooth / maxSpeed
      const r = Math.round(lerp(30, 255, t))
      const g = Math.round(lerp(100, 80, t))
      const b = Math.round(lerp(255, 30, t))
      const [x0, y0] = toC(pts[i-1].lat, pts[i-1].lon)
      const [x1, y1] = toC(pts[i].lat,   pts[i].lon)
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    ctx.restore()

    // Current position marker always at canvas center
    ctx.beginPath(); ctx.arc(W/2, H/2, 4.5, 0, Math.PI*2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.beginPath(); ctx.arc(W/2, H/2, 8, 0, Math.PI*2)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke()

    // North indicator — small arrow in top-right that rotates to show true north
    ctx.save()
    ctx.translate(W - 12, 12)
    ctx.rotate(-heading)
    ctx.beginPath()
    ctx.moveTo(0, -8); ctx.lineTo(-3.5, 3); ctx.lineTo(0, 1); ctx.lineTo(3.5, 3)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fill()
    ctx.restore()

  } else {
    // ── Full map: entire track extent ────────────────────────────────────────
    if (!toXY) return
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    ctx.beginPath()
    pts.forEach((p,i) => { const [x,y] = toXY(p.lat,p.lon); i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y) })
    ctx.strokeStyle = 'rgba(255,255,255,.12)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    for (let i = Math.max(1, props.trimStart); i <= idx && i < pts.length; i++) {
      const t = pts[i].speedSmooth / maxSpeed
      const r = Math.round(lerp(30,255,t)), g = Math.round(lerp(100,80,t)), b = Math.round(lerp(255,30,t))
      const [x0,y0] = toXY(pts[i-1].lat, pts[i-1].lon)
      const [x1,y1] = toXY(pts[i].lat,   pts[i].lon)
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
    if (idx < pts.length) {
      const [cx,cy] = toXY(pts[idx].lat, pts[idx].lon)
      ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx,cy,8.5,0,Math.PI*2)
      ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5; ctx.stroke()
    }
    ctx.save()
    ctx.font = `500 11px sans-serif`; ctx.textAlign='right'; ctx.textBaseline='top'
    ctx.fillStyle='rgba(255,255,255,0.35)'
    ctx.fillText('salidumay.com', W-10, 10)
    ctx.restore()
  }
}

// ── Elevation chart drawing ───────────────────────────────────────────────────
function drawElevChart() {
  const canvas = elevChartRef.value
  if (!canvas || !elevCtx || !props.points.length) return
  const W = canvas.width, H = canvas.height
  if (!W || !H) return
  const pts = props.points, idx = props.animIdx
  const eles = pts.map(p => p.ele)
  const eMin = Math.min(...eles), eMax = Math.max(...eles), eRange = (eMax - eMin) || 1
  const pL=4, pR=52, pT=8, pB=4
  const xOf = i   => pL + (i / (pts.length-1)) * (W - pL - pR)
  const yOf = ele => H - pB - ((ele - eMin) / eRange) * (H - pT - pB)

  elevCtx.clearRect(0, 0, W, H)

  // Fill area
  elevCtx.beginPath()
  elevCtx.moveTo(xOf(0), H)
  for (let i = 0; i < pts.length; i++) elevCtx.lineTo(xOf(i), yOf(pts[i].ele))
  elevCtx.lineTo(xOf(pts.length-1), H)
  elevCtx.closePath()
  const oc = props.overlayColor
  const { r: ocR, g: ocG, b: ocB } = parseOc(oc)
  const grad = elevCtx.createLinearGradient(0, pT, 0, H)
  grad.addColorStop(0, `rgba(${ocR},${ocG},${ocB},0.28)`)
  grad.addColorStop(1, `rgba(${ocR},${ocG},${ocB},0.04)`)
  elevCtx.fillStyle = grad
  elevCtx.fill()

  // Full dim line
  elevCtx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    i===0 ? elevCtx.moveTo(xOf(0),yOf(pts[0].ele)) : elevCtx.lineTo(xOf(i),yOf(pts[i].ele))
  }
  elevCtx.strokeStyle = `rgba(${ocR},${ocG},${ocB},0.4)`
  elevCtx.lineWidth = 1.5
  elevCtx.stroke()

  // Traveled portion brighter
  elevCtx.beginPath()
  for (let i = 0; i <= idx && i < pts.length; i++) {
    i===0 ? elevCtx.moveTo(xOf(0),yOf(pts[0].ele)) : elevCtx.lineTo(xOf(i),yOf(pts[i].ele))
  }
  elevCtx.strokeStyle = oc
  elevCtx.lineWidth = 2
  elevCtx.stroke()

  // Current dot
  if (idx < pts.length) {
    const cx = xOf(idx), cy = yOf(pts[idx].ele)
    elevCtx.beginPath(); elevCtx.arc(cx, cy, 5, 0, Math.PI*2)
    elevCtx.fillStyle = oc; elevCtx.fill()
    const eleM = Math.round(pts[idx].ele)
    // Cap font size: derive from canvas width (always correct) not height
    const fs = Math.min(16, Math.max(8, Math.round(W * 0.052)))
    elevCtx.font = `700 ${fs}px -apple-system, sans-serif`
    elevCtx.fillStyle = 'white'
    elevCtx.textAlign = 'left'
    elevCtx.textBaseline = 'middle'
    elevCtx.fillText(String(eleM), cx + 8, cy)
  }
}

// ── Resize observers ──────────────────────────────────────────────────────────
function onResize(entries) {
  const { width, height } = entries[0].contentRect
  canvasRef.value.width  = Math.round(width)
  canvasRef.value.height = Math.round(height)
  setupProjection(); draw()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  ro  = new ResizeObserver(onResize)
  ro.observe(canvasRef.value)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', onKeyDown)
})

watch(() => props.filterId, id => {
  if (glReady.value) {
    shader.setFilter(SHADER_PARAMS[id] ?? SHADER_PARAMS.none)
    shader.renderFrame()
  }
})

onUnmounted(() => {
  ro?.disconnect(); roElev?.disconnect(); roStage?.disconnect()
  shader.destroy()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousemove', onCapDragMove);   window.removeEventListener('mouseup', endCapDrag)
  window.removeEventListener('mousemove', onCapResizeMove); window.removeEventListener('mouseup', endCapResize)
})

// Watch elevation chart ref (appears/disappears with v-if)
watch(elevChartRef, (canvas) => {
  roElev?.disconnect(); roElev = null; elevCtx = null
  if (!canvas) return
  elevCtx = canvas.getContext('2d')
  roElev = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect
    if (width > 0 && height > 0) {
      canvas.width  = Math.round(width)
      canvas.height = Math.round(height)
      elevCtx = canvas.getContext('2d')
      drawElevChart()
    }
  })
  roElev.observe(canvas)
})

watch(() => props.points,       () => { setupProjection(); draw(); drawElevChart() })
watch(() => props.animIdx,      () => { draw(); drawElevChart() }, { flush: 'sync' })
watch(() => props.videoSrc,     () => { setupProjection(); draw() })
watch(() => props.overlayColor, () => { drawElevChart() })

// ── Location pill position: empty space per layout ────────────────────────────
const locationParts = computed(() => props.locationName.split(',').map(p => p.trim()).filter(Boolean))

const locationStyle = computed(() => ({ bottom: '8px', left: '8px', top: 'auto', right: 'auto' }))
</script>

<style scoped>
/* ── Stage ─────────────────────────────────────────────────────────────────── */
.stage {
  background: #0a0a0a;
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
  margin-bottom: 0;
  border: 0.5px solid var(--border);
  container-type: inline-size;
}

/* Fullscreen mode */
.stage:fullscreen,
.stage:-webkit-full-screen {
  border-radius: 0;
  height: 100dvh !important;
  aspect-ratio: unset !important;
  width: 100dvw;
}
.stage:fullscreen .fullscreen-btn,
.stage:-webkit-full-screen .fullscreen-btn { opacity: 1; }

/* Fullscreen toggle button */
/* ── Logo watermark ─────────────────────────────────────────────────────────── */
.logo-wm {
  position: absolute;
  bottom: 8px; right: 44px;
  display: flex; align-items: center; gap: 4px;
  opacity: 0.4;
  pointer-events: none;
  z-index: 20;
}
.logo-wm-icon { width: clamp(14px, 2cqw, 20px); height: clamp(14px, 2cqw, 20px); border-radius: 3px; display: block; }
.logo-wm-text { font-size: clamp(7px, 0.9cqw, 10px); font-weight: 600; color: white; text-shadow: 0 1px 4px rgba(0,0,0,.9); letter-spacing: .04em; }

.fullscreen-btn {
  position: absolute;
  bottom: 8px; right: 8px;
  width: 28px; height: 28px;
  background: rgba(0,0,0,0.5);
  border: 0.5px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 30;
  padding: 0;
}
.stage:hover .fullscreen-btn { opacity: 1; }
.fullscreen-btn:hover { background: rgba(0,0,0,0.75); color: white; }
.fullscreen-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

.video-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; background: #000;
}
.gl-canvas {
  pointer-events: none;
  /* object-fit handled by cover-UV computation in the shader */
  object-fit: unset;
}

/* Scales all HUD elements proportionally when aspect ratio is portrait.
   Children with position:absolute see the reduced coordinate space;
   after transform they appear correctly positioned within the full stage. */
.hud-overlay-root {
  position: absolute;
  top: 0; left: 0;
  width: calc(100% / var(--hud-scale, 1));
  height: calc(100% / var(--hud-scale, 1));
  transform: scale(var(--hud-scale, 1));
  transform-origin: top left;
}

/* ── Map canvas ─────────────────────────────────────────────────────────────── */
canvas:not(.inset) { width: 100%; height: 100%; display: block; }
canvas.inset {
  position: absolute;
  top: 4px; right: 4px;
  width: 21%;
  /* aspect-ratio from width — never relies on % height, always resolves */
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  border: 0.5px solid rgba(255,255,255,.18);
  display: block;
}

/* ── Progress bar ───────────────────────────────────────────────────────────── */
.hud-prog-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 4px;
  background: rgba(255,255,255,.12);
}
.hud-prog-fill {
  height: 100%; background: var(--oc);
  transition: width .05s linear;
}

/* ── Lap times ──────────────────────────────────────────────────────────────── */
.hud-laps {
  position: absolute; top: 4px; left: 0;
  /* Fixed % width — no min-width so it can't bleed into the elevation chart zone */
  width: 27%;
  max-height: 38%;
  overflow: hidden;
  background: rgba(0,0,0,.55);
  padding: 5px 8px 7px;
  border-radius: 0 0 6px 0;
  box-sizing: border-box;
}
.lap-header {
  font-size: clamp(7px, 1cqw, 11px);
  font-weight: 700;
  color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .08em;
  margin-bottom: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lap-row {
  font-size: clamp(8px, 1.15cqw, 13px);
  font-weight: 500;
  color: rgba(255,255,255,.55);
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  white-space: nowrap; overflow: hidden;
}
.lap-current {
  color: var(--oc); font-weight: 700;
  font-size: clamp(9px, 1.3cqw, 14px);
}
.lap-n { opacity: .7; }
.lap-d { color: rgba(255,255,255,.38); font-size: .9em; }

/* ── Top info (temp + dist) ─────────────────────────────────────────────────── */
/* Sits to the right of the lap box (left: 29%) and left of the map (right: 23%) */
.hud-top-info {
  position: absolute; top: 5px;
  left: 29%; right: 23%;
  display: flex; align-items: flex-start;
  gap: 10px; padding: 0 4px;
  overflow: hidden;
}
.hud-temp-block {
  display: flex; align-items: center; gap: 3px;
  font-size: clamp(10px, 1.4cqw, 16px);
  font-weight: 600; color: white; white-space: nowrap;
}
.hud-icon-sm { width: clamp(12px, 1.8cqw, 20px); height: clamp(12px, 1.8cqw, 20px); flex-shrink: 0; }
.hud-dist-block { margin-left: auto; text-align: right; white-space: nowrap; }
.hud-dist-val   { font-size: clamp(12px, 1.6cqw, 19px); font-weight: 700; color: white; }
.hud-dist-unit  { font-size: clamp(8px, 1cqw, 12px); color: rgba(255,255,255,.5); }
.hud-dist-total { font-size: clamp(7px, 0.9cqw, 10px); color: rgba(255,255,255,.4); margin-top: 1px; }

/* ── Elevation chart ────────────────────────────────────────────────────────── */
/* Use top + bottom anchors (never height:%) to avoid intrinsic-size fallback
   on aspect-ratio parents. top:12% + bottom:75% → 13% height. */
.hud-elev-canvas {
  position: absolute;
  top: 12%; bottom: 75%;
  left: 29%; right: 23%;
  display: block;
  border-radius: 3px;
}

/* ── Stat panels (left / right) ─────────────────────────────────────────────── */
.hud-panel-left,
.hud-panel-right {
  position: absolute;
  top: 30%; bottom: 30%;
  display: flex; flex-direction: column;
  justify-content: space-around;
}
.hud-panel-left  { left: 1.5%; max-width: 22%; }
/* Right panel: starts below the map (map ends at ~28% from top) */
.hud-panel-right { right: 1.5%; align-items: flex-end; max-width: 22%; }

.hud-stat-row   { display: flex; align-items: center; gap: clamp(3px, 0.5cqw, 7px); }
.hud-stat-row-r { display: flex; align-items: center; gap: clamp(3px, 0.5cqw, 7px); justify-content: flex-end; }

.hud-stat-icon, .hud-stat-icon-r { color: var(--oc);
  width: clamp(14px, 2cqw, 22px);
  height: clamp(14px, 2cqw, 22px);
  flex-shrink: 0;
}

.hud-stat-val, .hud-stat-val-r {
  font-size: clamp(10px, 1.4cqw, 17px);
  font-weight: 700; color: white;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
  white-space: nowrap;
}
.hud-stat-multi {
  font-size: clamp(9px, 1.2cqw, 14px);
  font-weight: 600; color: white;
  line-height: 1.45;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}

/* ── Bottom row ─────────────────────────────────────────────────────────────── */
.hud-bottom-row {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 30%;
  display: flex; align-items: flex-end;
  padding: 0 1% 1.5%;
  background: linear-gradient(transparent, rgba(0,0,0,.78) 55%);
}

/* Arc gauges — sized relative to bottom row width */
.hud-gauge { width: 14%; flex-shrink: 0; }
.gauge-svg { width: 100%; height: auto; display: block; }
.gauge-lbl {
  text-align: center;
  font-size: clamp(7px, 0.85cqw, 10px);
  font-weight: 700;
  color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .08em;
  margin-top: 1px;
}

/* Power zones */
.hud-zones { flex: 1; margin: 0 2% 3px; }
.zones-title {
  text-align: center;
  font-size: clamp(8px, 0.95cqw, 11px);
  font-weight: 700;
  color: rgba(255,255,255,.55);
  text-transform: uppercase; letter-spacing: .1em;
  margin-bottom: 3px;
}
.zones-bars {
  display: flex; align-items: flex-end; gap: 2px;
  height: 62%; min-height: 30px;
}
.zone-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.zone-bar-wrap {
  width: 100%; flex: 1;
  background: rgba(255,255,255,.08);
  border: 0.5px solid rgba(255,255,255,.15);
  border-radius: 2px 2px 0 0;
  display: flex; align-items: flex-end; overflow: hidden;
}
.zone-bar-fill {
  width: 100%;
  background: var(--oc-semi);
  transition: height .3s ease;
}
.zone-col.zone-active .zone-bar-fill { background: var(--oc); }
.zone-col.zone-active .zone-bar-wrap { border-color: var(--oc); }
.zone-range {
  font-size: clamp(5px, 0.65cqw, 8px);
  color: rgba(255,255,255,.35);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.zone-col.zone-active .zone-range { color: var(--oc); }

/* ── Minimal HUD ────────────────────────────────────────────────────────────── */
.minimal-bottom {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; align-items: stretch; justify-content: center;
  padding: 2.5rem 5% 1.2%;
  background: linear-gradient(transparent, rgba(0,0,0,0.82) 60%);
  gap: 0;
}
.mini-card {
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  gap: 0;
  min-width: 0;
}
.mini-val {
  font-size: clamp(16px, 2.8cqw, 34px);
  font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1.1;
  letter-spacing: -.02em;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
  white-space: nowrap;
}
.mini-unit {
  font-size: clamp(7px, 0.9cqw, 11px);
  font-weight: 600; color: rgba(255,255,255,.5);
  text-transform: uppercase; letter-spacing: .08em;
  margin-top: 1px;
}
.mini-lbl {
  font-size: clamp(7px, 0.8cqw, 10px);
  font-weight: 700; color: rgba(255,255,255,.35);
  text-transform: uppercase; letter-spacing: .12em;
  margin-top: 4px;
  text-shadow: 0 1px 3px rgba(0,0,0,.9);
}
.mini-divider {
  width: 0.5px; background: rgba(255,255,255,.18);
  align-self: stretch; margin: 0 clamp(6px, 1.2cqw, 18px);
  flex-shrink: 0;
}

/* ── GoPro HUD ───────────────────────────────────────────────────────────────── */
.gopro-coords {
  position: absolute; top: clamp(6px, 0.9cqw, 14px); left: 50%;
  transform: translateX(-50%);
  font-size: clamp(7px, 0.85cqw, 10px);
  font-weight: 500; color: rgba(255,255,255,.55);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
  white-space: nowrap; letter-spacing: .04em;
}
.gopro-bearing {
  position: absolute; top: clamp(14px, 2cqw, 30px); left: 50%;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: clamp(4px, 0.7cqw, 9px);
}
.gopro-compass { width: clamp(14px, 1.8cqw, 22px); height: clamp(17px, 2.2cqw, 26px); flex-shrink: 0; }
.gopro-bearing-val {
  font-size: clamp(13px, 1.9cqw, 24px);
  font-weight: 700; color: #fff;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.gopro-left-panel {
  position: absolute; top: 30%; left: 2%;
  display: flex; flex-direction: column;
  gap: clamp(10px, 1.5cqw, 22px);
}
.gopro-stat-block { display: flex; flex-direction: column; gap: clamp(1px, 0.25cqw, 4px); }
.gopro-stat-head  { display: flex; align-items: center; gap: clamp(4px, 0.6cqw, 8px); }
.gopro-icon { width: clamp(12px, 1.5cqw, 18px); height: clamp(11px, 1.4cqw, 16px); flex-shrink: 0; }
.gopro-stat-lbl {
  font-size: clamp(7px, 0.85cqw, 11px);
  font-weight: 700; color: rgba(255,255,255,.65);
  text-transform: uppercase; letter-spacing: .1em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.gopro-stat-val {
  font-size: clamp(14px, 2.1cqw, 26px);
  font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
  padding-left: clamp(16px, 2.1cqw, 26px);
}
.gopro-stat-unit { font-size: .65em; color: rgba(255,255,255,.65); font-weight: 600; }
.gopro-datetime-block {
  margin-top: clamp(6px, 0.8cqw, 12px);
  padding-left: clamp(16px, 2.1cqw, 26px);
  display: flex; flex-direction: column; gap: clamp(1px, 0.2cqw, 3px);
}
.gopro-datetime-time {
  font-size: clamp(11px, 1.4cqw, 18px);
  font-weight: 700; color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
  letter-spacing: 0.03em;
}
.gopro-datetime-date {
  font-size: clamp(7px, 0.85cqw, 11px);
  font-weight: 700; color: rgba(255,255,255,.65);
  letter-spacing: 0.06em; text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.gopro-gauge-wrap {
  position: absolute; bottom: 0; left: 50%;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center;
  width: clamp(100px, 18cqw, 220px);
  padding-bottom: 0.5%;
}
.gopro-gauge-svg { width: 100%; height: auto; display: block; }
.gopro-speed-unit {
  font-size: clamp(7px, 0.85cqw, 11px);
  font-weight: 700; color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .12em;
  margin-top: -2px;
  text-shadow: 0 1px 3px rgba(0,0,0,.9);
}

/* ── Sport HUD ───────────────────────────────────────────────────────────────── */
.sport-top-left {
  position: absolute; top: 10px; left: 2%;
  display: flex; align-items: baseline; gap: clamp(3px, 0.4cqw, 6px);
}
.sport-dist-val {
  font-size: clamp(18px, 2.8cqw, 34px); font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
}
.sport-dist-unit {
  font-size: clamp(8px, 1cqw, 13px); font-weight: 700;
  color: var(--oc); text-transform: uppercase; letter-spacing: .1em;
}
.sport-coords {
  position: absolute; top: 10px; right: 24%;
  text-align: right;
}
.sport-coord-line {
  font-size: clamp(6px, 0.78cqw, 10px); font-weight: 500;
  color: var(--oc-dim); font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,.9); line-height: 1.5;
  letter-spacing: .03em;
}
.sport-slope-block {
  position: absolute; top: 42%; left: 3%;
}
.sport-slope-lbl {
  font-size: clamp(7px, 0.85cqw, 11px); font-weight: 700;
  color: rgba(255,255,255,.6); text-transform: uppercase; letter-spacing: .12em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.sport-slope-val {
  font-size: clamp(18px, 3cqw, 38px); font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1.1;
  text-shadow: 0 1px 6px rgba(0,0,0,1); letter-spacing: -.01em;
  margin-top: 2px;
}
.sport-slope-unit {
  font-size: clamp(8px, 1cqw, 13px); font-weight: 700;
  color: var(--oc); text-transform: uppercase; letter-spacing: .1em;
  margin-top: 2px;
}
.sport-gauge-wrap {
  position: absolute; bottom: 1%; left: 1%;
  width: clamp(90px, 16cqw, 200px);
}
.sport-gauge-svg { width: 100%; height: auto; display: block; }

/* ── Cycling HUD ─────────────────────────────────────────────────────────────── */
.cyc-top-bar {
  position: absolute; top: 8px; left: 2%; right: 2%;
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 0 0.5%;
}
.cyc-stat { display: flex; flex-direction: column; gap: 1px; }
.cyc-stat--right { align-items: flex-end; }
.cyc-stat-lbl {
  font-size: clamp(6px, 0.78cqw, 10px); font-weight: 700;
  color: var(--oc); text-transform: uppercase; letter-spacing: .12em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.cyc-stat-val {
  font-size: clamp(14px, 2.1cqw, 26px); font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1.1;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
}
.cyc-stat-unit {
  font-size: .55em; font-weight: 600; color: rgba(255,255,255,.55);
}
.cyc-compass { display: flex; align-items: center; justify-content: center; }
.cyc-compass-svg { width: clamp(28px, 3.8cqw, 48px); height: clamp(28px, 3.8cqw, 48px); }

.cyc-center {
  position: absolute; top: 28%; bottom: 15%; left: 2%; right: 2%;
  display: flex; align-items: center; gap: 0;
}
.cyc-gauge-wrap {
  display: flex; flex-direction: column; align-items: center;
  width: clamp(100px, 17cqw, 210px); flex-shrink: 0;
}
.cyc-gauge-label {
  font-size: clamp(7px, 0.85cqw, 11px); font-weight: 700;
  color: var(--oc-dim); text-transform: uppercase; letter-spacing: .12em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9); margin-bottom: 2px;
}
.cyc-gauge-svg { width: 100%; height: auto; display: block; }
.cyc-gauge-unit {
  font-size: clamp(7px, 0.85cqw, 11px); font-weight: 700;
  color: var(--oc-dim); text-transform: uppercase; letter-spacing: .12em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9); margin-top: 2px;
}
.cyc-slope-block {
  flex: 1; padding-left: clamp(12px, 2cqw, 28px);
  display: flex; flex-direction: column; gap: 2px;
}
.cyc-slope-lbl {
  font-size: clamp(7px, 0.85cqw, 11px); font-weight: 700;
  color: rgba(255,255,255,.65); text-transform: uppercase; letter-spacing: .1em;
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.cyc-slope-val {
  font-size: clamp(22px, 3.8cqw, 48px); font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1;
  text-shadow: 0 1px 6px rgba(0,0,0,1); letter-spacing: -.02em;
}
.cyc-slope-unit {
  font-size: clamp(9px, 1.1cqw, 14px); font-weight: 700; color: var(--oc);
  text-shadow: 0 1px 4px rgba(0,0,0,.9);
}
.cyc-gps {
  position: absolute; bottom: 4%; left: 2%;
  display: flex; flex-direction: column; gap: 2px;
}
.cyc-gps-val {
  font-size: clamp(7px, 0.88cqw, 11px); font-weight: 500;
  color: rgba(255,255,255,.6); font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,.9); letter-spacing: .04em;
}

/* ── Location pill ──────────────────────────────────────────────────────────── */
.hud-location {
  position: absolute;
  display: flex;
  align-items: flex-start;
  gap: clamp(3px, 0.4cqw, 5px);
  background: rgba(0,0,0,0.55);
  border: 0.5px solid rgba(255,255,255,0.18);
  border-radius: 4px;
  padding: clamp(2px, 0.35cqw, 4px) clamp(5px, 0.8cqw, 10px) clamp(2px, 0.35cqw, 4px) clamp(4px, 0.6cqw, 7px);
  backdrop-filter: blur(6px);
  pointer-events: none;
  z-index: 20;
  max-width: 45%;
}
.hud-location-pin {
  width: clamp(7px, 0.9cqw, 11px);
  height: clamp(9px, 1.2cqw, 15px);
  flex-shrink: 0;
  color: var(--oc);
  opacity: 0.85;
  margin-top: 0.1em;
}
.hud-location-lines {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.hud-location-lines span {
  font-size: clamp(7px, 0.85cqw, 11px);
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  letter-spacing: 0.02em;
  line-height: 1.3;
}

/* ── Simple HUD (map-only) ──────────────────────────────────────────────────── */
.hud.hud-simple {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 3rem 1.25rem 0.9rem;
  background: linear-gradient(transparent, rgba(0,0,0,.9) 80%);
  display: flex; flex-direction: column; gap: .55rem;
}
.hud-stats { display: flex; align-items: flex-end; gap: 1.6rem; }
.hud-stat  { padding-left: 8px; border-left: 2px solid; }
.speed-stat { border-color: #06b6d4; }
.elev-stat  { border-color: #22c55e; }
.dist-stat  { border-color: #f97316; }
.h-val {
  font-size: 20px; font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1;
  letter-spacing: -.02em; display: flex; align-items: baseline; gap: 3px;
  text-shadow: 0 1px 6px rgba(0,0,0,1);
}
.h-unit { font-size: 9px; font-weight: 600; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .1em; }
.h-lbl  { font-size: 8px; font-weight: 700; color: rgba(255,255,255,.3); text-transform: uppercase; letter-spacing: .14em; margin-top: 5px; text-shadow: 0 1px 3px rgba(0,0,0,.9); }

.hud-progress { display: flex; align-items: center; gap: 8px; }
.hud-time     { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.45); font-variant-numeric: tabular-nums; letter-spacing: .03em; white-space: nowrap; min-width: 38px; }
.hud-time--end { text-align: right; }
.hud-track    { flex: 1; height: 3px; background: rgba(255,255,255,.15); border-radius: 2px; position: relative; }
.hud-fill     { position: absolute; inset: 0 auto 0 0; background: rgba(255,255,255,.85); border-radius: 2px; transition: width .05s linear; }
.hud-dot      { position: absolute; top: 50%; width: 8px; height: 8px; background: #fff; border-radius: 50%; transform: translate(-50%,-50%); box-shadow: 0 0 6px rgba(0,0,0,.5); transition: left .05s linear; }

/* ── Captions ──────────────────────────────────────────────────────────────── */
.caption-overlay {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: #fff;
  font-weight: 600;
  line-height: 1.3;
  z-index: 30;
  cursor: grab;
  user-select: none;
  text-shadow: 0 1px 4px rgba(0,0,0,.8);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: clamp(12px, 2.5cqw, 22px);
  box-sizing: border-box;
  outline: 1.5px solid transparent;
  transition: outline-color .15s;
}
.caption-overlay:hover {
  outline-color: rgba(255,255,255,.35);
}
.caption--active {
  outline-color: rgba(255,255,255,.7) !important;
  cursor: grabbing;
}
.caption--bottom { bottom: 8%; }
.caption--top    { top: 8%; }
.caption--small  { font-size: clamp(10px, 1.8cqw, 16px); }
.caption--large  { font-size: clamp(14px, 3.2cqw, 28px); }
.caption--bg     { background: rgba(0,0,0,0.55); }

/* Right-edge resize grip */
.cap-resize-handle {
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 28px;
  cursor: ew-resize;
  border-radius: 3px;
  background: rgba(255,255,255,0);
  transition: background .15s;
  display: flex; align-items: center; justify-content: center;
}
.caption-overlay:hover .cap-resize-handle,
.caption--active .cap-resize-handle {
  background: rgba(255,255,255,.25);
}
.cap-resize-handle::after {
  content: '';
  width: 2px;
  height: 16px;
  border-radius: 2px;
  background: rgba(255,255,255,.7);
  box-shadow: 4px 0 0 rgba(255,255,255,.4);
}
</style>
