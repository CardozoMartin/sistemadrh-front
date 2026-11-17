import { lazy, Suspense } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import type { Expediente } from '@/types/domain'
import { nombreTitular } from '../../shared/schemas/titular'
import { porcentaje } from '../fracciones'
import type { DatosExpedienteSubdivision } from '../types'

// El mapa (Leaflet) se carga recién cuando se muestra el panel.
const SubdivisionMap = lazy(() => import('@/components/map/SubdivisionMap').then((m) => ({ default: m.SubdivisionMap })))

/**
 * Fracciones de la subdivisión (mapa + tabla con titular, superficie, caudal y N° de
 * concesión), para las oficinas del circuito, el cierre y la consulta del expediente.
 */
export function FraccionesDetalle({ expediente }: { expediente: Expediente }) {
  const datos = expediente.datos as DatosExpedienteSubdivision | null
  if (!datos?.fracciones?.length) return null
  const { madre, fracciones } = datos
  const caudalTotal = fracciones.reduce((a, f) => a + (f.caudal ?? 0), 0)
  const conNumero = fracciones.some((f) => f.numeroConcesion)

  return (
    <Card>
      <h3 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
        <Icon name="call_split" className="text-primary" /> Subdivisión en {fracciones.length} fracciones · Concesión madre N° {datos.numeroConcesion} ({madre.hectareas.toFixed(2)} ha)
      </h3>
      <div className="flex flex-col gap-4 p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-left text-sm">
            <thead className="text-xs text-slate-500 uppercase dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3 font-medium">Fracción</th>
                <th className="py-2 pr-3 font-medium">Titular</th>
                <th className="py-2 pr-3 text-right font-medium">Superficie</th>
                <th className="py-2 pr-3 text-right font-medium">%</th>
                <th className="py-2 pr-3 text-right font-medium">Caudal</th>
                {conNumero && <th className="py-2 text-right font-medium">N° concesión</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {fracciones.map((f) => (
                <tr key={f.clave}>
                  <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-full" style={{ background: f.color }} /> {f.nombre}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{f.carga?.titulares[0] ? nombreTitular(f.carga.titulares[0]) : '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.hectareas.toFixed(2)} ha</td>
                  <td className="py-2 pr-3 text-right text-slate-500 tabular-nums">{porcentaje(f, madre).toFixed(1)} %</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{f.caudal == null ? '—' : `${f.caudal.toFixed(2)} l/s`}</td>
                  {conNumero && <td className="py-2 text-right font-semibold">{f.numeroConcesion ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                <td className="py-2 pr-3" colSpan={2}>
                  Total
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{fracciones.reduce((a, f) => a + f.hectareas, 0).toFixed(2)} ha</td>
                <td className="py-2 pr-3 text-right tabular-nums">100 %</td>
                <td className="py-2 pr-3 text-right tabular-nums">{caudalTotal.toFixed(2)} l/s</td>
                {conNumero && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
        <Suspense fallback={<div className="flex h-72 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
          <SubdivisionMap madre={madre.coordenadas} fracciones={fracciones} className="h-72" />
        </Suspense>
      </div>
    </Card>
  )
}
