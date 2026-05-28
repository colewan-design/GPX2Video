export const VIDEO_FILTERS = [
  { id: 'none',      label: 'None'      },
  { id: 'clarity',   label: 'Clarity'   },
  { id: 'vivid',     label: 'Vivid'     },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'warm',      label: 'Warm'      },
  { id: 'cool',      label: 'Cool'      },
  { id: 'bw',        label: 'B&W'       },
  { id: 'vintage',   label: 'Vintage'   },
  { id: 'fade',      label: 'Fade'      },
]

// WebGL shader parameters — single source of truth for all filters.
// sharp: unsharp-mask strength | radius: kernel pixel radius
// bright/contrast/sat/sepia/hue: colour corrections
export const SHADER_PARAMS = {
  none:      { sharp: 0.0, radius: 1.0, bright: 1.00, contrast: 1.00, sat: 1.00, sepia: 0.00, hue: 0.000 },
  // Large-radius unsharp mask for that "clarity" look only possible in GPU shaders
  clarity:   { sharp: 2.5, radius: 2.0, bright: 0.97, contrast: 1.25, sat: 1.45, sepia: 0.00, hue: 0.000 },
  vivid:     { sharp: 0.8, radius: 1.0, bright: 1.05, contrast: 1.12, sat: 1.65, sepia: 0.00, hue: 0.000 },
  cinematic: { sharp: 0.4, radius: 1.2, bright: 0.90, contrast: 1.28, sat: 0.78, sepia: 0.00, hue: 0.000 },
  warm:      { sharp: 0.0, radius: 1.0, bright: 1.08, contrast: 1.02, sat: 1.40, sepia: 0.32, hue: 0.000 },
  cool:      { sharp: 0.2, radius: 1.0, bright: 1.03, contrast: 1.05, sat: 1.20, sepia: 0.00, hue: 0.055 },
  bw:        { sharp: 0.8, radius: 1.0, bright: 1.00, contrast: 1.22, sat: 0.00, sepia: 0.00, hue: 0.000 },
  vintage:   { sharp: 0.0, radius: 1.0, bright: 1.10, contrast: 0.85, sat: 0.70, sepia: 0.60, hue: 0.000 },
  fade:      { sharp: 0.0, radius: 1.0, bright: 1.20, contrast: 0.80, sat: 0.68, sepia: 0.00, hue: 0.000 },
}
