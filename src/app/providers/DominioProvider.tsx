import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { crearContextoDominio, DominioContext } from '@/hooks/useDominio'
import { fetchDominio } from '@/services/dominio'

export const dominioKeys = { all: ['dominio'] as const }

/**
 * Carga los datos de referencia del dominio antes de mostrar la app. Así toda pantalla
 * puede usar useDominio() sabiendo que los datos ya están (sin manejar "cargando").
 */
export function DominioProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: dominioKeys.all,
    queryFn: fetchDominio,
    // Casi no cambian: se piden una vez por sesión.
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const value = useMemo(() => (query.data ? crearContextoDominio(query.data) : null), [query.data])

  if (query.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState mensaje="Cargando datos del sistema…" />
      </div>
    )
  }

  if (query.isError || !value) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState
          error={query.error}
          titulo="No se pudo iniciar el sistema"
          onRetry={() => void query.refetch()}
          reintentando={query.isFetching}
          className="max-w-lg"
        />
      </div>
    )
  }

  return <DominioContext.Provider value={value}>{children}</DominioContext.Provider>
}
