import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    sourcemap: false,
    // Las páginas se parten por ruta con React.lazy (ver App.jsx), así que el
    // bundle inicial ya bajó ~34%. El chunk principal que queda (~730 kB) es
    // código de arranque inevitable: React, Supabase (auth), framer-motion
    // (hero) y Sentry — todo necesario en el primer render, no tiene sentido
    // diferirlo. Subimos el umbral del warning para reflejar esa realidad.
    chunkSizeWarningLimit: 800,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
})
