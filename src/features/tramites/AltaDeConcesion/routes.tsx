import { Outlet, type RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { RutaConPermiso } from '@/features/auth/components/RutaDeOficina'

export const altaDeConcesionRoute: RouteObject = {
  path: 'alta-concesion',
  handle: { crumb: 'Alta de Concesión' },
  children: [
    // Catastro: inicio y pre carga, con su permiso.
    {
      element: (
        <RutaConPermiso permiso="ALTA_INICIAR" accion="iniciar altas de concesión">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [{ index: true, lazy: lazyPage(() => import('./pages/InicioAltaPage')) }],
    },
    {
      element: (
        <RutaConPermiso permiso="ALTA_CARGAR" accion="editar los datos de un alta">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [{ path: ':borradorId/datos', handle: { crumb: 'Pre carga de datos' }, lazy: lazyPage(() => import('./pages/PreCargaDatosPage')) }],
    },
    // Corrección de errores materiales de un alta que ya salió de la carga (con o sin resolución).
    {
      element: (
        <RutaConPermiso permiso="ALTA_CORREGIR" accion="corregir datos de altas">
          <Outlet />
        </RutaConPermiso>
      ),
      children: [{ path: ':expedienteId/correccion', handle: { crumb: 'Corrección de datos' }, lazy: lazyPage(() => import('./pages/CorreccionDatosPage')) }],
    },
    // Circuito en el backend real: dónde está, qué hace cada oficina e historial.
    {
      path: 'circuito/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/CircuitoAltaPage')),
    },
    // Circuito de las altas viejas de json-server (datos de demo anteriores al backend real).
    {
      path: 'expediente/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/GestionExpedientePage')),
    },
  ],
}
