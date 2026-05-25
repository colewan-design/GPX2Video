import { ref } from 'vue'
import { haversine, arrayMax } from '../utils/geo.js'

export function useGpxParser() {
  const gpxPoints   = ref([])
  const trackName   = ref('')
  const hasTimestamps = ref(true)
  const stats       = ref(null)
  const parseError  = ref('')

  function getExtVal(pt, ...selectors) {
    for (const sel of selectors) {
      try {
        const el = pt.querySelector(sel)
        if (el) { const v = parseFloat(el.textContent); if (!isNaN(v)) return v }
      } catch (_) { /* invalid selector */ }
    }
    return null
  }

  function parseGPX(xml) {
    parseError.value = ''
    const parser = new DOMParser()
    const doc    = parser.parseFromString(xml, 'text/xml')
    const trkpts = doc.querySelectorAll('trkpt')

    if (!trkpts.length) {
      parseError.value = 'No track points found in this GPX file.'
      return
    }

    const raw = []
    trkpts.forEach(pt => {
      const lat  = parseFloat(pt.getAttribute('lat'))
      const lon  = parseFloat(pt.getAttribute('lon'))
      const ele  = parseFloat(pt.querySelector('ele')?.textContent ?? 0)
      const timeEl = pt.querySelector('time')
      const time = timeEl ? new Date(timeEl.textContent) : null

      // Garmin / Wahoo extensions
      const hr    = getExtVal(pt, 'hr', 'gpxtpx\\:hr',   'ns3\\:hr')
      const cad   = getExtVal(pt, 'cad','gpxtpx\\:cad',  'ns3\\:cad')
      const power = getExtVal(pt, 'power', 'Power')
      const atemp = getExtVal(pt, 'atemp','gpxtpx\\:atemp','ns3\\:atemp')

      if (!isNaN(lat) && !isNaN(lon)) raw.push({ lat, lon, ele, time, hr, cad, power, atemp })
    })

    trackName.value     = doc.querySelector('name')?.textContent?.trim() || 'Activity'
    hasTimestamps.value = raw.some(p => p.time !== null)

    let totalDist = 0, cumGain = 0, cumLoss = 0

    const pts = raw.map((p, i) => {
      let dist = 0, speed = 0
      if (i > 0) {
        dist = haversine(raw[i-1].lat, raw[i-1].lon, p.lat, p.lon)
        totalDist += dist
        const dEle = p.ele - raw[i-1].ele
        if (dEle > 0) cumGain += dEle; else cumLoss += -dEle
        if (p.time && raw[i-1].time) {
          const dt = (p.time - raw[i-1].time) / 1000
          speed = dt > 0 ? (dist / dt) * 3.6 : 0
        }
      }
      return {
        ...p,
        cumDist:    totalDist,
        cumDistMi:  totalDist / 1609.344,
        speed:      Math.min(speed, 80),
        cumElevGain: cumGain,
        cumElevLoss: cumLoss,
      }
    })

    // Sliding-window smoothing
    const W = 5
    pts.forEach((p, i) => {
      const sl = pts.slice(Math.max(0, i - W), Math.min(pts.length, i + W + 1))
      p.speedSmooth = sl.reduce((s, x) => s + x.speed, 0) / sl.length

      const hrS  = sl.map(x => x.hr).filter(v => v !== null)
      p.hrSmooth = hrS.length ? hrS.reduce((a,b) => a+b,0)/hrS.length : null

      const cadS  = sl.map(x => x.cad).filter(v => v !== null)
      p.cadSmooth = cadS.length ? cadS.reduce((a,b) => a+b,0)/cadS.length : null

      const pwS    = sl.map(x => x.power).filter(v => v !== null)
      p.powerSmooth = pwS.length ? pwS.reduce((a,b) => a+b,0)/pwS.length : null
    })

    // Grade (wider window for stability)
    const GW = 15
    pts.forEach((p, i) => {
      const i0 = Math.max(0, i - GW)
      const di = pts[i].cumDist - pts[i0].cumDist
      const de = pts[i].ele     - pts[i0].ele
      p.grade = di > 5 ? (de / di) * 100 : 0
    })

    const speeds = pts.map(p => p.speedSmooth).filter(s => s > 0)
    const t0 = pts[0].time, tN = pts[pts.length-1].time
    const totalTime = t0 && tN ? tN - t0 : 0

    stats.value = {
      totalDist:   pts[pts.length-1].cumDist / 1000,
      totalDistMi: pts[pts.length-1].cumDistMi,
      elevGain:    Math.round(cumGain),
      elevGainFt:  Math.round(cumGain * 3.28084),
      elevLoss:    Math.round(cumLoss),
      elevLossFt:  Math.round(cumLoss * 3.28084),
      avgSpeed:    speeds.length ? speeds.reduce((a,b) => a+b,0)/speeds.length : 0,
      maxSpeed:    speeds.length ? arrayMax(speeds) : 0,
      totalTime,
      hasHr:    pts.some(p => p.hr    !== null),
      hasCad:   pts.some(p => p.cad   !== null),
      hasPower: pts.some(p => p.power !== null),
      hasTemp:  pts.some(p => p.atemp !== null),
    }

    gpxPoints.value = pts
  }

  function loadFile(file) {
    if (!file) return
    gpxPoints.value = []
    stats.value     = null
    const reader    = new FileReader()
    reader.onload   = e => parseGPX(e.target.result)
    reader.readAsText(file)
  }

  return { gpxPoints, trackName, hasTimestamps, stats, parseError, loadFile }
}
