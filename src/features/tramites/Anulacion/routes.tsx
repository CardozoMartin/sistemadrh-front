import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const anulacionRoute: RouteObject = {
  path: 'anulacion',
  handle: { crumb: 'Anulación de Concesión' },
  children: [
    // Catastro: búsqueda de la concesión (+ asignación del expediente) y verificación de datos
    { index: true, lazy: lazyPage(() => import('./pages/InicioAnulacionPage')) },
    { path: 'verificacion', handle: { crumb: 'Verificación de datos' }, lazy: lazyPage(() => import('./pages/VerificacionAnulacionPage')) },
    // Circuito: Recaudación → Distrito → Jurídico → Secretaría General → baja en Catastro
    { path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./pages/GestionAnulacionPage')) },
  ],
}
