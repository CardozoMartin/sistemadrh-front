import { lazy, Suspense, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { PoligonoReubicacion, PuntoReubicacion, SuministroReubicacion } from '../backend.types'
import {
  caminoSuministro,
  diferenciaSuperficie,
  filasServicio,
  hectareas,
  ladoDePoligono,
  nivelDiferencia,
  textoPunto,
  TOLERANCIA_SUPERFICIE_PCT,
  type LadoPoligono,
  type LadoServicio,
  type NivelDiferencia,
} from '../formato'

// Los mapas (Leaflet) se cargan recién cuando hay algo para comparar.
const MapasComparados = lazy(() => import('@/components/map/MapasComparados').then((m) => ({ default: m.MapasComparados })))
const EditorPoligonoMap = lazy(() => import('@/components/map/EditorPoligonoMap').then((m) => ({ default: m.EditorPoligonoMap })))

const cargandoMapa = (
  <div className="flex h-80 items-center justify-center">
    <Spinner className="size-5 text-primary" />
  </div>
)

const COLOR_DIFERENCIA: Record<NivelDiferencia, string> = {
  'sin-referencia': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  igual: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  dentro: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  fuera: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
}

/** «Hoy 90 ha → Cómo queda 90,01 ha», con la diferencia en verde (dentro de la tolerancia) o ámbar. */
function ResumenSuperficie({ vigente, propuesto }: { vigente: LadoPoligono | null; propuesto: LadoPoligono }) {
  const nivel = nivelDiferencia(vigente?.superficieHa ?? null, propuesto.superficieHa)
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Hoy</p>
        <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white">{vigente ? hectareas(vigente.superficieHa) : '—'}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{vigente ? `${Math.round(vigente.perimetroM)} m de perímetro · ${vigente.archivo ?? 'sin archivo'}` : 'Sin polígono vigente'}</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Icon name="arrow_forward" className="hidden text-slate-400 sm:block" />
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', COLOR_DIFERENCIA[nivel])}>
          {vigente ? diferenciaSuperficie(vigente.superficieHa, propuesto.superficieHa) : 'sin comparar'}
        </span>
      </div>
      <div className="rounded-lg border border-green-300 bg-green-50/50 p-3 dark:border-green-500/40 dark:bg-green-500/5">
        <p className="text-xs font-semibold text-green-700 uppercase dark:text-green-300">Cómo queda</p>
        <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white" title={propuesto.aproximada ? 'Estimada: PostGIS la mide al guardar' : undefined}>
          {propuesto.aproximada ? '≈ ' : ''}
          {hectareas(propuesto.superficieHa)}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {Math.round(propuesto.perimetroM)} m de perímetro · {propuesto.archivo ?? 'sin archivo'}
        </p>
        {propuesto.origen && <p className="truncate text-xs font-medium text-green-700 dark:text-green-300">{propuesto.origen}</p>}
      </div>
      {nivel === 'fuera' && (
        <p className="flex items-center gap-1 text-xs text-amber-700 sm:col-span-3 dark:text-amber-300">
          <Icon name="warning" className="text-base!" /> La superficie cambia más del {TOLERANCIA_SUPERFICIE_PCT} %: en una reubicación la magnitud no cambia. Revise el KML.
        </p>
      )}
    </div>
  )
}

/**
 * El lugar de hoy contra el nuevo: el resumen de superficies y los mapas, lado a lado (por defecto)
 * o superpuestos. Con `previa`, avisa que el nuevo todavía no se guardó.
 */
export function ComparacionLugar({ vigente, propuesto, previa = false }: { vigente: LadoPoligono | null; propuesto: LadoPoligono; previa?: boolean }) {
  const [vista, setVista] = useState<'lado' | 'superpuestos'>('lado')
  const boton = (activo: boolean) =>
    cn('flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold', activo ? 'bg-white text-primary shadow dark:bg-slate-700' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {previa ? (
          <span className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-200">
            <Icon name="visibility" className="text-base!" /> Vista previa: todavía no se guardó
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" className={boton(vista === 'lado')} onClick={() => setVista('lado')}>
            <Icon name="view_column_2" className="text-base!" /> Lado a lado
          </button>
          <button type="button" className={boton(vista === 'superpuestos')} onClick={() => setVista('superpuestos')}>
            <Icon name="layers" className="text-base!" /> Superpuestos
          </button>
        </div>
      </div>

      <ResumenSuperficie vigente={vigente} propuesto={propuesto} />

      <Suspense fallback={cargandoMapa}>
        {vista === 'lado' ? (
          <MapasComparados antes={vigente?.anillo ?? []} despues={propuesto.anillo} />
        ) : (
          <>
            <EditorPoligonoMap original={vigente?.anillo ?? []} propuesta={propuesto.anillo} className="h-96" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Punteado: el lugar de hoy. Relleno: cómo queda.</p>
          </>
        )}
      </Suspense>
    </div>
  )
}

/** El lugar vigente vs. el propuesto, tal como están guardados en el backend. */
export function ComparacionPoligono({ vigente, propuesto }: { vigente: PoligonoReubicacion | null; propuesto: PoligonoReubicacion }) {
  return <ComparacionLugar vigente={vigente && ladoDePoligono(vigente)} propuesto={ladoDePoligono(propuesto)} />
}

/** La forma de servicio campo por campo: hoy y cómo queda, con lo que cambia resaltado. */
export function TablaServicio({ hoy, queda, previa = false }: { hoy: LadoServicio; queda: LadoServicio; previa?: boolean }) {
  const filas = filasServicio(hoy, queda)
  const cambios = filas.filter((f) => f.cambia).length
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {cambios === 0 ? 'Por ahora queda igual que hoy.' : `${cambios === 1 ? 'Cambia 1 dato' : `Cambian ${cambios} datos`}${previa ? ' (todavía sin guardar)' : ''}.`}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-150 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold" />
              <th className="px-3 py-2 font-semibold">Hoy</th>
              <th className="px-3 py-2 font-semibold text-green-700 dark:text-green-300">Cómo queda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filas.map((f) => (
              <tr key={f.campo} className={f.cambia ? 'bg-amber-50/60 dark:bg-amber-500/5' : undefined}>
                <td className="px-3 py-2 text-xs font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">{f.campo}</td>
                <td className={cn('px-3 py-2', f.cambia ? 'text-slate-500 line-through decoration-slate-400 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400')}>{f.hoy}</td>
                <td className="px-3 py-2">
                  <span className={f.cambia ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}>{f.queda}</span>
                  {f.cambia && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">cambia</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface FormaServicio {
  suministro: SuministroReubicacion | null
  puntoEntrega: PuntoReubicacion | null
}

/** La forma de servicio vigente vs. la propuesta (sin punto propuesto, queda el vigente). */
export function ComparacionServicio({ vigente, propuesto }: { vigente: FormaServicio; propuesto: FormaServicio | null }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <dt className="mb-1 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Vigente</dt>
        <dd className="text-slate-700 dark:text-slate-200">{caminoSuministro(vigente.suministro)}</dd>
        {vigente.suministro?.observacion && <dd className="text-slate-500 dark:text-slate-400">{vigente.suministro.observacion}</dd>}
        <dd className="text-slate-500 dark:text-slate-400">Punto de entrega: {textoPunto(vigente.puntoEntrega)}</dd>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <dt className="mb-1 text-xs font-semibold text-primary uppercase">Propuesta</dt>
        {propuesto ? (
          <>
            <dd className="text-slate-900 dark:text-white">{caminoSuministro(propuesto.suministro)}</dd>
            {propuesto.suministro?.observacion && <dd className="text-slate-600 dark:text-slate-300">{propuesto.suministro.observacion}</dd>}
            <dd className="text-slate-600 dark:text-slate-300">Punto de entrega: {propuesto.puntoEntrega ? textoPunto(propuesto.puntoEntrega) : 'sin cambios (queda el vigente)'}</dd>
          </>
        ) : (
          <dd className="text-slate-500 dark:text-slate-400">Todavía no se cargó.</dd>
        )}
      </div>
    </dl>
  )
}
