import { cn } from '@/lib/cn'
import { hectareas, litrosPorSegundo } from '../../shared/circuitoBackend/reglas'
import type { ModificacionBackend } from '../backend.types'
import { ComparacionLadoALado } from './ComparacionPlanoMap'

const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

function Cifra({ etiqueta, valor, detalle, destacada }: { etiqueta: string; valor: string; detalle?: string; destacada?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-4 py-3', destacada ? 'border-primary/40 bg-primary/5' : 'border-slate-200 dark:border-slate-700')}>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{etiqueta}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white">{valor}</p>
      {detalle && <p className="text-xs text-slate-500 dark:text-slate-400">{detalle}</p>}
    </div>
  )
}

/**
 * La superficie antes y después (con el mapa), los usos y el caudal recalculados. Lo que mira cada
 * oficina para decidir y lo que Catastro coteja al cerrar. Todo lo calcula el backend.
 */
export function SuperficieResumen({ datos, conMapa = true }: { datos: ModificacionBackend; conMapa?: boolean }) {
  const m = datos.modificacion
  const { superficie, caudal, poligonoPropuesto: plano } = m
  const diferencia = superficie.diferenciaHa
  const cambianUsos = m.usos.some((u) => u.magnitudNueva !== null)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra
          etiqueta="Superficie actual"
          valor={hectareas(superficie.actualHa)}
          detalle={superficie.origenActual === 'POLIGONO' ? 'Medida del polígono vigente' : 'Suma de los usos en hectáreas (sin polígono)'}
        />
        <Cifra
          etiqueta="Nueva superficie"
          valor={superficie.nuevaHa === null ? '—' : hectareas(superficie.nuevaHa)}
          detalle={plano ? `Plano: ${plano.archivo.nombre} · perímetro ${num(plano.perimetroM)} m` : 'Falta cargar el plano'}
          destacada
        />
        <Cifra
          etiqueta="Diferencia"
          valor={diferencia === null ? '—' : `${diferencia > 0 ? '+' : ''}${hectareas(diferencia)}`}
          detalle={diferencia === null ? undefined : `${diferencia > 0 ? '+' : ''}${num((diferencia / superficie.actualHa) * 100)} % de la superficie actual`}
        />
      </div>

      {conMapa && (
        <ComparacionLadoALado
          actual={m.poligonoActual?.geojson ?? null}
          propuesto={plano?.geojson ?? null}
          numeroConcesion={m.concesion.numero}
          tituloActual={`Superficie actual · ${hectareas(superficie.actualHa)}`}
          tituloPropuesto={
            <>
              Nueva superficie
              {superficie.nuevaHa !== null && ` · ${hectareas(superficie.nuevaHa)}`}
              {diferencia !== null && (
                <span className={cn('ml-1.5', diferencia > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  ({diferencia > 0 ? '+' : ''}
                  {hectareas(diferencia)})
                </span>
              )}
            </>
          }
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Uso</th>
              <th className="px-4 py-2 text-right">Actual</th>
              <th className="px-4 py-2 text-right">Propuesto</th>
              <th className="px-4 py-2 text-right">Caudal actual</th>
              <th className="px-4 py-2 text-right">Caudal propuesto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 tabular-nums dark:divide-slate-700">
            {m.usos.map((u) => (
              <tr key={u.tipoUso}>
                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{u.nombre}</td>
                <td className="px-4 py-2 text-right">
                  {num(u.magnitudActual)} {u.unidad}
                </td>
                <td className={cn('px-4 py-2 text-right', u.magnitudNueva !== null && u.magnitudNueva !== u.magnitudActual && 'font-semibold text-primary')}>
                  {u.magnitudNueva === null ? '—' : `${num(u.magnitudNueva)} ${u.unidad}`}
                </td>
                <td className="px-4 py-2 text-right">{litrosPorSegundo(u.caudalActualLps)}</td>
                <td className="px-4 py-2 text-right">{u.caudalNuevoLps === null ? '—' : litrosPorSegundo(u.caudalNuevoLps)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold dark:bg-slate-900/40">
              <td className="px-4 py-2" colSpan={3}>
                Caudal asignado
              </td>
              <td className="px-4 py-2 text-right">{caudal.actualLps === null ? 'No registrado' : litrosPorSegundo(caudal.actualLps)}</td>
              <td className="px-4 py-2 text-right text-primary">{caudal.nuevoLps === null ? '—' : litrosPorSegundo(caudal.nuevoLps)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {cambianUsos && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Los usos en hectáreas cambian en la misma proporción que la superficie; los demás (cabezas, unidades) quedan igual. El caudal de cada uso es magnitud × dotación del catálogo, y el caudal
          asignado cambia en la misma proporción que la suma de los usos.
        </p>
      )}
    </div>
  )
}
