import { ref } from 'vue'
import { haversine, arrayMax } from '../utils/geo.js'

export function useGpxParser() {
  const gpxPoints = ref([])
  const trackName = ref('')
  const hasTimestamps = ref(true)
  const stats = ref(null)
  const parseError = ref('')

  function parseGPX(xml) {
    parseError.value = ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const trkpts = doc.querySelectorAll('trkpt')

    if (!trkpts.length) {
      parseError.value = 'No track points found in this GPX file.'
      return
    }

    const raw = []
    trkpts.forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat'))
      const lon = parseFloat(pt.getAttribute('lon'))
      const ele = parseFloat(pt.querySelector('ele')?.textContent ?? 0)
      const timeEl = pt.querySelector('time')
      const time = timeEl ? new Date(timeEl.textContent) : null
      if (!isNaN(lat) && !isNaN(lon)) raw.push({ lat, lon, ele, time })
    })

    trackName.value = doc.querySelector('name')?.textContent?.trim() || 'Activity'
    hasTimestamps.value = raw.some(p => p.time !== null)

    let totalDist = 0
    const pts = raw.map((p, i) => {
      let dist = 0, speed = 0
      if (i > 0) {
        dist = haversine(raw[i - 1].lat, raw[i - 1].lon, p.lat, p.lon)
        totalDist += dist
        if (p.time && raw[i - 1].time) {
          const dt = (p.time - raw[i - 1].time) / 1000
          speed = dt > 0 ? (dist / dt) * 3.6 : 0
        }
      }
      return { ...p, cumDist: totalDist, speed: Math.min(speed, 80) }
    })

    // Smooth speed with a sliding window
    const W = 5
    pts.forEach((p, i) => {
      const slice = pts.slice(Math.max(0, i - W), Math.min(pts.length, i + W + 1))
      p.speedSmooth = slice.reduce((s, x) => s + x.speed, 0) / slice.length
    })

    const speeds = pts.map(p => p.speedSmooth).filter(s => s > 0)
    const elevGain = pts.reduce(
      (g, p, i) => (i > 0 && p.ele > pts[i - 1].ele ? g + (p.ele - pts[i - 1].ele) : g),
      0
    )
    const t0 = pts[0].time
    const tN = pts[pts.length - 1].time
    const totalTime = t0 && tN ? tN - t0 : 0

    stats.value = {
      totalDist: pts[pts.length - 1].cumDist / 1000,
      elevGain: Math.round(elevGain),
      avgSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      maxSpeed: speeds.length ? arrayMax(speeds) : 0,
      totalTime,
    }

    gpxPoints.value = pts
  }

  function loadFile(file) {
    if (!file) return
    gpxPoints.value = []
    stats.value = null
    const reader = new FileReader()
    reader.onload = e => parseGPX(e.target.result)
    reader.readAsText(file)
  }

  return { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile }
}
