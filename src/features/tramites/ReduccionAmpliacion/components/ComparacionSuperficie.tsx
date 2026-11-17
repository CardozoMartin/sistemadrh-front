import { lazy, Suspense } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { perimetroMetros } from '@/lib/geo'
import { cn } from '@/lib/cn'
import type { Expediente } from '@/types/domain'
import { NOMBRE_TIPO } from '../superficie'
import type { DatosExpedienteModificacion } from '../types'

// El mapa (Leaflet) se carga recién cuando se muestra el panel.
const EditorPoligonoMap = lazy(() => import('@/components/map/EditorPoligonoMap').then((m) => ({ default: m.EditorPoligonoMap })))

const ha = (n: number) => `${n.toFixed(2)} ha`
const ls = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)} l/s`)

function Fila({ label, actual, propuesta, diferencia }: { label: string; actual: string; propuesta: string; diferencia?: number }) {
  return (
    <tr>
      <td className="py-1.5 pr-3 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">{label}</td>
      <td className="py-1.5 pr-3 tabular-nums">{actual}</td>
      <td className="py-1.5 pr-3 font-semibold tabular-nums">{propuesta}</td>
      <td className={cn('py-1.5 text-xs font-semibold tabular-nums', diferencia == null ? '' : diferencia > 0 ? 'text-emerald-600' : diferencia < 0 ? 'text-red-600' : '')}>
        {diferencia == null ? '' : `${diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}`}
      </td>
    </tr>
  )
}

/** Superficie vigente vs. propuesta (mapa + números), para las oficinas y la consulta del expediente. */
export function ComparacionSuperficie({ expediente }: { expediente: Expediente }) {
  const datos = expediente.datos as DatosExpedienteModificacion | null
  if (!datos) return null
  const { actual, propuesta, tipo } = datos

  return (
    <Card>
      <h3 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
        <Icon name="polyline" className="text-primary" /> {NOMBRE_TIPO[tipo]} de superficie
      </h3>
      <div className="flex flex-col gap-4 p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
              <th />
              <th className="pb-1 font-medium">Actual</th>
              <th className="pb-1 font-medium">Propuesta</th>
              <th className="pb-1 font-medium">Dif.</th>
            </tr>
          </thead>
          <tbody>
            <Fila label="Superficie" actual={ha(actual.hectareas)} propuesta={ha(propuesta.hectareas)} diferencia={propuesta.hectareas - actual.hectareas} />
            <Fila
              label="Caudal"
              actual={ls(actual.caudal)}
              propuesta={ls(propuesta.caudal)}
              diferencia={actual.caudal != null && propuesta.caudal != null ? propuesta.caudal - actual.caudal : undefined}
            />
            <Fila label="Perímetro" actual={`${Math.round(perimetroMetros(actual.coordenadas))} m`} propuesta={`${Math.round(perimetroMetros(propuesta.coordenadas))} m`} />
            <Fila label="Vértices" actual={String(actual.coordenadas.length)} propuesta={String(propuesta.coordenadas.length)} />
          </tbody>
        </table>
        <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
          <EditorPoligonoMap original={actual.coordenadas} propuesta={propuesta.coordenadas} className="h-64" />
        </Suspense>
      </div>
    </Card>
  )
}
