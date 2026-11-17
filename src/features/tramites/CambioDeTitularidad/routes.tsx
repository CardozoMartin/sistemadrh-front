import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const cambioDeTitularidadRoute: RouteObject = {
  path: 'cambio-titularidad',
  handle: { crumb: 'Cambio de Titularidad' },
  children: [
    // Catastro: búsqueda de la concesión (+ asignación del expediente) y pre-carga del nuevo titular
    { index: true, lazy: lazyPage(() => import('./pages/InicioCambioTitularidadPage')) },
    {
      path: ':borradorId/datos',
      handle: { crumb: 'Pre-carga nuevo titular' },
      lazy: lazyPage(() => import('./pages/NuevoTitularPage')),
    },
    // Circuito: Recaudación → Distrito → Jurídico → Secretaría General → cierre en Catastro
    {
      path: 'expediente/:expedienteId',
      handle: { crumb: 'Expediente' },
      lazy: lazyPage(() => import('./pages/GestionCambioTitularidadPage')),
    },
  ],
}
