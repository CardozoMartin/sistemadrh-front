import { useQuery } from '@tanstack/react-query'
import { fetchCatalogoLocalidades, fetchCatalogoSuministro } from '@/services/catalogos'

export const catalogoKeys = {
  all: ['catalogos'] as const,
  localidades: () => [...catalogoKeys.all, 'localidades'] as const,
  suministro: () => [...catalogoKeys.all, 'suministro'] as const,
}

// Los catálogos casi no cambian: se piden una vez por sesión.
const opcionesCatalogo = { staleTime: Infinity, gcTime: Infinity } as const

export function useCatalogoLocalidades() {
  const { data, isPending, isError } = useQuery({
    queryKey: catalogoKeys.localidades(),
    queryFn: fetchCatalogoLocalidades,
    ...opcionesCatalogo,
  })
  return { catalogo: data ?? null, cargando: isPending, error: isError }
}

export function useCatalogoSuministro() {
  const { data, isPending, isError } = useQuery({
    queryKey: catalogoKeys.suministro(),
    queryFn: fetchCatalogoSuministro,
    ...opcionesCatalogo,
  })
  return { catalogo: data ?? null, cargando: isPending, error: isError }
}
