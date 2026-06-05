const DB_NAME    = 'gpx2video_db'
const STORE_NAME = 'videos'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'order' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function cacheVideos(files) {
  // files: File[]  — ordered list to persist
  const db      = await openDB()
  const tx      = db.transaction(STORE_NAME, 'readwrite')
  const store   = tx.objectStore(STORE_NAME)
  store.clear()
  files.forEach((f, i) =>
    store.put({ order: i, name: f.name, lastModified: f.lastModified, blob: f })
  )
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function getCachedVideos() {
  const db    = await openDB()
  const tx    = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = e => {
      const rows = (e.target.result || []).sort((a, b) => a.order - b.order)
      resolve(rows.map(r => new File([r.blob], r.name, { type: r.blob.type, lastModified: r.lastModified })))
    }
    req.onerror = e => reject(e.target.error)
  })
}

export async function clearVideoCache() {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}
