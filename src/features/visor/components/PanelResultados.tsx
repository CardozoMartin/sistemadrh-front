import { cn } from '@/lib/cn'
import { formatoHa, nombreEstado, tituloConcesion } from '../estilos'
import type { AtributosConcesion, ConcesionGeo } from '../types'

interface Props {
  visibles: ConcesionGeo[]
  busqueda: string
  colorDe: (p: AtributosConcesion) => string
  seleccionada: number | null
  onSeleccionar: (concesionId: number) => void
}

/** Cuántas se dibujan en la lista a la vez (con miles, el resto aparece al buscar o filtrar). */
const MAX_LISTA = 300

/** Lista de las concesiones que se ven en el mapa (las que pasan la búsqueda y la leyenda). */
export function PanelResultados({ visibles, busqueda, colorDe, seleccionada, onSeleccionar }: Props) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {visibles.slice(0, MAX_LISTA).map(({ properties: p }) => (
        <li key={p.concesion_id}>
          <button
            type="button"
            onClick={() => onSeleccionar(p.concesion_id)}
            className={cn(
              'flex w-full items-start gap-3 border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
              p.concesion_id === seleccionada && 'bg-primary/5 dark:bg-primary/10',
            )}
            style={{ borderLeftColor: colorDe(p) }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{tituloConcesion(p)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.titular ?? 'Sin titular cargado'}</p>
              <p className="truncate text-xs text-slate-400">{[p.localidad, p.departamento].filter(Boolean).join(', ') || '—'}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-slate-600 tabular-nums dark:text-slate-300">{formatoHa(p.superficie_ha)}</p>
              <p className="text-[11px] text-slate-400">{nombreEstado(p.estado)}</p>
            </div>
          </button>
        </li>
      ))}
      {visibles.length > MAX_LISTA && (
        <li className="px-3 py-3 text-center text-xs text-slate-400">
          Se muestran las primeras {MAX_LISTA}. Busque o filtre para encontrar el resto (en el mapa están todas).
        </li>
      )}
      {!visibles.length && (
        <li className="px-3 py-8 text-center text-sm text-slate-400">{busqueda.trim() ? `Ninguna concesión coincide con «${busqueda.trim()}».` : 'No hay concesiones visibles.'}</li>
      )}
    </ul>
  )
}
