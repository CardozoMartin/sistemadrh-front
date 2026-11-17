// Herramientas de medición del visor: distancia (línea) y área (polígono).
//
// Uso: clic en el mapa agrega un vértice, doble clic (o «Terminar») cierra la medición,
// Esc la borra. Las medidas se calculan en POSGAR 2007 faja 3 (metros planos), igual que
// PostGIS y que los papeles de la oficina; la diferencia con un cálculo geodésico es despreciable
// para el tamaño de una finca.
import L from 'leaflet'
import { aPosgar } from '@/lib/posgar'

export type TipoMedicion = 'distancia' | 'area'

export interface ResultadoMedicion {
  tipo: TipoMedicion
  vertices: number
  /** Largo de la línea, o perímetro del polígono (m). */
  metros: number
  /** Solo en área (m²). */
  metrosCuadrados: number
  terminada: boolean
}

const COLOR = '#f97316'

export const formatoDistancia = (m: number) =>
  m >= 1000 ? `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} km` : `${m.toLocaleString('es-AR', { maximumFractionDigits: 1 })} m`

export const formatoArea = (m2: number) =>
  m2 >= 10000 ? `${(m2 / 10000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : `${m2.toLocaleString('es-AR', { maximumFractionDigits: 0 })} m²`

function medir(puntos: L.LatLng[], cerrar: boolean) {
  const pp = puntos.map((p) => aPosgar(p.lat, p.lng))
  let metros = 0
  const n = cerrar ? pp.length : pp.length - 1
  for (let i = 0; i < n; i++) {
    const a = pp[i]
    const b = pp[(i + 1) % pp.length]
    metros += Math.hypot(b.x - a.x, b.y - a.y)
  }
  let area = 0
  if (cerrar && pp.length >= 3) {
    for (let i = 0; i < pp.length; i++) {
      const a = pp[i]
      const b = pp[(i + 1) % pp.length]
      area += a.x * b.y - b.x * a.y
    }
  }
  return { metros, metrosCuadrados: Math.abs(area) / 2 }
}

/**
 * Activa una medición sobre el mapa. Devuelve cómo terminarla (deja el dibujo a la vista)
 * y cómo quitarla (borra el dibujo y suelta los eventos).
 */
export function iniciarMedicion(m: L.Map, tipo: TipoMedicion, onCambio: (r: ResultadoMedicion) => void) {
  const puntos: L.LatLng[] = []
  const grupo = L.layerGroup().addTo(m)
  const esArea = tipo === 'area'
  const forma = esArea
    ? L.polygon([], { color: COLOR, weight: 2.5, fillColor: COLOR, fillOpacity: 0.15, interactive: false })
    : L.polyline([], { color: COLOR, weight: 3, interactive: false })
  const guia = L.polyline([], { color: COLOR, weight: 2, dashArray: '5 6', opacity: 0.8, interactive: false })
  const etiqueta = L.tooltip({ permanent: true, direction: 'right', offset: [10, 0], className: 'medicion-etiqueta' })
  forma.addTo(grupo)
  guia.addTo(grupo)
  let terminada = false
  const zoomDobleClic = m.doubleClickZoom.enabled()
  m.doubleClickZoom.disable()
  m.getContainer().style.cursor = 'crosshair'
  // Mientras se mide, los tooltips de las capas taparían la etiqueta de la medición.
  m.getContainer().classList.add('visor-midiendo')

  const avisar = () => {
    const r = medir(puntos, esArea)
    onCambio({ tipo, vertices: puntos.length, ...r, terminada })
    const texto = esArea ? (puntos.length >= 3 ? `${formatoArea(r.metrosCuadrados)}` : '') : puntos.length >= 2 ? formatoDistancia(r.metros) : ''
    if (texto && puntos.length) {
      etiqueta.setLatLng(puntos.at(-1)!).setContent(texto)
      if (!grupo.hasLayer(etiqueta)) etiqueta.addTo(grupo)
    } else etiqueta.remove()
  }

  const alHacerClic = (e: L.LeafletMouseEvent) => {
    if (terminada) return
    // El doble clic que termina llega antes como dos clics en el mismo lugar: el segundo no suma vértice.
    const ultimo = puntos.at(-1)
    if (ultimo && m.latLngToContainerPoint(ultimo).distanceTo(e.containerPoint) < 4) return
    puntos.push(e.latlng)
    forma.setLatLngs(puntos)
    L.circleMarker(e.latlng, { radius: 4, color: '#fff', weight: 2, fillColor: COLOR, fillOpacity: 1, interactive: false }).addTo(grupo)
    avisar()
  }
  const alMover = (e: L.LeafletMouseEvent) => {
    if (terminada || !puntos.length) return
    guia.setLatLngs(esArea && puntos.length >= 2 ? [puntos.at(-1)!, e.latlng, puntos[0]] : [puntos.at(-1)!, e.latlng])
  }
  const terminar = () => {
    if (terminada) return
    terminada = true
    guia.setLatLngs([])
    m.getContainer().style.cursor = ''
    avisar()
  }
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'Enter') terminar()
  }

  m.on('click', alHacerClic)
  m.on('mousemove', alMover)
  m.on('dblclick', terminar)
  document.addEventListener('keydown', alTeclear)
  avisar()

  return {
    terminar,
    quitar: () => {
      m.off('click', alHacerClic)
      m.off('mousemove', alMover)
      m.off('dblclick', terminar)
      document.removeEventListener('keydown', alTeclear)
      grupo.remove()
      m.getContainer().style.cursor = ''
      m.getContainer().classList.remove('visor-midiendo')
      if (zoomDobleClic) m.doubleClickZoom.enable()
    },
  }
}
