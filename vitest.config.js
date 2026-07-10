import { defineConfig } from 'vitest/config'

// Config mínima de Vitest. Los tests actuales son de lógica pura (sin DOM),
// así que el entorno 'node' es suficiente y arranca más rápido que jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
