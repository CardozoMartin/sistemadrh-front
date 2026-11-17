// Capas de otros organismos, publicadas como WMS (imágenes que dibuja el servidor de origen).
// No pasan por el backend de la DRH.
//
//   Catastro                   Dirección General de Catastro (GeoServer): parcelas, canales de riego,
//                              concesiones, hijuelas, ríos, límites. Solo http y sin CORS: se pide por
//                              el proxy /ext/catastro (vite.config.ts; en producción, el servidor web).
//                              Se puede consultar: clic en el mapa → padrón y nomenclatura de la parcela.
//   Actividades agropecuarias  Ministerio de Producción: cultivos por campaña (EEAOC, INTA),
//                              apiarios, cooperativas, producción porcina, caprina, vitivinícola.
//   Actividades industriales   Ministerio de Producción: industrias, parques industriales, catastro minero.
//   Recursos hídricos          Ministerio de Producción: distritos, cuencas, cuerpos de agua, ríos,
//                              canales, pozos de agua, diques y comparticiones. Se puede consultar
//                              (ArcGIS: la consulta viene en XML propio de Esri, sin geometría).
//
// Las del Ministerio se leen del servidor (GetCapabilities) al abrir el visor: así las campañas
// nuevas aparecen solas. Las capas que son la misma cosa en distintos años («Caña de azúcar 2023»,
// «… 2024») se agrupan en un cultivo y se elige la campaña. Las de Catastro son una lista fija:
// publica 76 capas, varias rotas (pozos, cuencas, hidrografía, caminos, parcelas_legal devuelven
// error) o ajenas a la DRH (focos de incendio, piscinas…).
import type { FeatureCollection, Geometry } from 'geojson'
import { normalizar } from './filtros'

/** Una capa elegida a mano de un servicio (en vez de leer todas las que publica). */
export interface CapaFija {
  capa: string
  nombre: string
  /** Desde qué zoom se pide (las capas muy detalladas, a escala provincial, son lentas e ilegibles). */
  minZoom?: number
  /** Estilo propio (SLD) en vez del del servidor. */
  estilo?: string
}

export interface ServicioWms {
  id: string
  titulo: string
  resumen: string
  icono: string
  color: string
  url: string
  /** Servidor de origen, para los avisos (la url puede ser la del proxy). */
  servidor: string
  fuente: string
  /** Claves de los temas que se prenden al activar el servicio; sin esto, se prenden todos. */
  porDefecto?: string[]
  /** Lista fija de capas; sin esto, se leen del GetCapabilities. */
  capas?: CapaFija[]
  /** Se puede consultar con un clic (GetFeatureInfo; el servidor tiene que permitirlo). */
  consultable?: boolean
  /** Formato de la consulta: JSON (GeoServer, por defecto) o el XML de ArcGIS. */
  formatoConsulta?: 'json' | 'esri-xml'
  /** Qué se ve al consultar (para el texto de ayuda del panel). */
  ayudaConsulta?: string
  /** Opacidad de las imágenes. */
  opacidad?: number
}

/** Estilo de solo borde para una capa de polígonos (las parcelas de Catastro vienen rellenas y tapan el satélite). */
const soloBorde = (capa: string, color: string) =>
  `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"><NamedLayer><Name>${capa}</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Stroke><CssParameter name="stroke">${color}</CssParameter><CssParameter name="stroke-width">1</CssParameter></Stroke></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`

/** Zoom desde el que se ven las parcelas (a partir de ahí se distinguen las fincas). */
export const ZOOM_PARCELAS = 14

export const SERVICIOS_WMS: ServicioWms[] = [
  {
    id: 'catastro',
    titulo: 'Catastro',
    resumen: 'Parcelas y canales · Dir. Gral. de Catastro',
    icono: 'grid_on',
    color: '#ca8a04',
    url: '/ext/catastro/wms',
    servidor: '200.49.89.203 (Catastro)',
    fuente: 'Dirección General de Catastro de Tucumán (IDET)',
    porDefecto: ['parcelas', 'canales_riego'],
    consultable: true,
    ayudaConsulta: 'padrón y nomenclatura de la parcela, nombre del canal…',
    opacidad: 0.9,
    capas: [
      { capa: 'parcelas', nombre: 'Parcelas', minZoom: ZOOM_PARCELAS, estilo: soloBorde('parcelas', '#facc15') },
      { capa: 'canales_riego', nombre: 'Canales de riego' },
      { capa: 'concesiones', nombre: 'Concesiones (registro de Catastro)' },
      { capa: 'hijuelas', nombre: 'Hijuelas' },
      { capa: 'rios', nombre: 'Ríos' },
      { capa: 'departamentos', nombre: 'Departamentos' },
      { capa: 'localidades', nombre: 'Localidades' },
      { capa: 'rutas_provinciales', nombre: 'Rutas provinciales' },
      { capa: 'areas_protegidas', nombre: 'Áreas protegidas' },
      { capa: 'zonas_agroecologicas', nombre: 'Zonas agroecológicas' },
    ],
  },
  {
    id: 'agropecuarias',
    titulo: 'Actividades agropecuarias',
    resumen: 'Cultivos por campaña · Min. de Producción',
    icono: 'agriculture',
    color: '#16a34a',
    url: 'https://gis.producciontucuman.gob.ar/ArcGIS/services/Actividades_Agropecuarias_WMS/MapServer/WMSServer',
    servidor: 'gis.producciontucuman.gob.ar',
    fuente: 'Ministerio de Producción de Tucumán (EEAOC, INTA, SENASA)',
    porDefecto: ['cana de azucar'],
    opacidad: 0.75,
  },
  {
    id: 'industriales',
    titulo: 'Actividades industriales',
    resumen: 'Industrias y minería · Min. de Producción',
    icono: 'factory',
    color: '#9333ea',
    url: 'https://gis.producciontucuman.gob.ar/ArcGIS/services/Actividades_Industriales_WMS/MapServer/WMSServer',
    servidor: 'gis.producciontucuman.gob.ar',
    fuente: 'Ministerio de Producción de Tucumán',
    opacidad: 0.75,
  },
  {
    id: 'recursos_hidricos',
    titulo: 'Recursos hídricos',
    resumen: 'Pozos, canales, cuencas · Min. de Producción',
    icono: 'water',
    color: '#0e7490',
    url: 'https://gis.producciontucuman.gob.ar/ArcGIS/services/Recursos_Hidricos_WMS/MapServer/WMSServer',
    servidor: 'gis.producciontucuman.gob.ar',
    fuente: 'Ministerio de Producción de Tucumán (datos de la DRH)',
    // Los distritos y las cuencas vienen rellenos y tapan el mapa: se prenden a mano.
    porDefecto: ['pozos de agua', 'canales', 'diques'],
    consultable: true,
    formatoConsulta: 'esri-xml',
    ayudaConsulta: 'datos del pozo, canal, dique o distrito.',
    opacidad: 0.8,
  },
]

/** Un tema del servicio: una capa suelta o un cultivo con sus campañas (la más nueva primero). */
export interface TemaWms {
  clave: string
  nombre: string
  campanias: { capa: string; nombre: string }[]
  /** Desde qué zoom se ve (solo capas fijas). */
  minZoom?: number
}

/** Qué se ve de cada servicio: si está prendido y la capa elegida de cada tema (clave → capa). */
export type EstadoWms = Record<string, { activo: boolean; elegidas: Record<string, string> }>

export const ESTADO_WMS_INICIAL: EstadoWms = Object.fromEntries(SERVICIOS_WMS.map((s) => [s.id, { activo: false, elegidas: {} }]))

/** «Caña_de_azúcar_2024_EEAOC» → tema «Caña de azúcar», campaña «2024 EEAOC». Sin año: la capa sola. */
function separar(capa: string): { tema: string; campania: string | null } {
  const m = /^(.+?)_((?:19|20)\d{2}.*)$/.exec(capa)
  const limpiar = (t: string) => t.replace(/_/g, ' ').trim()
  return m ? { tema: limpiar(m[1]), campania: limpiar(m[2]).replace(/^(\d{4}) (\d{4})/, '$1-$2') } : { tema: limpiar(capa), campania: null }
}

const conTilde = (texto: string) => texto.normalize('NFD') !== texto

/** Lee las capas del GetCapabilities y las agrupa en temas, ordenados por nombre. */
export function temasDe(xml: string): TemaWms[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  // Las capas que se pueden pedir son las que tienen <Name> propio (no el de su estilo).
  const nombres = [...doc.getElementsByTagName('Layer')].flatMap((l) => [...l.children].filter((c) => c.localName === 'Name').map((c) => c.textContent?.trim() ?? '')).filter(Boolean)
  const temas = new Map<string, TemaWms>()
  for (const capa of nombres) {
    const { tema, campania } = separar(capa)
    // «Maiz» y «Maíz», «Citricos» y «Cítricos» son el mismo cultivo: se queda el nombre con tilde.
    const clave = normalizar(tema)
    const t = temas.get(clave) ?? { clave, nombre: tema, campanias: [] }
    if (conTilde(tema) && !conTilde(t.nombre)) t.nombre = tema
    t.campanias.push({ capa, nombre: campania ?? tema })
    temas.set(clave, t)
  }
  for (const t of temas.values()) t.campanias.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { numeric: true }))
  return [...temas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export async function leerTemas(servicio: ServicioWms): Promise<TemaWms[]> {
  if (servicio.capas) return servicio.capas.map((c) => ({ clave: c.capa, nombre: c.nombre, campanias: [{ capa: c.capa, nombre: c.nombre }], minZoom: c.minZoom }))
  const r = await fetch(`${servicio.url}?service=WMS&request=GetCapabilities`)
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
  return temasDe(await r.text())
}

/** La capa fija con ese nombre (estilo, zoom mínimo), si el servicio tiene lista fija. */
export const capaFija = (servicio: ServicioWms, capa: string) => servicio.capas?.find((c) => c.capa === capa)

/** Imagen de la leyenda que arma el servidor para una capa (con el estilo propio, si tiene). */
export function urlLeyenda(servicio: ServicioWms, capa: string) {
  const estilo = capaFija(servicio, capa)?.estilo
  return `${servicio.url}?request=GetLegendGraphic&version=1.3.0&format=image/png&layer=${encodeURIComponent(capa)}${estilo ? `&SLD_BODY=${encodeURIComponent(estilo)}` : ''}`
}

/** Capas que se ven, de todos los servicios prendidos. */
export const capasActivas = (estado: EstadoWms) =>
  SERVICIOS_WMS.flatMap((servicio) => (estado[servicio.id]?.activo ? Object.entries(estado[servicio.id].elegidas).map(([tema, capa]) => ({ servicio, tema, capa })) : []))

// ---------------------------------------------------------------------------
// Consulta con un clic (GetFeatureInfo): qué hay de cada capa consultable bajo el cursor.
// ---------------------------------------------------------------------------

/** Un objeto encontrado: la capa, sus datos para mostrar y su geometría (en EPSG:3857, la del pedido). */
export interface ObjetoConsultado {
  capa: string
  nombre: string
  datos: [string, string][]
  geometria: Geometry | null
}

/** Campos internos del GeoServer de Catastro (identificadores y colores): no le dicen nada al usuario. */
const CAMPOS_OCULTOS = new Set(['ENTITYID', 'CLASSID', 'REVISIONNUMBER', 'FEATID', 'ADMPCOLOR', 'KEY', 'CENTROID', 'GEOMETRY'])

/** Nombres legibles de los campos conocidos; el resto se muestra con la primera en mayúscula. */
const NOMBRES_CAMPO: Record<string, string> = {
  PADRON: 'Padrón',
  NOMENCLATURA: 'Nomenclatura',
  NOMBRE_CANAL: 'Canal',
  CATEGORIA: 'Categoría',
  LONG1: 'Largo (m)',
  CONCESION: 'Concesión',
  PADRON_CAT: 'Padrón catastral',
  PADRON_REN: 'Padrón de Rentas',
  DEPARTAMEN: 'Departamento',
  CARACTER: 'Carácter',
  CUIT_CUIL: 'CUIT/CUIL',
  OBSERVAC: 'Observaciones',
  TIPO_USUAR: 'Tipo de usuario',
}

const nombreCampo = (campo: string) => NOMBRES_CAMPO[campo] ?? campo.charAt(0) + campo.slice(1).toLowerCase().replace(/_/g, ' ')

/** Recuadro del mapa en EPSG:3857, su tamaño y el punto del clic, en píxeles. */
export interface PuntoConsulta {
  bbox: [number, number, number, number]
  ancho: number
  alto: number
  x: number
  y: number
}

/** Consulta las capas de un servicio en el punto del clic. */
export async function consultar(servicio: ServicioWms, capas: string[], punto: PuntoConsulta, senal?: AbortSignal): Promise<ObjetoConsultado[]> {
  const nombres = capas.join(',')
  const parametros = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetFeatureInfo',
    layers: nombres,
    query_layers: nombres,
    styles: '',
    crs: 'EPSG:3857',
    bbox: punto.bbox.join(','),
    width: String(punto.ancho),
    height: String(punto.alto),
    i: String(Math.round(punto.x)),
    j: String(Math.round(punto.y)),
    info_format: servicio.formatoConsulta === 'esri-xml' ? 'application/vnd.esri.wms_featureinfo_xml' : 'application/json',
    feature_count: '5',
    // Margen en píxeles alrededor del clic: las líneas (canales, ríos) son finas.
    buffer: '6',
  })
  const r = await fetch(`${servicio.url}?${parametros}`, { signal: senal })
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
  if (servicio.formatoConsulta === 'esri-xml') return objetosDeXmlEsri(servicio, await r.text())
  const datos = (await r.json()) as FeatureCollection
  return datos.features.map((f) => {
    // El id es «capa.fid-…»: de ahí sale de qué capa es cada objeto.
    const capa = String(f.id ?? '').split('.')[0]
    const visibles = Object.entries(f.properties ?? {})
      .filter(([campo, valor]) => !CAMPOS_OCULTOS.has(campo) && valor !== null && valor !== '' && valor !== 0)
      .map(([campo, valor]): [string, string] => [nombreCampo(campo), typeof valor === 'number' ? valor.toLocaleString('es-AR') : String(valor)])
    return { capa, nombre: capaFija(servicio, capa)?.nombre ?? capa, datos: visibles, geometria: f.geometry }
  })
}

/**
 * Respuesta de ArcGIS (application/vnd.esri.wms_featureinfo_xml): un FeatureInfoCollection por
 * capa, con un FeatureInfo por objeto y sus Field (FieldName / FieldValue). No trae geometría.
 */
function objetosDeXmlEsri(servicio: ServicioWms, xml: string): ObjetoConsultado[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const hijos = (el: Element, nombre: string) => [...el.children].filter((c) => c.localName === nombre)
  return [...doc.getElementsByTagNameNS('*', 'FeatureInfoCollection')].flatMap((coleccion) => {
    const capa = coleccion.getAttribute('layername') ?? ''
    return hijos(coleccion, 'FeatureInfo').map((objeto) => {
      const datos = hijos(objeto, 'Field')
        .map((campo): [string, string] => [hijos(campo, 'FieldName')[0]?.textContent?.trim() ?? '', hijos(campo, 'FieldValue')[0]?.textContent?.trim() ?? ''])
        .filter(([campo, valor]) => campo && valor && !CAMPOS_OCULTOS.has(campo.toUpperCase()) && !/^(Shape|OBJECTID|FID)(.|_|$)/i.test(campo) && valor !== 'Null')
        .map(([campo, valor]): [string, string] => [nombreCampo(campo.toUpperCase()), valor])
      return { capa, nombre: capaFija(servicio, capa)?.nombre ?? capa.replace(/_/g, ' '), datos, geometria: null }
    })
  })
}
