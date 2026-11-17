import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { LoadingState } from '@/components/feedback/States'
import { ROUTES } from '@/config/routes'
import { useSesion } from '../context'

/**
 * Envuelve la app: sin sesión lleva al login (y después vuelve a la pantalla pedida); con una
 * contraseña temporal, a cambiarla. `soloAdministrador`: pantallas de administración.
 */
export function RutaProtegida({ children, soloAdministrador }: { children: ReactNode; soloAdministrador?: boolean }) {
  const { estado, usuario } = useSesion()
  const { pathname, search } = useLocation()

  if (estado === 'cargando') return <LoadingState mensaje="Verificando la sesión…" className="py-20" />
  if (estado === 'anonimo' || !usuario) return <Navigate to={ROUTES.login} replace state={{ desde: pathname + search }} />
  if (usuario.debeCambiarClave) return <Navigate to={ROUTES.cambiarClave} replace />
  if (soloAdministrador && !usuario.esAdministrador) return <Navigate to={ROUTES.dashboard} replace />
  return <>{children}</>
}
