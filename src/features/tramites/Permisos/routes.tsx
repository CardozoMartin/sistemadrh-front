import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const permisosRoute: RouteObject = {
  path: 'permisos',
  handle: { crumb: 'Permisos de Uso' },
  children: [{ index: true, lazy: lazyPage(() => import('./pages/PermisosPage')) }],
}
