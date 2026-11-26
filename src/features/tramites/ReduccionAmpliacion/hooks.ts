// Hooks de datos de la Ampliación / Reducción (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks (y los del circuito compartido).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { titularesADto } from '../AltaDeConcesion/adaptadores'
import { altaKeys } from '../AltaDeConcesion/hooks'
import type { Circuito } from '../shared/circuitoBackend/contexto'
import type { ModificacionBackend } from './backend.types'
import { circuitoModificacionApi, modificacionApi, type IniciarModificacionDto } from './api'
import type { TitularesForm } from './schemas'

export const modificacionKeys = {
  all: ['backend', 'modificacionesSuperficie'] as const,
  enCurso: () => [...modificacionKeys.all, 'en-curso'] as const,
  detalle: (id: string) => [...modificacionKeys.all, 'detalle', id] as const,
}

/** El trámite para los paneles comunes de las oficinas (<CircuitoProvider>). */
export const CIRCUITO_MODIFICACION: Circuito = {
  api: circuitoModificacionApi,
  claveDetalle: modificacionKeys.detalle,
  claveLista: modificacionKeys.enCurso(),
  tipoTramite: 'AMPLIACION_REDUCCION',
  textos: { tramite: 'la ampliación / reducción', alRechazar: 'la concesión sigue igual, con su superficie', rolActual: 'Titular actual', rolNuevo: 'Nuevo titular' },
}

// --- Consultas -----------------------------------------------------------------

export function useModificacionesEnCurso() {
  return useQuery({ queryKey: modificacionKeys.enCurso(), queryFn: () => modificacionApi.listar() })
}

export function useModificacion(id: string | undefined) {
  return useQuery({ queryKey: modificacionKeys.detalle(id ?? ''), queryFn: () => modificacionApi.obtener(id!), enabled: !!id })
}

// --- Acciones de Catastro ------------------------------------------------------

/** Después de cada acción: el trámite actualizado a la caché; la lista, el historial y las bandejas, a refrescar. */
function useAlActualizar() {
  const qc = useQueryClient()
  return (m: ModificacionBackend) => {
    qc.setQueryData(modificacionKeys.detalle(m.expediente.id), m)
    void qc.invalidateQueries({ queryKey: modificacionKeys.enCurso() })
    void qc.invalidateQueries({ queryKey: altaKeys.historial(m.expediente.id) })
    void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
  }
}

export function useIniciarModificacion() {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: (dto: IniciarModificacionDto) => modificacionApi.iniciar(dto),
    onSuccess: alActualizar,
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: modificacionKeys.enCurso() }),
  })
}

export function useSubirPlano(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (archivo: File) => modificacionApi.subirPlano(id, archivo), onSuccess: alActualizar })
}

export function useGuardarTitulares(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (datos: TitularesForm) => modificacionApi.guardarTitulares(id, titularesADto(datos.titulares, datos.domicilios)), onSuccess: alActualizar })
}

export function useQuitarTitulares(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: () => modificacionApi.quitarTitulares(id), onSuccess: alActualizar })
}

/** Iniciado por error: queda anulado (motivo obligatorio, 10 caracteres o más). */
export function useCancelarModificacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: async (motivo: string) => (await circuitoModificacionApi.cancelar(id, motivo)) as ModificacionBackend, onSuccess: alActualizar })
}

/** Termina la carga: la primera vez la envía a Recaudación; si estaba corrigiendo lo observado, la reenvía a quien observó. */
export function useEnviarModificacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: async ({ reenvio, observaciones }: { reenvio: boolean; observaciones?: string }) =>
      (await (reenvio ? circuitoModificacionApi.reenviar(id, observaciones) : circuitoModificacionApi.enviar(id, observaciones))) as ModificacionBackend,
    onSuccess: alActualizar,
  })
}
