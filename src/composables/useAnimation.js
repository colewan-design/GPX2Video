import { ref, computed } from 'vue'

export function useAnimation(gpxPoints) {
  const animIdx = ref(0)
  const playing = ref(false)
  const playbackSpeed = ref(5)

  let rafId = null
  let lastTime = null  // reset to null on pause — prevents elapsed-time jump on resume (bug fix)

  const currentPoint = computed(() => gpxPoints.value[animIdx.value] ?? null)

  const progress = computed(() => {
    const len = gpxPoints.value.length
    return len > 1 ? animIdx.value / (len - 1) : 0
  })

  function play() {
    if (playing.value) return
    if (animIdx.value >= gpxPoints.value.length - 1) animIdx.value = 0
    playing.value = true
    lastTime = null
    rafId = requestAnimationFrame(tick)
  }

  function pause() {
    playing.value = false
    lastTime = null  // reset so resume doesn't compute a huge elapsed gap
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  }

  function toggle() {
    playing.value ? pause() : play()
  }

  function reset() {
    pause()
    animIdx.value = 0
  }

  function tick(ts) {
    if (!playing.value) return
    if (lastTime === null) lastTime = ts
    const elapsed = ts - lastTime
    lastTime = ts

    const pts = gpxPoints.value
    const steps = Math.max(1, Math.round(playbackSpeed.value * elapsed / 16))
    animIdx.value = Math.min(animIdx.value + steps, pts.length - 1)

    if (animIdx.value >= pts.length - 1) {
      playing.value = false
      lastTime = null
      rafId = null
      return
    }

    rafId = requestAnimationFrame(tick)
  }

  return { animIdx, playing, playbackSpeed, currentPoint, progress, toggle, reset }
}
