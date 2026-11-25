// Lo común a cualquier expediente del circuito de oficinas (alta, cambio de titularidad, anulación,
// reubicación, pozos…): el historial, tomarlo y las claves de caché del historial y las bandejas.
import { useQuery } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'
import type { EntradaHistorial } from './historial.types'

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const expedienteApi = {
  /** Pases, actuaciones y cambios de estado, en orden. */
  historial: (id: string) => datos(backend.get<EntradaHistorial[]>(`/expedientes/${id}/historial`)),
  /** La oficina que lo tiene lo toma para trabajarlo (antes de actuar). */
  tomar: (id: string) => datos(backend.post(`/expedientes/${id}/tomar`)),
}

/**
 * Claves de caché comunes a todos los trámites. Cuelgan del prefijo del alta (fue el primer
 * trámite): así, invalidar `altaKeys.all` también refresca el historial y las bandejas.
 */
export const expedienteKeys = {
  all: ['backend', 'altas'] as const,
  historial: (id: string) => [...expedienteKeys.all, 'historial', id] as const,
  bandejas: () => [...expedienteKeys.all, 'bandeja'] as const,
}

export function useHistorial(id: string | undefined) {
  return useQuery({ queryKey: expedienteKeys.historial(id ?? ''), queryFn: () => expedienteApi.historial(id!), enabled: !!id })
}
