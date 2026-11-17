// Hooks de datos de la Subdivisión: las pantallas usan solo estos hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDominio } from '@/hooks/useDominio'
import { expedienteKeys } from '../../expedientes/hooks'
import type { InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import { subdivisionApi } from './api'
import type { BorradorSubdivision, FraccionSubdivision } from './types'

export const subdivisionKeys = {
  all: ['subdivisiones'] as const,
  borradores: () => [...subdivisionKeys.all, 'borradores'] as const,
  borrador: (id: string) => [...subdivisionKeys.all, 'borrador', id] as const,
}

// --- Consultas -----------------------------------------------------------------

export function useBorradoresSubdivision() {
  return useQuery({ queryKey: subdivisionKeys.borradores(), queryFn: subdivisionApi.listarBorradores })
}

export function useBorradorSubdivision(id: string | undefined) {
  return useQuery({
    queryKey: subdivisionKeys.borrador(id ?? ''),
    queryFn: () => subdivisionApi.obtenerBorrador(id!),
    enabled: !!id,
    // Los formularios se inicializan con estos datos: no refrescar por detrás.
    staleTime: Infinity,
  })
}

// --- Acciones --------------------------------------------------------------------

export function useIniciarSubdivision() {
  const qc = useQueryClient()
  const { estadosPendientes } = useDominio()
  return useMutation({
    mutationFn: (form: InicioSobreConcesionForm) => subdivisionApi.iniciar(form, estadosPendientes),
    onSuccess: (borrador) => {
      qc.setQueryData(subdivisionKeys.borrador(borrador.id), borrador)
      void qc.invalidateQueries({ queryKey: subdivisionKeys.borradores() })
    },
  })
}

export function useGuardarFracciones(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fracciones: FraccionSubdivision[]) => subdivisionApi.guardarFracciones(id, fracciones),
    onSuccess: (borrador) => {
      qc.setQueryData(subdivisionKeys.borrador(id), borrador)
      void qc.invalidateQueries({ queryKey: subdivisionKeys.borradores() })
    },
  })
}

// Al eliminar/enviar no se toca la caché del detalle: la pantalla navega a otro lado.

export function useEliminarBorradorSubdivision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => subdivisionApi.eliminarBorrador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: subdivisionKeys.borradores() }),
  })
}

/** Envía la subdivisión a la siguiente oficina del circuito (etapas y usuario salen del dominio). */
export function useEnviarSubdivision() {
  const qc = useQueryClient()
  const { etapas, usuarios, estadosPendientes } = useDominio()
  return useMutation({
    mutationFn: (borrador: BorradorSubdivision) => {
      const [etapaCarga, etapaSiguiente] = etapas
      // TODO(login): usuario autenticado. Mientras tanto, el primer usuario de la oficina.
      const usuario = usuarios.find((u) => u.oficinaId === etapaCarga?.oficinaId)
      if (!etapaCarga || !etapaSiguiente || !usuario) throw new Error('El circuito de oficinas no está configurado en el sistema.')
      return subdivisionApi.enviar({
        borrador,
        estadosPendientes,
        etapaId: etapaCarga.id,
        oficinaOrigen: etapaCarga.oficinaId,
        oficinaDestino: etapaSiguiente.oficinaId,
        usuarioId: usuario.id,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subdivisionKeys.borradores() })
      void qc.invalidateQueries({ queryKey: expedienteKeys.all })
    },
  })
}
