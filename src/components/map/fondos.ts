// Mapas de fondo de toda la aplicación (visor y mapas de los formularios).
//
//   Satélite (Esri)  imagen satelital World Imagery + nombres de lugares y rutas encima (híbrido).
//                    Es el fondo por defecto: se ven las parcelas, los cultivos y los cauces.
//   Argenmap (IGN)   el mapa oficial de la Argentina (servicio TMS: el eje Y va invertido).
//
// El visor ofrece además las variantes del IGN y OpenStreetMap (FONDOS_VISOR); si un fondo
// no responde (caído o bloqueado por la red), se cambia solo a otro y se avisa.
import L from 'leaflet'

export const SATELITE = 'Satélite (Esri)'
export const ARGENMAP = 'Argenmap (IGN)'
export type NombreFondo = typeof SATELITE | typeof ARGENMAP

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'

/**
 * La imagen satelital tiene detalle hasta el zoom 18 en casi toda la provincia; más cerca se
 * agranda la del 18 (maxNativeZoom) en vez de mostrar «Map data not yet available».
 */
const opcionesEsri = { maxZoom: 21, maxNativeZoom: 18, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' }

export const FONDOS: Record<NombreFondo, () => L.Layer> = {
  [SATELITE]: () =>
    L.layerGroup([
      L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, opcionesEsri),
      // Rutas y nombres de lugares, para ubicarse sobre la imagen.
      L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { ...opcionesEsri, opacity: 0.6, attribution: undefined }),
      L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { ...opcionesEsri, attribution: undefined }),
    ]),
  [ARGENMAP]: () =>
    L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{y}.png', {
      tms: true,
      maxZoom: 21,
      maxNativeZoom: 19,
      attribution: '© Instituto Geográfico Nacional',
    }),
}

// ---------------------------------------------------------------------------
// Fondos del visor: los dos de siempre más Google Híbrido, el topográfico de Esri, las
// variantes del IGN y OpenStreetMap.
// Cada uno trae una miniatura (una tesela de Tucumán) para el selector de mapas base.
// ---------------------------------------------------------------------------

const IGN_TMS = 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0'
const capaIgn = (capa: string) =>
  L.tileLayer(`${IGN_TMS}/${capa}@EPSG%3A3857@png/{z}/{x}/{y}.png`, { tms: true, maxZoom: 21, maxNativeZoom: 19, attribution: '© Instituto Geográfico Nacional' })
/** Tesela de Tucumán en el zoom 10 (x 325, y 591; en TMS la y va invertida: 432). */
const miniaturaIgn = (capa: string) => `${IGN_TMS}/${capa}@EPSG%3A3857@png/10/325/432.png`

export interface FondoVisor {
  id: string
  nombre: string
  descripcion: string
  miniatura: string
  crear: () => L.Layer
}

export const FONDOS_VISOR: FondoVisor[] = [
  { id: 'satelite', nombre: 'Satélite Esri', descripcion: 'Imagen Esri con rutas y lugares', miniatura: `${ESRI}/World_Imagery/MapServer/tile/10/591/325`, crear: FONDOS[SATELITE] },
  {
    id: 'google',
    nombre: 'Google Híbrido',
    descripcion: 'Imagen de Google con calles y nombres',
    miniatura: 'https://mt1.google.com/vt/lyrs=y&x=325&y=591&z=10',
    crear: () =>
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: '0123', maxZoom: 21, maxNativeZoom: 20, attribution: 'Imágenes © Google' }),
  },
  { id: 'argenmap', nombre: 'Argenmap', descripcion: 'Mapa oficial del IGN', miniatura: miniaturaIgn('capabaseargenmap'), crear: FONDOS[ARGENMAP] },
  { id: 'gris', nombre: 'Argenmap gris', descripcion: 'Resalta las capas propias', miniatura: miniaturaIgn('mapabase_gris'), crear: () => capaIgn('mapabase_gris') },
  {
    id: 'topo-esri',
    nombre: 'Topográfico Esri',
    descripcion: 'Relieve, caminos y lugares (Esri)',
    miniatura: `${ESRI}/World_Topo_Map/MapServer/tile/10/591/325`,
    crear: () => L.tileLayer(`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, { ...opcionesEsri, attribution: 'Mapa © Esri' }),
  },
  { id: 'topo', nombre: 'Topográfico IGN', descripcion: 'Relieve y curvas de nivel (IGN)', miniatura: miniaturaIgn('mapabase_topo'), crear: () => capaIgn('mapabase_topo') },
  { id: 'oscuro', nombre: 'Argenmap oscuro', descripcion: 'Para trabajar de noche', miniatura: miniaturaIgn('argenmap_oscuro'), crear: () => capaIgn('argenmap_oscuro') },
  {
    id: 'osm',
    nombre: 'OpenStreetMap',
    descripcion: 'Calles, caminos y lugares',
    miniatura: 'https://tile.openstreetmap.org/10/325/591.png',
    crear: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap' }),
  },
]

/**
 * Pone en el mapa el fondo del visor con ese id (quitando el anterior). Si no responde,
 * pasa al satelital o, si el que falla es el satelital, a Argenmap, y lo avisa con `onFalla`.
 */
export function ponerFondoVisor(m: L.Map, id: string, anterior: L.Layer | null, onFalla: (texto: string, reemplazo: string) => void): L.Layer {
  if (anterior) m.removeLayer(anterior)
  const fondo = FONDOS_VISOR.find((f) => f.id === id) ?? FONDOS_VISOR[0]
  const capa = fondo.crear()
  const teselas = teselasDe(capa)
  let errores = 0
  let cargo = false
  teselas.on('tileload', () => (cargo = true))
  teselas.on('tileerror', () => {
    if (cargo || ++errores < ERRORES_PARA_CAMBIAR || !m.hasLayer(capa)) return
    teselas.off('tileerror')
    const reemplazo = FONDOS_VISOR.find((f) => f.id === (fondo.id === 'satelite' ? 'argenmap' : 'satelite'))!
    onFalla(`${fondo.nombre} no responde: se muestra ${reemplazo.nombre}.`, reemplazo.id)
  })
  return capa.addTo(m)
}

/** Si un fondo falla tantas teselas sin haber cargado ninguna, se pasa al otro. */
const ERRORES_PARA_CAMBIAR = 4

/** La capa de teselas «principal» de un fondo (en el satelital, la imagen; no los nombres). */
const teselasDe = (fondo: L.Layer): L.TileLayer => (fondo instanceof L.TileLayer ? fondo : ((fondo as L.LayerGroup).getLayers()[0] as L.TileLayer))
