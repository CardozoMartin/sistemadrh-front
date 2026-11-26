import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import { ARGENMAP, FONDOS, SATELITE } from '@/components/map/fondos'
import { Icon } from '@/components/ui/Icon'
import { CENTRO_TUCUMAN } from '@/lib/geo'

/**
 * Qué muestra el mapa:
 *   - 'ambos': el polígono actual (punteado) y el plano encima (un solo mapa).
 *   - 'actual': solo el polígono vigente, relleno (lado izquierdo de la comparación).
 *   - 'propuesto': cómo quedaría (el plano relleno) con el contorno anterior de referencia.
 */
export type VistaMapa = 'ambos' | 'actual' | 'propuesto'

/** Mapas que se mueven juntos (comparación lado a lado). */
export interface GrupoSincronizado {
  mapas: Set<L.Map>
  moviendo: boolean
}

export const nuevoGrupoSincronizado = (): GrupoSincronizado => ({
  mapas: new Set(),
  moviendo: false,
})

interface Props {
  /** Polígono vigente de la concesión. null si no tiene: casi todas las migradas. */
  actual: MultiPolygon | null
  /** El plano cargado. */
  propuesto: MultiPolygon | null
  /** N° de la concesión del trámite: se saca de la capa de vecinos para no dibujarla dos veces. */
  numeroConcesion?: string | null
  vista?: VistaMapa
  /** Rótulo arriba a la izquierda (ej.: «Superficie actual · 21,27 ha»). */
  titulo?: ReactNode
  /** Si se pasa, el mapa se mueve y hace zoom junto con los demás del grupo. */
  grupo?: GrupoSincronizado
  /** Satélite / Argenmap controlado desde afuera (para que los dos lados cambien juntos). */
  satelite?: boolean
  onSatelite?: (satelite: boolean) => void
  /**
   * Dibujar alrededor las otras concesiones de la DRH. En la comparación lado a lado va apagado:
   * ahí solo interesan la concesión actual y el plano, sin distraer con el resto.
   */
  conVecinos?: boolean
  className?: string
}

/**
 * Concesiones de la capa de la DRH (copia local del GeoServer, la misma que usa el visor), solo con
 * su forma y su número: para ver alrededor del plano a los vecinos reales. Se pide una vez por sesión.
 * Si la copia local no está (npm run sig:copiar), el mapa se muestra igual, sin vecinos.
 */
function useConcesionesDrh(habilitado: boolean) {
  return useQuery({
    enabled: habilitado,
    queryKey: ['capas-drh', 't07_concesiones', 'formas'],
    queryFn: async () => {
      const r = await fetch('/capas-drh/t07_concesiones.geojson')
      if (!r.ok) throw new Error(`Sin la capa de concesiones de la DRH (${r.status}).`)
      const capa = (await r.json()) as FeatureCollection
      return { ...capa, features: capa.features.filter((f) => f.geometry) }
    },
    staleTime: Infinity,
    retry: false,
  })
}

const numeroDe = (p: unknown) => String((p as { concesion?: unknown } | null)?.concesion ?? '').trim()

const ESTILO_ACTUAL_PUNTEADO: L.PathOptions = {
  color: '#f59e0b',
  weight: 3,
  dashArray: '8 6',
  fillColor: '#f59e0b',
  fillOpacity: 0.08,
}
const ESTILO_ACTUAL_RELLENO: L.PathOptions = {
  color: '#f59e0b',
  weight: 2.5,
  fillColor: '#f59e0b',
  fillOpacity: 0.25,
}
const ESTILO_REFERENCIA: L.PathOptions = {
  color: '#f59e0b',
  weight: 2,
  dashArray: '6 6',
  fill: false,
}
const ESTILO_PROPUESTO: L.PathOptions = {
  color: '#137fec',
  weight: 2.5,
  fillColor: '#137fec',
  fillOpacity: 0.25,
}

/**
 * Mapa de solo lectura, georreferenciado como el visor: el polígono actual, el plano de la nueva
 * superficie y, si `conVecinos`, alrededor las concesiones reales de la DRH (para ver si el plano
 * se mete en un vecino). Alternancia satélite (Esri) / Argenmap (IGN). Todo en WGS84.
 * Encuadra siempre la unión de actual y plano: así dos mapas lado a lado quedan a la misma escala.
 */
export function ComparacionPlanoMap({ actual, propuesto, numeroConcesion, vista = 'ambos', titulo, grupo, satelite: sateliteControlado, onSatelite, conVecinos = true, className = 'h-96' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capaBase = useRef<L.Layer | null>(null)
  const vecinos = useRef<L.GeoJSON | null>(null)
  const capas = useRef<L.GeoJSON[]>([])
  const [sateliteLocal, setSateliteLocal] = useState(true)
  const satelite = sateliteControlado ?? sateliteLocal
  const cambiarFondo = () => (onSatelite ? onSatelite(!satelite) : setSateliteLocal((s) => !s))
  const drh = useConcesionesDrh(conVecinos)

  const verActual = !!actual && vista !== 'propuesto'
  const verPropuesto = !!propuesto && vista !== 'actual'
  const verReferencia = !!actual && vista === 'propuesto'

  useEffect(() => {
    if (!contenedor.current) return
    // Canvas: miles de polígonos de vecinos sin trabar el navegador.
    const m = L.map(contenedor.current, {
      attributionControl: false,
      preferCanvas: true,
    }).setView(CENTRO_TUCUMAN, 13)
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capaBase.current = null
      vecinos.current = null
      capas.current = []
    }
  }, [])

  // Sincronización: lo que se mueve en un mapa se repite en los demás del grupo.
  useEffect(() => {
    const m = mapa.current
    if (!m || !grupo) return
    grupo.mapas.add(m)
    const alMover = () => {
      if (grupo.moviendo) return
      grupo.moviendo = true
      grupo.mapas.forEach((otro) => otro !== m && otro.setView(m.getCenter(), m.getZoom(), { animate: false }))
      grupo.moviendo = false
    }
    m.on('move zoomend', alMover)
    return () => {
      m.off('move zoomend', alMover)
      grupo.mapas.delete(m)
    }
  }, [grupo])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaBase.current?.remove()
    capaBase.current = FONDOS[satelite ? SATELITE : ARGENMAP]().addTo(m)
    vecinos.current?.bringToFront()
    capas.current.forEach((c) => c.bringToFront())
  }, [satelite])

  // Vecinos: las concesiones de la DRH (menos la del trámite), finitas y en rosa como en el visor.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    vecinos.current?.remove()
    vecinos.current = null
    if (!conVecinos || !drh.data) return
    const propio = (numeroConcesion ?? '').trim()
    vecinos.current = L.geoJSON(drh.data, {
      filter: (f) => !propio || numeroDe(f.properties) !== propio,
      style: {
        color: '#db2777',
        weight: 1,
        fillColor: '#db2777',
        fillOpacity: 0.08,
      },
      onEachFeature: (f, capa) =>
        capa.bindTooltip(`Concesión ${numeroDe(f.properties) || 's/n'}`, {
          sticky: true,
        }),
    }).addTo(m)
    capas.current.forEach((c) => c.bringToFront())
  }, [drh.data, numeroConcesion, conVecinos])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capas.current.forEach((c) => c.remove())
    capas.current = []
    if (verActual && actual) {
      capas.current.push(
        L.geoJSON(actual, {
          style: vista === 'actual' ? ESTILO_ACTUAL_RELLENO : ESTILO_ACTUAL_PUNTEADO,
        })
          .bindTooltip('Superficie actual', { sticky: true })
          .addTo(m),
      )
    }
    if (verPropuesto && propuesto) {
      capas.current.push(
        L.geoJSON(propuesto, { style: ESTILO_PROPUESTO })
          .bindTooltip(vista === 'propuesto' ? 'Nueva superficie (plano presentado)' : 'Plano presentado (nueva superficie)', { sticky: true })
          .addTo(m),
      )
    }
    // Contorno anterior encima del plano, para ver qué se agrega o qué se quita.
    if (verReferencia && actual) {
      capas.current.push(
        L.geoJSON(actual, {
          style: ESTILO_REFERENCIA,
          interactive: false,
        }).addTo(m),
      )
    }
    // Encuadre: la unión de los dos polígonos (aunque este lado dibuje uno solo), para que ambos
    // lados de la comparación arranquen con la misma escala.
    const limites = [actual, propuesto].filter((g): g is MultiPolygon => !!g).reduce((b, g) => b.extend(L.geoJSON(g).getBounds()), L.latLngBounds([]))
    if (!limites.isValid()) return
    // Esperar al layout para que fitBounds use el tamaño real (y no ajustar un mapa ya removido).
    // Con vecinos, un margen amplio deja verlos alrededor; sin ellos, se encuadra ajustado.
    const frame = requestAnimationFrame(() => {
      if (mapa.current !== m) return
      m.invalidateSize()
      m.fitBounds(limites.pad(conVecinos ? 0.6 : 0.15), { animate: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [actual, propuesto, vista, verActual, verPropuesto, verReferencia, conVecinos])

  return (
    <figure className="flex flex-col gap-2">
      <div className={`relative isolate overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
        <div ref={contenedor} className="h-full w-full" />
        <button
          type="button"
          onClick={cambiarFondo}
          className="absolute top-3 right-3 z-1000 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white dark:bg-slate-800/95 dark:text-slate-200"
        >
          <Icon name={satelite ? 'map' : 'satellite_alt'} className="text-base!" />
          {satelite ? 'Argenmap' : 'Satélite'}
        </button>
        <div className="absolute bottom-3 left-3 z-1000 flex flex-col gap-1 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">
          {verActual && (
            <span className="flex items-center gap-2">
              {vista === 'actual' ? (
                <span className="inline-block h-3 w-5 rounded-sm border-2 border-amber-500 bg-amber-500/25" />
              ) : (
                <span className="inline-block h-0 w-5 border-t-2 border-dashed border-amber-500" />
              )}
              Superficie actual
            </span>
          )}
          {verPropuesto && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-5 rounded-sm border-2 border-[#137fec] bg-[#137fec]/25" /> {vista === 'propuesto' ? 'Nueva superficie' : 'Plano presentado'}
            </span>
          )}
          {verReferencia && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-0 w-5 border-t-2 border-dashed border-amber-500" /> Contorno actual
            </span>
          )}
          {conVecinos && drh.data && (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-5 rounded-sm border border-[#db2777] bg-[#db2777]/10" /> Otras concesiones (capa DRH)
            </span>
          )}
          {conVecinos && drh.isError && <span className="text-slate-500">Sin la capa de concesiones de la DRH</span>}
          {!verActual && !verPropuesto && <span>Todavía no hay polígonos para mostrar.</span>}
        </div>
      </div>
      {titulo && <figcaption className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</figcaption>}
    </figure>
  )
}

/**
 * Comparación lado a lado: a la izquierda la concesión como está, a la derecha cómo quedaría con el
 * plano. Los dos mapas se mueven juntos y comparten el fondo (satélite / Argenmap). Solo muestran
 * esas dos superficies: las otras concesiones de la DRH no se dibujan, para no perder el foco.
 * Si todavía no hay plano o la concesión no tiene polígono, muestra un solo mapa.
 */
export function ComparacionLadoALado({
  actual,
  propuesto,
  numeroConcesion,
  tituloActual,
  tituloPropuesto,
}: {
  actual: MultiPolygon | null
  propuesto: MultiPolygon | null
  numeroConcesion?: string | null
  tituloActual?: ReactNode
  tituloPropuesto?: ReactNode
}) {
  const [grupo] = useState(nuevoGrupoSincronizado)
  const [satelite, setSatelite] = useState(true)

  if (!actual || !propuesto) return <ComparacionPlanoMap actual={actual} propuesto={propuesto} numeroConcesion={numeroConcesion} />

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ComparacionPlanoMap
        actual={actual}
        propuesto={propuesto}
        numeroConcesion={numeroConcesion}
        vista="actual"
        titulo={tituloActual}
        grupo={grupo}
        satelite={satelite}
        onSatelite={setSatelite}
        conVecinos={false}
      />
      <ComparacionPlanoMap
        actual={actual}
        propuesto={propuesto}
        numeroConcesion={numeroConcesion}
        vista="propuesto"
        titulo={tituloPropuesto}
        grupo={grupo}
        satelite={satelite}
        onSatelite={setSatelite}
        conVecinos={false}
      />
    </div>
  )
}
