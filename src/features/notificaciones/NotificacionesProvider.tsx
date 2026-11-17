import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RUTA_BANDEJA } from '@/config/routes'
import { useDominio } from '@/hooks/useDominio'
import { storage } from '@/lib/storage'
import { suscribirEventos, type EstadoConexion, type EventoExpediente } from '@/services/realtime'
import type { Oficina } from '@/types/domain'
import { expedienteKeys } from '../expedientes/hooks'
import { solicitudKeys } from '../expedientes/solicitudesNumero'
import { NotificacionesContext, type Aviso, type Notificacion } from './context'
import { Toaster } from './components/Toaster'
import { describirEvento } from './mensajes'

// v2: los eventos usan ids relacionales (oficinaId, tramiteId…); se descartan los guardados antes.
const KEY_NOTIFICACIONES = 'drh_notificaciones_v2'
const KEY_VISTOS = 'drh_bandejas_vistas'
const MAX_NOTIFICACIONES = 30

/** La primera vez se toma "ahora" como visto, para no marcar como nuevos los datos de ejemplo. */
function vistosIniciales(oficinas: Oficina[]): Record<Oficina, string> {
  const guardados = storage.get<Partial<Record<Oficina, string>>>(KEY_VISTOS, {})
  const ahora = new Date().toISOString()
  return Object.fromEntries(oficinas.map((o) => [o, guardados[o] ?? ahora])) as Record<Oficina, string>
}

let secuencia = 0
const nuevoId = () => `${Date.now().toString(36)}-${(secuencia += 1)}`

/**
 * Mantiene la conexión en vivo y, ante cada evento de expediente:
 * 1) refresca las consultas de expedientes (bandejas, listados, contadores),
 * 2) guarda la notificación (campana) y 3) muestra un aviso emergente.
 */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const dominio = useDominio()
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexion>('conectando')
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>(() => storage.get(KEY_NOTIFICACIONES, []))
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [vistos, setVistos] = useState(() => vistosIniciales(dominio.oficinas.map((o) => o.id)))

  useEffect(() => storage.set(KEY_NOTIFICACIONES, notificaciones), [notificaciones])
  useEffect(() => storage.set(KEY_VISTOS, vistos), [vistos])

  const mostrarAviso = useCallback((aviso: Omit<Aviso, 'id'>) => setAvisos((prev) => [...prev, { ...aviso, id: nuevoId() }].slice(-4)), [])
  const cerrarAviso = useCallback((id: string) => setAvisos((prev) => prev.filter((t) => t.id !== id)), [])

  useEffect(() => {
    return suscribirEventos((evento: EventoExpediente) => {
      void qc.invalidateQueries({ queryKey: expedienteKeys.all })
      void qc.invalidateQueries({ queryKey: solicitudKeys.all })
      // TODO(login): avisar solo si el expediente llega a la oficina del usuario.
      setNotificaciones((prev) => [{ id: nuevoId(), evento, leida: false }, ...prev].slice(0, MAX_NOTIFICACIONES))
      const m = describirEvento(evento, dominio)
      mostrarAviso({ titulo: m.titulo, detalle: m.detalle, icono: m.icon, ruta: RUTA_BANDEJA[m.oficina] })
    }, setEstadoConexion)
  }, [qc, dominio, mostrarAviso])

  const marcarTodasLeidas = useCallback(() => setNotificaciones((prev) => prev.map((n) => (n.leida ? n : { ...n, leida: true }))), [])
  const limpiarNotificaciones = useCallback(() => setNotificaciones([]), [])
  const marcarBandejaVista = useCallback((oficina: Oficina) => setVistos((prev) => ({ ...prev, [oficina]: new Date().toISOString() })), [])

  const value = useMemo(
    () => ({
      estadoConexion,
      notificaciones,
      noLeidas: notificaciones.filter((n) => !n.leida).length,
      marcarTodasLeidas,
      limpiarNotificaciones,
      avisos,
      mostrarAviso,
      cerrarAviso,
      vistos,
      marcarBandejaVista,
    }),
    [estadoConexion, notificaciones, marcarTodasLeidas, limpiarNotificaciones, avisos, mostrarAviso, cerrarAviso, vistos, marcarBandejaVista],
  )

  return (
    <NotificacionesContext.Provider value={value}>
      {children}
      <Toaster />
    </NotificacionesContext.Provider>
  )
}
