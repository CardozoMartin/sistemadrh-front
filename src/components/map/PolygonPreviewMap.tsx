import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARGENMAP, FONDOS, SATELITE } from './fondos'
import { CENTRO_TUCUMAN, type LatLng } from '@/lib/geo'
import { Icon } from '@/components/ui/Icon'


interface Props {
  coordenadas: LatLng[]
  /** Texto del tooltip del polígono. */
  etiqueta?: string
  className?: string
}

/** Mapa de solo lectura que muestra un polígono, con alternancia satélite (Esri) / Argenmap (IGN). */
export function PolygonPreviewMap({ coordenadas, etiqueta, className = 'h-72' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capaBase = useRef<L.Layer | null>(null)
  const poligono = useRef<L.Polygon | null>(null)
  const [satelite, setSatelite] = useState(true)

  // Crear / destruir el mapa
  useEffect(() => {
    if (!contenedor.current) return
    const m = L.map(contenedor.current, { attributionControl: false }).setView(CENTRO_TUCUMAN, 13)
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capaBase.current = null
      poligono.current = null
    }
  }, [])

  // Capa base
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaBase.current?.remove()
    capaBase.current = FONDOS[satelite ? SATELITE : ARGENMAP]().addTo(m)
    poligono.current?.bringToFront()
  }, [satelite])

  // Polígono
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    poligono.current?.remove()
    if (coordenadas.length < 3) return

    const p = L.polygon(coordenadas, { color: '#137fec', weight: 2, fillColor: '#137fec', fillOpacity: 0.18 }).addTo(m)
    if (etiqueta) p.bindTooltip(etiqueta, { sticky: true })
    poligono.current = p
    // Esperar al layout para que fitBounds use el tamaño real del contenedor. Se cancela
    // si el mapa se destruye antes (ej: doble montaje de StrictMode), porque ajustar un
    // mapa ya removido tira "Cannot read properties of undefined (reading '_leaflet_pos')".
    const frame = requestAnimationFrame(() => {
      if (mapa.current !== m) return
      m.invalidateSize()
      m.fitBounds(p.getBounds(), { padding: [30, 30], animate: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [coordenadas, etiqueta])

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
    </div>
  )
}
