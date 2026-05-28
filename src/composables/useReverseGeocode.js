import { ref } from 'vue'

const DB_NAME    = 'gpx2video'
const STORE_NAME = 'geocache'
const DB_VERSION = 1

// Round to 2 decimal places (~1.1 km grid) to maximise cache hits
function cacheKey(lat, lon) {
  return `${(+lat).toFixed(2)},${(+lon).toFixed(2)}`
}

let _db = null

function openDb() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror   = e => reject(e.target.error)
  })
}

function dbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = e => reject(e.target.error)
  }))
}

function dbPut(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  }))
}

function buildName(data) {
  const a = data.address || {}

  // Most specific place name: barangay → neighbourhood → hamlet → village → suburb → city_district
  const place = a.barangay || a.neighbourhood || a.hamlet || a.isolated_dwelling || ''

  // Settlement: city → town → municipality → village → suburb → county
  const city = a.city || a.town || a.municipality || a.village || a.suburb || a.city_district || a.county || a.state_district || ''

  // Administrative region: PH uses province + region; others use state
  const region = a.state || a.province || a.region || ''

  // Build from most → least specific, skip duplicates
  const parts = [place, city, region].filter((v, i, arr) => v && arr.indexOf(v) === i)

  return parts.length
    ? parts.join(', ')
    : data.display_name?.split(',').slice(0, 3).join(',').trim() || ''
}

export function useReverseGeocode() {
  const locationName = ref('')
  const loading      = ref(false)

  let debounceTimer = null
  let lastKey       = null

  async function _resolve(lat, lon) {
    const key = cacheKey(lat, lon)

    // 1. Check IndexedDB cache first
    try {
      const cached = await dbGet(key)
      if (cached) {
        locationName.value = cached
        loading.value = false
        return
      }
    } catch (_) { /* fall through to network */ }

    // 2. Fetch from Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14`
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'gpx2video/1.0' }
      })
      if (!res.ok) return
      const data = await res.json()
      const name = buildName(data)
      if (name) locationName.value = name

      // 3. Persist to cache only when we have a real name (never cache empty strings)
      if (name) dbPut(key, name).catch(() => {})
    } catch (_) {
      // Network failure — keep last known name
    } finally {
      loading.value = false
    }
  }

  function lookup(lat, lon) {
    const key = cacheKey(lat, lon)
    if (key === lastKey) return
    lastKey = key
    clearTimeout(debounceTimer)
    loading.value = true
    debounceTimer = setTimeout(() => _resolve(lat, lon), 2000)
  }

  function lookupNow(lat, lon) {
    clearTimeout(debounceTimer)
    const key = cacheKey(lat, lon)
    lastKey = key
    loading.value = true
    _resolve(lat, lon)
  }

  function clear() {
    clearTimeout(debounceTimer)
    locationName.value = ''
    lastKey = null
    loading.value = false
  }

  return { locationName, loading, lookup, lookupNow, clear }
}
