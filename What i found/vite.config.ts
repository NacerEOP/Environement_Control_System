import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ and @/app to the app directory (where App.tsx & components live)
      '@': path.resolve(__dirname, './app'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
  server: {
    proxy: {
      // Proxy les appels API absolus afin d'éviter CORS en dev:
      // le navigateur parle uniquement à http://localhost:5173,
      // Vite relaie ensuite vers Apache http://localhost.
      "/Hackaton%20projet%20Crop%20Care/api": {
        target: "http://localhost",
        changeOrigin: false,
      },
    },
  },
})
