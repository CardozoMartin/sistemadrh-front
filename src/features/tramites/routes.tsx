// Flujos de trámite de concesión. Cada trámite vive en su propia carpeta con sus
// pages/, components/, schemas, api.ts y routes.tsx; acá solo se ensamblan.
import { Navigate, type RouteObject } from 'react-router'
import { ROUTES } from '@/config/routes'
import { altaDeConcesionRoute } from './AltaDeConcesion/routes'
import { cambioDeTitularidadRoute } from './CambioDeTitularidad/routes'
import { anulacionRoute } from './Anulacion/routes'
import { reduccionAmpliacionRoute } from './ReduccionAmpliacion/routes'
import { subdivisionRoute } from './Subdivision/routes'
import { reubicacionRoute } from './Reubicacion/routes'
import { permisosRoute } from './Permisos/routes'
import { deOficina } from '@/features/auth/components/RutaDeOficina'

export const tramitesRoutes: RouteObject[] = [
  {
    path: 'tramites',
    handle: { crumb: 'Trámites' },
    children: [
      { index: true, element: <Navigate to={ROUTES.catastro.tramites} replace /> },
      altaDeConcesionRoute,
      // Circula por varias oficinas (backend real): cada pantalla controla su permiso u oficina.
      cambioDeTitularidadRoute,
      // Pendientes de migrar al backend: por ahora, solo Catastro.
      deOficina('catastro', [anulacionRoute, reduccionAmpliacionRoute, subdivisionRoute, reubicacionRoute, permisosRoute]),
    ],
  },
]
