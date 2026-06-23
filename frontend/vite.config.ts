import { fileURLToPath, URL } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Добавляем вот этот блок
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['synapse.tel'],
  },
})