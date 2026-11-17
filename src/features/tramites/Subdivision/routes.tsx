import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const subdivisionRoute: RouteObject = {
  path: 'subdivision',
  handle: { crumb: 'Subdivisión' },
  children: [
    // Catastro: búsqueda de la concesión (+ asignación del expediente), fracciones y datos de cada una
    { index: true, lazy: lazyPage(() => import('./pages/InicioSubdivisionPage')) },
    { path: ':borradorId/fracciones', handle: { crumb: 'Definir fracciones' }, lazy: lazyPage(() => import('./pages/DefinicionFraccionesPage')) },
    { path: ':borradorId/datos', handle: { crumb: 'Datos por fracción' }, lazy: lazyPage(() => import('./pages/DatosFraccionesPage')) },
    // Circuito: Recaudación → Distrito → Jurídico → Secretaría General → cierre en Catastro
    { path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/GestionSubdivisionPage')) },
  ],
}
