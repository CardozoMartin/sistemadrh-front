import { lazy, Suspense, type ReactNode } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import type { PoligonoReubicacion, PuntoReubicacion, SuministroReubicacion } from '../backend.types'
import { anilloExterior, caminoSuministro, diferenciaSuperficie, hectareas, textoPunto } from '../formato'

// El mapa (Leaflet) se carga recién cuando hay algo para comparar.
const EditorPoligonoMap = lazy(() => import('@/components/map/EditorPoligonoMap').then((m) => ({ default: m.EditorPoligonoMap })))

function Fila({ label, vigente, propuesto, diferencia }: { label: string; vigente: ReactNode; propuesto: ReactNode; diferencia?: ReactNode }) {
  return (
    <tr>
      <td className="py-1.5 pr-3 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">{label}</td>
      <td className="py-1.5 pr-3 tabular-nums">{vigente}</td>
      <td className="py-1.5 pr-3 font-semibold tabular-nums">{propuesto}</td>
      <td className="py-1.5 text-xs font-semibold tabular-nums">{diferencia}</td>
    </tr>
  )
}

/** El lugar vigente vs. el propuesto: superficie, perímetro, archivo y el mapa con los dos. */
export function ComparacionPoligono({ vigente, propuesto }: { vigente: PoligonoReubicacion | null; propuesto: PoligonoReubicacion }) {
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
            <th />
            <th className="pb-1 font-medium">Vigente</th>
            <th className="pb-1 font-medium">Propuesto</th>
            <th className="pb-1 font-medium">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          <Fila
            label="Superficie"
            vigente={vigente ? hectareas(vigente.superficieHa) : '—'}
            propuesto={hectareas(propuesto.superficieHa)}
            diferencia={vigente ? diferenciaSuperficie(vigente.superficieHa, propuesto.superficieHa) : undefined}
          />
          <Fila label="Perímetro" vigente={vigente ? `${Math.round(vigente.perimetroM)} m` : '—'} propuesto={`${Math.round(propuesto.perimetroM)} m`} />
          <Fila label="Archivo" vigente={vigente?.archivo?.nombre ?? '—'} propuesto={propuesto.archivo?.nombre ?? '—'} />
        </tbody>
      </table>
      <Suspense fallback={<div className="flex h-72 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
        <EditorPoligonoMap original={anilloExterior(vigente)} propuesta={anilloExterior(propuesto)} className="h-80" />
      </Suspense>
      <p className="text-xs text-slate-500 dark:text-slate-400">Punteado: el lugar vigente. Relleno: el propuesto.</p>
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
