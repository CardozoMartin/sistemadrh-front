// Publicación de los polígonos en el mapa público (Argenmap). Backend real: /api/mapa/publicacion.
// Una concesión se publica recién con resolución y verificada por alguien con el permiso
// «Publicar en el mapa»; los usuarios internos la ven siempre en el visor del sistema.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sigKeys } from '@/features/visor/hooks'
import { backend } from '@/services/api/backend'

export type EstadoPublicacion = 'PENDIENTE' | 'OBSERVADO' | 'PUBLICADO'

export interface PoligonoParaPublicar {
  poligonoId: string
  concesionId: string
  numero: string | null
  expedienteId: string | null
  expediente: string | null
  expedienteEstado: string | null
  titular: string | null
  departamento: string | null
  localidad: string | null
  distrito: string | null
  superficieHa: number
  publicacion: EstadoPublicacion
  /** La nota de quien lo observó (o lo publicó). */
  nota: string | null
  usuario: string | null
  fecha: string | null
  /** «12/2026» si ya tiene resolución. */
  resolucion: string | null
  resolucionFecha: string | null
  listoParaPublicar: boolean
  /** Corrección de un polígono publicado: al aprobarla lo reemplaza (mientras tanto sigue el publicado). */
  esCorreccion: boolean
  superficieAnteriorHa: number | null
}

/** Filtros de la lista: ids de los catálogos de GET /api/concesiones/filtros. */
export interface FiltrosPublicacion {
  texto?: string
  departamento?: string
  distrito?: string
  localidad?: string
}

export interface ListaParaPublicar {
  items: PoligonoParaPublicar[]
  total: number
  pagina: number
  porPagina: number
}

export const POLIGONOS_POR_PAGINA = 20

export const ESTADOS_PUBLICACION: Record<EstadoPublicacion, { nombre: string; clases: string }> = {
  PENDIENTE: { nombre: 'Sin publicar', clases: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  OBSERVADO: { nombre: 'Observado', clases: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  PUBLICADO: { nombre: 'Publicado en Argenmap', clases: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
}

const publicacionApi = {
  async listar(params: Record<string, unknown>): Promise<ListaParaPublicar> {
    const { data } = await backend.get<ListaParaPublicar>('/mapa/publicacion', { params })
    return data
  },
  async publicar(poligonoId: string, observaciones?: string) {
    await backend.post(`/mapa/publicacion/${poligonoId}/publicar`, { observaciones: observaciones || undefined })
  },
  async observar(poligonoId: string, observaciones: string) {
    await backend.post(`/mapa/publicacion/${poligonoId}/observar`, { observaciones })
  },
  async reemplazar(poligonoId: string, archivo: File): Promise<{ poligonoId: string; avisos: string[] }> {
    const datos = new FormData()
    datos.append('archivo', archivo)
    const { data } = await backend.post<{ poligonoId: string; avisos: string[] }>(`/mapa/publicacion/${poligonoId}/reemplazar`, datos, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
}

const CLAVE = ['mapa', 'publicacion'] as const

export function usePoligonosParaPublicar(estado: EstadoPublicacion | undefined, filtros: FiltrosPublicacion, pagina: number) {
  const params = Object.fromEntries(
    Object.entries({ estado, ...filtros, texto: filtros.texto?.trim(), pagina, porPagina: POLIGONOS_POR_PAGINA }).filter(([, v]) => v !== undefined && v !== ''),
  )
  return useQuery({ queryKey: [...CLAVE, params], queryFn: () => publicacionApi.listar(params), placeholderData: keepPreviousData })
}

/** Publicar, observar o reemplazar: refresca la lista y las capas del visor. */
export function useAccionPublicacion() {
  const qc = useQueryClient()
  const alTerminar = () => {
    void qc.invalidateQueries({ queryKey: CLAVE })
    void qc.invalidateQueries({ queryKey: sigKeys.all })
  }
  return {
    publicar: useMutation({ mutationFn: (p: { poligonoId: string; observaciones?: string }) => publicacionApi.publicar(p.poligonoId, p.observaciones), onSuccess: alTerminar }),
    observar: useMutation({ mutationFn: (p: { poligonoId: string; observaciones: string }) => publicacionApi.observar(p.poligonoId, p.observaciones), onSuccess: alTerminar }),
    reemplazar: useMutation({ mutationFn: (p: { poligonoId: string; archivo: File }) => publicacionApi.reemplazar(p.poligonoId, p.archivo), onSuccess: alTerminar }),
  }
}
