// Catálogo de capas del visor, organizado por tema como Argenmap (el visor del IGN): cada
// sección junta las capas de un tema, vengan de donde vengan.
//   base   capas del sistema (PostGIS): concesiones, pozos, desagües y puntos, ríos y canales.
//   drh    capas del GeoServer de la DRH (copia local, ver capasDrh.ts).
//   wms    un tema de un servicio WMS de otro organismo (ver capasWms.ts), por su clave.
//   wms-todos  todos los temas de un servicio (los cultivos por campaña del Ministerio, que cambian).
import type { CapasVisor } from './filtros'

export type CapaBase = Exclude<keyof CapasVisor, 'etiquetas'>

export type RefCapa =
  | { tipo: 'base'; capa: CapaBase }
  | { tipo: 'drh'; id: string }
  | { tipo: 'wms'; servicio: string; tema: string }
  | { tipo: 'wms-todos'; servicio: string }

export interface SeccionCatalogo {
  id: string
  titulo: string
  descripcion: string
  icono: string
  capas: RefCapa[]
}

const base = (capa: CapaBase): RefCapa => ({ tipo: 'base', capa })
const drh = (id: string): RefCapa => ({ tipo: 'drh', id })
const wms = (servicio: string, tema: string): RefCapa => ({ tipo: 'wms', servicio, tema })

export const SECCIONES: SeccionCatalogo[] = [
  {
    id: 'concesiones',
    titulo: 'Concesiones y permisos',
    descripcion: 'Derechos de agua, permisos precarios, derecho tradicional',
    icono: 'water_drop',
    capas: [
      base('concesiones'),
      drh('t07_concesiones'),
      drh('t07_concesiones_bebida_e_industriales'),
      drh('t07_concesiones_anuladas'),
      drh('t07_permisos_precarios'),
      drh('t07_derecho_tradicional'),
      wms('catastro', 'concesiones'),
    ],
  },
  {
    id: 'subterraneas',
    titulo: 'Aguas subterráneas',
    descripcion: 'Pozos registrados y relevados',
    icono: 'water_pump',
    capas: [base('pozos'), drh('t07_pozos'), wms('recursos_hidricos', 'pozos de agua')],
  },
  {
    id: 'usos',
    titulo: 'Usos y desagües',
    descripcion: 'Puntos de entrega y desagües de las concesiones',
    icono: 'valve',
    capas: [base('puntos')],
  },
  {
    id: 'riego',
    titulo: 'Red de riego',
    descripcion: 'Canales, tomas, compuertas, obras de arte, hijuelas',
    icono: 'water',
    capas: [
      drh('t07_canales_riego'),
      drh('t07_tomas'),
      drh('t07_compuertas'),
      drh('t07_obras_arte'),
      wms('recursos_hidricos', 'canales'),
      wms('recursos_hidricos', 'comparticiones'),
      wms('catastro', 'canales_riego'),
      wms('catastro', 'hijuelas'),
    ],
  },
  {
    id: 'hidrografia',
    titulo: 'Hidrografía',
    descripcion: 'Ríos, cuerpos de agua, diques, cuencas',
    icono: 'waves',
    capas: [
      base('cauces'),
      drh('t07_rios'),
      drh('t07_represas'),
      wms('recursos_hidricos', 'rios'),
      wms('recursos_hidricos', 'cuerpos de agua'),
      wms('recursos_hidricos', 'diques'),
      wms('recursos_hidricos', 'cuencas hidricas'),
      wms('catastro', 'rios'),
    ],
  },
  {
    id: 'limites',
    titulo: 'Límites y unidades territoriales',
    descripcion: 'Distritos de riego, departamentos, localidades',
    icono: 'border_outer',
    capas: [drh('t07_distritos'), drh('t07_departamentos'), wms('recursos_hidricos', 'distritos'), wms('catastro', 'departamentos'), wms('catastro', 'localidades')],
  },
  {
    id: 'catastro',
    titulo: 'Catastro',
    descripcion: 'Parcelas, rutas, áreas protegidas, zonas agroecológicas',
    icono: 'grid_on',
    capas: [wms('catastro', 'parcelas'), wms('catastro', 'rutas_provinciales'), wms('catastro', 'areas_protegidas'), wms('catastro', 'zonas_agroecologicas')],
  },
  {
    id: 'agropecuarias',
    titulo: 'Actividades agropecuarias',
    descripcion: 'Cultivos por campaña, apiarios, ganadería',
    icono: 'agriculture',
    capas: [{ tipo: 'wms-todos', servicio: 'agropecuarias' }],
  },
  {
    id: 'industriales',
    titulo: 'Actividades industriales',
    descripcion: 'Industrias, parques industriales, minería',
    icono: 'factory',
    capas: [{ tipo: 'wms-todos', servicio: 'industriales' }],
  },
]

/** Nombre corto del origen de cada capa (va debajo del nombre, para distinguir capas parecidas). */
export const FUENTES = {
  base: 'Sistema DRH',
  cauces: 'OpenStreetMap',
  drh: 'GeoServer DRH',
} as const
