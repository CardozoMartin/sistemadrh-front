// Hooks de datos de la Reubicación (backend real): consultas (useQuery) y acciones (useMutation).
// Las pantallas usan solo estos hooks; nunca llaman a la API directamente.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaKeys } from '../AltaDeConcesion/hooks'
import { reubicacionApi, type ArchivoPoligono, type FormaServicioDto, type IniciarReubicacionDto } from './api'
import type { ReubicacionBackend } from './backend.types'

export const reubicacionKeys = {
  all: ['backend', 'reubicaciones'] as const,
  checklist: () => [...reubicacionKeys.all, 'checklist'] as const,
  enCurso: () => [...reubicacionKeys.all, 'en-curso'] as const,
  reubicacion: (id: string) => [...reubicacionKeys.all, 'reubicacion', id] as const,
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

export function useCancelarReubicacion(id: string) {
  const alActualizar = useAlActualizar()
  return useMutation({ mutationFn: (motivo: string) => reubicacionApi.cancelar(id, motivo), onSuccess: alActualizar })
}
