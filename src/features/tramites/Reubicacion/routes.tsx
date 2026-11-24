import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaConPermiso } from '@/features/auth/components/RutaDeOficina'

export const reubicacionRoute: RouteObject = {
  path: 'reubicacion',
  handle: { crumb: 'Reubicación' },
  children: [
    // Catastro (backend real): búsqueda de la concesión, expediente, checklist y motivo; propuesta (polígono y forma de servicio) y envío a Recaudación.
    {
      element: (
        <RutaConPermiso permiso="REUBICACION_GESTIONAR" accion="gestionar reubicaciones">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [
        { index: true, lazy: lazyPage(() => import('./pages/InicioReubicacionPage')) },
        { path: ':expedienteId/propuesta', handle: { crumb: 'Propuesta' }, lazy: lazyPage(() => import('./pages/PropuestaReubicacionPage')) },
      ],
    },
  ],
}
