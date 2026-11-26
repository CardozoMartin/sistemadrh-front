import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaConPermiso, RutaDeOficina } from '@/features/auth/components/RutaDeOficina'

export const reduccionAmpliacionRoute: RouteObject = {
  path: 'reduccion-ampliacion',
  handle: { crumb: 'Ampliación / Reducción' },
  children: [
    // Catastro (backend real): búsqueda de la concesión, tipo, expediente y checklist; carga del plano.
    {
      element: (
        <RutaConPermiso permiso="SUPERFICIE_GESTIONAR" accion="gestionar ampliaciones y reducciones">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [
        { index: true, lazy: lazyPage(() => import('./pages/InicioReduccionAmpliacionPage')) },
        { path: ':expedienteId/datos', handle: { crumb: 'Plano de la nueva superficie' }, lazy: lazyPage(() => import('./pages/CargaModificacionPage')) },
      ],
    },
    // Circuito en el backend real: lo ven todas las oficinas; cada panel controla quién actúa.
    { path: 'circuito/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/CircuitoModificacionPage')) },
    // Circuito viejo de json-server (solo dev:mock / demo): como antes, solo Catastro.
    {
      element: (
        <RutaDeOficina oficina="catastro">
          <Outlet />
        </RutaDeOficina>
      ),
      children: [{ path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/GestionReduccionAmpliacionPage')) }],
    },
  ],
}
