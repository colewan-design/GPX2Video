// Seconds between MP4 epoch (1904-01-01) and Unix epoch (1970-01-01)
const MP4_EPOCH_OFFSET = 2082844800

/**
 * Parse the recording creation time from an MP4 file's mvhd box.
 * Returns a Date, or null if not found / not an MP4 / clock looks wrong.
 */
export async function parseMp4CreationTime(file) {
  // Read up to 8 MB — moov box is almost always in the first few MB
  const CHUNK = Math.min(file.size, 8 * 1024 * 1024)
  const buf = await file.slice(0, CHUNK).arrayBuffer()
  const view = new DataView(buf)

  let offset = 0
  while (offset + 8 <= buf.byteLength) {
    const boxSize = view.getUint32(offset)
    const boxType = readFourCC(view, offset + 4)

    if (boxType === 'moov') {
      return findMvhd(view, offset + 8, offset + Math.min(boxSize, buf.byteLength))
    }

    if (boxSize < 8) break
    offset += boxSize
  }
  return null
}

function findMvhd(view, start, end) {
  let offset = start
  while (offset + 8 <= end && offset + 8 <= view.byteLength) {
    const boxSize = view.getUint32(offset)
    const boxType = readFourCC(view, offset + 4)

    if (boxType === 'mvhd') {
      const version = view.getUint8(offset + 8)
      let creationSec
      if (version === 0) {
        // 32-bit creation time at byte 12
        creationSec = view.getUint32(offset + 12)
      } else {
        // 64-bit creation time at bytes 12–19
        const hi = view.getUint32(offset + 12)
        const lo = view.getUint32(offset + 16)
        creationSec = hi * 4294967296 + lo
      }
      const unixMs = (creationSec - MP4_EPOCH_OFFSET) * 1000
      // Sanity-check: must be after 2000-01-01 and before 2100-01-01
      if (unixMs > 946684800000 && unixMs < 4102444800000) {
        return new Date(unixMs)
      }
      return null
    }

    if (boxSize < 8) break
    offset += boxSize
  }
  return null
}

function readFourCC(view, offset) {
  return (
    String.fromCharCode(view.getUint8(offset)) +
    String.fromCharCode(view.getUint8(offset + 1)) +
    String.fromCharCode(view.getUint8(offset + 2)) +
    String.fromCharCode(view.getUint8(offset + 3))
  )
}
