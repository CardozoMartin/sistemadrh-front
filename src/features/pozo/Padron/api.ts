// Padrón de pozos por origen. PROTOTIPO: lo responde el backend emulado (npm run demo).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'
import type { FiltrosPozos, PadronPozos } from './types'

/** Solo los filtros completados (los vacíos no viajan en la query string). */
const completados = (f: FiltrosPozos) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''))

export const padronApi = {
  listar: async (filtros: FiltrosPozos) => (await backend.get<PadronPozos>('/pozos/padron', { params: completados(filtros) })).data,
}

/** Lista del padrón; conserva los resultados mientras se escribe o se cambia un filtro. */
export function usePadronPozos(filtros: FiltrosPozos) {
  return useQuery({ queryKey: ['backend', 'pozos', 'padron', completados(filtros)], queryFn: () => padronApi.listar(filtros), placeholderData: keepPreviousData })
}
