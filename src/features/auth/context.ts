import { createContext, useContext } from 'react'
import type { UsuarioSesion } from './api'

export interface SesionContextValue {
  /** cargando: se está verificando el token guardado. */
  estado: 'cargando' | 'anonimo' | 'conectado'
  usuario: UsuarioSesion | null
  /** El usuario tiene ese permiso (el administrador, todos). */
  puede: (permiso: string) => boolean
  ingresar: (usuario: string, clave: string) => Promise<UsuarioSesion>
  salir: () => Promise<void>
  /** Después de cambiar la contraseña: la sesión actualizada. */
  actualizar: (usuario: UsuarioSesion) => void
}

export const SesionContext = createContext<SesionContextValue | null>(null)

export function useSesion(): SesionContextValue {
  const ctx = useContext(SesionContext)
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return ctx
}
