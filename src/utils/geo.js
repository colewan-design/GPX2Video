export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

// Bug fix: avoid Math.max(...largeArray) spread which overflows stack on 10k+ points
export function arrayMax(arr) {
  return arr.reduce((a, b) => (b > a ? b : a), -Infinity)
}

export function arrayMin(arr) {
  return arr.reduce((a, b) => (b < a ? b : a), Infinity)
}

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    : `${m}:${String(s % 60).padStart(2, '0')}`
}
