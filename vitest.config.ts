import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests unitarios de la lógica sin pantalla (schemas, adaptadores, reglas): npm test.
// Separado de vite.config.ts para no arrastrar sus plugins (mapas, proxy, capas del visor).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
