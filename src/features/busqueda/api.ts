// Búsqueda general de expedientes (backend real: GET /expedientes/buscar). Cualquier trámite,
// en curso o terminado, con dónde está y de qué oficina vino.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ROUTES } from '@/config/routes'
import { backend } from '@/services/api/backend'

export interface FiltrosExpedientes {
  /** N° de expediente (123 o 123/332-2026), nombre o documento del titular. */
  texto?: string
  tipoTramite?: string
  /** Un estado del catálogo o PENDIENTES (los que siguen circulando). */
  estado?: string
  /** Oficina donde está hoy. */
  oficina?: string
  desde?: string
  hasta?: string
  pagina?: number
}

export interface ExpedienteEncontrado {
  id: string
  numero: string
  fechaIngreso: string
  tipoTramite: string
  tramiteNombre: string
  estado: string
  estadoNombre: string
  estadoColor: string
  etapa: string
  etapaNombre: string
  titular: string | null
  documento: string | null
  oficinaActual: string
  oficinaActualNombre: string
  /** null: no salió todavía de la oficina que lo inició. */
  oficinaAnterior: string | null
  oficinaAnteriorNombre: string | null
  /** Cuándo llegó a la oficina donde está. */
  ultimoPase: string | null
}

export interface ResultadoBusqueda {
  total: number
  pagina: number
  porPagina: number
  expedientes: ExpedienteEncontrado[]
}

export const POR_PAGINA = 25

async function buscarExpedientes(f: FiltrosExpedientes): Promise<ResultadoBusqueda> {
  const params = Object.fromEntries(Object.entries({ ...f, porPagina: POR_PAGINA }).filter(([, v]) => v !== undefined && v !== ''))
  const { data } = await backend.get<ResultadoBusqueda>('/expedientes/buscar', { params })
  return data
}

/** Mientras se escribe se sigue mostrando el resultado anterior (sin parpadeo). */
export function useBuscarExpedientes(f: FiltrosExpedientes) {
  return useQuery({ queryKey: ['backend', 'expedientes', 'buscar', f], queryFn: () => buscarExpedientes(f), placeholderData: keepPreviousData })
}

/**
 * Consulta de cada expediente según su trámite (los que ya están en el backend real): datos,
 * auditoría e historial. El panel de trabajo de cada oficina se abre desde su bandeja.
 */
const RUTA_VER: Record<string, (id: string) => string> = {
  ALTA_CONCESION: ROUTES.consulta.alta,
  BAJA_POZO: ROUTES.consulta.bajaPozo,
}

export const rutaVerExpediente = (e: ExpedienteEncontrado) => RUTA_VER[e.tipoTramite]?.(e.id) ?? null
