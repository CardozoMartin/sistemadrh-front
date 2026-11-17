import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { storage } from '@/lib/storage'
import { mensajeDeError } from '@/services/api/errors'
import { analizarArchivoGeografico, type AnalisisGeometria } from '@/services/sig'
import { BarraEstado } from '../components/BarraEstado'
import { BarraHerramientas, IrACoordenada, TarjetaMedicion, type Herramienta } from '../components/BarraHerramientas'
import { FichaConcesion } from '../components/FichaConcesion'
import { MapaConcesiones } from '../components/MapaConcesiones'
import { PanelArchivo } from '../components/PanelArchivo'
import { PanelAyuda } from '../components/PanelAyuda'
import { PanelCapas, type Destino } from '../components/PanelCapas'
import { PanelFondos } from '../components/PanelFondos'
import { PanelResultados } from '../components/PanelResultados'
import { BotonIcono, claseFlotante } from '../components/ui'
import { borrarPreferencias, usePreferenciaCapas, usePreferenciaCriterio, usePreferenciaDrh, usePreferenciaOpacidades, usePreferenciaWms } from '../preferencias'
import { armarLeyenda, colorizador } from '../colores'
import { formatoHa } from '../estilos'
import { filtrar, filtrosIniciales, recuadroDe } from '../filtros'
import { useCapaCauces, useCapaConcesiones, useCapaPozos, useCapaPuntos, useCapasDrh } from '../hooks'
import type { ResultadoMedicion, TipoMedicion } from '../medicion'

type Panel = 'capas' | 'fondos' | 'resultados' | 'archivo' | 'ayuda'

const PANELES: { id: Panel; icono: string; titulo: string; subtitulo: string }[] = [
  { id: 'capas', icono: 'layers', titulo: 'Capas', subtitulo: 'Catálogo de capas de la DRH' },
  { id: 'fondos', icono: 'map', titulo: 'Mapas base', subtitulo: 'Fondo sobre el que se dibujan las capas' },
  { id: 'resultados', icono: 'format_list_bulleted', titulo: 'Concesiones', subtitulo: 'Las que se ven en el mapa' },
  { id: 'archivo', icono: 'upload_file', titulo: 'Comparar archivo', subtitulo: 'KML o GeoJSON, sin guardar' },
  { id: 'ayuda', icono: 'help', titulo: 'Ayuda', subtitulo: 'Cómo usar el visor' },
]

/** Recuadro de la provincia (oeste, sur, este, norte), para la vista inicial sin concesiones. */
const RECUADRO_TUCUMAN: [number, number, number, number] = [-66.2, -28.05, -64.45, -26.05]
const CLAVE_FONDO = 'drh_visor_fondo'

/**
 * Visor cartográfico a pantalla completa, con la organización de los visores SIG del IGN:
 *   - Arriba a la izquierda: encabezado con el buscador. Debajo, la barra lateral que abre
 *     los paneles: catálogo de capas, mapas base, lista de concesiones, comparar un archivo y ayuda.
 *   - Arriba a la derecha: herramientas (vista inicial, ir a coordenada, medir distancia y
 *     área, pantalla completa, actualizar) y, debajo, la ficha de la concesión seleccionada.
 *   - Abajo: barra de estado con el sistema de referencia, la posición del cursor (lat/long y
 *     POSGAR), la escala y el zoom.
 *
 * Las concesiones, los pozos, los desagües / puntos de entrega y los ríos salen de PostGIS: son
 * las mismas capas que ve QGIS (sig.v_concesiones, sig.v_pozos, sig.v_puntos y sig.cauce). Todo se guarda en POSGAR 2007 faja 3
 * (EPSG:5345); el mapa web lo recibe en latitud/longitud.
 * La concesión seleccionada queda en la URL (?concesion=ID), así se puede compartir el enlace.
 */
export default function VisorPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCapaConcesiones()
  const capaPozos = useCapaPozos()
  const capaPuntos = useCapaPuntos()
  const capaCauces = useCapaCauces()
  // Lo que el usuario elige en el panel de capas queda guardado en la PC (ver preferencias.ts).
  const [capas, setCapas] = usePreferenciaCapas()
  const [wms, setWms] = usePreferenciaWms()
  const [drh, setDrh] = usePreferenciaDrh()
  const [opacidades, setOpacidades] = usePreferenciaOpacidades()
  const [criterio, setCriterio] = usePreferenciaCriterio()
  // Las capas elegidas se siguen leyendo aunque el grupo se apague: así prenderlo de nuevo es inmediato.
  const capasDrh = useCapasDrh(drh.elegidas)
  const lecturaDrh = useMemo(
    () => Object.fromEntries(capasDrh.map((c) => [c.id, { cantidad: c.datos?.features.length, cargando: c.cargando, error: c.error ? mensajeDeError(c.error) : null }])),
    [capasDrh],
  )
  const drhVisibles = useMemo(() => (drh.activo ? capasDrh : []), [drh.activo, capasDrh])
  const [encuadre, setEncuadre] = useState<{ recuadro: [number, number, number, number]; clave: number } | null>(null)
  const [parametros, setParametros] = useSearchParams()
  const [filtros, setFiltros] = useState(() => ({ ...filtrosIniciales(), criterio }))
  useEffect(() => setCriterio(filtros.criterio), [filtros.criterio, setCriterio])
  const [panel, setPanel] = useState<Panel | null>(() => (window.matchMedia('(min-width: 640px)').matches ? 'capas' : null))
  const [fondo, setFondoEstado] = useState(() => storage.get(CLAVE_FONDO, 'satelite'))
  const [aviso, setAviso] = useState<string | null>(null)
  const [vista, setVista] = useState({ zoom: 9, escala: 0 })
  const refCursor = useRef<HTMLSpanElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)

  // Herramientas: medición (con su resultado) e «Ir a coordenada» (con su pin).
  const [herramienta, setHerramientaEstado] = useState<Herramienta | null>(null)
  const [medicion, setMedicion] = useState<{ tipo: TipoMedicion; clave: number } | null>(null)
  const [resultado, setResultado] = useState<ResultadoMedicion | null>(null)
  const [marca, setMarca] = useState<{ lat: number; lng: number; texto: string; clave: number } | null>(null)

  // Comparar un archivo.
  const [comparacion, setComparacion] = useState<AnalisisGeometria | null>(null)
  const [comparando, setComparando] = useState(false)
  const [errorComparacion, setErrorComparacion] = useState<string | null>(null)

  const seleccionada = parametros.get('concesion') ? Number(parametros.get('concesion')) : null
  const seleccionar = (id: number | null) =>
    setParametros(
      (p) => {
        if (id === null) p.delete('concesion')
        else p.set('concesion', String(id))
        return p
      },
      { replace: true },
    )

  const todas = useMemo(() => data?.features ?? [], [data])
  const visibles = useMemo(() => filtrar(todas, filtros), [todas, filtros])
  const superficie = useMemo(() => visibles.reduce((acc, f) => acc + f.properties.superficie_ha, 0), [visibles])
  // Colores: la leyenda se arma con todas (así no cambia al apagar colores) según el criterio elegido.
  const leyenda = useMemo(() => armarLeyenda(todas, filtros.criterio), [todas, filtros.criterio])
  const colorDe = useMemo(() => colorizador(leyenda, filtros.criterio), [leyenda, filtros.criterio])
  // Destinos de «Ir a»: distritos de riego y departamentos que tienen concesiones.
  const destinos = useMemo<Destino[]>(() => {
    const contar = (valores: (string | null)[]) => {
      const c = new Map<string, number>()
      for (const v of valores) if (v) c.set(v, (c.get(v) ?? 0) + 1)
      return [...c.entries()].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    }
    return [
      ...contar(todas.map((f) => f.properties.distrito)).map(([v, n]) => ({ clave: `distrito:${v}`, nombre: `Distrito ${v}`, grupo: 'Distritos de riego' as const, cantidad: n })),
      ...contar(todas.map((f) => f.properties.departamento)).map(([v, n]) => ({ clave: `departamento:${v}`, nombre: v, grupo: 'Departamentos' as const, cantidad: n })),
    ]
  }, [todas])
  const encuadrar = (recuadro: [number, number, number, number] | null) => setEncuadre({ recuadro: recuadro ?? RECUADRO_TUCUMAN, clave: Date.now() })
  function irA(clave: string) {
    const [campo, valor] = clave.split(':') as ['distrito' | 'departamento' | '*', string]
    encuadrar(recuadroDe(campo === '*' ? todas : todas.filter((f) => f.properties[campo] === valor)))
  }
  const ficha = todas.find((f) => f.properties.concesion_id === seleccionada)
  // Pozos de las concesiones visibles (los filtros de concesiones también filtran sus pozos).
  const pozos = useMemo(() => {
    const ids = new Set(visibles.map((f) => f.properties.concesion_id))
    return (capaPozos.data?.features ?? []).filter((p) => p.properties.concesion_id === null || ids.has(p.properties.concesion_id))
  }, [capaPozos.data, visibles])
  // Desagües y puntos de entrega de las concesiones visibles (mismo criterio que los pozos).
  const puntos = useMemo(() => {
    const ids = new Set(visibles.map((c) => c.properties.concesion_id))
    return (capaPuntos.data?.features ?? []).filter((p) => ids.has(p.properties.concesion_id))
  }, [capaPuntos.data, visibles])
  const pozosDeFicha = useMemo(() => (capaPozos.data?.features ?? []).filter((p) => p.properties.concesion_id === seleccionada), [capaPozos.data, seleccionada])

  function setFondo(id: string) {
    setFondoEstado(id)
    storage.set(CLAVE_FONDO, id)
  }

  function elegirHerramienta(h: Herramienta | null) {
    setHerramientaEstado(h)
    setResultado(null)
    setMedicion(h === 'distancia' || h === 'area' ? { tipo: h, clave: Date.now() } : null)
    if (h !== 'coordenada') setMarca(null)
  }

  async function comparar(archivo: File) {
    setComparando(true)
    setErrorComparacion(null)
    try {
      setComparacion(await analizarArchivoGeografico(archivo))
    } catch (e) {
      setComparacion(null)
      setErrorComparacion(mensajeDeError(e))
    } finally {
      setComparando(false)
    }
  }

  function buscar(texto: string) {
    setFiltros((f) => ({ ...f, busqueda: texto }))
    if (texto.trim()) setPanel('resultados')
  }

  // Esc cancela la medición en curso.
  useEffect(() => {
    if (!medicion) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') elegirHerramienta(null)
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [medicion])

  // Pantalla completa del visor (no de toda la aplicación).
  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement === raiz.current)
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])
  function alternarPantallaCompleta() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void raiz.current?.requestFullscreen()
  }

  // Los avisos (ej: un fondo que no responde) se van solos.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  const infoPanel = PANELES.find((p) => p.id === panel)
  const busqueda = filtros.busqueda.trim()
  let contenido: ReactNode = null
  if (panel === 'capas')
    contenido = (
      <PanelCapas
        filtros={filtros}
        onFiltrar={setFiltros}
        leyenda={leyenda}
        capas={capas}
        onCapas={setCapas}
        cantidades={{ concesiones: visibles.length, superficieHa: superficie, pozos: pozos.length, puntos: puntos.length, cauces: capaCauces.data?.features.length ?? 0 }}
        destinos={destinos}
        onIrA={irA}
        wms={wms}
        onWms={setWms}
        drh={drh}
        onDrh={setDrh}
        lecturaDrh={lecturaDrh}
        opacidades={opacidades}
        onOpacidad={(clave, valor) => setOpacidades((o) => ({ ...o, [clave]: valor }))}
        onRestablecer={() => {
          borrarPreferencias()
          window.location.reload()
        }}
      />
    )
  else if (panel === 'fondos') contenido = <PanelFondos fondo={fondo} onFondo={setFondo} />
  else if (panel === 'resultados') contenido = <PanelResultados visibles={visibles} busqueda={filtros.busqueda} colorDe={colorDe} seleccionada={seleccionada} onSeleccionar={seleccionar} />
  else if (panel === 'archivo')
    contenido = (
      <PanelArchivo
        comparacion={comparacion}
        comparando={comparando}
        error={errorComparacion}
        onArchivo={(a) => void comparar(a)}
        onQuitar={() => setComparacion(null)}
        onSeleccionar={seleccionar}
      />
    )
  else if (panel === 'ayuda') contenido = <PanelAyuda />

  return (
    <div ref={raiz} className="absolute inset-0 isolate bg-slate-200 dark:bg-slate-900">
      <div className="visor-mapa absolute inset-0">
        <MapaConcesiones
          concesiones={visibles}
          colorDe={colorDe}
          pozos={pozos}
          puntos={puntos}
          cauces={capaCauces.data?.features}
          capasDrh={drhVisibles}
          opacidades={opacidades}
          capas={capas}
          wms={wms}
          encuadre={encuadre}
          seleccionada={seleccionada}
          onSeleccionar={seleccionar}
          comparacion={comparacion?.geojson}
          fondo={fondo}
          onFondoFalla={(texto, reemplazo) => {
            setAviso(texto)
            setFondoEstado(reemplazo)
          }}
          medicion={medicion}
          onMedicion={setResultado}
          marca={marca}
          onVista={setVista}
          refCursor={refCursor}
        />
      </div>

      {/* Izquierda: encabezado con buscador, barra lateral y panel abierto */}
      <div className="pointer-events-none absolute top-3 bottom-10 left-3 z-1001 flex w-[calc(100%-1.5rem)] flex-col gap-2 sm:w-[25rem]">
        <header className="pointer-events-auto flex items-center gap-3 rounded-xl bg-primary px-3 py-2 text-white shadow-lg ring-1 ring-black/10">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15">
            <Icon name="water_drop" filled className="text-[22px]!" />
          </span>
          <div className="hidden min-w-0 shrink-0 leading-tight min-[420px]:block">
            <p className="text-sm font-bold">Visor SIG</p>
            <p className="text-[11px] text-white/75">Recursos Hídricos · Tucumán</p>
          </div>
          <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-white px-2.5 text-slate-800 focus-within:ring-2 focus-within:ring-white/60 dark:bg-slate-800 dark:text-slate-100">
            <Icon name="search" className="text-[18px]! text-slate-400" />
            <input
              type="search"
              value={filtros.busqueda}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Titular, número, padrón…"
              aria-label="Buscar concesiones"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm placeholder:text-slate-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {filtros.busqueda && (
              <button type="button" onClick={() => buscar('')} aria-label="Borrar búsqueda" className="text-slate-400 hover:text-slate-600">
                <Icon name="close" className="text-[18px]!" />
              </button>
            )}
          </label>
        </header>

        <div className="flex min-h-0 flex-1 items-start gap-2">
          <nav aria-label="Paneles del visor" className={cn('pointer-events-auto flex flex-col gap-1 rounded-xl p-1', claseFlotante)}>
            {PANELES.map((p) => (
              <BotonIcono
                solido
                key={p.id}
                icono={p.icono}
                titulo={p.titulo}
                activo={panel === p.id}
                marca={p.id === 'resultados' && busqueda ? visibles.length : p.id === 'archivo' && !!comparacion}
                onClick={() => setPanel(panel === p.id ? null : p.id)}
                className={p.id === 'ayuda' ? 'mt-2' : undefined}
              />
            ))}
          </nav>

          {infoPanel && (
            <section aria-label={infoPanel.titulo} className={cn('pointer-events-auto flex max-h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl', claseFlotante)}>
              <div className="flex items-center gap-2 border-b border-slate-100 py-2 pr-1.5 pl-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{infoPanel.titulo}</h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{panel === 'resultados' && busqueda ? `Resultados de «${busqueda}»` : infoPanel.subtitulo}</p>
                </div>
                <button type="button" onClick={() => setPanel(null)} aria-label="Cerrar panel" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                  <Icon name="chevron_left" className="text-[22px]!" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{contenido}</div>
              {(panel === 'capas' || panel === 'resultados') && (
                <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-200">{visibles.length.toLocaleString('es-AR')}</strong> de {todas.length.toLocaleString('es-AR')} concesiones ·{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{formatoHa(superficie)}</strong>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Derecha: herramientas, tarjeta de la herramienta activa y ficha de la concesión */}
      <div className="pointer-events-none absolute top-[4.75rem] right-3 bottom-10 z-1000 flex flex-col items-end gap-2 sm:top-3">
        <div className="pointer-events-auto">
          <BarraHerramientas
            herramienta={herramienta}
            onHerramienta={elegirHerramienta}
            onVistaInicial={() => encuadrar(recuadroDe(todas))}
            pantallaCompleta={pantallaCompleta}
            onPantallaCompleta={alternarPantallaCompleta}
            actualizando={isFetching || capaPozos.isFetching || capaPuntos.isFetching || capaCauces.isFetching}
            onActualizar={() => {
              void refetch()
              void capaPozos.refetch()
              void capaPuntos.refetch()
              void capaCauces.refetch()
            }}
          />
        </div>
        {herramienta === 'coordenada' && (
          <div className="pointer-events-auto">
            <IrACoordenada onIr={(lat, lng, texto) => setMarca({ lat, lng, texto, clave: Date.now() })} onCerrar={() => elegirHerramienta(null)} />
          </div>
        )}
        {medicion && (
          <div className="pointer-events-auto">
            <TarjetaMedicion tipo={medicion.tipo} resultado={resultado} onNueva={() => elegirHerramienta(medicion.tipo)} onCerrar={() => elegirHerramienta(null)} />
          </div>
        )}
        {ficha && (
          <div className="pointer-events-auto min-h-0 overflow-y-auto rounded-lg">
            <FichaConcesion concesion={ficha} pozos={pozosDeFicha} onCerrar={() => seleccionar(null)} />
          </div>
        )}
      </div>

      {/* Mensajes: arriba al centro */}
      <div className="pointer-events-none absolute inset-x-3 top-36 z-1002 flex flex-col items-center gap-2 sm:top-16">
        {isLoading && (
          <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-lg dark:bg-slate-800 dark:text-slate-300">
            <Spinner className="size-4 text-primary" /> Cargando concesiones…
          </p>
        )}
        {!isLoading && !isError && !todas.length && (
          <p className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-lg dark:bg-slate-800 dark:text-slate-300">Todavía no hay concesiones con polígono cargado.</p>
        )}
        {aviso && <p className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-lg ring-1 ring-amber-200">{aviso}</p>}
        {isError && (
          <div className="pointer-events-auto max-w-lg rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-500/30">
            <p className="font-semibold">No se pudo cargar la capa de concesiones.</p>
            <p>{mensajeDeError(error)}</p>
            <p className="mt-1 opacity-80">El visor usa el backend real: verifique que esté corriendo (carpeta backend, «npm run start:dev», puerto 3000).</p>
          </div>
        )}
      </div>

      <BarraEstado refCursor={refCursor} zoom={vista.zoom} escala={vista.escala} />
    </div>
  )
}
