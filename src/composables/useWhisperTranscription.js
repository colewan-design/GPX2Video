import { ref } from 'vue'

let _worker     = null
let _workerModel = null

function getWorker() {
  if (!_worker) {
    _worker = new Worker(
      new URL('../workers/whisper.worker.js', import.meta.url),
      { type: 'module' },
    )
  }
  return _worker
}

export function useWhisperTranscription() {
  const status    = ref('idle')    // idle | downloading | transcribing | done | error
  const progress  = ref(0)         // 0–1 during download
  const error     = ref(null)
  const segments  = ref([])
  const modelSize = ref('tiny')

  async function transcribe(videoBlob) {
    status.value   = 'downloading'
    progress.value = 0
    error.value    = null

    try {
      const audioData = await extractAudio(videoBlob)
      const modelId   = `Xenova/whisper-${modelSize.value}.en`
      const worker    = getWorker()

      // Load / warm up the model (no-op if already loaded)
      await new Promise((resolve, reject) => {
        function onMsg(e) {
          const { type, ratio } = e.data
          if (type === 'progress') {
            progress.value = ratio >= 0 ? ratio : progress.value  // keep last value when indeterminate
          } else if (type === 'ready') {
            worker.removeEventListener('message', onMsg)
            resolve()
          } else if (type === 'error') {
            worker.removeEventListener('message', onMsg)
            reject(new Error(e.data.message))
          }
        }
        worker.addEventListener('message', onMsg)
        worker.postMessage({ type: 'load', modelId })
      })

      status.value   = 'transcribing'
      progress.value = 0

      // Run transcription — transfer the Float32Array buffer for zero-copy
      const result = await new Promise((resolve, reject) => {
        function onMsg(e) {
          const { type } = e.data
          if (type === 'result') {
            worker.removeEventListener('message', onMsg)
            resolve(e.data.data)
          } else if (type === 'error') {
            worker.removeEventListener('message', onMsg)
            reject(new Error(e.data.message))
          }
        }
        worker.addEventListener('message', onMsg)
        worker.postMessage({ type: 'transcribe', audio: audioData }, [audioData.buffer])
      })

      let id = 0
      segments.value = (result.chunks ?? []).map(chunk => ({
        id:    id++,
        start: chunk.timestamp[0] ?? 0,
        end:   chunk.timestamp[1] ?? (chunk.timestamp[0] ?? 0) + 3,
        text:  chunk.text.trim(),
      })).filter(s => s.text)

      status.value = 'done'
    } catch (e) {
      error.value  = e.message ?? 'Transcription failed.'
      status.value = 'error'
    }
  }

  async function extractAudio(blob) {
    const audioCtx    = new AudioContext({ sampleRate: 16000 })
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    await audioCtx.close()
    return audioBuffer.getChannelData(0)
  }

  function addSegment() {
    const last  = segments.value[segments.value.length - 1]
    const start = last ? last.end + 0.1 : 0
    segments.value.push({ id: Date.now(), start, end: start + 3, text: '' })
  }

  function removeSegment(id) {
    segments.value = segments.value.filter(s => s.id !== id)
  }

  function updateSegment(id, patch) {
    const seg = segments.value.find(s => s.id === id)
    if (seg) Object.assign(seg, patch)
  }

  function clearSegments() {
    segments.value = []
    status.value   = 'idle'
    error.value    = null
  }

  return {
    status, progress, error, segments, modelSize,
    transcribe, addSegment, removeSegment, updateSegment, clearSegments,
  }
}
