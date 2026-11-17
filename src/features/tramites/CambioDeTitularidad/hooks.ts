// Hooks de datos del Cambio de Titularidad: consultas (useQuery) y acciones (useMutation).
// Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Concesion } from '@/features/concesiones/datos'
import { useDominio } from '@/hooks/useDominio'
import { expedienteKeys } from '../../expedientes/hooks'
import { cambioTitularidadApi } from './api'
import type { InicioCambioForm, NuevoTitularForm } from './schemas'
import type { BorradorCambioTitularidad } from './types'

export const cambioKeys = {
  all: ['cambiosTitularidad'] as const,
  borradores: () => [...cambioKeys.all, 'borradores'] as const,
  borrador: (id: string) => [...cambioKeys.all, 'borrador', id] as const,
}

// --- Consultas -----------------------------------------------------------------

export function useBorradoresCambio() {
  return useQuery({ queryKey: cambioKeys.borradores(), queryFn: cambioTitularidadApi.listarBorradores })
}

export function useBorradorCambio(id: string | undefined) {
  return useQuery({
    queryKey: cambioKeys.borrador(id ?? ''),
    queryFn: () => cambioTitularidadApi.obtenerBorrador(id!),
    enabled: !!id,
    // El formulario se inicializa una sola vez con estos datos: no refrescar por detrás.
    staleTime: Infinity,
  })
}

// --- Acciones --------------------------------------------------------------------

export function useIniciarCambio() {
  const qc = useQueryClient()
  const { estadosPendientes } = useDominio()
  return useMutation({
    mutationFn: (form: InicioCambioForm) => cambioTitularidadApi.iniciar({ form, estadosPendientes }),
    onSuccess: (borrador) => {
      qc.setQueryData(cambioKeys.borrador(borrador.id), borrador)
      void qc.invalidateQueries({ queryKey: cambioKeys.borradores() })
    },
  })
}

export function useGuardarDatosCambio(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevoTitularForm) => cambioTitularidadApi.guardarDatos(id, datos),
    onSuccess: (borrador) => {
      qc.setQueryData(cambioKeys.borrador(id), borrador)
      void qc.invalidateQueries({ queryKey: cambioKeys.borradores() })
    },
  })
}

// Al eliminar/enviar no se toca la caché del detalle: la pantalla que lo muestra
// navega a otro lado, y si se refrescara antes mostraría "no encontrado".

export function useEliminarBorradorCambio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cambioTitularidadApi.eliminarBorrador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cambioKeys.borradores() }),
  })
}

/** Envía el cambio a la siguiente oficina del circuito (etapas y usuario salen del dominio). */
export function useEnviarCambio() {
  const qc = useQueryClient()
  const { etapas, usuarios } = useDominio()
  return useMutation({
    mutationFn: ({ borrador, datos, concesion }: { borrador: BorradorCambioTitularidad; datos: NuevoTitularForm; concesion: Concesion }) => {
      const [etapaCarga, etapaSiguiente] = etapas
      // TODO(login): usuario autenticado. Mientras tanto, el primer usuario de la oficina.
      const usuario = usuarios.find((u) => u.oficinaId === etapaCarga?.oficinaId)
      if (!etapaCarga || !etapaSiguiente || !usuario) throw new Error('El circuito de oficinas no está configurado en el sistema.')
      return cambioTitularidadApi.enviar({
        borrador,
        datos,
        concesion,
        etapaId: etapaCarga.id,
        oficinaOrigen: etapaCarga.oficinaId,
        oficinaDestino: etapaSiguiente.oficinaId,
        usuarioId: usuario.id,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cambioKeys.borradores() })
      void qc.invalidateQueries({ queryKey: expedienteKeys.all })
    },
  })
}
