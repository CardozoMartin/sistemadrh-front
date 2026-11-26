import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARGENMAP, FONDOS, SATELITE } from './fondos'
import { Icon } from '@/components/ui/Icon'
import type { LatLng } from '@/lib/geo'

const GRIS = '#64748b'
const VERDE = '#16a34a'

interface Props {
  /** Cómo es hoy (vacío si no hay polígono). */
  antes: LatLng[]
  /** Cómo queda. */
  despues: LatLng[]
  etiquetaAntes?: string
  etiquetaDespues?: string
  /** Alto de cada mapa. */
  className?: string
}

/**
 * Dos mapas lado a lado, sincronizados (mover o hacer zoom en uno mueve el otro):
 *   - a la izquierda, cómo es hoy;
 *   - a la derecha, cómo queda, con el de hoy punteado de referencia.
 * Los dos arrancan con el mismo encuadre (el que abarca ambos polígonos) para que se vea el corrimiento.
 */
export function MapasComparados({ antes, despues, etiquetaAntes = 'Hoy', etiquetaDespues = 'Cómo queda', className = 'h-80' }: Props) {
  const contIzq = useRef<HTMLDivElement>(null)
  const contDer = useRef<HTMLDivElement>(null)
  const mapas = useRef<{ izq: L.Map; der: L.Map } | null>(null)
  const capas = useRef<{ antesIzq: L.Polygon; antesDer: L.Polygon; despues: L.Polygon } | null>(null)
  const bases = useRef<L.Layer[]>([])
  const [satelite, setSatelite] = useState(true)

  /** El encuadre que abarca los dos polígonos. */
  const encuadrar = (puntos: LatLng[]) => {
    const m = mapas.current
    if (!m || puntos.length === 0) return
    const bounds = L.latLngBounds(puntos)
    m.izq.fitBounds(bounds, { padding: [30, 30], animate: false })
    m.der.fitBounds(bounds, { padding: [30, 30], animate: false })
  }

  // Crear / destruir los dos mapas y sincronizarlos.
  useEffect(() => {
    if (!contIzq.current || !contDer.current) return
    const izq = L.map(contIzq.current, { attributionControl: false })
    const der = L.map(contDer.current, { attributionControl: false })
    mapas.current = { izq, der }
    capas.current = {
      antesIzq: L.polygon(antes, { color: GRIS, weight: 3, fillColor: GRIS, fillOpacity: 0.25, interactive: false }).addTo(izq),
      antesDer: L.polygon(antes, { color: '#ffffff', weight: 2, dashArray: '6,6', fillOpacity: 0, interactive: false }).addTo(der),
      despues: L.polygon(despues, { color: VERDE, weight: 3, fillColor: VERDE, fillOpacity: 0.25, interactive: false }).addTo(der),
    }

    // Sincronización: el que se mueve (por el usuario) arrastra al otro. La bandera evita el rebote.
    let sincronizando = false
    const seguir = (origen: L.Map, destino: L.Map) => () => {
      if (sincronizando) return
      sincronizando = true
      destino.setView(origen.getCenter(), origen.getZoom(), { animate: false })
      sincronizando = false
    }
    izq.on('move', seguir(izq, der))
    der.on('move', seguir(der, izq))

    // Se espera al layout para que el encuadre use el tamaño real de los contenedores.
    const frame = requestAnimationFrame(() => {
      if (mapas.current?.izq !== izq) return
      izq.invalidateSize()
      der.invalidateSize()
      encuadrar([...antes, ...despues])
    })
    return () => {
      cancelAnimationFrame(frame)
      izq.remove()
      der.remove()
      mapas.current = null
      capas.current = null
      bases.current = []
    }
    // Los mapas se arman una vez; los cambios de polígonos se aplican en el efecto de abajo.
  }, [])

  // Capa base (la misma en los dos).
  useEffect(() => {
    const m = mapas.current
    if (!m) return
    bases.current.forEach((b) => b.remove())
    const crear = FONDOS[satelite ? SATELITE : ARGENMAP]
    bases.current = [crear().addTo(m.izq), crear().addTo(m.der)]
  }, [satelite])

  // Polígonos nuevos (ej: se eligió otro KML): se redibujan y se vuelve a encuadrar. Se compara por
  // contenido (no por referencia) para no reencuadrar en cada render y perder lo que movió el usuario.
  const clave = JSON.stringify([antes, despues])
  useEffect(() => {
    const c = capas.current
    if (!c) return
    c.antesIzq.setLatLngs(antes)
    c.antesDer.setLatLngs(antes)
    c.despues.setLatLngs(despues)
    encuadrar([...antes, ...despues])
  }, [clave])

  const rotulo = 'absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200'
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 md:grid-cols-2">
        <div className={`relative isolate overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
          <div ref={contIzq} className="h-full w-full" />
          <span className={rotulo}>
            <span className="size-3 rounded-sm border-2" style={{ borderColor: GRIS, background: `${GRIS}40` }} /> {etiquetaAntes}
          </span>
          {antes.length === 0 && (
            <p className="absolute inset-x-6 top-1/2 z-[1000] -translate-y-1/2 rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-slate-600 shadow dark:bg-slate-800/95 dark:text-slate-300">
              La concesión no tiene polígono vigente cargado.
            </p>
          )}
        </div>
        <div className={`relative isolate overflow-hidden rounded-lg border border-green-300 dark:border-green-500/40 ${className}`}>
          <div ref={contDer} className="h-full w-full" />
          <span className={rotulo}>
            <span className="size-3 rounded-sm border-2" style={{ borderColor: VERDE, background: `${VERDE}40` }} /> {etiquetaDespues}
          </span>
          {antes.length > 0 && (
            <span className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-slate-600 shadow dark:bg-slate-800/95 dark:text-slate-300">
              <span className="h-0 w-5 border-t-2 border-dashed border-slate-500" /> {etiquetaAntes} (referencia)
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Icon name="sync_alt" className="text-base!" /> Los dos mapas se mueven juntos.
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={() => encuadrar([...antes, ...despues])} className="flex items-center gap-1 font-semibold text-primary hover:underline">
            <Icon name="center_focus_strong" className="text-base!" /> Volver a encuadrar
          </button>
          <button type="button" onClick={() => setSatelite((s) => !s)} className="flex items-center gap-1 font-semibold text-primary hover:underline">
            <Icon name={satelite ? 'map' : 'satellite_alt'} className="text-base!" /> {satelite ? 'Ver Argenmap' : 'Ver satélite'}
          </button>
        </div>
      </div>
    </div>
  )
}
