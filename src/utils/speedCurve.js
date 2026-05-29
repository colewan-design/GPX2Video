// Curved speed presets — each is a list of [normalised-source-t, speed] keyframes.
// t=0 is the start of the trimmed clip, t=1 is the end.
// speed=1 is real-time; <1 = slow-mo; >1 = fast-forward.

export const SPEED_PRESETS = {
  normal: {
    label: 'Normal',
    keyframes: [[0, 1], [1, 1]],
  },
  hero: {
    label: 'Hero',
    // slow at start/end, normal in the middle — cinematic intro/outro
    keyframes: [[0, 0.25], [0.15, 0.25], [0.35, 1], [0.65, 1], [0.85, 0.25], [1, 0.25]],
  },
  bullet: {
    label: 'Bullet',
    // normal → extreme slow-mo in the middle → normal
    keyframes: [[0, 1], [0.25, 1], [0.4, 0.08], [0.6, 0.08], [0.75, 1], [1, 1]],
  },
  montage: {
    label: 'Montage',
    // alternating fast and slow — dynamic highlight reel feel
    keyframes: [[0, 2], [0.2, 0.5], [0.4, 2], [0.6, 0.5], [0.8, 2], [1, 2]],
  },
  rush: {
    label: 'Rush',
    // uniformly 2× faster — shorten a long clip quickly
    keyframes: [[0, 2], [1, 2]],
  },
}

// Evaluate speed at normalised source position t (0–1) using smooth cubic interpolation.
export function evalSpeed(keyframes, t) {
  const n = keyframes.length
  if (t <= keyframes[0][0]) return keyframes[0][1]
  if (t >= keyframes[n - 1][0]) return keyframes[n - 1][1]
  for (let i = 0; i < n - 1; i++) {
    const [t0, s0] = keyframes[i]
    const [t1, s1] = keyframes[i + 1]
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0)
      const smooth = u * u * (3 - 2 * u)  // smoothstep — no abrupt speed jumps
      return s0 + (s1 - s0) * smooth
    }
  }
  return keyframes[n - 1][1]
}

// Build the list of source-video positions (in seconds) for each output frame.
// Returns an array where index = output frame number, value = source seek time.
// Stops when the source clip is exhausted (handles both speedup and slowdown).
export function buildFrameSourceTimes(keyframes, trimDuration, fps) {
  const dt = 1 / fps
  const MIN_SPEED = 0.02  // floor to prevent infinite loops at near-zero speed
  const sourceTimes = []
  let sourceT = 0
  while (sourceT < trimDuration) {
    sourceTimes.push(sourceT)
    const speed = Math.max(MIN_SPEED, evalSpeed(keyframes, sourceT / trimDuration))
    sourceT += speed * dt
  }
  return sourceTimes
}

// Returns true when the curve is effectively flat at 1× (use the fast play-based loop).
export function isFlatNormal(keyframes) {
  return keyframes.every(([, s]) => Math.abs(s - 1) < 0.01)
}
