import { ref } from 'vue'

const draggedFile = ref(null)
const isDragging  = ref(false)

export function useDraggedVideo() {
  return { draggedFile, isDragging }
}
