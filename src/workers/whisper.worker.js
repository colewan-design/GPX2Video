// Import directly from CDN — Vite does not bundle https:// URLs, so the
// self-contained dist file (onnxruntime-web included) loads as-is in the browser.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'

env.allowLocalModels = false

// Force WASM-only execution — prevents ONNX Runtime from creating WebGL/WebGPU
// contexts that compete with the app's VideoEncoder and video shader, which can
// cause GPU context loss and truncated exports.
env.backends.onnx.wasm.proxy = false
env.backends.onnx.wasm.numThreads = 1

let transcriber  = null
let currentModel = null

// Aggregate per-file download progress into a single 0–1 value.
function makeProgressTracker(onUpdate) {
  const loaded = {}
  const totals = {}
  return function (p) {
    if (p.status === 'initiate') {
      loaded[p.file] = 0
      totals[p.file] = 0
    } else if (p.status === 'progress') {
      loaded[p.file] = p.loaded ?? 0
      totals[p.file] = p.total  ?? 0
    } else if (p.status === 'done') {
      loaded[p.file] = totals[p.file] ?? 0
    }
    const totalLoaded = Object.values(loaded).reduce((a, b) => a + b, 0)
    const totalSize   = Object.values(totals).reduce((a, b) => a + b, 0)
    onUpdate(totalSize > 0 ? totalLoaded / totalSize : -1)  // -1 = indeterminate
  }
}

self.addEventListener('message', async (e) => {
  const { type, audio, modelId } = e.data

  if (type === 'load') {
    try {
      if (transcriber && currentModel === modelId) {
        self.postMessage({ type: 'ready' })
        return
      }
      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        progress_callback: makeProgressTracker((ratio) => {
          self.postMessage({ type: 'progress', ratio })
        }),
      })
      currentModel = modelId
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message ?? String(err) })
    }
  }

  if (type === 'transcribe') {
    try {
      const result = await transcriber(audio, {
        return_timestamps: true,
        chunk_length_s:    30,
        stride_length_s:   5,
      })
      self.postMessage({ type: 'result', data: result })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message ?? String(err) })
    }
  }
})
