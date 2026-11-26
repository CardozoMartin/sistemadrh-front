// Búsqueda de concesiones VIGENTES para iniciar un trámite sobre una concesión (cambio de
// titularidad, anulación, reubicación…): la misma consulta de Catastro, filtrada por estado.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { FiltrosConcesiones, ResultadoConcesiones } from '@/features/catastro/consultaConcesiones'
import { backend } from '@/services/api/backend'

/** Resultados por página en la búsqueda del inicio. */
export const CONCESIONES_POR_PAGINA = 10

export function buscarVigentes(filtros: FiltrosConcesiones, pagina: number, porPagina = CONCESIONES_POR_PAGINA) {
  const params = Object.fromEntries(Object.entries({ ...filtros, estado: 'VIGENTE', pagina, porPagina }).filter(([, v]) => v !== undefined && v !== ''))
  return backend.get<ResultadoConcesiones>('/concesiones/buscar', { params }).then((r) => r.data)
}

/** Con `filtros` en null no pide nada: la lista arranca vacía hasta que el usuario busca. */
export function useBuscarVigentes(filtros: FiltrosConcesiones | null, pagina: number) {
  return useQuery({
    queryKey: ['backend', 'concesiones-vigentes', filtros ?? {}, pagina] as const,
    queryFn: () => buscarVigentes(filtros!, pagina),
    enabled: !!filtros,
    placeholderData: keepPreviousData,
  })
}
