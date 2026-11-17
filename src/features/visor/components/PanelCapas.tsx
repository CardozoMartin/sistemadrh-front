import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { storage } from '@/lib/storage'
import { CRITERIOS, type CriterioColor, type ItemLeyenda as ItemDeLeyenda } from '../colores'
import { COLOR_POZO_A_REVISAR, COLOR_POZO_OFICIO, ESTADOS_POZO, formatoHa, TIPOS_PUNTO, ZOOM_ETIQUETAS } from '../estilos'
import { SERVICIOS_WMS, urlLeyenda, type EstadoWms, type ServicioWms, type TemaWms } from '../capasWms'
import { CAPAS_DRH, type CapaDrh, type EstadoDrh } from '../capasDrh'
import { FUENTES, SECCIONES, type CapaBase, type RefCapa, type SeccionCatalogo } from '../catalogo'
import { CAPAS_NINGUNA, normalizar, type CapasVisor, type FiltrosVisor } from '../filtros'
import { useTemasServicios } from '../hooks'
import { claveOpacidadDrh, claveOpacidadWms, CLAVE_RELLENO_CONCESIONES, CLAVE_SECCIONES_ABIERTAS, opacidadDe, RELLENO_CONCESIONES, type Opacidades } from '../preferencias'
import { Casilla, claseSelect, ControlOpacidad, Interruptor, ItemLeyenda } from './ui'

/** Un lugar al que se puede llevar el mapa (distrito de riego o departamento). */
export interface Destino {
  clave: string
  nombre: string
  grupo: 'Distritos de riego' | 'Departamentos'
  cantidad: number
}

interface Props {
  filtros: FiltrosVisor
  onFiltrar: (filtros: FiltrosVisor) => void
  leyenda: ItemDeLeyenda[]
  capas: CapasVisor
  onCapas: (capas: CapasVisor) => void
  cantidades: { concesiones: number; superficieHa: number; pozos: number; puntos: number; cauces: number }
  destinos: Destino[]
  onIrA: (clave: string) => void
  /** Capas WMS de otros organismos. */
  wms: EstadoWms
  onWms: (wms: EstadoWms) => void
  /** Capas del GeoServer de la DRH (copia local): cuáles están elegidas y cómo va su lectura. */
  drh: EstadoDrh
  onDrh: (drh: EstadoDrh) => void
  lecturaDrh: Record<string, { cantidad?: number; cargando: boolean; error: string | null }>
  /** Opacidad de cada capa (se guarda en la PC). */
  opacidades: Opacidades
  onOpacidad: (clave: string, valor: number) => void
  /** Borra las preferencias guardadas y vuelve a la configuración de fábrica. */
  onRestablecer: () => void
}

// ---------------------------------------------------------------------------
// Capas del catálogo, ya resueltas: nombre, origen y de dónde sale su estado.
// ---------------------------------------------------------------------------

const NOMBRES_BASE: Record<CapaBase, string> = {
  concesiones: 'Concesiones',
  pozos: 'Pozos',
  puntos: 'Desagües y puntos de entrega',
  cauces: 'Ríos y canales',
}

type Item =
  | { tipo: 'base'; clave: string; nombre: string; capa: CapaBase }
  | { tipo: 'drh'; clave: string; nombre: string; capa: CapaDrh }
  | { tipo: 'wms'; clave: string; nombre: string; servicio: ServicioWms; tema: TemaWms }
  /** Tema de un servicio que todavía no respondió (o no responde). */
  | { tipo: 'wms-pendiente'; clave: string; nombre: string; servicio: ServicioWms; error: boolean }

type Temas = Record<string, { temas: TemaWms[]; cargando: boolean; error: boolean }>

function resolver(ref: RefCapa, temas: Temas): Item[] {
  if (ref.tipo === 'base') return [{ tipo: 'base', clave: `base:${ref.capa}`, nombre: NOMBRES_BASE[ref.capa], capa: ref.capa }]
  if (ref.tipo === 'drh') {
    const capa = CAPAS_DRH.find((c) => c.id === ref.id)
    return capa ? [{ tipo: 'drh', clave: `drh:${capa.id}`, nombre: capa.nombre, capa }] : []
  }
  const servicio = SERVICIOS_WMS.find((s) => s.id === ref.servicio)
  if (!servicio) return []
  const t = temas[servicio.id]
  const lista = ref.tipo === 'wms' ? (t?.temas ?? []).filter((x) => x.clave === ref.tema) : (t?.temas ?? [])
  if (lista.length) return lista.map((tema) => ({ tipo: 'wms', clave: `wms:${servicio.id}|${tema.clave}`, nombre: tema.nombre, servicio, tema }))
  if (t?.cargando || t?.error) {
    const nombre = ref.tipo === 'wms' ? ref.tema.charAt(0).toUpperCase() + ref.tema.slice(1).replace(/_/g, ' ') : servicio.titulo
    return [{ tipo: 'wms-pendiente', clave: `wms:${servicio.id}|${ref.tipo === 'wms' ? ref.tema : '*'}`, nombre, servicio, error: t.error }]
  }
  return []
}

/** Origen de la capa, en corto («Sistema DRH», «GeoServer DRH», «Dir. Gral. de Catastro»…). */
function fuenteDe(item: Item) {
  if (item.tipo === 'base') return item.capa === 'cauces' ? FUENTES.cauces : FUENTES.base
  if (item.tipo === 'drh') return FUENTES.drh
  return item.servicio.resumen.split(' · ')[1] ?? item.servicio.titulo
}

// ---------------------------------------------------------------------------
// Piezas del panel.
// ---------------------------------------------------------------------------

/** Sección del catálogo (como las de Argenmap): encabezado azul con título y descripción; se despliega. */
function Seccion({ seccion, abierta, onAlternar, activas, children }: { seccion: SeccionCatalogo; abierta: boolean; onAlternar: () => void; activas: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg ring-1 ring-slate-900/10 dark:ring-white/10">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 bg-institucional px-3 py-2.5 text-left text-white transition-colors hover:bg-primary-oscuro"
      >
        <Icon name={seccion.icono} className="text-[22px]! text-white/85" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{seccion.titulo}</span>
          <span className="line-clamp-2 block text-xs leading-snug text-white/70">{seccion.descripcion}</span>
        </span>
        {activas > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-celeste px-1.5 text-[11px] font-bold text-white tabular-nums" title={`${activas} ${activas === 1 ? 'capa' : 'capas'} a la vista`}>
            {activas}
          </span>
        )}
        <Icon name="expand_more" className={cn('text-[20px]! text-white/80 transition-transform', abierta && 'rotate-180')} />
      </button>
      {abierta && <div className="divide-y divide-slate-100 bg-white dark:divide-slate-700/60 dark:bg-slate-800">{children}</div>}
    </section>
  )
}

/** Una capa del catálogo: casilla, muestra, nombre y origen; con la capa a la vista, sus opciones en un desplegable. */
function FilaCapa({
  marcada,
  onCambiar,
  muestra,
  nombre,
  fuente,
  cantidad,
  aviso,
  deshabilitada,
  opciones,
  opcionesAbiertas = false,
}: {
  marcada: boolean
  onCambiar: () => void
  muestra: ReactNode
  nombre: string
  fuente: string
  cantidad?: number
  aviso?: ReactNode
  deshabilitada?: boolean
  opciones?: ReactNode
  opcionesAbiertas?: boolean
}) {
  const [abiertas, setAbiertas] = useState(opcionesAbiertas)
  const verOpciones = marcada && opciones && abiertas
  return (
    <div className={cn(marcada && 'bg-primary/4 dark:bg-primary/10')}>
      <div className="flex items-center gap-2.5 py-1.5 pr-1.5 pl-3">
        <input
          type="checkbox"
          checked={marcada}
          onChange={onCambiar}
          disabled={deshabilitada}
          aria-label={`${nombre} (${fuente})`}
          className="size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-primary disabled:cursor-not-allowed"
        />
        <span className="grid w-4 shrink-0 place-items-center">{muestra}</span>
        <button type="button" onClick={onCambiar} disabled={deshabilitada} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
          <span className={cn('block truncate text-sm', marcada ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>{nombre}</span>
          <span className="block truncate text-[11px] text-slate-400">{fuente}</span>
        </button>
        {cantidad !== undefined && <span className="shrink-0 text-xs text-slate-400 tabular-nums">{cantidad.toLocaleString('es-AR')}</span>}
        {opciones && (
          <button
            type="button"
            onClick={() => setAbiertas((a) => !a)}
            disabled={!marcada}
            aria-expanded={!!verOpciones}
            aria-label={`Opciones de ${nombre}`}
            title={marcada ? 'Opacidad, leyenda y opciones' : 'Prenda la capa para ver sus opciones'}
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-30',
              verOpciones ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700',
            )}
          >
            <Icon name="tune" className="text-[18px]!" />
          </button>
        )}
      </div>
      {aviso && <div className="pr-3 pb-1.5 pl-13 text-xs">{aviso}</div>}
      {verOpciones && <div className="mx-3 mb-2 ml-13 flex flex-col gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900/50">{opciones}</div>}
    </div>
  )
}

const muestraCuadro = (color: string, punteado = false, relleno = true) => (
  <span className={cn('size-3.5 rounded-sm border-2', punteado && 'border-dashed')} style={{ borderColor: color, backgroundColor: relleno ? `${color}40` : 'transparent' }} />
)
const muestraPunto = (color: string) => <span className="size-3 rounded-full border-2 border-white shadow ring-1 ring-slate-300" style={{ backgroundColor: color }} />
const muestraLinea = (color: string, punteada = false) => <span className={cn('w-4 border-t-[3px]', punteada && 'border-dashed')} style={{ borderColor: color }} />

function muestraDrh(c: CapaDrh) {
  if (c.tipo === 'punto') return muestraPunto(c.color)
  if (c.tipo === 'linea') return muestraLinea(c.color)
  return muestraCuadro(c.color, c.punteado, c.tipo !== 'limite')
}

const MUESTRAS_BASE: Record<CapaBase, ReactNode> = {
  concesiones: muestraCuadro('#137fec'),
  pozos: muestraPunto('#0284c7'),
  puntos: <span className="size-2.5 rotate-45 border-2 border-white shadow ring-1 ring-slate-300" style={{ backgroundColor: TIPOS_PUNTO.DESAGUE.color }} />,
  cauces: muestraLinea('#2563eb'),
}

/** Nota chica de las opciones (origen, zoom, ayuda). */
const Nota = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-snug text-slate-400">{children}</p>

/**
 * Catálogo de capas del visor, organizado por tema como Argenmap: cada sección (concesiones,
 * aguas subterráneas, riego, hidrografía, límites, Catastro, producción…) junta las capas del
 * sistema, las del GeoServer de la DRH y las de otros organismos. Arriba, «Buscar capa» e «Ir a».
 * Cada capa a la vista tiene sus opciones (opacidad, leyenda, campaña…) en el botón de ajustes.
 * Las secciones abiertas, como el resto de lo elegido, quedan guardadas en la PC.
 */
export function PanelCapas(props: Props) {
  const { filtros, onFiltrar, leyenda, capas, onCapas, cantidades, destinos, onIrA, wms, onWms, drh, onDrh, lecturaDrh, opacidades, onOpacidad, onRestablecer } = props
  const temas = useTemasServicios()
  const [busqueda, setBusqueda] = useState('')
  const [abiertas, setAbiertasEstado] = useState<string[]>(() => {
    const guardadas = storage.get<unknown>(CLAVE_SECCIONES_ABIERTAS, null)
    return Array.isArray(guardadas) ? guardadas.filter((s): s is string => typeof s === 'string') : ['concesiones']
  })
  function alternarSeccion(id: string) {
    const nuevas = abiertas.includes(id) ? abiertas.filter((s) => s !== id) : [...abiertas, id]
    setAbiertasEstado(nuevas)
    storage.set(CLAVE_SECCIONES_ABIERTAS, nuevas)
  }

  // --- Estado de cada capa ---
  const activa = (item: Item): boolean => {
    if (item.tipo === 'base') return capas[item.capa]
    if (item.tipo === 'drh') return drh.activo && drh.elegidas.includes(item.capa.id)
    if (item.tipo === 'wms') return !!(wms[item.servicio.id]?.activo && wms[item.servicio.id].elegidas[item.tema.clave])
    return false
  }
  function alternar(item: Item) {
    if (item.tipo === 'base') return onCapas({ ...capas, [item.capa]: !capas[item.capa] })
    if (item.tipo === 'drh') {
      const actuales = drh.activo ? drh.elegidas : []
      const elegidas = actuales.includes(item.capa.id) ? actuales.filter((e) => e !== item.capa.id) : [...actuales, item.capa.id]
      return onDrh({ activo: elegidas.length > 0, elegidas })
    }
    if (item.tipo === 'wms') {
      const estado = wms[item.servicio.id]
      const elegidas = { ...(estado?.activo ? estado.elegidas : {}) }
      if (elegidas[item.tema.clave]) delete elegidas[item.tema.clave]
      else elegidas[item.tema.clave] = item.tema.campanias[0].capa
      onWms({ ...wms, [item.servicio.id]: { activo: Object.keys(elegidas).length > 0, elegidas } })
    }
  }
  function ocultarTodo() {
    onCapas(CAPAS_NINGUNA)
    onWms(Object.fromEntries(Object.keys(wms).map((id) => [id, { activo: false, elegidas: {} }])))
    onDrh({ activo: false, elegidas: [] })
  }

  // --- Catálogo resuelto y filtrado por la búsqueda ---
  const texto = normalizar(busqueda.trim())
  const secciones = useMemo(
    () =>
      SECCIONES.map((s) => {
        const items = s.capas.flatMap((ref) => resolver(ref, temas))
        const coinciden = texto && !normalizar(s.titulo).includes(texto) ? items.filter((i) => normalizar(`${i.nombre} ${fuenteDe(i)}`).includes(texto)) : items
        return { seccion: s, items: coinciden, todos: items }
      }).filter((s) => s.items.length > 0),
    [temas, texto],
  )
  // Todas las capas a la vista, aunque la búsqueda esconda su sección.
  const totalActivas = SECCIONES.reduce((n, s) => n + s.capas.flatMap((ref) => resolver(ref, temas)).filter(activa).length, 0)

  // --- Opciones de cada tipo de capa ---
  function opcionesBase(capa: CapaBase): ReactNode {
    if (capa === 'concesiones')
      return (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-extrabold text-red-600 [text-shadow:0_0_2px_#fff]">123</span>
            <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">Números de concesión (zoom {ZOOM_ETIQUETAS} o más)</span>
            <Interruptor activo={capas.etiquetas} onCambiar={() => onCapas({ ...capas, etiquetas: !capas.etiquetas })} etiqueta="Números de concesión" />
          </div>
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Colorear por</span>
            <select value={filtros.criterio} onChange={(e) => onFiltrar({ ...filtros, criterio: e.target.value as CriterioColor, ocultos: new Set() })} className={cn(claseSelect, 'py-1 text-xs')}>
              {CRITERIOS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="-mx-1.5">
            {leyenda.map((item) => (
              <Casilla
                key={item.valor}
                marcada={!filtros.ocultos.has(item.valor)}
                onCambiar={() => {
                  const ocultos = new Set(filtros.ocultos)
                  if (ocultos.has(item.valor)) ocultos.delete(item.valor)
                  else ocultos.add(item.valor)
                  onFiltrar({ ...filtros, ocultos })
                }}
                muestra={<span className="size-3.5 shrink-0 rounded-sm border-2" style={{ borderColor: item.color, backgroundColor: `${item.color}55` }} />}
                texto={item.nombre}
                cantidad={item.cantidad}
              />
            ))}
          </div>
          {leyenda.length > 1 && (
            <div className="flex gap-3 text-xs font-semibold text-primary">
              <button type="button" onClick={() => onFiltrar({ ...filtros, ocultos: new Set() })} className="hover:underline">
                Todos
              </button>
              <button type="button" onClick={() => onFiltrar({ ...filtros, ocultos: new Set(leyenda.map((i) => i.valor)) })} className="hover:underline">
                Ninguno
              </button>
            </div>
          )}
        </>
      )
    if (capa === 'pozos')
      return (
        <div className="-mx-1.5">
          {Object.entries(ESTADOS_POZO).map(([clave, e]) => (
            <ItemLeyenda key={clave} muestra={muestraPunto(e.color)} texto={e.nombre} />
          ))}
          <ItemLeyenda muestra={<span className="size-3 shrink-0 rounded-full border-[3px] bg-sky-600" style={{ borderColor: COLOR_POZO_A_REVISAR }} />} texto="Fuera del polígono de su concesión" />
          <ItemLeyenda muestra={<span className="size-3 shrink-0 rounded-full border-[3px] bg-sky-600" style={{ borderColor: COLOR_POZO_OFICIO }} />} texto="Registrado de oficio" />
        </div>
      )
    if (capa === 'puntos')
      return (
        <div className="-mx-1.5">
          {Object.entries(TIPOS_PUNTO).map(([clave, t]) => (
            <ItemLeyenda key={clave} muestra={<span className="size-2.5 shrink-0 rotate-45 border-2 border-white shadow ring-1 ring-slate-300" style={{ backgroundColor: t.color }} />} texto={t.nombre} />
          ))}
          <ItemLeyenda
            muestra={<span className="size-2.5 shrink-0 rotate-45 border-[3px]" style={{ borderColor: COLOR_POZO_A_REVISAR, backgroundColor: TIPOS_PUNTO.DESAGUE.color }} />}
            texto="A más de 1 km del polígono de su concesión"
          />
        </div>
      )
    return (
      <>
        <div className="-mx-1.5">
          <ItemLeyenda muestra={muestraLinea('#2563eb')} texto="Río o arroyo" />
          <ItemLeyenda muestra={muestraLinea('#0891b2', true)} texto="Canal" />
        </div>
        <Nota>Fuente: OpenStreetMap. La red de canales de riego de la DRH está en «Red de riego».</Nota>
      </>
    )
  }

  function opcionesWms(servicio: ServicioWms, tema: TemaWms): ReactNode {
    const capa = wms[servicio.id]?.elegidas[tema.clave] ?? tema.campanias[0].capa
    return (
      <>
        {tema.campanias.length > 1 && (
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">Campaña</span>
            <select
              value={capa}
              onChange={(e) => onWms({ ...wms, [servicio.id]: { activo: true, elegidas: { ...wms[servicio.id].elegidas, [tema.clave]: e.target.value } } })}
              aria-label={`Campaña de ${tema.nombre}`}
              className={cn(claseSelect, 'py-1 text-xs')}
            >
              {tema.campanias.map((c) => (
                <option key={c.capa} value={c.capa}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <ControlOpacidad nombre={tema.nombre} valor={opacidadDe(opacidades, claveOpacidadWms(servicio.id, tema.clave), servicio.opacidad ?? 0.75)} onCambiar={(v) => onOpacidad(claveOpacidadWms(servicio.id, tema.clave), v)} />
        {tema.minZoom && <Nota>Se ve al acercar el mapa (zoom {tema.minZoom} o más).</Nota>}
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer select-none hover:text-primary">Leyenda</summary>
          <img src={urlLeyenda(servicio, capa)} alt={`Leyenda de ${tema.nombre}`} loading="lazy" className="mt-1 max-w-full rounded bg-white p-1" />
        </details>
        <Nota>
          Fuente: {servicio.fuente}.{servicio.consultable && ` Clic en el mapa para ver los datos${servicio.ayudaConsulta ? `: ${servicio.ayudaConsulta}` : '.'}`}
        </Nota>
      </>
    )
  }

  function fila(item: Item) {
    const marcada = activa(item)
    if (item.tipo === 'base') {
      return (
        <FilaCapa
          key={item.clave}
          marcada={marcada}
          onCambiar={() => alternar(item)}
          muestra={MUESTRAS_BASE[item.capa]}
          nombre={item.nombre}
          fuente={item.capa === 'concesiones' ? `${FUENTES.base} · ${formatoHa(cantidades.superficieHa)}` : fuenteDe(item)}
          cantidad={cantidades[item.capa]}
          opciones={opcionesBase(item.capa)}
          opcionesAbiertas={item.capa === 'concesiones'}
        />
      )
    }
    if (item.tipo === 'drh') {
      const l = lecturaDrh[item.capa.id]
      const aviso = marcada && l?.cargando ? <span className="text-slate-400">Leyendo la capa…</span> : marcada && l?.error ? <span className="text-red-600">{l.error}</span> : null
      return (
        <FilaCapa
          key={item.clave}
          marcada={marcada}
          onCambiar={() => alternar(item)}
          muestra={muestraDrh(item.capa)}
          nombre={item.nombre}
          fuente={fuenteDe(item)}
          cantidad={l?.cantidad}
          aviso={aviso}
          opciones={
            <>
              <ControlOpacidad nombre={item.nombre} valor={opacidadDe(opacidades, claveOpacidadDrh(item.capa.id), 1)} onCambiar={(v) => onOpacidad(claveOpacidadDrh(item.capa.id), v)} />
              <Nota>Copia local del GeoServer de la DRH («npm run sig:copiar» la actualiza). Clic en un objeto para ver sus datos.</Nota>
            </>
          }
        />
      )
    }
    if (item.tipo === 'wms')
      return (
        <FilaCapa
          key={item.clave}
          marcada={marcada}
          onCambiar={() => alternar(item)}
          muestra={muestraCuadro(item.servicio.color)}
          nombre={item.nombre}
          fuente={fuenteDe(item)}
          opciones={opcionesWms(item.servicio, item.tema)}
        />
      )
    return (
      <FilaCapa
        key={item.clave}
        marcada={false}
        onCambiar={() => {}}
        deshabilitada
        muestra={muestraCuadro(item.servicio.color)}
        nombre={item.nombre}
        fuente={item.error ? `${item.servicio.servidor} no responde` : 'Leyendo las capas del servidor…'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Buscar capa e Ir a */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="search" className="text-[18px]! text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar capa…"
            aria-label="Buscar capa"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda de capas" className="text-slate-400 hover:text-slate-600">
              <Icon name="close" className="text-[18px]!" />
            </button>
          )}
        </label>
        <label className="flex items-center gap-1.5">
          <Icon name="travel_explore" className="text-[18px]! text-slate-400" />
          <select value="" onChange={(e) => e.target.value && onIrA(e.target.value)} aria-label="Ir a un distrito o departamento" className={cn(claseSelect, 'py-1.5')}>
            <option value="">Ir a un distrito o departamento…</option>
            <option value="*">Toda la provincia</option>
            {(['Distritos de riego', 'Departamentos'] as const).map((grupo) => (
              <optgroup key={grupo} label={grupo}>
                {destinos
                  .filter((d) => d.grupo === grupo)
                  .map((d) => (
                    <option key={d.clave} value={d.clave}>
                      {d.nombre} ({d.cantidad})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {/* Relleno de todos los polígonos del mapa (concesiones y capas del GeoServer). */}
      <div className="rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700">
        <ControlOpacidad
          etiqueta="Relleno de polígonos"
          nombre="todos los polígonos"
          valor={opacidadDe(opacidades, CLAVE_RELLENO_CONCESIONES, RELLENO_CONCESIONES)}
          onCambiar={(v) => onOpacidad(CLAVE_RELLENO_CONCESIONES, v)}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-200">{totalActivas}</strong> {totalActivas === 1 ? 'capa' : 'capas'} a la vista
        </span>
        <button type="button" onClick={ocultarTodo} disabled={!totalActivas} className="flex items-center gap-1 font-semibold text-primary hover:underline disabled:text-slate-400 disabled:no-underline">
          <Icon name="layers_clear" className="text-[16px]!" />
          Ocultar todo
        </button>
      </div>

      {/* Secciones del catálogo */}
      <div className="flex flex-col gap-1.5">
        {secciones.map(({ seccion, items, todos }) => (
          <Seccion key={seccion.id} seccion={seccion} abierta={!!texto || abiertas.includes(seccion.id)} onAlternar={() => alternarSeccion(seccion.id)} activas={todos.filter(activa).length}>
            {items.map(fila)}
          </Seccion>
        ))}
        {!secciones.length && <p className="px-1 py-4 text-center text-sm text-slate-400">Ninguna capa coincide con «{busqueda.trim()}».</p>}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
        <Icon name="save" className="text-[16px]! text-slate-400" />
        <p className="min-w-0 flex-1">
          Las capas, la opacidad y el mapa base que elija quedan guardados en esta PC.{' '}
          <button type="button" onClick={onRestablecer} className="font-semibold text-primary hover:underline">
            Volver a la configuración inicial
          </button>
        </p>
      </div>
    </div>
  )
}
