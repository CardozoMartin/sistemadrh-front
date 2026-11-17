import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDominio } from '@/hooks/useDominio'
import type { Oficina } from '@/types/domain'
import { expedientesApi, type EmailSimulado, type FiltrosExpedientes, type RevisionInput, type TomarInput } from './api'

/** Claves de caché de expedientes. Invalidar `expedienteKeys.all` refresca todo lo relacionado. */
export const expedienteKeys = {
  all: ['expedientes'] as const,
  listas: () => [...expedienteKeys.all, 'lista'] as const,
  lista: (filtros: FiltrosExpedientes) => [...expedienteKeys.listas(), filtros] as const,
  detalle: (id: string) => [...expedienteKeys.all, 'detalle', id] as const,
}

interface OpcionesLista {
  /** Solo los estados marcados como pendientes en /estados (lo que atiende una oficina). */
  pendientes?: boolean
  /** Refresco periódico (ms). Se usa como respaldo cuando no hay conexión en vivo. */
  refetchInterval?: number | false
}

export function useExpedientes(filtros: FiltrosExpedientes = {}, { pendientes, refetchInterval = false }: OpcionesLista = {}) {
  const { estadosPendientes } = useDominio()
  const filtrosFinales: FiltrosExpedientes = pendientes && !filtros.estadoId ? { ...filtros, estadoId: estadosPendientes } : filtros
  return useQuery({
    queryKey: expedienteKeys.lista(filtrosFinales),
    queryFn: () => expedientesApi.listar(filtrosFinales),
    // Al cambiar filtros se mantiene la lista anterior mientras llega la nueva.
    placeholderData: keepPreviousData,
    refetchInterval,
  })
}

export function useExpediente(id: string | undefined) {
  return useQuery({
    queryKey: expedienteKeys.detalle(id ?? ''),
    queryFn: () => expedientesApi.obtener(id!),
    enabled: !!id,
  })
}

/** Aprueba (avanza) u observa (detiene) el expediente en la oficina actual. */
export function useRegistrarRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RevisionInput) => expedientesApi.registrarRevision(input),
    onSuccess: (expediente) => {
      // El detalle solo se marca como viejo (sin volver a pedirlo): la pantalla que lo
      // muestra navega a la bandeja y no debe rearmarse con la etapa siguiente.
      void qc.invalidateQueries({ queryKey: expedienteKeys.detalle(expediente.id), refetchType: 'none' })
      void qc.invalidateQueries({ queryKey: expedienteKeys.listas() })
    },
  })
}

/** La oficina toma el expediente (queda en su historial). */
export function useTomarExpediente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TomarInput) => expedientesApi.tomar(input),
    onSuccess: (expediente) => {
      qc.setQueryData(expedienteKeys.detalle(expediente.id), expediente)
      void qc.invalidateQueries({ queryKey: expedienteKeys.listas() })
    },
  })
}

export function useEnviarEmail() {
  return useMutation({ mutationFn: (email: EmailSimulado) => expedientesApi.enviarEmail(email) })
}

/** Usuario que firma las acciones de una oficina. TODO(login): usuario autenticado. */
export function useUsuarioDeOficina(oficina: Oficina) {
  return useDominio().usuarios.find((u) => u.oficinaId === oficina) ?? null
}
