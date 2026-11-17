import { useEffect, useRef, type RefObject } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FeatureCollection, Geometry, MultiPolygon } from 'geojson'
import { ponerFondoVisor } from '@/components/map/fondos'
import { CENTRO_TUCUMAN, puntoEtiqueta, type LatLng } from '@/lib/geo'
import { aPosgar, formatearPosgar } from '@/lib/posgar'
import { COLOR_COMPARACION, COLOR_POZO_A_REVISAR, COLOR_POZO_OFICIO, DISTANCIA_MAX_PUNTO_M, TIPOS_PUNTO, ZOOM_ETIQUETAS, colorPozo, formatoHa, formatoNumero, nombreEstado, nombreEstadoPozo, tituloConcesion } from '../estilos'
import { capaFija, capasActivas, consultar, SERVICIOS_WMS, type EstadoWms, type ObjetoConsultado, type ServicioWms } from '../capasWms'
import { CAPAS_DRH, camposDe, type CapaDrh, type TipoCapaDrh } from '../capasDrh'
import { claveOpacidadDrh, claveOpacidadWms, CLAVE_RELLENO_CONCESIONES, opacidadDe, RELLENO_CONCESIONES, type Opacidades } from '../preferencias'
import type { CapasVisor } from '../filtros'
import { iniciarMedicion, type ResultadoMedicion, type TipoMedicion } from '../medicion'
import type { AtributosConcesion, CauceGeo, ConcesionGeo, PozoGeo, PuntoGeo } from '../types'

/** Escala aproximada (1:N) en la latitud del centro, para una pantalla de 96 ppp. */
function escalaDe(m: L.Map): number {
  const lat = m.getCenter().lat
  const metrosPorPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (m.getZoom() + 8)
  return metrosPorPixel * (96 / 0.0254)
}

/** Marca de «Ir a coordenada»: un pin con el ícono de Material Symbols. */
const ICONO_MARCA = L.divIcon({
  className: '',
  html: '<span class="material-symbols-outlined icon-fill" style="font-size:40px;color:#dc2626;text-shadow:0 1px 3px rgba(0,0,0,.45)">location_on</span>',
  iconSize: [40, 40],
  iconAnchor: [20, 38],
  popupAnchor: [0, -34],
})

/**
 * Márgenes al encuadrar: los paneles flotan sobre el mapa (barra lateral y panel a la
 * izquierda, herramientas y ficha a la derecha, barra de estado abajo), así que se deja libre
 * esa zona para que lo encuadrado no quede debajo. En pantallas angostas los paneles van arriba.
 */
function margenesLibres(m: L.Map): L.FitBoundsOptions {
  const ancho = m.getSize().x
  return ancho >= 900
    ? { paddingTopLeft: [440, 80], paddingBottomRight: [360, 60] }
    : { paddingTopLeft: [70, 130], paddingBottomRight: [20, 60] }
}

/**
 * Debajo de este zoom las parcelas (de pocas hectáreas) se ven como puntitos: cada concesión
 * se marca además con un círculo de su color, que se puede tocar.
 */
const ZOOM_MARCADORES = 12

/** Alto aproximado de la etiqueta (13 px de letra). */
const ALTO_TEXTO_PX = 16

/** Ancho en píxeles del texto con la letra de la etiqueta (se mide una vez por concesión). */
let medidor: CanvasRenderingContext2D | null = null
function anchoDeTexto(texto: string): number {
  medidor ??= document.createElement('canvas').getContext('2d')
  if (!medidor) return texto.length * 8
  medidor.font = "800 13px 'Public Sans', sans-serif"
  return medidor.measureText(texto).width + 3 // + el contorno blanco
}

/** Texto de la etiqueta: el número de concesión o, si todavía está en trámite, el expediente. */
const textoEtiqueta = (p: AtributosConcesion) => p.numero ?? (p.expediente ? `Exp. ${p.expediente}` : null)

/** Ríos y canales: azul (los canales, punteados). Van debajo de las concesiones. */
const COLOR_RIO = '#2563eb'
const COLOR_CANAL = '#0891b2'

/** Texto del tooltip de un pozo. */
function tooltipPozo(p: PozoGeo['properties']) {
  const datos = [
    p.profundidad_m !== null && `${formatoNumero(p.profundidad_m)} m de profundidad`,
    p.caudal_lps !== null && `${formatoNumero(p.caudal_lps)} l/s`,
  ].filter(Boolean)
  const concesion = p.concesion_numero ? `Concesión ${p.concesion_numero}` : 'Sin concesión'
  const aviso = p.dentro_de_concesion === false ? `<br><span style="color:${COLOR_POZO_A_REVISAR}">⚠ Cae fuera del polígono de su concesión</span>` : ''
  const oficio = p.origen === 'OFICIO' ? `<br><span style="color:${COLOR_POZO_OFICIO}">Registrado de oficio</span>` : ''
  return `<strong>${p.alias ?? 'Pozo'}</strong> · ${p.id_interno}<br>${concesion} · ${nombreEstadoPozo(p.estado)}${datos.length ? `<br>${datos.join(' · ')}` : ''}${oficio}${aviso}`
}

/** Texto del tooltip de un desagüe o punto de entrega: las dos coordenadas, la cargada primero. */
function tooltipPunto(p: PuntoGeo['properties']) {
  const posgar = `POSGAR X ${formatoNumero(p.coord_x, 0)} · Y ${formatoNumero(p.coord_y, 0)}`
  const grados = `${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}`
  const coordenadas = p.sistema_carga === 'WGS84' ? `${grados}<br>${posgar}` : `${posgar}<br>${grados}`
  const concesion = p.concesion_numero ? `Concesión ${p.concesion_numero}` : p.expediente ? `Alta en trámite · Exp. ${p.expediente}` : 'Alta en trámite'
  const lejos = p.distancia_poligono_m !== null && p.distancia_poligono_m > DISTANCIA_MAX_PUNTO_M
  const aviso = lejos ? `<br><span style="color:${COLOR_POZO_A_REVISAR}">⚠ A ${formatoNumero(p.distancia_poligono_m! / 1000)} km del polígono de su concesión</span>` : ''
  return `<strong>${TIPOS_PUNTO[p.tipo].nombre}</strong> · ${concesion}${p.referencia ? `<br>${p.referencia}` : ''}<br>${coordenadas}${aviso}`
}

const escapar = (texto: string) => texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Contenido del globo de la consulta a otros organismos: un bloque por objeto encontrado. */
function htmlConsulta(objetos: ObjetoConsultado[]) {
  return objetos
    .map(({ nombre, datos }) => {
      const filas = datos.map(([campo, valor]) => `<tr><td style="padding:1px 8px 1px 0;color:#64748b;vertical-align:top">${escapar(campo)}</td><td style="padding:1px 0;font-weight:600">${escapar(valor)}</td></tr>`).join('')
      return `<div style="margin-bottom:6px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#a16207">${escapar(nombre)}</div>${filas ? `<table style="font-size:13px">${filas}</table>` : '<div style="color:#64748b">Sin datos cargados</div>'}</div>`
    })
    .join('')
}

/** Globo de un objeto de las capas del GeoServer de la DRH: título y todos sus datos. */
function htmlObjetoDrh(capa: CapaDrh, p: Record<string, unknown>) {
  const filas = camposDe(capa, p)
    .map(([campo, valor]) => `<tr><td style="padding:1px 8px 1px 0;color:#64748b;vertical-align:top">${escapar(campo)}</td><td style="padding:1px 0;font-weight:600">${escapar(valor)}</td></tr>`)
    .join('')
  return `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:${capa.color}">${escapar(capa.nombre)}</div><div style="font-weight:700;margin-bottom:4px">${escapar(capa.titulo(p))}</div><div style="max-height:260px;overflow-y:auto"><table style="font-size:13px">${filas}</table></div><div style="margin-top:4px;font-size:11px;color:#94a3b8">GeoServer DRH · copia local</div>`
}

/**
 * Panel de las capas del GeoServer de la DRH: encima de las capas propias (que se dibujan en un
 * <canvas>) y en SVG, para que los clics donde no hay nada de estas capas lleguen al canvas de abajo.
 */
const PANEL_DRH = 'capasDrh'

/** Estilo de un objeto de una capa del GeoServer con la opacidad elegida para la capa (1 = la de fábrica). */
/**
 * Estilo de una capa del GeoServer. El relleno de sus polígonos sigue el control global «Relleno de
 * polígonos» (con el valor de fábrica de las concesiones, 30 %, quedan en el 15 % de siempre).
 */
function estiloDrh(def: CapaDrh, opacidad: number, renderer: L.SVG, relleno: number): L.CircleMarkerOptions {
  const base = { renderer, pane: PANEL_DRH, color: def.color, dashArray: def.punteado ? '6 4' : undefined }
  if (def.tipo === 'punto') return { ...base, radius: 5, color: '#fff', weight: 1.5, opacity: opacidad, fillColor: def.color, fillOpacity: opacidad }
  if (def.tipo === 'limite') return { ...base, weight: 2.5, opacity: 0.9 * opacidad, fill: false }
  if (def.tipo === 'linea') return { ...base, weight: 2.5, opacity: 0.9 * opacidad }
  return { ...base, weight: 1.5, opacity: opacidad, fillColor: def.color, fillOpacity: 0.5 * relleno * opacidad }
}

/** Orden de dibujo: los límites abajo, después polígonos, líneas y, arriba de todo, los puntos. */
const ORDEN_DRH: TipoCapaDrh[] = ['limite', 'poligono', 'linea', 'punto']

/** Color del resaltado de lo consultado (el de las parcelas de Catastro, más grueso). */
const COLOR_CONSULTA = '#facc15'

/** Rombo para los puntos de la sección de usos (los pozos son círculos: no se confunden). */
const iconoPunto = (color: string, aRevisar: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [14, 14],
    html: `<span style="display:block;width:14px;height:14px;transform:rotate(45deg) scale(.75);background:${color};border:${aRevisar ? 3 : 2}px solid ${aRevisar ? COLOR_POZO_A_REVISAR : '#fff'};box-shadow:0 0 2px rgba(0,0,0,.5)"></span>`,
  })

interface Props {
  concesiones: ConcesionGeo[]
  /** Color de cada concesión según el criterio elegido en el panel (estado, uso, distrito…). */
  colorDe: (p: AtributosConcesion) => string
  /** Pozos a dibujar (puntos). Clic en un pozo → selecciona su concesión. */
  pozos?: PozoGeo[]
  /** Desagües y puntos de entrega (rombos). Clic → selecciona su concesión. */
  puntos?: PuntoGeo[]
  /** Ríos y canales (líneas). */
  cauces?: CauceGeo[]
  /** Capas del GeoServer de la DRH que se ven (copia local), ya leídas. Clic en un objeto → sus datos. */
  capasDrh?: { id: string; datos?: FeatureCollection }[]
  /** Opacidad elegida para cada capa (temas WMS, capas del GeoServer, relleno de las concesiones). */
  opacidades?: Opacidades
  /** Qué capas se ven. */
  capas: CapasVisor
  /** Capas WMS de otros organismos que se ven. Clic en el mapa → consulta las que se pueden consultar. */
  wms: EstadoWms
  /** Pedido de encuadre (ir a un distrito o departamento). `clave` cambia en cada pedido. */
  encuadre?: { recuadro: [number, number, number, number]; clave: number } | null
  seleccionada: number | null
  onSeleccionar: (concesionId: number | null) => void
  /** Polígono que se está comparando (un KML cargado en el visor), en rojo punteado. */
  comparacion?: MultiPolygon | null
  /** Mapa base (id de FONDOS_VISOR). */
  fondo: string
  /** El fondo no respondió: se pasó a `reemplazo` (el padre actualiza su estado y avisa). */
  onFondoFalla: (texto: string, reemplazo: string) => void
  /** Medición activa. `clave` cambia para empezar una nueva del mismo tipo. */
  medicion?: { tipo: TipoMedicion; clave: number } | null
  onMedicion?: (resultado: ResultadoMedicion) => void
  /** Punto de «Ir a coordenada» (se marca con un pin y se centra el mapa). */
  marca?: { lat: number; lng: number; texto: string; clave: number } | null
  /** Zoom y escala actuales, para la barra de estado. */
  onVista?: (vista: { zoom: number; escala: number }) => void
  /** Elemento donde se escribe la posición del cursor (directo en el DOM: cambia en cada movimiento). */
  refCursor?: RefObject<HTMLElement | null>
}

/**
 * Mapa del visor: concesiones (polígonos coloreados según el criterio elegido), pozos (puntos)
 * y ríos y canales (líneas); cada capa se prende y apaga desde el panel.
 *   - Clic en un polígono o en un pozo → selecciona la concesión (y la resalta).
 *   - Al cambiar la selección desde la lista → centra el mapa en esa concesión.
 *   - Al cargar la capa la primera vez → encuadra todas las concesiones.
 *   - «Ir a» un distrito o departamento → encuadra esa zona.
 *   - Si hay un polígono de comparación → lo dibuja encima y lo encuadra.
 *   - Mapa base, mediciones y «Ir a coordenada» los maneja el visor (barra de herramientas).
 *   Mientras se mide, los clics son vértices: no seleccionan concesiones.
 */
export function MapaConcesiones(props: Props) {
  const { concesiones, colorDe, pozos = [], puntos = [], cauces = [], capasDrh = [], opacidades = {}, capas, wms, encuadre, seleccionada, onSeleccionar, comparacion } = props
  const { fondo, onFondoFalla, medicion, onMedicion, marca, onVista, refCursor } = props
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.GeoJSON | null>(null)
  const marcadores = useRef<L.LayerGroup | null>(null)
  const capaComparacion = useRef<L.GeoJSON | null>(null)
  const capaPozos = useRef<L.LayerGroup | null>(null)
  const capaPuntos = useRef<L.LayerGroup | null>(null)
  const capaCauces = useRef<L.GeoJSON | null>(null)
  /** Capa WMS de cada tema de otro organismo (clave «servicio|capa»): una por tema, así una capa rota no apaga las demás. */
  const capasWms = useRef(new Map<string, L.TileLayer.WMS>())
  /** Capa de Leaflet de cada capa del GeoServer de la DRH que se ve (con los datos que dibuja). */
  const dibujadasDrh = useRef(new Map<string, { datos: FeatureCollection; capa: L.LayerGroup; def: CapaDrh; geo: L.GeoJSON; etiquetas: L.Marker[] }>())
  const opacidadesActuales = useRef(opacidades)
  opacidadesActuales.current = opacidades
  const relleno = opacidadDe(opacidades, CLAVE_RELLENO_CONCESIONES, RELLENO_CONCESIONES)
  const rellenoActual = useRef(relleno)
  rellenoActual.current = relleno
  /** Relleno de una concesión: la seleccionada, un poco más marcada. */
  const rellenoDe = (elegida: boolean) => (elegida ? Math.min(1, rellenoActual.current + 0.2) : rellenoActual.current)
  const rendererDrh = useRef<L.SVG | null>(null)
  const wmsActual = useRef(wms)
  wmsActual.current = wms
  /** Consulta en curso o mostrada: el globo, lo resaltado y el pedido (para cancelarlo). */
  const consulta = useRef<{ globo: L.Popup | null; resaltado: L.GeoJSON | null; control: AbortController | null }>({ globo: null, resaltado: null, control: null })
  /** Polígono de Leaflet de cada concesión, para resaltarla y centrarla. */
  const porId = useRef(new Map<number, L.Path>())
  const encuadrada = useRef(false)
  // Los callbacks y las capas cambian en cada render; se guardan en refs para usarlos en los eventos del mapa.
  const seleccionar = useRef(onSeleccionar)
  seleccionar.current = onSeleccionar
  const verConcesiones = useRef(capas.concesiones)
  verConcesiones.current = capas.concesiones
  const midiendo = useRef(false)
  midiendo.current = !!medicion
  const eventos = useRef({ onFondoFalla, onMedicion, onVista, refCursor })
  eventos.current = { onFondoFalla, onMedicion, onVista, refCursor }
  const capaFondo = useRef<L.Layer | null>(null)
  /** Punto y texto de la etiqueta de cada concesión; se calculan una vez por dato. */
  const etiquetas = useRef<{ punto: LatLng; texto: string; ancho: number; alto: number; anchoTexto: number }[]>([])
  const capaEtiquetas = useRef<L.LayerGroup | null>(null)
  const verEtiquetas = useRef(capas.concesiones && capas.etiquetas)
  verEtiquetas.current = capas.concesiones && capas.etiquetas

  // 1. Crear / destruir el mapa. preferCanvas: dibuja en un solo <canvas> en vez de un
  //    elemento SVG por polígono (con miles de concesiones la diferencia es grande).
  useEffect(() => {
    if (!contenedor.current) return
    // El zoom va abajo a la derecha, sobre la barra de estado: arriba flotan los paneles.
    const m = L.map(contenedor.current, { preferCanvas: true, zoomControl: false }).setView(CENTRO_TUCUMAN, 9)
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(m)
    // Panel de las capas del GeoServer (ver PANEL_DRH): sin eventos propios, solo los de sus objetos.
    const panelDrh = m.createPane(PANEL_DRH)
    panelDrh.style.zIndex = '450'
    panelDrh.style.pointerEvents = 'none'
    rendererDrh.current = L.svg({ pane: PANEL_DRH })
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>')
    // Clic fuera de un polígono: quita la selección (salvo que se esté midiendo) y consulta las
    // capas de otros organismos que se ven (ej: padrón y nomenclatura de la parcela de Catastro).
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (midiendo.current) return
      seleccionar.current(null)
      void consultarWms(e)
    })
    // Posición del cursor en latitud/longitud y en POSGAR 07 (la que usa la oficina).
    m.on('mousemove', (e: L.LeafletMouseEvent) => {
      const destino = eventos.current.refCursor?.current
      if (!destino) return
      const { lat, lng } = e.latlng
      destino.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}  ·  POSGAR ${formatearPosgar(aPosgar(lat, lng))}`
    })
    const avisarVista = () => eventos.current.onVista?.({ zoom: m.getZoom(), escala: escalaDe(m) })
    m.on('zoomend moveend', avisarVista)
    m.on('moveend', () => dibujarEtiquetas())
    avisarVista()
    // Marcadores de las concesiones solo con el mapa alejado.
    m.on('zoomend', () => {
      const grupo = marcadores.current
      if (!grupo) return
      if (m.getZoom() < ZOOM_MARCADORES && verConcesiones.current) grupo.addTo(m)
      else grupo.remove()
    })
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capa.current = null
      marcadores.current = null
      capaComparacion.current = null
      capaPozos.current = null
      capaPuntos.current = null
      capaCauces.current = null
      capasWms.current.clear()
      dibujadasDrh.current.clear()
      rendererDrh.current = null
      consulta.current.control?.abort()
      consulta.current = { globo: null, resaltado: null, control: null }
      capaFondo.current = null
      capaEtiquetas.current = null
      porId.current.clear()
      encuadrada.current = false
    }
  }, [])

  // 2. Concesiones: se redibujan cuando cambian los datos, el filtro, los colores o si se ven.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capa.current?.remove()
    marcadores.current?.remove()
    porId.current.clear()
    const grupo = L.layerGroup()

    const geo = L.geoJSON(concesiones, {
      style: (f) => {
        const color = f ? colorDe(f.properties) : '#64748b'
        return { color, weight: 2.5, opacity: 1, fillColor: color, fillOpacity: rellenoDe(f?.properties.concesion_id === seleccionada) }
      },
      onEachFeature: (f: ConcesionGeo, layer) => {
        const p = f.properties
        porId.current.set(p.concesion_id, layer as L.Path)
        const tooltip = `<strong>${tituloConcesion(p)}</strong><br>${p.titular ?? 'Sin titular cargado'}<br>${nombreEstado(p.estado)} · ${formatoHa(p.superficie_ha)}${p.usos ? `<br>${p.usos}` : ''}`
        const alHacerClic = (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return // el clic sigue al mapa: es un vértice de la medición
          L.DomEvent.stopPropagation(e)
          seleccionar.current(p.concesion_id)
        }
        layer.bindTooltip(tooltip, { sticky: true }).on('click', alHacerClic)

        // Marcador en el centro de la parcela, para cuando el mapa está alejado.
        L.circleMarker((layer as L.Polygon).getBounds().getCenter(), { radius: 5, color: '#fff', weight: 1.5, fillColor: colorDe(p), fillOpacity: 0.95 })
          .bindTooltip(tooltip)
          .on('click', alHacerClic)
          .addTo(grupo)
      },
    })
    capa.current = geo
    marcadores.current = grupo
    etiquetas.current = concesiones.flatMap((f) => {
      const texto = textoEtiqueta(f.properties)
      const lugar = texto ? puntoEtiqueta(f.geometry.coordinates) : null
      return texto && lugar ? [{ ...lugar, texto, anchoTexto: anchoDeTexto(texto) }] : []
    })
    dibujarEtiquetas()
    if (capas.concesiones) {
      geo.addTo(m)
      if (m.getZoom() < ZOOM_MARCADORES) grupo.addTo(m)
    }
    capaCauces.current?.bringToBack()
    pozosAlFrente()
    capaComparacion.current?.bringToFront()

    // La primera vez, encuadrar todas las concesiones (después se respeta lo que hizo el usuario).
    if (!encuadrada.current && concesiones.length) {
      encuadrada.current = true
      const frame = requestAnimationFrame(() => {
        if (mapa.current !== m) return
        m.invalidateSize()
        m.fitBounds(geo.getBounds(), { ...margenesLibres(m), maxZoom: 16, animate: false })
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [concesiones, colorDe, capas.concesiones])

  // 2b. Pozos: un punto por pozo, con el color de su estado. Borde rojo si cae fuera de su concesión.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaPozos.current?.remove()
    capaPozos.current = null
    if (!capas.pozos) return
    const grupo = L.layerGroup()
    for (const pozo of pozos) {
      const p = pozo.properties
      const [lng, lat] = pozo.geometry.coordinates
      const aRevisar = p.dentro_de_concesion === false
      const oficio = p.origen === 'OFICIO'
      const borde = aRevisar ? COLOR_POZO_A_REVISAR : oficio ? COLOR_POZO_OFICIO : '#fff'
      L.circleMarker([lat, lng], { radius: oficio ? 7 : 6, color: borde, weight: aRevisar || oficio ? 3 : 2, fillColor: colorPozo(p.estado), fillOpacity: 1 })
        .bindTooltip(tooltipPozo(p))
        .on('click', (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return
          L.DomEvent.stopPropagation(e)
          if (p.concesion_id !== null) seleccionar.current(p.concesion_id)
        })
        .addTo(grupo)
    }
    grupo.addTo(m)
    capaPozos.current = grupo
  }, [pozos, capas.pozos])

  // 2b'. Desagües y puntos de entrega: rombos con el color del tipo. Borde rojo si quedan lejos del polígono.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaPuntos.current?.remove()
    capaPuntos.current = null
    if (!capas.puntos) return
    const grupo = L.layerGroup()
    for (const punto of puntos) {
      const p = punto.properties
      const [lng, lat] = punto.geometry.coordinates
      const aRevisar = p.distancia_poligono_m !== null && p.distancia_poligono_m > DISTANCIA_MAX_PUNTO_M
      L.marker([lat, lng], { icon: iconoPunto(TIPOS_PUNTO[p.tipo].color, aRevisar), keyboard: false })
        .bindTooltip(tooltipPunto(p), { offset: [8, 0], direction: 'right' })
        .on('click', (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return
          L.DomEvent.stopPropagation(e)
          seleccionar.current(p.concesion_id)
        })
        .addTo(grupo)
    }
    grupo.addTo(m)
    capaPuntos.current = grupo
  }, [puntos, capas.puntos])

  // 2c. Ríos y canales: líneas azules (canales punteados), siempre debajo de las concesiones.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaCauces.current?.remove()
    capaCauces.current = null
    if (!capas.cauces || !cauces.length) return
    const geo = L.geoJSON(cauces, {
      style: (f) =>
        f?.properties.tipo === 'CANAL'
          ? { color: COLOR_CANAL, weight: 2.5, dashArray: '6 4', opacity: 0.9 }
          : { color: COLOR_RIO, weight: f?.properties.nombre ? 3 : 1.5, opacity: 0.8 },
      onEachFeature: (f: CauceGeo, layer) => {
        const p = f.properties
        layer.bindTooltip(`<strong>${p.nombre ?? (p.tipo === 'CANAL' ? 'Canal sin nombre' : 'Cauce sin nombre')}</strong><br>${p.tipo === 'CANAL' ? 'Canal' : 'Río / arroyo'} · ${formatoNumero(p.largo_km)} km`, {
          sticky: true,
        })
      },
    }).addTo(m)
    geo.bringToBack()
    capaCauces.current = geo
  }, [cauces, capas.cauces])

  // 2c'. Servicios WMS de otros organismos: imágenes del servidor de origen, encima del mapa
  //      base (zIndex) y debajo de las capas vectoriales de la DRH (que van en otro panel).
  //      Los primeros servicios de la lista van arriba (Catastro: las parcelas sobre los cultivos).
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const pedidas = new Map(capasActivas(wms).map((c) => [`${c.servicio.id}|${c.capa}`, c]))
    for (const [clave, capa] of capasWms.current) {
      if (pedidas.has(clave)) continue
      capa.remove()
      capasWms.current.delete(clave)
    }
    for (const [clave, { servicio, tema, capa }] of pedidas) {
      if (capasWms.current.has(clave)) continue
      const fija = capaFija(servicio, capa)
      const nueva = L.tileLayer
        .wms(servicio.url, {
          layers: capa,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          opacity: opacidadDe(opacidadesActuales.current, claveOpacidadWms(servicio.id, tema), servicio.opacidad ?? 0.75),
          zIndex: 10 + SERVICIOS_WMS.length - SERVICIOS_WMS.indexOf(servicio),
          minZoom: fija?.minZoom ?? 0,
          maxZoom: 21,
          attribution: servicio.fuente,
          // Parámetro extra del pedido (Leaflet lo agrega a la URL): estilo propio de la capa.
          ...(fija?.estilo ? { SLD_BODY: fija.estilo } : {}),
        })
        .addTo(m)
      capasWms.current.set(clave, nueva)
    }
  }, [wms])

  // 2c''. Capas del GeoServer de la DRH (copia local): se agregan y quitan de a una, según el panel.
  useEffect(() => {
    const m = mapa.current
    const renderer = rendererDrh.current
    if (!m || !renderer) return
    const pedidas = new Map(capasDrh.filter((c) => c.datos).map((c) => [c.id, c.datos!]))
    for (const [id, { datos, capa }] of dibujadasDrh.current) {
      if (pedidas.get(id) === datos) continue
      capa.remove()
      dibujadasDrh.current.delete(id)
    }
    let agregadas = 0
    for (const [id, datos] of pedidas) {
      if (dibujadasDrh.current.has(id)) continue
      const def = CAPAS_DRH.find((c) => c.id === id)
      if (!def) continue
      const opacidad = opacidadDe(opacidadesActuales.current, claveOpacidadDrh(id), 1)
      dibujadasDrh.current.set(id, { datos, def, ...dibujarCapaDrh(def, datos, renderer, opacidad) })
      dibujadasDrh.current.get(id)!.capa.addTo(m)
      agregadas++
    }
    if (!agregadas) return
    // Orden de dibujo por tipo (el SVG dibuja arriba lo último).
    for (const tipo of ORDEN_DRH) {
      for (const [id, { capa }] of dibujadasDrh.current) {
        if (CAPAS_DRH.find((c) => c.id === id)?.tipo === tipo) capa.eachLayer((l) => (l as L.FeatureGroup).bringToFront?.())
      }
    }
  }, [capasDrh])

  /**
   * Una capa del GeoServer: puntos (círculos), líneas o polígonos del color de la capa; los límites
   * (distritos, departamentos) solo con borde, sin clic y con su nombre en el centro.
   */
  function dibujarCapaDrh(def: CapaDrh, datos: FeatureCollection, renderer: L.SVG, opacidad: number) {
    const limite = def.tipo === 'limite'
    const geo = L.geoJSON(datos, {
      pane: PANEL_DRH,
      interactive: !limite,
      pointToLayer: (_, latlng) => L.circleMarker(latlng, estiloDrh(def, opacidad, renderer, rellenoActual.current)),
      style: () => estiloDrh(def, opacidad, renderer, rellenoActual.current),
      onEachFeature: (f, layer) => {
        if (limite) return
        const p = (f.properties ?? {}) as Record<string, unknown>
        layer.bindTooltip(`<strong>${escapar(def.titulo(p))}</strong><br><span style="color:#64748b">${escapar(def.nombre)}</span>`, { sticky: def.tipo !== 'punto' })
        layer.on('click', (e: L.LeafletMouseEvent) => {
          if (midiendo.current) return
          L.DomEvent.stopPropagation(e)
          limpiarConsulta()
          L.popup({ maxWidth: 360, autoPanPaddingTopLeft: [440, 80] }).setLatLng(e.latlng).setContent(htmlObjetoDrh(def, p)).openOn(mapa.current!)
        })
      },
    })
    const grupo = L.layerGroup([geo])
    const etiquetas: L.Marker[] = []
    if (limite) {
      // Nombre del distrito o departamento en el centro de su recuadro.
      geo.eachLayer((l) => {
        const p = ((l as L.Polygon).feature?.properties ?? {}) as Record<string, unknown>
        const etiqueta = L.marker((l as L.Polygon).getBounds().getCenter(), {
          pane: PANEL_DRH,
          interactive: false,
          keyboard: false,
          opacity: opacidad,
          icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span style="display:inline-block;transform:translate(-50%,-50%);white-space:nowrap;font:700 12px 'Public Sans',sans-serif;color:${def.color};text-shadow:0 0 3px #fff,0 0 3px #fff">${escapar(def.titulo(p))}</span>` }),
        }).addTo(grupo)
        etiquetas.push(etiqueta)
      })
    }
    return { capa: grupo, geo, etiquetas }
  }

  // 2c'''. Opacidad elegida en el panel: se cambia el estilo de lo que ya está dibujado (sin volver a pedirlo).
  useEffect(() => {
    for (const { servicio, tema, capa } of capasActivas(wms)) {
      capasWms.current.get(`${servicio.id}|${capa}`)?.setOpacity(opacidadDe(opacidades, claveOpacidadWms(servicio.id, tema), servicio.opacidad ?? 0.75))
    }
    const renderer = rendererDrh.current
    if (renderer) {
      for (const [id, { def, geo, etiquetas }] of dibujadasDrh.current) {
        const opacidad = opacidadDe(opacidades, claveOpacidadDrh(id), 1)
        geo.setStyle(() => estiloDrh(def, opacidad, renderer, rellenoActual.current))
        for (const e of etiquetas) e.setOpacity(opacidad)
      }
    }
    porId.current.forEach((layer, id) => layer.setStyle({ fillOpacity: rellenoDe(id === seleccionada) }))
  }, [opacidades])

  /** Quita el globo y el resaltado de la consulta anterior, y cancela la que esté en curso. */
  function limpiarConsulta() {
    const c = consulta.current
    c.control?.abort()
    c.resaltado?.remove()
    if (c.globo) mapa.current?.closePopup(c.globo)
    consulta.current = { globo: null, resaltado: null, control: null }
  }

  /**
   * Consulta (GetFeatureInfo) las capas que se ven de los servicios consultables, en el punto del
   * clic. Muestra los datos en un globo y resalta lo encontrado. Solo usa refs: se llama desde el
   * evento de clic, que se registra una sola vez.
   */
  async function consultarWms(e: L.LeafletMouseEvent) {
    const m = mapa.current
    if (!m) return
    limpiarConsulta()
    const porServicio = new Map<ServicioWms, string[]>()
    for (const { servicio, capa } of capasActivas(wmsActual.current)) {
      const minZoom = capaFija(servicio, capa)?.minZoom ?? 0
      if (servicio.consultable && m.getZoom() >= minZoom) porServicio.set(servicio, [...(porServicio.get(servicio) ?? []), capa])
    }
    if (!porServicio.size) return

    const limites = m.getBounds()
    const so = L.CRS.EPSG3857.project(limites.getSouthWest())
    const ne = L.CRS.EPSG3857.project(limites.getNorthEast())
    const tamanio = m.getSize()
    const punto = { bbox: [so.x, so.y, ne.x, ne.y] as [number, number, number, number], ancho: tamanio.x, alto: tamanio.y, x: e.containerPoint.x, y: e.containerPoint.y }
    const control = new AbortController()
    const globo = L.popup({ maxWidth: 340, autoPanPaddingTopLeft: [440, 80] }).setLatLng(e.latlng).setContent('<span style="color:#64748b">Consultando…</span>').openOn(m)
    globo.on('remove', () => {
      if (consulta.current.globo !== globo) return
      consulta.current.control?.abort()
      consulta.current.resaltado?.remove()
      consulta.current = { globo: null, resaltado: null, control: null }
    })
    consulta.current = { globo, resaltado: null, control }

    try {
      const respuestas = await Promise.allSettled([...porServicio].map(([servicio, capas]) => consultar(servicio, capas, punto, control.signal)))
      if (control.signal.aborted) return
      const objetos = respuestas.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      const fallidos = [...porServicio.keys()].filter((_, i) => respuestas[i].status === 'rejected')
      if (!objetos.length && !fallidos.length) {
        m.closePopup(globo)
        return
      }
      const aviso = fallidos.map((s) => `<div style="color:#b91c1c;font-size:12px">${escapar(s.servidor)} no respondió la consulta.</div>`).join('')
      globo.setContent(htmlConsulta(objetos) + aviso)
      const geometrias = objetos.map((o) => o.geometria).filter((g): g is Geometry => g !== null)
      if (geometrias.length) {
        consulta.current.resaltado = L.geoJSON(geometrias, {
          // La geometría viene en EPSG:3857 (la del pedido), con una tercera coordenada en 0.
          coordsToLatLng: (c) => L.CRS.EPSG3857.unproject(L.point(c[0], c[1])),
          pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 8 }),
          style: { color: COLOR_CONSULTA, weight: 4, fillColor: COLOR_CONSULTA, fillOpacity: 0.15 },
          interactive: false,
        }).addTo(m)
      }
    } catch {
      if (!control.signal.aborted) globo.setContent('<span style="color:#b91c1c">No se pudo hacer la consulta.</span>')
    }
  }

  // 2d. «Ir a»: encuadrar el distrito o departamento elegido.
  useEffect(() => {
    const m = mapa.current
    if (!m || !encuadre) return
    const [o, s, e, n] = encuadre.recuadro
    m.flyToBounds(
      [
        [s, o],
        [n, e],
      ],
      { ...margenesLibres(m), maxZoom: 15, duration: 0.8 },
    )
  }, [encuadre])

  /**
   * Números de las concesiones (rojo con borde blanco, se leen sobre el satélite y sobre el
   * mapa oscuro). Se redibujan al mover el mapa: solo las que están a la vista y con zoom suficiente.
   */
  function dibujarEtiquetas() {
    const m = mapa.current
    if (!m) return
    capaEtiquetas.current?.remove()
    capaEtiquetas.current = null
    if (!verEtiquetas.current || m.getZoom() < ZOOM_ETIQUETAS) return
    const vista = m.getBounds().pad(0.1)
    const grupo = L.layerGroup()
    // Grados de longitud → píxeles al zoom actual (en Web Mercator es lineal).
    const pxPorGrado = (256 * 2 ** m.getZoom()) / 360
    for (const { punto, texto, ancho, alto, anchoTexto } of etiquetas.current) {
      if (!vista.contains(punto)) continue
      // Solo si el número entra en la finca: si no, al alejarse taparía el polígono y a los vecinos.
      const altoPx = alto * pxPorGrado / Math.cos((punto[0] * Math.PI) / 180)
      if (ancho * pxPorGrado < anchoTexto + 8 || altoPx < ALTO_TEXTO_PX + 4) continue
      L.marker(punto, {
        icon: L.divIcon({ className: 'etiqueta-concesion', html: `<span>${texto.replace(/[<>&]/g, '')}</span>`, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(grupo)
    }
    capaEtiquetas.current = grupo.addTo(m)
  }

  // 2e. Prender / apagar los números.
  useEffect(() => {
    dibujarEtiquetas()
  }, [capas.etiquetas, capas.concesiones])

  /** Los pozos van siempre encima de los polígonos (si no, el clic y el tooltip serían del polígono). */
  function pozosAlFrente() {
    capaPozos.current?.eachLayer((l) => (l as L.CircleMarker).bringToFront())
  }

  // 3. Resaltar y centrar la seleccionada.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    porId.current.forEach((layer, id) => {
      const elegida = id === seleccionada
      layer.setStyle({ weight: elegida ? 4.5 : 2.5, fillOpacity: rellenoDe(elegida) })
      if (elegida) layer.bringToFront()
    })
    pozosAlFrente()
    const layer = seleccionada !== null ? porId.current.get(seleccionada) : undefined
    if (layer && 'getBounds' in layer) {
      const limites = (layer as L.Polygon).getBounds()
      // Acercar hasta la parcela si está fuera de la vista o el mapa está muy alejado para verla.
      // Si ya se ve bien, no se mueve (evita saltos al hacer clic sobre un polígono).
      if (!m.getBounds().contains(limites) || m.getZoom() < ZOOM_MARCADORES + 2) {
        m.flyToBounds(limites, { ...margenesLibres(m), maxZoom: 16, duration: 0.8 })
      }
    }
  }, [seleccionada, concesiones])

  // 4. Polígono de comparación (rojo punteado, por encima de todo).
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaComparacion.current?.remove()
    capaComparacion.current = null
    if (!comparacion) return
    const geo = L.geoJSON(comparacion, {
      style: { color: COLOR_COMPARACION, weight: 3, dashArray: '6 6', fillColor: COLOR_COMPARACION, fillOpacity: 0.12 },
      interactive: false,
    }).addTo(m)
    capaComparacion.current = geo
    m.flyToBounds(geo.getBounds(), { ...margenesLibres(m), maxZoom: 17, duration: 0.6 })
  }, [comparacion])

  // 5. Mapa base. Si no responde, el padre recibe el reemplazo y vuelve a pasar por acá.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaFondo.current = ponerFondoVisor(m, fondo, capaFondo.current, (texto, reemplazo) => eventos.current.onFondoFalla(texto, reemplazo))
  }, [fondo])

  // 6. Medición de distancia o área.
  useEffect(() => {
    const m = mapa.current
    if (!m || !medicion) return
    const activa = iniciarMedicion(m, medicion.tipo, (r) => eventos.current.onMedicion?.(r))
    return () => activa.quitar()
  }, [medicion])

  // 7. «Ir a coordenada»: pin con las coordenadas y el mapa centrado ahí.
  useEffect(() => {
    const m = mapa.current
    if (!m || !marca) return
    const pin = L.marker([marca.lat, marca.lng], { icon: ICONO_MARCA, keyboard: false }).bindPopup(marca.texto, { closeButton: true }).addTo(m)
    m.flyTo([marca.lat, marca.lng], Math.max(m.getZoom(), 16), { duration: 0.8 })
    m.once('moveend', () => pin.openPopup())
    return () => {
      pin.remove()
    }
  }, [marca])

  return <div ref={contenedor} className="h-full w-full" />
}
