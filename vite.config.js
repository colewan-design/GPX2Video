import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server:  { historyApiFallback: true },
  preview: { historyApiFallback: true },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
})
