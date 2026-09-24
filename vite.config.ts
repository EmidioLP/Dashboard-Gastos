import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // firebase alone is ~600 kB minified (180 kB gzip)
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\/]@?firebase/ },
            { name: 'charts', test: /node_modules[\/](recharts|d3-|victory-vendor)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
})
