// Hooks de datos de la Reubicación (backend real): consultas (useQuery) y acciones (useMutation).
// Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expedienteKeys } from '../shared/circuito/expediente'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'
import { reubicacionApi, type ArchivoPoligono, type FormaServicioDto, type IniciarReubicacionDto } from './api'
import type { ReubicacionBackend } from './backend.types'

export const reubicacionKeys = {
  all: ['backend', 'reubicaciones'] as const,
  checklist: () => [...reubicacionKeys.all, 'checklist'] as const,
  enCurso: () => [...reubicacionKeys.all, 'en-curso'] as const,
  reubicacion: (id: string) => [...reubicacionKeys.all, 'reubicacion', id] as const,
  /** Cuelgan de la reubicación: se refrescan con cada acción del circuito sobre ella. */
  recaudacion: (id: string) => [...reubicacionKeys.reubicacion(id), 'recaudacion'] as const,
  avisoDeuda: (id: string) => [...reubicacionKeys.reubicacion(id), 'aviso-deuda'] as const,
}

// --- Consultas -----------------------------------------------------------------

/** El checklist casi no cambia: se pide una vez por sesión. */
export function useChecklistReubicacion() {
  return useQuery({ queryKey: reubicacionKeys.checklist(), queryFn: reubicacionApi.checklist, staleTime: Infinity })
}

export function useReubicacionesEnCurso() {
  return useQuery({ queryKey: reubicacionKeys.enCurso(), queryFn: () => reubicacionApi.listar() })
}

export function useReubicacion(id: string | undefined) {
  return useQuery({ queryKey: reubicacionKeys.reubicacion(id ?? ''), queryFn: () => reubicacionApi.obtener(id!), enabled: !!id })
}

/** Concesiones de los titulares y si tienen deuda. Cuelga de la reubicación: se refresca con cada acción. */
export function useAntecedentesDeudaReubicacion(id: string) {
  return useQuery({ queryKey: reubicacionKeys.recaudacion(id), queryFn: () => reubicacionApi.antecedentesDeuda(id) })
}

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAvisoReubicacion(id: string, habilitado: boolean) {
  return useQuery({ queryKey: reubicacionKeys.avisoDeuda(id), queryFn: () => reubicacionApi.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}

// --- Refresco después de cada acción ----------------------------------------------

/**
 * Después de actuar sobre una reubicación se refrescan la lista en curso, el historial y las bandejas
 * (claves del alta: son comunes a todos los trámites). La reubicación en sí:
 * - si la acción la devolvió actualizada (Catastro), va directo a la caché;
 * - si no (acciones del circuito), se vuelve a pedir junto con lo que cuelga de ella (recaudación, aviso).
 */
function useRefrescar() {
  const qc = useQueryClient()
  return (id: string, actualizada?: ReubicacionBackend) => {
    if (actualizada) qc.setQueryData(reubicacionKeys.reubicacion(id), actualizada)
    else void qc.invalidateQueries({ queryKey: reubicacionKeys.reubicacion(id) })
    void qc.invalidateQueries({ queryKey: reubicacionKeys.enCurso() })
    void qc.invalidateQueries({ queryKey: expedienteKeys.historial(id) })
    void qc.invalidateQueries({ queryKey: expedienteKeys.bandejas() })
  }
}

/** Catastro: la acción devuelve la reubicación actualizada. */
function useAccionCatastro<TInput, TOutput extends ReubicacionBackend = ReubicacionBackend>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const refrescar = useRefrescar()
  return useMutation<TOutput, Error, TInput>({ mutationFn: (input) => accion(id, input), onSuccess: (r) => refrescar(id, r) })
}

/** Circuito de oficinas: después se vuelve a pedir la reubicación con sus antecedentes. */
function useAccionCircuito<TInput, TOutput>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const refrescar = useRefrescar()
  return useMutation<TOutput, Error, TInput>({ mutationFn: (input) => accion(id, input), onSuccess: () => refrescar(id) })
}

// --- Catastro: inicio, propuesta y envío -------------------------------------------

export function useIniciarReubicacion() {
  const qc = useQueryClient()
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (dto: IniciarReubicacionDto) => reubicacionApi.iniciar(dto),
    onSuccess: (r) => refrescar(r.expediente.id, r),
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: reubicacionKeys.enCurso() }),
  })
}

export const useGuardarPoligonoReubicacion = (id: string) => useAccionCatastro(id, (i, archivo: ArchivoPoligono) => reubicacionApi.guardarPoligono(i, archivo))
export const useGuardarServicioReubicacion = (id: string) => useAccionCatastro(id, (i, dto: FormaServicioDto) => reubicacionApi.guardarServicio(i, dto))
export const useEnviarReubicacion = (id: string) => useAccionCatastro<void>(id, (i) => reubicacionApi.enviar(i))
/** Corrección de lo observado por Jurídico: vuelve a Jurídico. */
export const useReenviarReubicacion = (id: string) => useAccionCatastro<void>(id, (i) => reubicacionApi.reenviar(i))
export const useCancelarReubicacion = (id: string) => useAccionCatastro(id, (i, motivo: string) => reubicacionApi.cancelar(i, motivo))

// --- Circuito: Recaudación, dictámenes, Secretaría General y cierre --------------------

export const useTomarReubicacion = (id: string) => useAccionCircuito<void, unknown>(id, (i) => reubicacionApi.tomar(i))
export const useVerificarDeudaReubicacion = (id: string) => useAccionCircuito(id, reubicacionApi.verificarDeuda)
export const useCursoConDeudaReubicacion = (id: string) => useAccionCircuito(id, reubicacionApi.cursoConDeuda)
export const useNotificarDeudaReubicacion = (id: string) => useAccionCircuito(id, reubicacionApi.notificarDeuda)
/** Distrito (apto / no apto) y Jurídico (apto / observado / no apto). */
export const useDictaminarReubicacion = (id: string, oficina: OficinaDictamen) => useAccionCircuito(id, (i, dto: Dictamen) => reubicacionApi.dictaminar(i, oficina, dto))
/** Secretaría General: registra la resolución con su PDF y pasa a Catastro (cierre). */
export const useResolucionReubicacion = (id: string) => useAccionCircuito(id, reubicacionApi.resolucion)
/** Catastro: cierre (visto bueno final). Lo propuesto rige en la concesión. */
export const useVerificacionFinalReubicacion = (id: string) => useAccionCircuito(id, reubicacionApi.verificacionFinal)
