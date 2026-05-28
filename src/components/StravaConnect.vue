<template>
  <div class="strava-wrap">
    <div class="strava-divider"><span>or import from Strava</span></div>

    <!-- ── Not connected ────────────────────────────────────────────────────── -->
    <template v-if="!isConnected">
      <div class="strava-card strava-card--center">
        <button class="strava-btn strava-btn--primary" @click="authorize">
          <StravaIcon />
          Connect with Strava
        </button>
      </div>
    </template>

    <!-- ── Connected — activity list ─────────────────────────────────────── -->
    <template v-else>
      <div class="strava-card">
        <!-- Header row -->
        <div class="strava-header">
          <div class="strava-athlete">
            <img
              v-if="athlete?.profile_medium"
              :src="athlete.profile_medium"
              class="strava-avatar"
              alt=""
            />
            <span class="strava-athlete-name">{{ athlete?.firstname }} {{ athlete?.lastname }}</span>
          </div>
          <button class="strava-link-btn" @click="disconnect">Disconnect</button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="strava-loading">
          <span class="strava-spinner" />
          Loading activities…
        </div>

        <!-- Activity list -->
        <div v-else-if="activities.length" class="strava-list">
          <div
            v-for="a in activities"
            :key="a.id"
            class="strava-row"
            :class="{ 'strava-row--busy': importing === a.id }"
          >
            <span class="strava-sport">{{ SPORT_ICONS[a.sport_type] || SPORT_ICONS[a.type] || '🏅' }}</span>
            <div class="strava-info">
              <div class="strava-name">{{ a.name }}</div>
              <div class="strava-meta">
                {{ fmtDate(a.start_date_local) }}
                <template v-if="a.distance"> · {{ (a.distance / 1000).toFixed(1) }} km</template>
                <template v-if="a.total_elevation_gain"> · ↑{{ Math.round(a.total_elevation_gain) }} m</template>
              </div>
            </div>
            <button
              class="strava-import-btn"
              :disabled="importing !== null"
              @click="onImport(a)"
            >
              <span v-if="importing === a.id" class="strava-spinner strava-spinner--sm" />
              <span v-else>Import</span>
            </button>
          </div>
        </div>

        <div v-else class="strava-empty">No recent activities found.</div>
      </div>
    </template>

    <!-- Error banner -->
    <p v-if="authError || actError" class="strava-error">
      {{ authError || actError }}
    </p>
  </div>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useStravaAuth }       from '../composables/useStravaAuth.js'
import { useStravaActivities, SPORT_ICONS } from '../composables/useStravaActivities.js'

const emit = defineEmits(['gpx'])

// ── Auth ──────────────────────────────────────────────────────────────────────
const {
  error: authError, isConnected, athlete,
  authorize, getAccessToken, disconnect,
} = useStravaAuth()

// ── Activities ────────────────────────────────────────────────────────────────
const {
  activities, loading, importing, error: actError,
  fetchActivities, importActivity,
} = useStravaActivities(getAccessToken)

// ── Import handler ────────────────────────────────────────────────────────────
async function onImport(activity) {
  const gpx = await importActivity(activity)
  if (gpx) emit('gpx', gpx, activity.name)
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Load activities once connected ────────────────────────────────────────────
onMounted(() => {
  if (isConnected.value) fetchActivities()
})

watch(isConnected, (val) => {
  if (val) fetchActivities()
})
</script>

<!-- Strava logo S-shape inline component -->
<script>
const StravaIcon = {
  template: `<svg class="strava-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z"/>
    <path d="M11.321 13.828H8.332L15.387 0l3.441 6.814h-3.046l-4.461-8.814v.001z" opacity=".6"/>
  </svg>`,
}
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.strava-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strava-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text3, rgba(255,255,255,0.3));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.strava-divider::before,
.strava-divider::after {
  content: '';
  flex: 1;
  height: 0.5px;
  background: var(--border, rgba(255,255,255,0.1));
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.strava-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg2, #161616);
  border: 0.5px solid var(--border, rgba(255,255,255,0.1));
  border-radius: var(--radius-lg, 10px);
}
.strava-card--center { align-items: center; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.strava-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: .55rem 1.1rem;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  border: none;
  transition: filter 0.15s, opacity 0.15s;
  white-space: nowrap;
}
.strava-btn--primary {
  background: #FC4C02;
  color: #fff;
}
.strava-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.strava-btn--primary:disabled { opacity: .45; cursor: not-allowed; }

.strava-link-btn {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--text3, rgba(255,255,255,0.35));
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.strava-link-btn:hover { color: var(--text2, rgba(255,255,255,0.6)); }

/* ── Strava icon ──────────────────────────────────────────────────────────── */
:deep(.strava-icon) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* ── Connected header ─────────────────────────────────────────────────────── */
.strava-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.strava-athlete {
  display: flex;
  align-items: center;
  gap: 8px;
}
.strava-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border, rgba(255,255,255,0.12));
}
.strava-athlete-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #fff);
}

/* ── Activity list ────────────────────────────────────────────────────────── */
.strava-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 256px;
  overflow-y: auto;
  overflow-x: hidden;
  /* Subtle scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--border, rgba(255,255,255,0.12)) transparent;
}
.strava-list::-webkit-scrollbar       { width: 4px; }
.strava-list::-webkit-scrollbar-track { background: transparent; }
.strava-list::-webkit-scrollbar-thumb { background: var(--border, rgba(255,255,255,0.12)); border-radius: 2px; }

.strava-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 6px;
  border-radius: 6px;
  transition: background 0.1s;
}
.strava-row:hover          { background: var(--bg3, rgba(255,255,255,0.04)); }
.strava-row--busy          { opacity: .65; }

.strava-sport {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  width: 22px;
  text-align: center;
}
.strava-info   { flex: 1; min-width: 0; }
.strava-name   { font-size: 12px; font-weight: 600; color: var(--text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.strava-meta   { font-size: 11px; color: var(--text3, rgba(255,255,255,0.4)); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.strava-import-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  padding: .3rem .65rem;
  font-size: 11px;
  font-weight: 600;
  border-radius: 5px;
  border: 0.5px solid var(--border2, rgba(255,255,255,0.1));
  background: var(--bg3, rgba(255,255,255,0.05));
  color: var(--text, #fff);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.strava-import-btn:hover:not(:disabled) {
  background: var(--bg4, rgba(255,255,255,0.1));
  border-color: var(--border, rgba(255,255,255,0.2));
}
.strava-import-btn:disabled { opacity: .45; cursor: not-allowed; }

/* ── Loading / empty ──────────────────────────────────────────────────────── */
.strava-loading,
.strava-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text3, rgba(255,255,255,0.4));
  padding: 8px 2px;
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
.strava-spinner {
  display: inline-block;
  width: 13px; height: 13px;
  border: 1.5px solid rgba(255,255,255,0.15);
  border-top-color: #FC4C02;
  border-radius: 50%;
  animation: strava-spin .7s linear infinite;
  flex-shrink: 0;
}
.strava-spinner--sm { width: 10px; height: 10px; }

@keyframes strava-spin { to { transform: rotate(360deg); } }

/* ── Error ────────────────────────────────────────────────────────────────── */
.strava-error {
  font-size: 12px;
  color: #ff6b6b;
  background: rgba(255, 107, 107, .08);
  border: 0.5px solid rgba(255, 107, 107, .2);
  border-radius: var(--radius-md, 6px);
  padding: .6rem .8rem;
  margin: 0;
}
</style>
