import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Copia local de las capas del GeoServer de la DRH (la arma el backend con «npm run sig:copiar»;
 * fuera de git porque tiene nombres y CUIT). Se sirve en /capas-drh/<capa>.geojson, en
 * desarrollo y en «vite preview». Ver src/features/visor/capasDrh.ts.
 */
function capasDrh(): Plugin {
  const carpeta = fileURLToPath(new URL('../backend/recursos/sig/geoserver', import.meta.url))
  const servir: Connect.NextHandleFunction = (req, res, next) => {
    const nombre = /^\/capas-drh\/([\w-]+\.geojson)$/.exec(req.url?.split('?')[0] ?? '')?.[1]
    if (!nombre) return next()
    const archivo = join(carpeta, nombre)
    if (!existsSync(archivo)) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8')
    createReadStream(archivo).pipe(res)
  }
  return {
    name: 'capas-drh',
    configureServer: (server) => void server.middlewares.use(servir),
    configurePreviewServer: (server) => void server.middlewares.use(servir),
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), capasDrh()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Acceso desde otra red por un túnel (Cloudflare o ngrok): Vite rechaza los nombres de host
    // que no conoce. Solo se aceptan estos dominios, además de localhost.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
    // El front siempre llama a /api/...; en desarrollo se redirige a json-server.
    // Con el backend real solo cambia el target (o VITE_API_URL).
    proxy: {
      // Eventos en vivo (SSE). Va antes que /api para que tenga prioridad.
      '/api/events': {
        target: 'http://localhost:3002',
        rewrite: () => '/events',
      },
      // Módulos que ya usan el backend real (NestJS + PostGIS, carpeta /backend, puerto 3000).
      // Se migra de a uno: cada prefijo que se agrega acá deja de ir a json-server.
      '/api/sig': {
        target: 'http://localhost:3000',
      },
      // Backend real con prefijo propio: json-server también usa /api/expedientes, así que lo
      // que ya migró (Alta de Concesión, expedientes, personas, deudas…) va por /backend/*.
      // Ver src/services/api/backend.ts.
      '/backend': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/backend/, '/api'),
      },
      // WMS de la Dirección General de Catastro (IDET): solo http y sin CORS, así que el navegador
      // no lo puede pedir directo (se bloquea en https y no deja leer la consulta con un clic).
      // En producción hace falta el mismo proxy en el servidor web. Ver features/visor/capasWms.ts.
      '/ext/catastro': {
        target: 'http://200.49.89.203',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ext\/catastro/, '/geoserver/dgct'),
      },
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
