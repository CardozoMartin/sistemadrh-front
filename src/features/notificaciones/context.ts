import { createContext, useContext } from 'react'
import type { EstadoConexion, EventoExpediente } from '@/services/realtime'
import type { Oficina } from '@/types/domain'

export interface Notificacion {
  id: string
  evento: EventoExpediente
  leida: boolean
}

/** Aviso emergente (abajo a la derecha): de un evento en vivo o de una acción propia. */
export interface Aviso {
  id: string
  titulo: string
  detalle?: string
  icono: string
  tono?: 'info' | 'exito'
  /** Si se pasa, muestra el enlace «Ver bandeja». */
  ruta?: string
}

export interface NotificacionesContextValue {
  estadoConexion: EstadoConexion
  notificaciones: Notificacion[]
  noLeidas: number
  marcarTodasLeidas: () => void
  limpiarNotificaciones: () => void
  /** Suma a la campana un evento que no llegó por la conexión en vivo (ej: un pedido de número encontrado al consultar). */
  agregarNotificacion: (evento: EventoExpediente) => void
  /** Avisos emergentes visibles en este momento. */
  avisos: Aviso[]
  mostrarAviso: (aviso: Omit<Aviso, 'id'>) => void
  cerrarAviso: (id: string) => void
  /** Última vez que se miró la bandeja de cada oficina (ISO). */
  vistos: Record<Oficina, string>
  marcarBandejaVista: (oficina: Oficina) => void
}

export const NotificacionesContext = createContext<NotificacionesContextValue | null>(null)

export function useNotificaciones() {
  const ctx = useContext(NotificacionesContext)
  if (!ctx) throw new Error('useNotificaciones debe usarse dentro de <NotificacionesProvider>')
  return ctx
}
