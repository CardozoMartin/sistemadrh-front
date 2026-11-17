import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/services/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Reintentar solo errores de red o del servidor, nunca 4xx (no van a cambiar).
      retry: (intentos, error) => {
        const status = error instanceof ApiError ? error.status : null
        if (status !== null && status < 500) return false
        return intentos < 1
      },
    },
  },
})
