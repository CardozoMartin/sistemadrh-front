// Caché de la Baja de Pozo (TanStack Query). Después de cada acción se actualiza la baja y se
// refrescan el historial, las listas, los avisos a Distrito y la búsqueda de pozos.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { altaKeys } from '@/features/tramites/AltaDeConcesion/hooks'
import { bajaPozoApi } from './api'
import type { BajaBackend, BajaDeOficioDto } from './types'

export const bajaPozoKeys = {
  all: ['backend', 'bajas-pozo'] as const,
  listas: () => [...bajaPozoKeys.all, 'lista'] as const,
  lista: (todas: boolean) => [...bajaPozoKeys.listas(), todas] as const,
  baja: (id: string) => [...bajaPozoKeys.all, 'baja', id] as const,
  documentos: () => [...bajaPozoKeys.all, 'documentos'] as const,
  avisos: () => [...bajaPozoKeys.all, 'avisos-distrito'] as const,
  pozos: (q: string) => ['backend', 'pozos', q] as const,
  pozo: (id: string) => ['backend', 'pozos', 'ficha', id] as const,
}

export function useBajasPozo(todas = false) {
  return useQuery({ queryKey: bajaPozoKeys.lista(todas), queryFn: () => bajaPozoApi.listar(todas), refetchInterval: 30_000 })
}

export function useBajaPozo(id: string | undefined) {
  return useQuery({ queryKey: bajaPozoKeys.baja(id ?? ''), queryFn: () => bajaPozoApi.obtener(id!), enabled: !!id })
}

/** Checklist de la mesa de entrada: cambia muy poco. */
export function useDocumentosBaja() {
  return useQuery({ queryKey: bajaPozoKeys.documentos(), queryFn: bajaPozoApi.documentos, staleTime: Infinity })
}

/** Búsqueda de pozos: conserva los resultados anteriores mientras se escribe. */
export function useBuscarPozos(q: string) {
  return useQuery({ queryKey: bajaPozoKeys.pozos(q), queryFn: () => bajaPozoApi.buscarPozos(q), placeholderData: keepPreviousData })
}

export function usePozo(id: string | undefined) {
  return useQuery({ queryKey: bajaPozoKeys.pozo(id ?? ''), queryFn: () => bajaPozoApi.obtenerPozo(id!), enabled: !!id })
}

/** Avisos de bajas para que Distrito tome conocimiento; se refrescan cada 30 s. */
export function useAvisosDistrito(todos = false) {
  return useQuery({ queryKey: [...bajaPozoKeys.avisos(), todos], queryFn: () => bajaPozoApi.avisosDistrito(todos), refetchInterval: 30_000 })
}

/** Lo que cambia cuando se da de baja un pozo: búsqueda, fichas, listas y avisos. */
function useRefrescarPozos() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: bajaPozoKeys.listas() })
    void qc.invalidateQueries({ queryKey: bajaPozoKeys.avisos() })
    void qc.invalidateQueries({ queryKey: ['backend', 'pozos'] })
  }
}

export function useTomarConocimiento() {
  const refrescar = useRefrescarPozos()
  return useMutation({ mutationFn: bajaPozoApi.tomarConocimiento, onSuccess: refrescar })
}

export function useIniciarBaja() {
  const qc = useQueryClient()
  const refrescar = useRefrescarPozos()
  return useMutation({
    mutationFn: bajaPozoApi.iniciar,
    onSuccess: (baja) => {
      qc.setQueryData(bajaPozoKeys.baja(baja.expediente.id), baja)
      refrescar()
    },
  })
}

/** Baja de oficio de un pozo: actualiza su ficha y refresca la búsqueda, las listas y los avisos. */
export function useBajaDeOficio(pozoId: string) {
  const qc = useQueryClient()
  const refrescar = useRefrescarPozos()
  return useMutation({
    mutationFn: (dto: BajaDeOficioDto) => bajaPozoApi.darDeBajaDeOficio(pozoId, dto),
    onSuccess: (pozo) => {
      refrescar()
      qc.setQueryData(bajaPozoKeys.pozo(pozoId), pozo)
    },
  })
}

/** Acción sobre una baja: recibe la llamada a la API y actualiza la caché al terminar. */
export function useAccionBaja<TInput>(id: string, accion: (id: string, input: TInput) => Promise<unknown>) {
  const qc = useQueryClient()
  const refrescar = useRefrescarPozos()
  return useMutation<unknown, Error, TInput>({
    mutationFn: (input: TInput) => accion(id, input),
    onSuccess: (r) => {
      // Las acciones devuelven la baja actualizada; tomar devuelve otra cosa.
      if (r && typeof r === 'object' && 'baja' in r) qc.setQueryData(bajaPozoKeys.baja(id), r as BajaBackend)
      else void qc.invalidateQueries({ queryKey: bajaPozoKeys.baja(id) })
      // El historial lo muestra el componente del alta (sirve para cualquier expediente).
      void qc.invalidateQueries({ queryKey: altaKeys.historial(id) })
      refrescar()
    },
  })
}
