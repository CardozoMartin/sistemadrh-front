import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import { catastroRoutes } from '@/features/catastro/routes'
import { oficinasRoutes } from '@/features/oficinas.routes'
import { tramitesRoutes } from '@/features/tramites/routes'
import { pozoRoutes } from '@/features/pozo/routes'
import { herramientasRoutes } from '@/features/herramientas.routes'
import { informaticaRoutes } from '@/features/informatica/routes'
import { RutaProtegida } from '@/features/auth/components/RutaProtegida'
import { lazyPage } from './lazyPage'

// Cada módulo define sus propias rutas; acá solo se ensamblan. El login y el cambio de
// contraseña van fuera de AppLayout; todo lo demás exige sesión (RutaProtegida).
export const router = createBrowserRouter([
  { path: '/login', lazy: lazyPage(() => import('@/features/auth/pages/LoginPage')), errorElement: <RouteErrorPage /> },
  { path: '/cambiar-clave', lazy: lazyPage(() => import('@/features/auth/pages/CambiarClavePage')), errorElement: <RouteErrorPage /> },
  {
    path: '/',
    element: (
      <RutaProtegida>
        <AppLayout />
      </RutaProtegida>
    ),
    errorElement: <RouteErrorPage />,
    handle: { crumb: 'Inicio' },
    children: [
      { index: true, element: <DashboardPage />, handle: { crumb: 'Dashboard' } },
      ...catastroRoutes,
      ...oficinasRoutes,
      ...tramitesRoutes,
      ...pozoRoutes,
      ...herramientasRoutes,
      ...informaticaRoutes,
      { path: '*', element: <NotFoundPage />, handle: { crumb: 'No encontrada' } },
    ],
  },
])
