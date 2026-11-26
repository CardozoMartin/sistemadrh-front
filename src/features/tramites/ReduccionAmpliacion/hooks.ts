// Hooks de datos de la Ampliación / Reducción (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { titularesADto } from '../AltaDeConcesion/adaptadores'
import { expedienteKeys } from '../shared/circuito/expediente'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'
import type { HooksRecaudacion } from '../shared/circuito/PanelRecaudacion'
import { modificacionApi, type IniciarModificacionDto } from './api'
import type { ModificacionBackend } from './backend.types'
import type { TitularesForm } from './schemas'

export const modificacionKeys = {
  all: ['backend', 'modificacionesSuperficie'] as const,
  checklist: () => [...modificacionKeys.all, 'checklist'] as const,
  enCurso: () => [...modificacionKeys.all, 'en-curso'] as const,
  detalle: (id: string) => [...modificacionKeys.all, 'detalle', id] as const,
  /** Cuelgan del trámite: se refrescan con cada acción del circuito sobre él. */
  recaudacion: (id: string) => [...modificacionKeys.detalle(id), 'recaudacion'] as const,
  avisoDeuda: (id: string) => [...modificacionKeys.detalle(id), 'aviso-deuda'] as const,
}

// --- Consultas -----------------------------------------------------------------

/** El checklist casi no cambia: se pide una vez por sesión. */
export function useChecklistModificacion() {
  return useQuery({ queryKey: modificacionKeys.checklist(), queryFn: modificacionApi.checklist, staleTime: Infinity })
}

export function useModificacionesEnCurso() {
  return useQuery({ queryKey: modificacionKeys.enCurso(), queryFn: () => modificacionApi.listar() })
}

export function useModificacion(id: string | undefined) {
  return useQuery({ queryKey: modificacionKeys.detalle(id ?? ''), queryFn: () => modificacionApi.obtener(id!), enabled: !!id })
}

/** Concesiones de los titulares y si tienen deuda. Cuelga del trámite: se refresca con cada acción. */
export function useAntecedentesDeudaModificacion(id: string) {
  return useQuery({ queryKey: modificacionKeys.recaudacion(id), queryFn: () => modificacionApi.antecedentesDeuda(id) })
}

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAvisoModificacion(id: string, habilitado: boolean) {
  return useQuery({ queryKey: modificacionKeys.avisoDeuda(id), queryFn: () => modificacionApi.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}

// --- Refresco después de cada acción ----------------------------------------------

/**
 * Después de actuar se refrescan la lista en curso, el historial y las bandejas (claves comunes a
 * todos los trámites). El trámite en sí:
 * - si la acción lo devolvió actualizado (Catastro), va directo a la caché;
 * - si no (acciones del circuito), se vuelve a pedir junto con lo que cuelga de él (recaudación, aviso).
 */
function useRefrescar() {
  const qc = useQueryClient()
  return (id: string, actualizado?: ModificacionBackend) => {
    if (actualizado) qc.setQueryData(modificacionKeys.detalle(id), actualizado)
    else void qc.invalidateQueries({ queryKey: modificacionKeys.detalle(id) })
    void qc.invalidateQueries({ queryKey: modificacionKeys.enCurso() })
    void qc.invalidateQueries({ queryKey: expedienteKeys.historial(id) })
    void qc.invalidateQueries({ queryKey: expedienteKeys.bandejas() })
  }
}

/** Catastro: la acción devuelve el trámite actualizado. */
function useAccionCatastro<TInput, TOutput extends ModificacionBackend = ModificacionBackend>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const refrescar = useRefrescar()
  return useMutation<TOutput, Error, TInput>({ mutationFn: (input) => accion(id, input), onSuccess: (m) => refrescar(id, m) })
}

/** Circuito de oficinas: después se vuelve a pedir el trámite con sus antecedentes. */
function useAccionCircuito<TInput, TOutput>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const refrescar = useRefrescar()
  return useMutation<TOutput, Error, TInput>({ mutationFn: (input) => accion(id, input), onSuccess: () => refrescar(id) })
}

// --- Catastro: inicio, carga y envío ------------------------------------------------

export function useIniciarModificacion() {
  const qc = useQueryClient()
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (dto: IniciarModificacionDto) => modificacionApi.iniciar(dto),
    onSuccess: (m) => refrescar(m.expediente.id, m),
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: modificacionKeys.enCurso() }),
  })
}

export const useSubirPlano = (id: string) => useAccionCatastro(id, (i, archivo: File) => modificacionApi.subirPlano(i, archivo))
export const useGuardarTitulares = (id: string) => useAccionCatastro(id, (i, datos: TitularesForm) => modificacionApi.guardarTitulares(i, titularesADto(datos.titulares, datos.domicilios)))
export const useQuitarTitulares = (id: string) => useAccionCatastro<void>(id, (i) => modificacionApi.quitarTitulares(i))
/** Iniciado por error: queda anulado (motivo obligatorio, 10 caracteres o más). */
export const useCancelarModificacion = (id: string) => useAccionCatastro(id, (i, motivo: string) => modificacionApi.cancelar(i, motivo))
/** Termina la carga: la primera vez la envía a Recaudación; si estaba corrigiendo lo observado, la reenvía a quien observó. */
export const useEnviarModificacion = (id: string) =>
  useAccionCatastro(id, (i, { reenvio, observaciones }: { reenvio: boolean; observaciones?: string }) =>
    reenvio ? modificacionApi.reenviar(i, observaciones) : modificacionApi.enviar(i, observaciones),
  )

// --- Circuito: Recaudación, dictámenes, Secretaría General y cierre --------------------

export const useTomarModificacion = (id: string) => useAccionCircuito<void, unknown>(id, (i) => modificacionApi.tomar(i))
export const useVerificarDeudaModificacion = (id: string) => useAccionCircuito(id, modificacionApi.verificarDeuda)
export const useNotificarDeudaModificacion = (id: string) => useAccionCircuito(id, modificacionApi.notificarDeuda)
/** Distrito y Jurídico: apto / observado (vuelve a Catastro) / no apto. */
export const useDictaminarModificacion = (id: string, oficina: OficinaDictamen) => useAccionCircuito(id, (i, dto: Dictamen) => modificacionApi.dictaminar(i, oficina, dto))
/** Secretaría General: registra la resolución con su PDF y pasa a Catastro (verificación final). */
export const useResolucionModificacion = (id: string) => useAccionCircuito(id, modificacionApi.resolucion)
/** Catastro: verificación final con el caudal asignado de la resolución. La concesión cambia de superficie. */
export const useVerificacionFinalModificacion = (id: string) => useAccionCircuito(id, modificacionApi.verificacionFinal)

/** Recaudación con los paneles comunes. Sin «dar curso con deuda»: con deuda este trámite no avanza. */
export const HOOKS_RECAUDACION_MODIFICACION: HooksRecaudacion = {
  useAntecedentes: useAntecedentesDeudaModificacion,
  useVerificar: useVerificarDeudaModificacion,
  useBorradorAviso: useBorradorAvisoModificacion,
  useNotificar: useNotificarDeudaModificacion,
}
