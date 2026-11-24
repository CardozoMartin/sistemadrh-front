// Hooks de datos de la Reubicación (backend real): consultas (useQuery) y acciones (useMutation).
// Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaKeys } from '../AltaDeConcesion/hooks'
import { reubicacionApi, type ArchivoPoligono, type FormaServicioDto, type IniciarReubicacionDto } from './api'
import type { ReubicacionBackend } from './backend.types'
import type { Dictamen, OficinaDictamen } from '../shared/circuito/PanelDictamen'

export const reubicacionKeys = {
  all: ['backend', 'reubicaciones'] as const,
  checklist: () => [...reubicacionKeys.all, 'checklist'] as const,
  enCurso: () => [...reubicacionKeys.all, 'en-curso'] as const,
  reubicacion: (id: string) => [...reubicacionKeys.all, 'reubicacion', id] as const,
  /** Cuelgan de la reubicación: se refrescan con cada acción sobre ella. */
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

// --- Acciones --------------------------------------------------------------------

/** Después de cada acción: la reubicación actualizada a la caché; la lista y las bandejas, a refrescar. */
function useAlActualizar() {
  const qc = useQueryClient()
  return (reubicacion: ReubicacionBackend) => {
    qc.setQueryData(reubicacionKeys.reubicacion(reubicacion.expediente.id), reubicacion)
    void qc.invalidateQueries({ queryKey: reubicacionKeys.enCurso() })
    void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
  }
}

export function useIniciarReubicacion() {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: (dto: IniciarReubicacionDto) => reubicacionApi.iniciar(dto),
    onSuccess: alActualizar,
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: reubicacionKeys.enCurso() }),
  })
}

export function useGuardarPoligonoReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (archivo: ArchivoPoligono) => reubicacionApi.guardarPoligono(id, archivo), onSuccess: alActualizar })
}

export function useGuardarServicioReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (dto: FormaServicioDto) => reubicacionApi.guardarServicio(id, dto), onSuccess: alActualizar })
}

export function useEnviarReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: () => reubicacionApi.enviar(id), onSuccess: alActualizar })
}

export function useReenviarReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: () => reubicacionApi.reenviar(id), onSuccess: alActualizar })
}

export function useCancelarReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (motivo: string) => reubicacionApi.cancelar(id, motivo), onSuccess: alActualizar })
}

// --- Circuito y Recaudación ------------------------------------------------------

/** Concesiones de los titulares y si tienen deuda. Cuelga de la reubicación: se refresca con cada acción. */
export function useAntecedentesDeudaReubicacion(id: string) {
  return useQuery({ queryKey: reubicacionKeys.recaudacion(id), queryFn: () => reubicacionApi.antecedentesDeuda(id) })
}

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAvisoReubicacion(id: string, habilitado: boolean) {
  return useQuery({ queryKey: reubicacionKeys.avisoDeuda(id), queryFn: () => reubicacionApi.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}

/** Una acción del circuito: después se refrescan la reubicación, sus antecedentes, el historial y las bandejas. */
function useAccionReubicacion<TInput, TOutput>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input) => accion(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reubicacionKeys.reubicacion(id) })
      void qc.invalidateQueries({ queryKey: reubicacionKeys.enCurso() })
      // Historial y bandejas de oficina (claves del alta: son comunes a todos los trámites).
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

export const useTomarReubicacion = (id: string) => useAccionReubicacion<void, unknown>(id, (i) => reubicacionApi.tomar(i))
export const useVerificarDeudaReubicacion = (id: string) => useAccionReubicacion(id, reubicacionApi.verificarDeuda)
export const useCursoConDeudaReubicacion = (id: string) => useAccionReubicacion(id, reubicacionApi.cursoConDeuda)
export const useNotificarDeudaReubicacion = (id: string) => useAccionReubicacion(id, reubicacionApi.notificarDeuda)
export const useDictaminarReubicacion = (id: string, oficina: OficinaDictamen) =>
  useAccionReubicacion(id, (i, dto: Dictamen) => reubicacionApi.dictaminar(i, oficina, dto))
