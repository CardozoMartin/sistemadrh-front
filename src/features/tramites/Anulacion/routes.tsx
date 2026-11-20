import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaConPermiso, RutaDeOficina } from '@/features/auth/components/RutaDeOficina'

export const anulacionRoute: RouteObject = {
  path: 'anulacion',
  handle: { crumb: 'Anulación de Concesión' },
  children: [
    // Catastro (backend real): búsqueda de la concesión, expediente, checklist y motivo; verificación de datos e «Iniciar anulación».
    {
      element: (
        <RutaConPermiso permiso="ANULACION_GESTIONAR" accion="gestionar anulaciones de concesiones">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [
        { index: true, lazy: lazyPage(() => import('./pages/InicioAnulacionPage')) },
        { path: ':expedienteId/verificacion', handle: { crumb: 'Verificación de datos' }, lazy: lazyPage(() => import('./pages/VerificacionAnulacionPage')) },
      ],
    },
    // Circuito en el backend real: dónde está, qué hace la oficina que lo tiene (hoy: Recaudación) e historial.
    { path: 'circuito/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/CircuitoAnulacionPage')) },
    // Circuito viejo de json-server (solo dev:mock / demo): como antes, solo Catastro.
    {
      element: (
        <RutaDeOficina oficina="catastro">
          <Outlet />
        </RutaDeOficina>
      ),
      children: [{ path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/GestionAnulacionPage')) }],
    },
  ],
}
