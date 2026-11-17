// Hooks de datos de la Reducción / Ampliación: las pantallas usan solo estos hooks.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDominio } from '@/hooks/useDominio'
import { expedienteKeys } from '../../expedientes/hooks'
import type { InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import { reduccionAmpliacionApi } from './api'
import type { SuperficieConcesion, TipoModificacion } from './types'

export function useValidarInicioModificacion() {
  const { estadosPendientes } = useDominio()
  return useMutation({ mutationFn: (inicio: InicioSobreConcesionForm) => reduccionAmpliacionApi.validarInicio(inicio, estadosPendientes) })
}

/** Crea el expediente en la siguiente oficina (etapas y usuario salen del dominio). */
export function useIniciarModificacion() {
  const qc = useQueryClient()
  const { etapas, usuarios, estadosPendientes } = useDominio()
  return useMutation({
    mutationFn: (input: { inicio: InicioSobreConcesionForm; tipo: TipoModificacion; propuesta: SuperficieConcesion }) => {
      const [etapaCarga, etapaSiguiente] = etapas
      // TODO(login): usuario autenticado. Mientras tanto, el primer usuario de la oficina.
      const usuario = usuarios.find((u) => u.oficinaId === etapaCarga?.oficinaId)
      if (!etapaCarga || !etapaSiguiente || !usuario) throw new Error('El circuito de oficinas no está configurado en el sistema.')
      return reduccionAmpliacionApi.iniciar({
        ...input,
        estadosPendientes,
        etapaId: etapaCarga.id,
        oficinaOrigen: etapaCarga.oficinaId,
        oficinaDestino: etapaSiguiente.oficinaId,
        usuarioId: usuario.id,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: expedienteKeys.all }),
  })
}
