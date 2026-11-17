// Cliente HTTP del backend real (NestJS + PostgreSQL/PostGIS, carpeta /backend).
//
// Convive con el cliente de json-server (./client.ts) mientras dura la migración: cada
// módulo que pasa al backend real usa este. En desarrollo, el proxy de Vite manda /backend/*
// a localhost:3000/api/*. Con todo migrado, queda un solo cliente.
import axios from 'axios'
import { adaptadorDemo } from '../demo/adaptador'
import { MODO_DEMO } from '../demo/modo'
import { guardarToken, tokenActual, usuarioActualId } from '../sesion'
import { toApiError } from './errors'

export const backend = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? '/backend',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// Modo demo: todo lo del backend real lo responde el emulador del navegador (services/demo).
if (MODO_DEMO) backend.defaults.adapter = adaptadorDemo(() => true)

// Quién actúa: el token del login. En el modo demo, el usuario elegido en la barra superior.
backend.interceptors.request.use((config) => {
  if (MODO_DEMO) config.headers.set('X-Usuario-Id', usuarioActualId())
  else if (tokenActual()) config.headers.set('Authorization', `Bearer ${tokenActual()}`)
  return config
})

// Mismos errores que el resto de la app: ApiError con el mensaje listo para mostrar.
// El backend devuelve los errores de validación como lista: se juntan en un texto.
backend.interceptors.response.use(
  (response) => response,
  (error) => {
    // La sesión venció o se cerró (salvo el propio login, que responde 401 con clave incorrecta).
    if (error?.response?.status === 401 && !String(error.config?.url ?? '').startsWith('/auth/login')) guardarToken(null)
    const data = error?.response?.data
    if (data && Array.isArray(data.message)) data.message = data.message.join(' · ')
    return Promise.reject(toApiError(error))
  },
)
