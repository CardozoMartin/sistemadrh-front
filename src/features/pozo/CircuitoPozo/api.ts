// Circuito del registro de pozo. PROTOTIPO: lo responde el backend emulado (npm run demo).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaKeys } from '@/features/tramites/AltaDeConcesion/hooks'
import { backend } from '@/services/api/backend'
import type { DatosCatastroPozo, RegistroPozoBackend } from './types'

const BASE = '/tramites/registro-pozo'
const datos = async <T>(p: Promise<{ data: T }>) => (await p).data
const post = (id: string, accion: string, dto: unknown = {}) => datos(backend.post<RegistroPozoBackend>(`${BASE}/${id}/${accion}`, dto))

export type Resultado = 'APTO' | 'OBSERVADO' | 'NO_APTO'

export const registroPozoApi = {
  obtener: (id: string) => datos(backend.get<RegistroPozoBackend>(`${BASE}/${id}`)),
  guardarCatastro: (id: string, dto: DatosCatastroPozo) => datos(backend.put<RegistroPozoBackend>(`${BASE}/${id}/catastro`, dto)),
  catastro: (id: string, dto: { resultado: Resultado; observaciones?: string }) => post(id, 'catastro', dto),
  distrito: (id: string, dto: { observaciones?: string }) => post(id, 'distrito', dto),
  recaudacion: (id: string, dto: { resultado: 'SIN_DEUDA' | 'CON_DEUDA'; deudas?: { personaId: string; detalle: string; monto?: number }[]; observaciones?: string }) => post(id, 'recaudacion', dto),
  juridico: (id: string, dto: { resultado: Resultado; observaciones?: string }) => post(id, 'juridico', dto),
  resolucion: (id: string, dto: { decision: 'APROBAR' | 'RECHAZAR'; numero?: string; anio?: number; fecha?: string; observaciones?: string }) => post(id, 'resolucion', dto),
  reenviar: (id: string, dto: { observaciones: string }) => post(id, 'reenviar', dto),
  cierre: (id: string, dto: { observaciones?: string }) => post(id, 'cierre', dto),
  tomar: (id: string) => datos(backend.post(`/expedientes/${id}/tomar`)),
}

export const registroPozoKeys = {
  registro: (id: string) => ['backend', 'registro-pozo', id] as const,
}

export function useRegistroPozo(id: string | undefined) {
  return useQuery({ queryKey: registroPozoKeys.registro(id ?? ''), queryFn: () => registroPozoApi.obtener(id!), enabled: !!id })
}

/**
 * Acción del circuito: guarda el registro actualizado y refresca el historial, las bandejas,
 * el padrón de pozos y el visor (al cerrar nace la concesión).
 */
export function useAccionRegistro<T>(id: string, accion: (id: string, dto: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: T) => accion(id, dto),
    onSuccess: (r) => {
      if (r && typeof r === 'object' && 'ficha' in r) qc.setQueryData(registroPozoKeys.registro(id), r)
      else void qc.invalidateQueries({ queryKey: registroPozoKeys.registro(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
      void qc.invalidateQueries({ queryKey: ['backend', 'pozos'] })
      void qc.invalidateQueries({ queryKey: ['sig'] })
    },
  })
}
