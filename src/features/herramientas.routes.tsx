import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'

export const herramientasRoutes: RouteObject[] = [
  {
    path: 'busqueda',
    handle: { crumb: 'Búsqueda general' },
    children: [
      { index: true, lazy: lazyPage(() => import('./busqueda/pages/BusquedaPage')) },
      { path: 'concesion/:concesionId', handle: { crumb: 'Historial de la concesión' }, lazy: lazyPage(() => import('./catastro/pages/HistorialConcesionPage')) },
      { path: 'expediente/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./catastro/pages/ExpedienteDetallePage')) },
      // Consulta (backend real): sin el panel de trabajo de la oficina.
      { path: 'alta/:expedienteId', handle: { crumb: 'Alta de concesión' }, lazy: lazyPage(() => import('./tramites/AltaDeConcesion/pages/CircuitoAltaPage').then((m) => ({ default: m.ConsultaAltaPage }))) },
      { path: 'baja-pozo/:expedienteId', handle: { crumb: 'Baja de pozo' }, lazy: lazyPage(() => import('./pozo/BajaDePozo/pages/CircuitoBajaPage').then((m) => ({ default: m.ConsultaBajaPage }))) },
    ],
  },
  { path: 'visor', handle: { crumb: 'Visor cartográfico', pantallaCompleta: true }, lazy: lazyPage(() => import('./visor/pages/VisorPage')) },
  { path: 'configuracion', handle: { crumb: 'Configuración' }, lazy: lazyPage(() => import('./configuracion/pages/ConfiguracionPage')) },
]
