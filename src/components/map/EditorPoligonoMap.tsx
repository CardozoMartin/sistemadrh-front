import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARGENMAP, FONDOS, SATELITE } from './fondos'
import { Icon } from '@/components/ui/Icon'
import type { LatLng } from '@/lib/geo'


const AZUL = '#137fec'
const ROJO = '#ef4444'

const iconoVertice = L.divIcon({
  className: '',
  html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#fff;border:3px solid ${AZUL};box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:grab"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

interface Props {
  /** Polígono vigente de la concesión (se dibuja punteado, de referencia). */
  original: LatLng[]
  /** Nueva propuesta. */
  propuesta: LatLng[]
  /** Polígonos de concesiones vecinas (en gris). */
  vecinos?: LatLng[][]
  /** La propuesta cumple las restricciones (azul) o no (rojo). */
  valido?: boolean
  /** Con `onChange`, los vértices se pueden arrastrar. */
  onChange?: (coordenadas: LatLng[]) => void
  className?: string
}

/**
 * Mapa para comparar y editar la superficie de una concesión (prototipo
 * ReduccionAmpliacion/reducionampliacion.html): polígono original punteado, nueva
 * propuesta con vértices arrastrables y concesiones vecinas.
 */
export function EditorPoligonoMap({ original, propuesta, vecinos = [], valido = true, onChange, className = 'h-[28rem]' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capaBase = useRef<L.Layer | null>(null)
  const capaOriginal = useRef<L.Polygon | null>(null)
  const capaVecinos = useRef<L.LayerGroup | null>(null)
  const capaPropuesta = useRef<L.Polygon | null>(null)
  const vertices = useRef<L.Marker[]>([])
  const arrastrando = useRef(false)
  const onChangeRef = useRef(onChange)
  const [satelite, setSatelite] = useState(true)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Crear / destruir el mapa
  useEffect(() => {
    if (!contenedor.current) return
    const m = L.map(contenedor.current, { attributionControl: false })
    mapa.current = m
    capaVecinos.current = L.layerGroup().addTo(m)
    capaOriginal.current = L.polygon(original, { color: '#64748b', weight: 2, dashArray: '6,6', fillOpacity: 0, interactive: false }).addTo(m)
    capaPropuesta.current = L.polygon(propuesta, { color: AZUL, weight: 3, fillColor: AZUL, fillOpacity: 0.2 }).addTo(m)
    // Se espera al layout para que el encuadre use el tamaño real del contenedor.
    const frame = requestAnimationFrame(() => {
      if (mapa.current !== m) return
      m.invalidateSize()
      m.fitBounds(L.latLngBounds([...original, ...propuesta]), { padding: [40, 40], animate: false })
    })
    return () => {
      cancelAnimationFrame(frame)
      m.remove()
      mapa.current = null
      vertices.current = []
    }
    // El mapa se arma una vez; los cambios de polígonos se aplican en los efectos de abajo.
  }, [])

  // Capa base
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaBase.current?.remove()
    capaBase.current = FONDOS[satelite ? SATELITE : ARGENMAP]().addTo(m)
  }, [satelite])

  useEffect(() => {
    capaOriginal.current?.setLatLngs(original)
  }, [original])

  useEffect(() => {
    const grupo = capaVecinos.current
    if (!grupo) return
    grupo.clearLayers()
    vecinos.forEach((v) => L.polygon(v, { color: '#64748b', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.15, interactive: false }).addTo(grupo))
  }, [vecinos])

  useEffect(() => {
    const color = valido ? AZUL : ROJO
    capaPropuesta.current?.setStyle({ color, fillColor: color })
  }, [valido])

  // Propuesta + vértices arrastrables
  useEffect(() => {
    const m = mapa.current
    const poligono = capaPropuesta.current
    if (!m || !poligono || arrastrando.current) return
    poligono.setLatLngs(propuesta)

    if (!onChangeRef.current) {
      vertices.current.forEach((v) => v.remove())
      vertices.current = []
      return
    }
    if (vertices.current.length !== propuesta.length) {
      vertices.current.forEach((v) => v.remove())
      vertices.current = propuesta.map((p, i) => {
        const marcador = L.marker(p, { icon: iconoVertice, draggable: true, keyboard: false }).addTo(m)
        marcador.on('dragstart', () => (arrastrando.current = true))
        marcador.on('drag', () => poligono.setLatLngs(vertices.current.map((v) => v.getLatLng())))
        marcador.on('dragend', () => {
          arrastrando.current = false
          const coords = vertices.current.map((v) => [+v.getLatLng().lat.toFixed(7), +v.getLatLng().lng.toFixed(7)] as LatLng)
          onChangeRef.current?.(coords)
        })
        marcador.bindTooltip(`Vértice ${i + 1}`, { direction: 'top', offset: [0, -6] })
        return marcador
      })
    } else {
      vertices.current.forEach((v, i) => v.setLatLng(propuesta[i]))
    }
  }, [propuesta])

  return (
    <div className={`relative isolate overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
      <div ref={contenedor} className="h-full w-full" />
      <button
        type="button"
        onClick={() => setSatelite((s) => !s)}
        className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white dark:bg-slate-800/95 dark:text-slate-200"
      >
        <Icon name={satelite ? 'map' : 'satellite_alt'} className="text-base!" />
        {satelite ? 'Argenmap' : 'Satélite'}
      </button>
      {onChange && (
        <p className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
          <Icon name="edit_location_alt" className="text-base! text-primary" /> Modo edición: arrastre los vértices
        </p>
      )}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
        <span className="font-semibold">Leyenda</span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-slate-500" /> Polígono original
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm border-2" style={{ borderColor: valido ? AZUL : ROJO, background: `${valido ? AZUL : ROJO}33` }} /> Nueva propuesta
        </span>
        {vecinos.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm border border-slate-500 bg-slate-300/50" /> Concesiones vecinas
          </span>
        )}
      </div>
    </div>
  )
}
