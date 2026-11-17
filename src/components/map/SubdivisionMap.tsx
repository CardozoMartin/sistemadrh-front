import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARGENMAP, FONDOS, SATELITE } from './fondos'
import { Icon } from '@/components/ui/Icon'
import { centroide, type LatLng } from '@/lib/geo'


/** Distancia (px) a la que un clic se pega a un vértice existente. */
const IMAN_PX = 14

export interface FraccionMapa {
  clave: string
  nombre: string
  color: string
  coordenadas: LatLng[]
}

export type ModoSubdivisionMap = 'ver' | 'dibujar' | 'editar'

interface Props {
  /** Polígono de la concesión madre (punteado). */
  madre: LatLng[]
  fracciones: FraccionMapa[]
  /** Fracción seleccionada (se resalta; es la que se dibuja o edita). */
  activa?: string | null
  modo?: ModoSubdivisionMap
  onSeleccionar?: (clave: string) => void
  /** Nuevo polígono de la fracción activa (al cerrar el dibujo o al soltar un vértice). */
  onCambiar?: (clave: string, coordenadas: LatLng[]) => void
  /** Al terminar o cancelar el dibujo. */
  onTerminarDibujo?: () => void
  className?: string
}

const marcador = (color: string, tamanio = 12) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:${tamanio}px;height:${tamanio}px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:grab"></span>`,
    iconSize: [tamanio, tamanio],
    iconAnchor: [tamanio / 2, tamanio / 2],
  })

const redondear = (ll: L.LatLng): LatLng => [+ll.lat.toFixed(7), +ll.lng.toFixed(7)]

/**
 * Mapa de la subdivisión (prototipo subdivision/comienzoTramite.html): polígono madre
 * punteado y una fracción por color. En modo «dibujar» cada clic agrega un vértice a la
 * fracción activa (se pega a los vértices cercanos para compartir bordes) y doble clic
 * la cierra; en modo «editar» los vértices de la fracción activa se arrastran.
 */
export function SubdivisionMap({ madre, fracciones, activa = null, modo = 'ver', onSeleccionar, onCambiar, onTerminarDibujo, className = 'h-[30rem]' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capaBase = useRef<L.Layer | null>(null)
  const capaMadre = useRef<L.Polygon | null>(null)
  const capaFracciones = useRef<L.LayerGroup | null>(null)
  const capaEdicion = useRef<L.LayerGroup | null>(null)
  const capaBorrador = useRef<L.LayerGroup | null>(null)
  const [satelite, setSatelite] = useState(true)
  const [borrador, setBorrador] = useState<LatLng[]>([])

  // Lo último de props y estado, para los manejadores de Leaflet (se registran una vez).
  const actual = useRef({ madre, fracciones, activa, modo, borrador, onSeleccionar, onCambiar, onTerminarDibujo })
  useEffect(() => {
    actual.current = { madre, fracciones, activa, modo, borrador, onSeleccionar, onCambiar, onTerminarDibujo }
  })

  /** Pega el punto al vértice más cercano (madre o fracciones) si está a menos de IMAN_PX. */
  function iman(ll: L.LatLng, excluir?: string): L.LatLng {
    const m = mapa.current
    if (!m) return ll
    const { madre: md, fracciones: fs, borrador: b } = actual.current
    const candidatos = [...md, ...fs.filter((f) => f.clave !== excluir).flatMap((f) => f.coordenadas), ...b]
    const p = m.latLngToContainerPoint(ll)
    let mejor: L.LatLng = ll
    let distancia = IMAN_PX
    for (const c of candidatos) {
      const q = m.latLngToContainerPoint(L.latLng(c[0], c[1]))
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < distancia) {
        distancia = d
        mejor = L.latLng(c[0], c[1])
      }
    }
    return mejor
  }

  function cerrarBorrador() {
    const { activa: a, borrador: b, onCambiar: cambiar, onTerminarDibujo: terminar } = actual.current
    if (!a || b.length < 3) return
    cambiar?.(a, b)
    setBorrador([])
    terminar?.()
  }

  function cancelarBorrador() {
    setBorrador([])
    actual.current.onTerminarDibujo?.()
  }

  // Crear / destruir el mapa
  useEffect(() => {
    if (!contenedor.current) return
    const m = L.map(contenedor.current, { attributionControl: false, doubleClickZoom: false })
    mapa.current = m
    capaMadre.current = L.polygon(madre, { color: '#64748b', weight: 2.5, dashArray: '7,5', fillOpacity: 0.04, interactive: false }).addTo(m)
    capaFracciones.current = L.layerGroup().addTo(m)
    capaEdicion.current = L.layerGroup().addTo(m)
    capaBorrador.current = L.layerGroup().addTo(m)

    let ultimoClic = 0
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (actual.current.modo !== 'dibujar' || !actual.current.activa) return
      // Un doble clic dispara dos clics: el segundo no agrega punto.
      const ahora = Date.now()
      if (ahora - ultimoClic < 300) return
      ultimoClic = ahora
      setBorrador((b) => [...b, redondear(iman(e.latlng, actual.current.activa ?? undefined))])
    })
    m.on('dblclick', () => {
      if (actual.current.modo === 'dibujar') cerrarBorrador()
    })

    const frame = requestAnimationFrame(() => {
      if (mapa.current !== m) return
      m.invalidateSize()
      if (madre.length >= 3) m.fitBounds(L.latLngBounds(madre), { padding: [40, 40], animate: false })
    })
    return () => {
      cancelAnimationFrame(frame)
      m.remove()
      mapa.current = null
    }
    // El mapa se arma una vez; los cambios se aplican en los efectos de abajo.
  }, [])

  // Capa base
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaBase.current?.remove()
    capaBase.current = FONDOS[satelite ? SATELITE : ARGENMAP]().addTo(m)
  }, [satelite])

  useEffect(() => {
    capaMadre.current?.setLatLngs(madre)
  }, [madre])

  // Al cambiar de modo o de fracción se descarta el dibujo a medio hacer.
  useEffect(() => {
    setBorrador([])
    const m = mapa.current
    if (!m) return
    m.getContainer().style.cursor = modo === 'dibujar' ? 'crosshair' : ''
    if (modo === 'ver') m.dragging.enable()
  }, [modo, activa])

  // Fracciones
  useEffect(() => {
    const grupo = capaFracciones.current
    if (!grupo) return
    grupo.clearLayers()
    for (const f of fracciones) {
      if (f.coordenadas.length < 3) continue
      const esActiva = f.clave === activa
      const poligono = L.polygon(f.coordenadas, {
        color: f.color,
        weight: esActiva ? 3.5 : 2,
        fillColor: f.color,
        fillOpacity: esActiva ? 0.32 : 0.18,
        // Mientras se dibuja, los clics tienen que llegar al mapa.
        interactive: modo !== 'dibujar',
      }).addTo(grupo)
      poligono.on('click', () => actual.current.onSeleccionar?.(f.clave))
      L.marker(centroide(f.coordenadas), {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<span style="background:${f.color};color:#fff;font:600 11px/1 system-ui;padding:3px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);transform:translate(-50%,-50%);display:inline-block">${f.nombre}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(grupo)
      if (esActiva) poligono.bringToFront()
    }
  }, [fracciones, activa, modo])

  // Vértices arrastrables de la fracción activa (modo editar)
  useEffect(() => {
    const grupo = capaEdicion.current
    if (!grupo) return
    grupo.clearLayers()
    const f = fracciones.find((x) => x.clave === activa)
    if (modo !== 'editar' || !f || f.coordenadas.length < 3) return
    const puntos = [...f.coordenadas]
    const contorno = L.polygon(puntos, { color: f.color, weight: 2, dashArray: '4,4', fill: false, interactive: false }).addTo(grupo)
    puntos.forEach((p, i) => {
      const v = L.marker(p, { icon: marcador(f.color), draggable: true, keyboard: false }).addTo(grupo)
      v.bindTooltip(`Vértice ${i + 1}`, { direction: 'top', offset: [0, -6] })
      v.on('drag', () => {
        puntos[i] = redondear(v.getLatLng())
        contorno.setLatLngs(puntos)
      })
      v.on('dragend', () => {
        puntos[i] = redondear(iman(v.getLatLng(), f.clave))
        actual.current.onCambiar?.(f.clave, [...puntos])
      })
    })
  }, [fracciones, activa, modo])

  // Dibujo en curso
  useEffect(() => {
    const grupo = capaBorrador.current
    if (!grupo) return
    grupo.clearLayers()
    if (borrador.length === 0) return
    const color = fracciones.find((f) => f.clave === activa)?.color ?? '#137fec'
    if (borrador.length >= 2) L.polyline(borrador, { color, weight: 2.5, dashArray: '6,4', interactive: false }).addTo(grupo)
    if (borrador.length >= 3) L.polygon(borrador, { color, weight: 0, fillColor: color, fillOpacity: 0.18, interactive: false }).addTo(grupo)
    borrador.forEach((p, i) =>
      L.circleMarker(p, { radius: 5, color: '#0f172a', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false })
        .bindTooltip(`P${i + 1}`, { permanent: true, direction: 'top', opacity: 0.85 })
        .addTo(grupo),
    )
  }, [borrador, activa, fracciones])

  const nombreActiva = fracciones.find((f) => f.clave === activa)?.nombre

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

      {modo === 'dibujar' && (
        <div className="absolute top-3 left-3 z-[1000] flex max-w-[calc(100%-7rem)] flex-wrap items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
          <span className="flex items-center gap-1.5 font-semibold">
            <Icon name="draw" className="text-base! text-primary" /> Dibujando {nombreActiva}: {borrador.length} punto{borrador.length === 1 ? '' : 's'}
          </span>
          <button type="button" disabled={!borrador.length} onClick={() => setBorrador((b) => b.slice(0, -1))} className="rounded px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700">
            Deshacer
          </button>
          <button type="button" disabled={borrador.length < 3} onClick={cerrarBorrador} className="rounded bg-primary px-2 py-1 font-semibold text-white hover:bg-primary-oscuro disabled:opacity-40">
            Cerrar polígono
          </button>
          <button type="button" onClick={cancelarBorrador} className="rounded px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
            Cancelar
          </button>
        </div>
      )}
      {modo === 'editar' && nombreActiva && (
        <p className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
          <Icon name="edit_location_alt" className="text-base! text-primary" /> Editando {nombreActiva}: arrastre los vértices
        </p>
      )}

      <div className="absolute bottom-3 left-3 z-[1000] flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-slate-500" /> Concesión madre
        </span>
        {fracciones.map((f) => (
          <span key={f.clave} className="flex items-center gap-2">
            <span className="size-3 rounded-sm border-2" style={{ borderColor: f.color, background: `${f.color}33` }} /> {f.nombre}
          </span>
        ))}
      </div>
    </div>
  )
}
