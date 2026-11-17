// Pedido de número de concesión: Secretaría General lo solicita antes de cargar la
// resolución y Catastro lo asigna. Colección /solicitudesNumero (relacionada con el
// expediente por expedienteId). Los avisos en vivo llegan por el servidor de eventos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api/client'
import { ApiError } from '@/services/api/errors'
import { filtro } from '@/services/api/jsonServer'
import type { Expediente, Oficina, SolicitudNumero } from '@/types/domain'
import { expedienteKeys } from './hooks'

const RUTA = '/solicitudesNumero'

/** Solicitud con su expediente embebido (relación expedienteId → /expedientes). */
export type SolicitudConExpediente = SolicitudNumero & { expediente?: Expediente }

export const solicitudesNumeroApi = {
  async listar(condiciones: { expedienteId?: string; estado?: SolicitudNumero['estado'] } = {}): Promise<SolicitudConExpediente[]> {
    const { data } = await api.get<SolicitudConExpediente[]>(RUTA, {
      params: { ...filtro(condiciones), _sort: '-fecha', _embed: 'expediente' },
    })
    return data
  },

  /** Con `etiquetas` se piden varios números (uno por etiqueta, ej: las fracciones de una subdivisión). */
  async solicitar(expedienteId: string, oficinaId: Oficina, usuarioId: string, etiquetas?: string[]): Promise<SolicitudNumero> {
    const { data } = await api.post<SolicitudNumero>(RUTA, {
      expedienteId,
      oficinaId,
      usuarioId,
      fecha: new Date().toISOString(),
      estado: 'pendiente',
      ...(etiquetas?.length ? { etiquetas } : {}),
    } satisfies Omit<SolicitudNumero, 'id'>)
    return data
  },

  /**
   * Catastro asigna los números. Un pedido simple guarda el número en la solicitud y en
   * el expediente; uno con etiquetas, solo en la solicitud (el trámite los aplica al
   * registrar la resolución). Los números no pueden repetirse ni estar usados.
   * El backend real debería hacerlo en una sola operación.
   */
  async asignar(solicitud: SolicitudNumero, numeros: string[]): Promise<SolicitudNumero> {
    if (numeros.some((n) => !/^\d+$/.test(n))) throw new ApiError('Ingrese solo números de concesión.', 400, 'NUMERO_INVALIDO')
    if (new Set(numeros).size !== numeros.length) throw new ApiError('Hay números de concesión repetidos.', 409, 'NUMERO_REPETIDO')
    const { data: usados } = await api.get<Expediente[]>('/expedientes', { params: filtro({ numeroConcesion: { in: numeros } }) })
    const ajenos = usados.filter((e) => e.id !== solicitud.expedienteId)
    if (ajenos.length) {
      throw new ApiError(`El número de concesión ${ajenos.map((e) => e.numeroConcesion).join(', ')} ya está asignado.`, 409, 'NUMERO_USADO')
    }

    const multiple = !!solicitud.etiquetas?.length
    if (!multiple) await api.patch<Expediente>(`/expedientes/${solicitud.expedienteId}`, { numeroConcesion: numeros[0] })
    const { data } = await api.patch<SolicitudNumero>(`${RUTA}/${solicitud.id}`, {
      estado: 'asignada',
      ...(multiple ? { numerosConcesion: numeros } : { numeroConcesion: numeros[0] }),
      fechaAsignacion: new Date().toISOString(),
    })
    return data
  },

  /** Próximo número sugerido: el mayor número de concesión existente + 1. */
  async proximoNumero(): Promise<string> {
    const { data } = await api.get<Pick<Expediente, 'numeroConcesion'>[]>('/expedientes')
    const max = data.reduce((m, e) => Math.max(m, Number(e.numeroConcesion) || 0), 0)
    return String(max + 1)
  },
}

export const solicitudKeys = {
  all: ['solicitudesNumero'] as const,
  lista: (condiciones: object) => [...solicitudKeys.all, condiciones] as const,
  proximo: () => [...solicitudKeys.all, 'proximo'] as const,
}

export function useSolicitudesNumero(condiciones: { expedienteId?: string; estado?: SolicitudNumero['estado'] } = {}, enabled = true) {
  return useQuery({
    queryKey: solicitudKeys.lista(condiciones),
    queryFn: () => solicitudesNumeroApi.listar(condiciones),
    enabled,
  })
}

export function useProximoNumeroConcesion() {
  return useQuery({ queryKey: solicitudKeys.proximo(), queryFn: solicitudesNumeroApi.proximoNumero })
}

export function useSolicitarNumero() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ expedienteId, oficinaId, usuarioId, etiquetas }: { expedienteId: string; oficinaId: Oficina; usuarioId: string; etiquetas?: string[] }) =>
      solicitudesNumeroApi.solicitar(expedienteId, oficinaId, usuarioId, etiquetas),
    onSuccess: () => qc.invalidateQueries({ queryKey: solicitudKeys.all }),
  })
}

export function useAsignarNumero() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ solicitud, numeros }: { solicitud: SolicitudNumero; numeros: string[] }) => solicitudesNumeroApi.asignar(solicitud, numeros),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: solicitudKeys.all })
      void qc.invalidateQueries({ queryKey: expedienteKeys.all })
    },
  })
}
