# GPX2Video — Feature Documentation

## Overview
Browser-based tool that overlays GPS data (speed, elevation, distance) onto a video file and exports it as an MP4. No server required — everything runs in the browser.

---

## 1. GPX File Loading

**Component:** `DropZone.vue` · **Composable:** `useGpxParser.js`

- Drag-and-drop or click-to-browse for `.gpx` files
- Parses all `<trkpt>` elements: latitude, longitude, elevation, timestamp
- Computes per-point values:
  - **Cumulative distance** (metres) via Haversine formula
  - **Instantaneous speed** (km/h) from consecutive timestamps
  - **Smoothed speed** — 5-point sliding-window average to reduce GPS noise
- Caps raw speed at 80 km/h before smoothing to remove GPS spike artefacts
- Warns when GPX has no timestamps (speed will read 0; Strava/Garmin exports required for speed data)
- Supports any standard `.gpx` file: Strava, Garmin Connect, Komoot, etc.

**Session stats computed on load:**

| Stat | Detail |
|------|--------|
| Total distance | km, from cumulative Haversine |
| Elevation gain | metres, summed positive deltas |
| Average speed | km/h, mean of non-zero smoothed values |
| Max speed | km/h, array-reduce (avoids stack overflow on large tracks) |
| Total time | ms, last timestamp − first timestamp |

---

## 2. GPX Map Visualization

**Component:** `VideoStage.vue` (canvas layer)

- Canvas renders the full route as a faint trail
- Traveled portion is **speed-colored**: blue (slow) → orange (fast), interpolated per segment
- Current position shown as a white dot with a soft halo ring
- Canvas projection: lat/lon → pixel using min/max bounding box with 40 px padding
- `ResizeObserver` keeps canvas pixel dimensions in sync with CSS layout at all times
- `arrayMax` uses `reduce` instead of spread to avoid stack overflow on 10 000+ point tracks

---

## 3. GPX-Only Animation Playback

**Composable:** `useAnimation.js` · **Component:** `PlaybackControls.vue`

- `requestAnimationFrame` loop advances the track point index over time
- Playback speeds: **1×, 2×, 5×, 10×, 20×**
- Play / Pause / Reset controls
- `lastTime` is nulled on pause so resume does not compute a huge elapsed gap
- Animation always entered via `requestAnimationFrame` — never called directly (prevents NaN cascade from undefined timestamp)
- Speed selector hidden automatically when a video is loaded

---

## 4. HUD Overlay

**Component:** `VideoStage.vue` (HTML overlay)

Rendered as a dark-gradient bar at the bottom of the stage:

| Field | Source |
|-------|--------|
| Speed | `point.speedSmooth` (km/h) |
| Elevation | `point.ele` rounded to integer (m) |
| Distance | `point.cumDist / 1000` (km) |
| Progress bar | `progress` prop (0–1) |
| Elapsed time | `point.time − points[0].time`, formatted `h:mm:ss` |
| Total time | GPX duration or point count fallback |

---

## 5. Elevation & Speed Charts

**Component:** `ChartRow.vue` · **Library:** Chart.js

- Two side-by-side area charts rendered below the main stage
- **Elevation profile** — blue fill, X axis = distance (km)
- **Speed over distance** — orange fill, X axis = distance (km)
- Sampled to max ~200 points for rendering performance
- Charts are destroyed and rebuilt when a new GPX file is loaded

---

## 6. Video File Loading

**Component:** `VideoLoader.vue` · **Composable:** `useVideoSync.js`

- Compact drag-and-drop strip accepts any browser-playable video (`video/*`)
- Creates an `ObjectURL` for the file; previous URL is revoked on replacement
- Once loaded, `VideoStage` switches to **video mode**:
  - `<video>` element fills the stage (`object-fit: contain`, black bars preserved)
  - GPX map canvas becomes a **168 × 112 px inset** in the bottom-right corner
  - Stage switches to `aspect-ratio: 16 / 9`

---

## 7. MP4 Creation Time Parser

**Utility:** `src/utils/mp4.js`

Reads the first 8 MB of the file to locate the MP4 `moov → mvhd` box:

- Supports both **version 0** (32-bit creation time) and **version 1** (64-bit)
- Converts from MP4 epoch (1904-01-01) to Unix epoch
- Sanity-checks the result: must be between 2000-01-01 and 2100-01-01
- Returns `null` if the box is not found or the timestamp is invalid
- Used to auto-compute the sync offset without any user input

---

## 8. GPX ↔ Video Sync

**Composable:** `useVideoSync.js`

### Auto-detection
When a video is loaded alongside a timestamped GPX:
```
autoOffsetSec = (mp4CreationTime − gpxPoints[0].time) / 1000
```
Positive value = GPS recording started before the video. Displayed with an **Auto-detected** badge.

### Manual offset slider
- Range: **−300 s to +300 s** in 0.5 s steps
- `totalOffsetSec = autoOffsetSec + manualOffsetSec`
- Reset button (↺) zeroes `manualOffsetSec` back to the auto value
- Displayed with a **Manual** badge when `autoDetected` is false

### Frame → GPX point lookup
For each `timeupdate` event:
```
targetMs = gpxPoints[0].time + (totalOffsetSec + video.currentTime) × 1000
```
Binary search over `gpxPoints` timestamps finds the nearest point. Result is clamped to `[trimStart, trimEnd]`.

### No-timestamp fallback
If the GPX has no timestamps, point index is computed as:
```
idx = round((currentTime / duration) × (points.length − 1))
```

---

## 9. GPX Timeline & Trim

**Component:** `SyncPanel.vue` · **Composable:** `useVideoSync.js`

### Elevation timeline
- Canvas draws a sampled elevation profile (up to 400 samples) as a filled area chart
- Always visible once a GPX file is loaded
- Header shows trimmed distance range and duration: e.g., `2.3 km → 18.5 km  ·  32:10`

### Trim handles
- **Left handle** = `trimStart` index — sets where in the GPX the video begins
- **Right handle** = `trimEnd` index — sets where in the GPX the video ends
- Dimmed CSS overlays shade the excluded portions of the elevation chart
- Minimum gap enforced: 2% of total points (prevents handles from stacking)
- Touch-friendly: 20 px wide hit area, `ew-resize` cursor

### Live stats on drag
`useVideoSync` stores `lastCurrentTime` and `lastDuration` from the most recent `timeupdate`. A watcher on `[trimStart, trimEnd]` immediately re-runs `_applyTime` so the HUD stats and map dot update in real time as you drag, even while the video is paused.

### Video preview on drag
`onTrimStart` / `onTrimEnd` in `App.vue` call `gpxIdxToVideoTime(idx)` to convert the GPX index back to a video timestamp and call `videoStageRef.seekTo(t)`. The subsequent `seeked → timeupdate` cycle confirms the stats.

```
gpxIdxToVideoTime(idx):
  if timestamps → (gpxPoints[idx].time − gpxPoints[0].time) / 1000 − totalOffsetSec
  else          → (idx / N) × lastDuration
```

### Playhead
White vertical line tracks `animIdx / (points.length − 1)` across the elevation chart. A small circle at the bottom makes it easier to read at a glance.

---

## 10. MP4 Export with Overlay

**Composable:** `useVideoExport.js` · **Library:** `mp4-muxer`

### Requirements
- Chrome or Edge 94+ (WebCodecs API — `VideoEncoder`, `VideoFrame`)
- No server, no file upload — fully client-side

### Pipeline
```
video element
  └─ requestVideoFrameCallback (real-time, frame-accurate)
       └─ OffscreenCanvas composite
            ├─ drawImage(videoEl)          — video frame
            ├─ drawMapInset()              — GPX map inset (bottom-right)
            └─ drawHud()                   — speed / elevation / distance / bar
                 └─ VideoEncoder (H.264)
                      └─ mp4-muxer (ArrayBufferTarget)
                           └─ Blob download
```

### Video trim
Before encoding, GPX trim indices are converted to video timestamps:

```
vTrimStart = (gpxPoints[trimStart].time − gpxPoints[0].time) / 1000 − totalOffsetSec
vTrimEnd   = (gpxPoints[trimEnd].time   − gpxPoints[0].time) / 1000 − totalOffsetSec
```

- Capture starts at `vTrimStart`; stops at `vTrimEnd`
- Frame timestamps written as `(vt − vTrimStart) × 1 000 000` µs → exported MP4 starts at `0:00`
- No-timestamp fallback: linear proportion of video duration

### Encoding parameters
- Codec: H.264, profile and level auto-selected by resolution:

  | Output width | AVC level | Max area |
  |---|---|---|
  | ≤ 1280 px | 3.1 (`avc1.4d001f`) | 921 600 px |
  | ≤ 1920 px | 4.0 (`avc1.4d0028`) | 2 097 152 px |
  | > 1920 px | 5.1 (`avc1.4d0033`) | 8 912 896 px |

- Bitrate: 8 Mbps
- Framerate: 30 fps
- Source capped at 1920 px wide; dimensions rounded to nearest even number (H.264 requirement)
- Keyframe every 2 seconds

### Overlay drawing (canvas)
Dimensions scale relative to video height (`s = H / 320`):

**Map inset** — `168 s × 112 s` px, bottom-right corner, 12 s px from edge, 64 s px above HUD:
- Rounded-rect clip mask
- Faint full trail + speed-colored traveled segment + position dot
- All line widths, dot radius, padding scaled by `s`

**HUD** — bottom gradient, same layout as the live HTML overlay:
- Stats text, unit, label — all sized by `s`
- Progress bar drawn with a manual `arcTo` rounded-rect (avoids OffscreenCanvas `roundRect` compatibility issues)
- Time labels left/right-aligned at bar edges

### Audio
Not included in the exported file. Re-combine with the original using DaVinci Resolve, CapCut, or `ffmpeg -i export.mp4 -i original.mp4 -c copy -map 0:v -map 1:a output.mp4`.

---

## File Structure

```
src/
├── utils/
│   ├── geo.js            haversine, lerp, arrayMax, arrayMin, fmtTime
│   └── mp4.js            MP4 mvhd creation-time parser
├── composables/
│   ├── useGpxParser.js   GPX XML → point array + session stats
│   ├── useAnimation.js   rAF-based GPX-only playback loop
│   ├── useVideoSync.js   video ↔ GPX sync, trim, offset, auto-detect
│   └── useVideoExport.js WebCodecs H.264 export with overlay + trim
└── components/
    ├── DropZone.vue       GPX drag-and-drop input
    ├── VideoLoader.vue    Video file drag-and-drop strip
    ├── VideoStage.vue     Canvas map + video element + HUD overlay
    ├── MetricsRow.vue     Session stats bar (distance, elevation, speed, time)
    ├── PlaybackControls.vue  Play/Pause/Reset/Speed + Export button
    ├── ExportButton.vue   Export button with spinner + progress %
    ├── SyncPanel.vue      Elevation timeline, trim handles, offset slider
    └── ChartRow.vue       Chart.js elevation profile + speed chart
```
