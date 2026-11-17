import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { ICONO_MOVIMIENTO, type Movimiento, type TipoMovimiento } from '../movimientos'

const formatear = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const COLOR: Record<TipoMovimiento, string> = {
  inicio: 'bg-primary/10 text-primary',
  recepcion: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20',
  derivacion: 'bg-green-100 text-green-600 dark:bg-green-500/20',
  observacion: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20',
  finalizacion: 'bg-green-600 text-white',
}

interface Props {
  movimientos: Movimiento[]
  /** Fila final (ej: "Pendiente en Distrito"). */
  pie?: ReactNode
  /** Etiqueta antes de cada movimiento (ej: el trámite y el expediente, en el historial de una concesión). */
  etiqueta?: (m: Movimiento) => ReactNode
}

/** Línea de tiempo de movimientos (quién hizo qué, cuándo y con qué observación). */
export function LineaDeTiempo({ movimientos, pie, etiqueta }: Props) {
  return (
    <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
      {movimientos.map((m) => (
        <li key={`${m.expedienteId}-${m.clave}`} className="mb-4 ml-5">
          <span className={cn('absolute -left-2.5 flex size-5 items-center justify-center rounded-full', COLOR[m.tipo])}>
            <Icon name={ICONO_MOVIMIENTO[m.tipo]} className="text-sm!" />
          </span>
          {etiqueta && <div className="mb-0.5">{etiqueta(m)}</div>}
          <p className="text-sm text-slate-800 dark:text-slate-100">{m.texto}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatear(m.fecha)}</p>
          {m.observaciones && <p className="mt-1 text-xs text-slate-600 italic dark:text-slate-300">“{m.observaciones}”</p>}
        </li>
      ))}
      {pie}
    </ol>
  )
}

/** Fila final de la línea de tiempo para lo que todavía está pendiente. */
export function PieLineaDeTiempo({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <li className="ml-5">
      <span className="absolute -left-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-white">
        <Icon name="more_horiz" className="text-sm!" />
      </span>
      <p className="text-sm font-semibold text-primary">{titulo}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{detalle}</p>
    </li>
  )
}
