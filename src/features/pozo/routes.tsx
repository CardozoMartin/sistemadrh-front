import type { RouteObject } from 'react-router'
import { lazyPage } from '@/app/lazyPage'
import { deOficina } from '@/features/auth/components/RutaDeOficina'

export const pozoRoutes: RouteObject[] = [
  {
    path: 'pozo',
    handle: { crumb: 'Pozos' },
    children: [
      // El expediente de una baja o de un registro se consulta desde cualquier oficina (búsqueda, bandejas).
      { path: 'registro/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./CircuitoPozo/pages/CircuitoPozoPage')) },
      { path: 'bajas/:expedienteId', handle: { crumb: 'Expediente' }, lazy: lazyPage(() => import('./BajaDePozo/pages/CircuitoBajaPage')) },
      deOficina('pozos', [
        { index: true, lazy: lazyPage(() => import('./pages/PozoInicioPage')) },
        { path: 'autorizacion', handle: { crumb: 'Autorización de pozo' }, lazy: lazyPage(() => import('./pages/AutorizacionPozoPage')) },
        {
          path: 'registro',
          handle: { crumb: 'Alta de pozo' },
          children: [
            { index: true, lazy: lazyPage(() => import('./AltaDePozo/pages/AltaPozoPage')) },
          ],
        },
        {
          path: 'empresas',
          handle: { crumb: 'Empresas perforadoras' },
          children: [
            { index: true, lazy: lazyPage(() => import('./EmpresasPerforadoras/pages/EmpresasPage')) },
            { path: 'nueva', handle: { crumb: 'Nueva empresa' }, lazy: lazyPage(() => import('./EmpresasPerforadoras/pages/NuevaEmpresaPage')) },
            { path: ':empresaId', handle: { crumb: 'Ficha de la empresa' }, lazy: lazyPage(() => import('./EmpresasPerforadoras/pages/EmpresaPage')) },
            { path: ':empresaId/revision', handle: { crumb: 'Revisión' }, lazy: lazyPage(() => import('./EmpresasPerforadoras/pages/RevisionEmpresaPage')) },
          ],
        },
        { path: 'autorizaciones', handle: { crumb: 'Autorizaciones' }, lazy: lazyPage(() => import('./pages/AutorizacionesPage')) },
        {
          path: 'registrados',
          handle: { crumb: 'Pozos registrados' },
          children: [
            { index: true, lazy: lazyPage(() => import('./Padron/pages/PozosRegistradosPage')) },
            { path: ':pozoId/monitoreos', handle: { crumb: 'Monitoreos' }, lazy: lazyPage(() => import('./Monitoreos/pages/MonitoreosPozoPage')) },
          ],
        },
        { path: 'consulta', handle: { crumb: 'Consulta general' }, lazy: lazyPage(() => import('./pages/ConsultaGeneralPage')) },
        {
          path: 'bajas',
          handle: { crumb: 'Baja de pozo' },
          children: [
            { index: true, lazy: lazyPage(() => import('./BajaDePozo/pages/BuscarPozoPage')) },
            { path: 'tramites', handle: { crumb: 'Bajas en trámite' }, lazy: lazyPage(() => import('./BajaDePozo/pages/BajasPozoPage')) },
            { path: 'pozo/:pozoId', handle: { crumb: 'Pozo' }, lazy: lazyPage(() => import('./BajaDePozo/pages/PozoBajaPage')) },
          ],
        },
      ]),
    ],
  },
]
