# GPX2VIDEO — Features & Libraries

## Libraries

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vue` | ^3.4.0 | UI framework (Composition API) |
| `@xenova/transformers` | ^2.17.2 | In-browser Whisper AI transcription via WASM |
| `chart.js` | ^4.4.1 | Activity charts (speed, elevation, HR, cadence, power) |
| `mp4-muxer` | ^5.2.2 | MP4 container muxing for video export |
| `mp4box` | ^2.3.0 | MP4 demuxing — extracts encoded audio/video samples and rotation metadata |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.0 | Build tool and dev server |
| `@vitejs/plugin-vue` | ^5.0.0 | Vue SFC support for Vite |
| `sharp` | ^0.34.5 | Image processing (sticker export) |
| `playwright` | ^1.60.0 | End-to-end testing |

### Browser APIs Used

| API | Usage |
|---|---|
| **WebCodecs** (`VideoEncoder`, `VideoDecoder`, `AudioEncoder`) | GPU-accelerated MP4 export |
| **OffscreenCanvas** | Off-main-thread frame rendering during export |
| **WebGL** | Shader-based real-time and export video filters |
| **Web Workers** | Whisper model runs in a dedicated worker thread |
| **`requestVideoFrameCallback`** | Frame-accurate video capture for export |
| **`IndexedDB`** | Persistent cache for reverse geocode results |
| **`MediaStreamTrackProcessor`** | Audio capture fallback via `captureStream()` |
| **`AudioContext`** | PCM decode fallback for audio re-encoding |
| **Nominatim API** (OpenStreetMap) | Reverse geocoding (no API key required) |
| **Strava API** | OAuth 2.0 activity import |

---

## Features

### Media Import

- **GPX file import** — drag-and-drop or file picker; parses track points, timestamps, speed, elevation, heart rate, cadence, power, temperature, and grade
- **Strava integration** — OAuth 2.0 connect; browse and import GPX directly from Strava activities
- **Multi-file video import** — load one or more MP4 files; each becomes a segment on the concatenated timeline; append additional clips after the initial load

### GPX–Video Sync

- **Auto-detect offset** — reads MP4 creation timestamp from container `mvhd` box; falls back to file `lastModified` date when no MP4 timestamp is found
- **Manual offset slider** — ±300 s range with 0.5 s steps; shown below the video source loader
- **Sync status badge** — shows `Auto ✓ (file date)`, `Auto ✓`, or `Manual`
- **Sync lane in timeline** — visual overlay of the GPX window mapped onto video time

### Video Timeline

- **Multi-clip timeline** — drag to reorder clips; inline trim handles per clip
- **Split clip** — `Ctrl+B` or toolbar button splits at the current playhead position
- **Delete clip** — `Delete`/`Backspace` or toolbar button removes the selected clip
- **Merge clips** — merge two adjacent clips back into one
- **GPX timeline lane** — scrollable view of track points aligned to video time
- **Charts lane** — Chart.js graphs for speed, elevation, heart rate, cadence, and power
- **Draggable drop zone** — drop a new video file directly onto the timeline to append it

### Playback

- **Play / Pause / Reset** with `Space` keyboard shortcut
- **Playback speed** selector
- **Timecode display** — `HH:MM:SS:FF` at 30 fps
- **Keyboard shortcuts**

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Ctrl+B` | Split clip at playhead |
| `Delete` / `Backspace` | Delete selected clip |

### Overlay Formats

Seven HUD layouts selectable in the right panel:

| Format | Description |
|---|---|
| `Classic` | Full stat panel (4 rows) + map inset + bottom gradient |
| `Minimal` | Compact speed / distance / time strip |
| `GoPro` | Progress bar + multi-metric layout, GoPro-style |
| `Sport` | Large speed + pace display |
| `Cycling` | Power / cadence / HR focused layout |
| `Sticker 1` | Portrait static activity sticker |
| `Sticker 2` | Full-map activity sticker |

**Live metrics rendered on every frame:**
- Speed (km/h), Pace (min/km), Distance (km), Total distance
- Heart rate (bpm), Cadence (rpm), Power (W), Estimated calories
- Elevation gain / loss (m), Grade (%), Temperature (°C)
- Elapsed time, Current lap / total laps (auto 1 km laps with best lap highlight)
- Clock time derived from GPX timestamps + offset

**Map inset** — heading-up mini-map with speed-colored trail; rotates with direction of travel; north indicator arrow

**Accent color picker** — applies a custom color to progress bars, icons, and map highlights

### Video Filters (WebGL)

Applied in real-time during preview and baked into the export via a WebGL unsharp-mask + color-matrix shader:

| Filter | Effect |
|---|---|
| None | Pass-through |
| Clarity | Large-radius unsharp mask + boosted contrast and saturation |
| Vivid | Sharpened + high saturation |
| Cinematic | Desaturated, high-contrast, darker |
| Warm | Sepia tint + boosted saturation |
| Cool | Slight blue hue shift |
| B&W | Full desaturation |
| Vintage | Low contrast, sepia, faded |
| Fade | Lifted blacks, low contrast |

### Speed Curves

Variable-speed presets applied per-clip at export time via seek-based frame sampling:

| Preset | Description |
|---|---|
| Normal | Real-time 1× |
| Hero | Slow-motion intro/outro (0.25×), normal in the middle |
| Bullet | Extreme slow-motion (0.08×) in the middle section |
| Montage | Alternating 2× fast and 0.5× slow |
| Rush | Uniform 2× fast-forward |

### AI Captions (Whisper)

- **In-browser transcription** — `@xenova/transformers` runs `Xenova/whisper-*.en` entirely in the browser via WASM; no server or API key needed
- **Model selector** — tiny / small / medium (trades speed vs. accuracy)
- **Caption editor** — add, edit, remove, and clear segments with `start`/`end` timestamps and text
- **Caption styling options**

| Option | Values |
|---|---|
| Font family | Inter (sans), Montserrat, Impact, Oswald, Bebas Neue |
| Font size | Numeric px (scales to export resolution) |
| Color | Hex color picker |
| Bold | Toggle |
| ALL CAPS / lowercase | Toggle |
| Placement | 9-position grid (top/mid/bot × left/center/right) |
| Drag position | Drag caption to any position; resize width handle |
| Background | Semi-transparent rounded rect |
| Background opacity | 0–100 % |
| Outline | Text stroke for contrast on bright backgrounds |

- **Captions baked into export** — rendered on the 2D canvas at full export resolution

### Video Export

- **WebCodecs pipeline** — `VideoDecoder` (fast path for clips ≤ 60 s) or `requestVideoFrameCallback` (legacy seek+play path); `VideoEncoder` outputs H.264/AVC; muxed via `mp4-muxer`
- **Audio handling** — prefers stream-copy (splices encoded AAC frames directly, lossless); falls back to `captureStream()` + `AudioEncoder`; final fallback is `AudioContext` PCM decode + re-encode
- **Video rotation correction** — reads `tkhd` rotation matrix from MP4 container; compensates 90°/180°/270° rotation that `ctx.drawImage` ignores
- **Hardware acceleration** — tries GPU-accelerated `VideoEncoder` first; auto-falls back to software on error
- **Multi-segment export** — concatenates clips from multiple video files with correct audio timing
- **Speed curve export** — seek-based frame sampling when a non-flat speed curve is active
- **Resolution cap** — downscales to 1920 px on the longest edge; output always has even-pixel dimensions (H.264 requirement)
- **Output** — downloads `gpx2video-export.mp4` directly from the browser; no upload required

### Sticker Export

- Exports a standalone activity summary card (route map + key stats) as a PNG image using `sharp`

### Track Stats Panel

- Total distance, moving time, elevation gain / loss
- Max speed, average speed, average heart rate, average cadence, average power

### Reverse Geocoding

- Calls Nominatim (OpenStreetMap) with the current GPX point as the user moves through the track
- Results cached in **IndexedDB** with a ~111 m grid key to minimize requests
- Location name shown in the app header and included in overlay / export

### Canvas & Layout

- **Resizable panels** — drag handles on left panel (col-resize), right panel (col-resize), and timeline (row-resize)
- **Aspect ratio selector** — 16:9, 9:16, 1:1 for the preview canvas and export dimensions
- **Auto aspect detection** — sets aspect ratio to 9:16 automatically when a portrait video is loaded

---

## File Structure

```
src/
├── utils/
│   ├── geo.js              haversine, lerp, arrayMax, fmtTime
│   ├── mp4.js              MP4 mvhd creation-time parser
│   ├── filters.js          WebGL shader parameters per filter preset
│   └── speedCurve.js       Speed curve presets and frame-time builder
├── workers/
│   └── whisper.worker.js   Web Worker that hosts @xenova/transformers
├── composables/
│   ├── useGpxParser.js           GPX XML → point array + session stats
│   ├── useAnimation.js           rAF-based GPX-only playback loop
│   ├── useVideoSync.js           Video ↔ GPX sync, multi-clip, trim, offset, auto-detect
│   ├── useVideoExport.js         WebCodecs H.264 export with overlay, audio, speed curves
│   ├── useVideoShader.js         WebGL shader setup and per-filter rendering
│   ├── useWhisperTranscription.js  Whisper worker bridge + caption segment management
│   ├── useReverseGeocode.js      Nominatim lookup with IndexedDB cache
│   ├── useStravaAuth.js          Strava OAuth 2.0 flow
│   ├── useStravaActivities.js    Strava activity list + GPX download
│   ├── useDraggedVideo.js        Video drag-and-drop handling
│   └── useVideoCache.js          Video file blob URL cache
└── components/
    ├── GpxLoader.vue           GPX source row (file pick + Strava toggle)
    ├── VideoLoader.vue         Video file drag-and-drop strip + segment list
    ├── VideoStage.vue          Canvas map + <video> element + HUD overlay
    ├── SyncPanel.vue           Full timeline — clips, GPX, sync, charts lanes
    ├── ChartRow.vue            Chart.js speed / elevation / HR / cadence / power charts
    ├── MetricsRow.vue          Session stats row
    ├── PlaybackControls.vue    Play / Pause / Reset / Speed selector
    ├── ExportButton.vue        Export button with progress ring
    ├── CaptionEditor.vue       Whisper trigger + caption segment list + style controls
    ├── OverlayFormatBar.vue    Overlay format selector (7 presets)
    ├── OverlayColorPicker.vue  Accent color hex picker
    ├── FilterBar.vue           Video filter selector
    ├── SpeedCurveBar.vue       Speed curve preset selector
    ├── PlayerSizeBar.vue       Aspect ratio selector
    ├── StickerExport.vue       Activity sticker PNG export
    ├── StravaConnect.vue       Strava OAuth connect + activity browser
    └── DropZone.vue            Generic file drag-and-drop zone
```
