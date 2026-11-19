import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaConPermiso } from '@/features/auth/components/RutaDeOficina'

export const cambioDeTitularidadRoute: RouteObject = {
  path: 'cambio-titularidad',
  handle: { crumb: 'Cambio de Titularidad' },
  children: [
    // Catastro (backend real): búsqueda de la concesión, expediente y checklist; pre-carga del nuevo titular.
    {
      element: (
        <RutaConPermiso permiso="TITULARIDAD_GESTIONAR" accion="gestionar cambios de titularidad">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [
        { index: true, lazy: lazyPage(() => import('./pages/InicioCambioTitularidadPage')) },
        {
          path: ':expedienteId/datos',
          handle: { crumb: 'Pre-carga nuevo titular' },
          lazy: lazyPage(() => import('./pages/NuevoTitularPage')),
        },
      ],
    },
    // Circuito: Recaudación → Distrito → Jurídico → Secretaría General → cierre en Catastro
    {
      path: 'expediente/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/GestionCambioTitularidadPage')),
    },
  ],
}
