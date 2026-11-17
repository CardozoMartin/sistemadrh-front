import { useMemo } from 'react'
import type { Oficina } from '@/types/domain'
import { useExpedientes } from '../expedientes/hooks'
import { useNotificaciones } from './context'

export interface ResumenBandeja {
  /** Expedientes pendientes en la oficina. */
  pendientes: number
  /** Llegados desde la última vez que se miró la bandeja. */
  nuevos: number
}

/** Contadores por oficina para el sidebar (y cualquier indicador global). */
export function useResumenBandejas(): Partial<Record<Oficina, ResumenBandeja>> {
  const { vistos, estadoConexion } = useNotificaciones()
  // Sin conexión en vivo se refresca cada 30 s como respaldo.
  const { data } = useExpedientes({}, { pendientes: true, refetchInterval: estadoConexion === 'en_vivo' ? false : 30_000 })

  return useMemo(() => {
    const resumen: Partial<Record<Oficina, ResumenBandeja>> = {}
    for (const e of data ?? []) {
      const r = (resumen[e.oficinaId] ??= { pendientes: 0, nuevos: 0 })
      r.pendientes += 1
      if (e.fechaActualizacion > (vistos[e.oficinaId] ?? '')) r.nuevos += 1
    }
    return resumen
  }, [data, vistos])
}
