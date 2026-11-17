import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const reubicacionRoute: RouteObject = {
  path: 'reubicacion',
  handle: { crumb: 'Reubicación' },
  children: [{ index: true, lazy: lazyPage(() => import('./pages/ReubicacionPage')) }],
}
