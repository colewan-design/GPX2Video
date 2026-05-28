import { ref } from 'vue'

const API = 'https://www.strava.com/api/v3'

export const SPORT_ICONS = {
  Run: '🏃', TrailRun: '🏃', VirtualRun: '🏃',
  Ride: '🚴', VirtualRide: '🚴', GravelRide: '🚴', MountainBikeRide: '🚵', EBikeRide: '🚴',
  Swim: '🏊',
  Walk: '🚶', Hike: '🥾',
  Rowing: '🚣', Kayaking: '🛶', Canoeing: '🛶', Surfing: '🏄', Windsurf: '🏄',
  AlpineSki: '⛷️', NordicSki: '⛷️', BackcountrySki: '⛷️', Snowboard: '🏂',
  IceSkate: '⛸️', InlineSkate: '🛼',
  Workout: '💪', WeightTraining: '🏋️', Yoga: '🧘', Crossfit: '💪',
  Soccer: '⚽', Tennis: '🎾', Golf: '⛳',
  RockClimbing: '🧗',
}

export function useStravaActivities(getAccessToken) {
  const activities = ref([])
  const loading    = ref(false)
  const importing  = ref(null)   // activity id currently being imported
  const error      = ref(null)

  // ── Fetch recent activities list ────────────────────────────────────────────

  async function fetchActivities(page = 1) {
    loading.value = true
    error.value   = null
    try {
      const token = await getAccessToken()
      const res   = await fetch(`${API}/athlete/activities?per_page=20&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Strava API error (${res.status})`)
      activities.value = await res.json()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ── Import a single activity as GPX string ──────────────────────────────────

  async function importActivity(activity) {
    importing.value = activity.id
    error.value     = null
    try {
      const token = await getAccessToken()
      const keys  = 'latlng,altitude,time,heartrate,cadence,watts,temp'
      const res   = await fetch(
        `${API}/activities/${activity.id}/streams?keys=${keys}&key_by_type=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Failed to fetch activity streams (${res.status})`)
      const streams = await res.json()
      return streamsToGpx(streams, activity.name, new Date(activity.start_date))
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      importing.value = null
    }
  }

  return { activities, loading, importing, error, fetchActivities, importActivity }
}

// ── GPX builder ───────────────────────────────────────────────────────────────

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function streamsToGpx(streams, name, startTime) {
  const latlng   = streams.latlng?.data    ?? []
  const altitude = streams.altitude?.data  ?? []
  const time     = streams.time?.data      ?? []  // elapsed seconds from activity start
  const hr       = streams.heartrate?.data ?? []
  const cad      = streams.cadence?.data   ?? []
  const power    = streams.watts?.data     ?? []
  const temp     = streams.temp?.data      ?? []

  const baseMs = startTime instanceof Date ? startTime.getTime() : Date.now()

  const trkpts = latlng.map((ll, i) => {
    const lat = ll[0].toFixed(7)
    const lon = ll[1].toFixed(7)
    const ele = (altitude[i] ?? 0).toFixed(1)
    const iso = new Date(baseMs + (time[i] ?? 0) * 1000).toISOString()

    // Extensions: hr/cad/temp inside gpxtpx:TrackPointExtension, power as sibling
    const hrTag    = hr[i]    != null ? `<gpxtpx:hr>${Math.round(hr[i])}</gpxtpx:hr>` : ''
    const cadTag   = cad[i]   != null ? `<gpxtpx:cad>${Math.round(cad[i])}</gpxtpx:cad>` : ''
    const atempTag = temp[i]  != null ? `<gpxtpx:atemp>${Number(temp[i]).toFixed(1)}</gpxtpx:atemp>` : ''
    const pwrTag   = power[i] != null ? `<power>${Math.round(power[i])}</power>` : ''

    const tpxInner = hrTag + cadTag + atempTag
    const ext = (tpxInner || pwrTag)
      ? `\n        <extensions>${tpxInner ? `<gpxtpx:TrackPointExtension>${tpxInner}</gpxtpx:TrackPointExtension>` : ''}${pwrTag}</extensions>`
      : ''

    return `      <trkpt lat="${lat}" lon="${lon}">
        <ele>${ele}</ele>
        <time>${iso}</time>${ext}
      </trkpt>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="gpx2video"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>${escXml(name)}</name>
    <trkseg>
${trkpts.join('\n')}
    </trkseg>
  </trk>
</gpx>`
}
