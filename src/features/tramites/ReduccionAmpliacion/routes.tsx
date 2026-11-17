import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const reduccionAmpliacionRoute: RouteObject = {
  path: 'reduccion-ampliacion',
  handle: { crumb: 'Reducción / Ampliación' },
  children: [
    // Catastro: búsqueda de la concesión (+ asignación del expediente) y definición de la nueva superficie
    { index: true, lazy: lazyPage(() => import('./pages/InicioReduccionAmpliacionPage')) },
    { path: 'superficie', handle: { crumb: 'Definición de superficie' }, lazy: lazyPage(() => import('./pages/DefinicionSuperficiePage')) },
    // Circuito: Recaudación → Distrito → Jurídico → Secretaría General → cierre en Catastro
    { path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/GestionReduccionAmpliacionPage')) },
  ],
}
