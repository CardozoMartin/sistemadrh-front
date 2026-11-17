// Login, sesión y contraseña (backend real: /auth/*).
import { backend } from '@/services/api/backend'

/** Quién está conectado (GET /auth/sesion), con su oficina, rol y permisos. */
export interface UsuarioSesion {
  id: string
  legajo: string
  apellido: string
  nombre: string
  email: string
  oficina: { codigo: string; nombre: string } | null
  rol: { codigo: string; nombre: string } | null
  /** Solo jefes de Distrito: el distrito que atiende (null: todos). */
  distrito: { id: number; codigo: string; nombre: string } | null
  esAdministrador: boolean
  /** Entró con una contraseña temporal: tiene que cambiarla antes de seguir. */
  debeCambiarClave: boolean
  permisos: string[]
}

export const authApi = {
  login: async (usuario: string, clave: string) => (await backend.post<{ token: string; usuario: UsuarioSesion }>('/auth/login', { usuario, clave })).data,
  sesion: async () => (await backend.get<UsuarioSesion>('/auth/sesion')).data,
  logout: async () => void (await backend.post('/auth/logout')),
  cambiarClave: async (actual: string, nueva: string) => (await backend.post<UsuarioSesion>('/auth/cambiar-clave', { actual, nueva })).data,
}

/** Mismas reglas que el backend (seguridad/claves.ts). Mensaje de error o null. */
export function errorClave(clave: string): string | null {
  if (clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.'
  if (clave.length > 100) return 'La contraseña admite hasta 100 caracteres.'
  if (!/[a-zA-ZñÑ]/.test(clave) || !/\d/.test(clave)) return 'La contraseña tiene que tener letras y números.'
  return null
}
