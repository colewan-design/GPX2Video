export const VIDEO_FILTERS = [
  { id: 'none',      label: 'None',      css: 'none' },
  { id: 'vivid',     label: 'Vivid',     css: 'saturate(1.6) contrast(1.1) brightness(1.05)' },
  { id: 'cinematic', label: 'Cinematic', css: 'contrast(1.2) saturate(0.82) brightness(0.92)' },
  { id: 'warm',      label: 'Warm',      css: 'sepia(0.3) saturate(1.35) brightness(1.05)' },
  { id: 'cool',      label: 'Cool',      css: 'hue-rotate(18deg) saturate(1.15) brightness(1.02)' },
  { id: 'bw',        label: 'B&W',       css: 'grayscale(1) contrast(1.15)' },
  { id: 'vintage',   label: 'Vintage',   css: 'sepia(0.55) contrast(0.88) brightness(1.12) saturate(0.75)' },
  { id: 'fade',      label: 'Fade',      css: 'contrast(0.82) saturate(0.72) brightness(1.18)' },
]

export function filterCss(id) {
  return VIDEO_FILTERS.find(f => f.id === id)?.css ?? 'none'
}
