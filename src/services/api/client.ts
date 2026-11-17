// Cliente HTTP único de la app. Todas las peticiones pasan por acá para centralizar
// URL base, headers (token cuando exista login), demoras simuladas y errores.
import axios from 'axios'
import { adaptadorDemo } from '../demo/adaptador'
import { MODO_DEMO, USA_JSON_SERVER } from '../demo/modo'
import { guardarToken, tokenActual } from '../sesion'
import { toApiError } from './errors'

const DEMORA_MS = import.meta.env.DEV ? Number(import.meta.env.VITE_API_DELAY_MS ?? 400) : 0

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Demora artificial en desarrollo para que se vean los estados de carga en la demo.
if (DEMORA_MS > 0) {
  api.interceptors.request.use((config) => new Promise((resolve) => setTimeout(() => resolve(config), DEMORA_MS)))
}

// Modo demo: lo geográfico (/sig/*, backend real) lo responde el emulador; lo demás sigue en json-server.
if (MODO_DEMO) api.defaults.adapter = adaptadorDemo((url) => url.startsWith('/sig/'))

// Modo real: este cliente solo llega al backend en /sig/* (el proxy de Vite lo manda a NestJS).
// Lo demás era de json-server: se corta con un aviso claro en lugar de mostrar datos simulados.
if (!USA_JSON_SERVER) {
  const adaptadorHttp = api.defaults.adapter
  api.defaults.adapter = (config) => {
    if (config.url?.startsWith('/sig/')) return axios.getAdapter(adaptadorHttp)(config)
    return Promise.reject(
      new axios.AxiosError(
        'Esta pantalla todavía no está conectada a la base de datos (pendiente de migrar al backend).',
        'PENDIENTE_MIGRAR',
        config,
      ),
    )
  }
}

// /sig/* va al backend real: lleva el token del login.
api.interceptors.request.use((config) => {
  if (!MODO_DEMO && tokenActual() && config.url?.startsWith('/sig/')) config.headers.set('Authorization', `Bearer ${tokenActual()}`)
  return config
})

// Todos los errores salen como ApiError con un mensaje listo para mostrar.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && error.config?.url?.startsWith('/sig/')) guardarToken(null)
    return Promise.reject(toApiError(error))
  },
)
