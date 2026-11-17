// Rutas de inicio de las oficinas intermedias del circuito. Cuando alguna crezca
// (bandeja, detalle de expediente, etc.) se mueve a su propio features/<oficina>/routes.tsx.
import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { deOficina } from '@/features/auth/components/RutaDeOficina'

export const oficinasRoutes: RouteObject[] = [
  deOficina('recaudacion', [
    {
      path: 'recaudacion',
      handle: { crumb: 'Recaudación' },
      lazy: lazyPage(() => import('./recaudacion/pages/RecaudacionInicioPage')),
    },
  ]),
  deOficina('distrito', [
    {
      path: 'distrito',
      handle: { crumb: 'Distrito' },
      lazy: lazyPage(() => import('./distrito/pages/DistritoInicioPage')),
    },
  ]),
  deOficina('juridico', [
    {
      path: 'juridico',
      handle: { crumb: 'Jurídico' },
      lazy: lazyPage(() => import('./juridico/pages/JuridicoInicioPage')),
    },
  ]),
  deOficina('secretaria_general', [
    {
      path: 'secretaria-general',
      handle: { crumb: 'Secretaría General' },
      lazy: lazyPage(() => import('./secretaria-general/pages/SecretariaGeneralInicioPage')),
    },
  ]),
]
