// Hooks de datos de la Anulación: las pantallas usan solo estos hooks.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDominio } from '@/hooks/useDominio'
import { expedienteKeys } from '../../expedientes/hooks'
import type { InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import { anulacionApi } from './api'
import type { VerificacionAnulacionForm } from './schemas'

export function useValidarInicioAnulacion() {
  const { estadosPendientes } = useDominio()
  return useMutation({ mutationFn: (inicio: InicioSobreConcesionForm) => anulacionApi.validarInicio(inicio, estadosPendientes) })
}

/** Crea el expediente de anulación en la siguiente oficina (etapas y usuario salen del dominio). */
export function useIniciarAnulacion() {
  const qc = useQueryClient()
  const { etapas, usuarios, estadosPendientes } = useDominio()
  return useMutation({
    mutationFn: ({ inicio, verificacion }: { inicio: InicioSobreConcesionForm; verificacion: VerificacionAnulacionForm }) => {
      const [etapaCarga, etapaSiguiente] = etapas
      // TODO(login): usuario autenticado. Mientras tanto, el primer usuario de la oficina.
      const usuario = usuarios.find((u) => u.oficinaId === etapaCarga?.oficinaId)
      if (!etapaCarga || !etapaSiguiente || !usuario) throw new Error('El circuito de oficinas no está configurado en el sistema.')
      return anulacionApi.iniciar({
        inicio,
        verificacion,
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
