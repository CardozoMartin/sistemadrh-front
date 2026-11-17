// Hooks de datos del Alta de Concesión (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
//
// Cada acción del circuito devuelve el alta actualizada: se guarda en la caché y se
// refrescan el historial y las bandejas (el expediente cambió de oficina o de estado).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaConcesionApi } from './api'
import type { AltaBackend, OficinaBackend } from './backend.types'

export const altaKeys = {
  all: ['backend', 'altas'] as const,
  situaciones: () => [...altaKeys.all, 'situaciones-legales'] as const,
  alta: (id: string) => [...altaKeys.all, 'alta', id] as const,
  historial: (id: string) => [...altaKeys.all, 'historial', id] as const,
  /** Bajo la clave del historial: se refresca cada vez que se refresca el historial. */
  auditoria: (id: string) => [...altaKeys.historial(id), 'auditoria'] as const,
  emails: (id: string) => [...altaKeys.all, 'emails', id] as const,
  bandejas: () => [...altaKeys.all, 'bandeja'] as const,
  bandeja: (oficina: OficinaBackend) => [...altaKeys.bandejas(), oficina] as const,
  deudas: (personaId: string) => [...altaKeys.all, 'deudas', personaId] as const,
  /** Bajo la clave del alta: se refresca con cada acción sobre el alta. */
  antecedentesDeuda: (id: string) => [...altaKeys.alta(id), 'recaudacion'] as const,
}

// --- Consultas ---------------------------------------------------------------------

export function useSituacionesLegales() {
  return useQuery({ queryKey: altaKeys.situaciones(), queryFn: altaConcesionApi.situacionesLegales, staleTime: Infinity })
}

export function useAlta(id: string | undefined) {
  return useQuery({ queryKey: altaKeys.alta(id ?? ''), queryFn: () => altaConcesionApi.obtener(id!), enabled: !!id })
}

export function useHistorial(id: string | undefined) {
  return useQuery({ queryKey: altaKeys.historial(id ?? ''), queryFn: () => altaConcesionApi.historial(id!), enabled: !!id })
}

export function useAuditoria(id: string | undefined) {
  return useQuery({ queryKey: altaKeys.auditoria(id ?? ''), queryFn: () => altaConcesionApi.auditoria(id!), enabled: !!id })
}

/** Bandeja de una oficina; se refresca sola cada 30 s (hasta que haya eventos en vivo del backend). */
export function useBandeja(oficina: OficinaBackend) {
  return useQuery({ queryKey: altaKeys.bandeja(oficina), queryFn: () => altaConcesionApi.bandeja(oficina), refetchInterval: 30_000 })
}

export function useDeudas(personaId: string | undefined) {
  return useQuery({ queryKey: altaKeys.deudas(personaId ?? ''), queryFn: () => altaConcesionApi.deudas(personaId!), enabled: !!personaId })
}

// --- Acciones ----------------------------------------------------------------------

/** Después de cualquier acción: el alta nueva a la caché y el resto, a refrescar. */
function useAlActualizar(id: string) {
  const qc = useQueryClient()
  return (alta?: AltaBackend) => {
    if (alta) qc.setQueryData(altaKeys.alta(id), alta)
    else void qc.invalidateQueries({ queryKey: altaKeys.alta(id), exact: true })
    void qc.invalidateQueries({ queryKey: altaKeys.antecedentesDeuda(id) })
    void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
    void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
  }
}

/** Concesiones otorgadas de los titulares del alta y si tienen deuda (pantalla de Recaudación). */
export function useAntecedentesDeuda(id: string) {
  return useQuery({ queryKey: altaKeys.antecedentesDeuda(id), queryFn: () => altaConcesionApi.antecedentesDeuda(id) })
}

/** Consulta si el número de expediente está libre (no se cachea: puede cambiar en cualquier momento). */
export function useVerificarExpediente() {
  return useMutation({ mutationFn: altaConcesionApi.disponibilidad })
}

export function useIniciarAlta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: altaConcesionApi.iniciar,
    onSuccess: (alta) => {
      qc.setQueryData(altaKeys.alta(alta.id), alta)
      // El alta nueva queda en la bandeja de Catastro (en carga).
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

/** Acción genérica sobre un alta: recibe la llamada a la API y actualiza la caché al terminar. */
export function useAccionAlta<TInput, TOutput = unknown>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const alActualizar = useAlActualizar(id)
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input: TInput) => accion(id, input),
    // Las acciones del alta devuelven el alta actualizada (con «circuito»); tomar devuelve otra cosa.
    onSuccess: (respuesta) => alActualizar(respuesta && typeof respuesta === 'object' && 'circuito' in respuesta ? (respuesta as unknown as AltaBackend) : undefined),
  })
}

/**
 * Enviar (CARGA → Recaudación) o reenviar (CORRECCION → la oficina que observó) desde la carga.
 * Catastro deja de tener el expediente: primero se sale de la pantalla (`alDerivar`) y recién
 * después se actualiza la caché, para que la carga no se reemplace por «el expediente está en …».
 */
export function useDerivarCarga(id: string, alDerivar: (alta: AltaBackend) => void) {
  const alActualizar = useAlActualizar(id)
  return useMutation<AltaBackend, Error, { corregido: boolean }>({
    mutationFn: ({ corregido }) => (corregido ? altaConcesionApi.reenviar(id, 'Observaciones corregidas.') : altaConcesionApi.enviar(id)),
    onSuccess: (alta) => {
      alDerivar(alta)
      alActualizar(alta)
    },
  })
}

/** Tomar desde la bandeja (el expediente que se toma va en la llamada). */
export function useTomarDeBandeja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => altaConcesionApi.tomar(id),
    onSuccess: (_r, id) => {
      void qc.invalidateQueries({ queryKey: altaKeys.alta(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

/** Cancelar desde la bandeja un alta iniciada por error (el expediente y el motivo van en la llamada). */
export function useCancelarAlta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, observaciones }: { id: string; observaciones: string }) => altaConcesionApi.cancelar(id, observaciones),
    onSuccess: (alta) => {
      qc.setQueryData(altaKeys.alta(alta.id), alta)
      void qc.invalidateQueries({ queryKey: altaKeys.historial(alta.id) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

export function useTomar(id: string) {
  return useAccionAlta<void>(id, (i) => altaConcesionApi.tomar(i))
}

export function useCancelarDeuda(id: string) {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar(id)
  return useMutation({
    mutationFn: ({ deudaId, comprobante }: { deudaId: string; comprobante?: string }) => altaConcesionApi.cancelarDeuda(deudaId, comprobante),
    onSuccess: () => {
      alActualizar()
      void qc.invalidateQueries({ queryKey: [...altaKeys.all, 'deudas'] })
    },
  })
}

/** Correos que se mandaron por el expediente (avisos de deuda, etc.). */
export function useEmails(id: string) {
  return useQuery({ queryKey: altaKeys.emails(id), queryFn: () => altaConcesionApi.emails(id) })
}

/** Recaudación avisa la deuda por correo a los titulares: queda en el historial y en la lista de correos. */
export function useNotificarDeuda(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (observaciones?: string) => altaConcesionApi.notificarDeuda(id, observaciones),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: altaKeys.emails(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
    },
  })
}
