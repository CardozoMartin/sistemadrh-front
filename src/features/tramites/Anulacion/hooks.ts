// Hooks de datos de la Anulación de Concesión (backend real): consultas (useQuery) y acciones
// (useMutation). Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaKeys } from '../AltaDeConcesion/hooks'
import { anulacionApi, type IniciarAnulacionDto } from './api'
import type { AnulacionBackend } from './backend.types'

export const anulacionKeys = {
  all: ['backend', 'anulaciones'] as const,
  checklist: () => [...anulacionKeys.all, 'checklist'] as const,
  enCurso: () => [...anulacionKeys.all, 'en-curso'] as const,
  anulacion: (id: string) => [...anulacionKeys.all, 'anulacion', id] as const,
}

// --- Consultas -----------------------------------------------------------------

/** El checklist casi no cambia: se pide una vez por sesión. */
export function useChecklistAnulacion() {
  return useQuery({ queryKey: anulacionKeys.checklist(), queryFn: anulacionApi.checklist, staleTime: Infinity })
}

export function useAnulacionesEnCurso() {
  return useQuery({ queryKey: anulacionKeys.enCurso(), queryFn: () => anulacionApi.listar() })
}

export function useAnulacion(id: string | undefined) {
  return useQuery({ queryKey: anulacionKeys.anulacion(id ?? ''), queryFn: () => anulacionApi.obtener(id!), enabled: !!id })
}

// --- Acciones --------------------------------------------------------------------

/** Después de cada acción: la anulación actualizada a la caché; la lista y las bandejas, a refrescar. */
function useAlActualizar() {
  const qc = useQueryClient()
  return (anulacion: AnulacionBackend) => {
    qc.setQueryData(anulacionKeys.anulacion(anulacion.expediente.id), anulacion)
    void qc.invalidateQueries({ queryKey: anulacionKeys.enCurso() })
    void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
  }
}

export function useIniciarAnulacion() {
  const qc = useQueryClient()
  const alActualizar = useAlActualizar()
  return useMutation({
    mutationFn: (dto: IniciarAnulacionDto) => anulacionApi.iniciar(dto),
    onSuccess: alActualizar,
    // Aun si falla (ej: se cortó la respuesta), la lista se refresca: puede haberse creado igual.
    onError: () => void qc.invalidateQueries({ queryKey: anulacionKeys.enCurso() }),
  })
}

export function useEnviarAnulacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: () => anulacionApi.enviar(id), onSuccess: alActualizar })
}

export function useCancelarAnulacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (motivo: string) => anulacionApi.cancelar(id, motivo), onSuccess: alActualizar })
}

// --- Circuito y Recaudación ------------------------------------------------------

/** Concesiones de los titulares y si tienen deuda. Cuelga de la anulación: se refresca con cada acción. */
export function useAntecedentesDeudaAnulacion(id: string) {
  return useQuery({ queryKey: [...anulacionKeys.anulacion(id), 'recaudacion'], queryFn: () => anulacionApi.antecedentesDeuda(id) })
}

/** Borrador del aviso de deuda: se pide al abrirlo y no se cachea (las deudas pueden cambiar). */
export function useBorradorAvisoAnulacion(id: string, habilitado: boolean) {
  return useQuery({ queryKey: [...anulacionKeys.anulacion(id), 'aviso-deuda'], queryFn: () => anulacionApi.borradorAvisoDeuda(id), enabled: habilitado, staleTime: 0, gcTime: 0 })
}

/** Una acción del circuito: después se refrescan la anulación, sus antecedentes, el historial y las bandejas. */
function useAccionAnulacion<TInput, TOutput>(id: string, accion: (id: string, input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  return useMutation<TOutput, Error, TInput>({
    mutationFn: (input) => accion(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: anulacionKeys.anulacion(id) })
      void qc.invalidateQueries({ queryKey: anulacionKeys.enCurso() })
      // Historial y bandejas de oficina (claves del alta: son comunes a todos los trámites).
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
      void qc.invalidateQueries({ queryKey: altaKeys.bandejas() })
    },
  })
}

export const useTomarAnulacion = (id: string) => useAccionAnulacion<void, unknown>(id, (i) => anulacionApi.tomar(i))
export const useVerificarDeudaAnulacion = (id: string) => useAccionAnulacion(id, anulacionApi.verificarDeuda)
export const useCursoConDeudaAnulacion = (id: string) => useAccionAnulacion(id, anulacionApi.cursoConDeuda)
export const useNotificarDeudaAnulacion = (id: string) => useAccionAnulacion(id, anulacionApi.notificarDeuda)
