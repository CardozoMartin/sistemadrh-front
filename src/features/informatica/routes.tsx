import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaProtegida } from '@/features/auth/components/RutaProtegida'

/** Informática: administración del acceso al sistema. Solo administradores (el backend también lo exige). */
export const informaticaRoutes: RouteObject[] = [
  {
    path: 'informatica',
    handle: { crumb: 'Informática' },
    element: (
      <RutaProtegida soloAdministrador>
        <Outlet />
      </RutaProtegida>
    ),
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/InformaticaPage')) },
      { path: 'usuarios', handle: { crumb: 'Usuarios' }, lazy: lazyPage(() => import('./pages/UsuariosPage')) },
      { path: 'permisos', handle: { crumb: 'Plantillas por rol' }, lazy: lazyPage(() => import('./pages/PermisosPage')) },
    ],
  },
]
