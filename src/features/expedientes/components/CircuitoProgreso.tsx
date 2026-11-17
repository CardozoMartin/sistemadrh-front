import { Icon } from '@/components/ui/Icon'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import type { Expediente } from '@/types/domain'
import { posicionActual } from '../circuito'

/**
 * Barra de progreso del circuito de oficinas (Fase 2 del plan).
 * Completadas en verde, la actual en azul (ámbar si está observada), las siguientes en gris.
 * Las etapas salen de la API (/etapas).
 */
export function CircuitoProgreso({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const actual = posicionActual(expediente, d)
  const finalizado = !d.estadosPendientes.includes(expediente.estadoId)
  const observado = expediente.estadoId === 'observado'

  return (
    <ol className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface-dark">
      {d.etapas.map((etapa, i) => {
        const completa = finalizado || i < actual
        const esActual = !finalizado && i === actual
        return (
          <li key={etapa.id} className="flex min-w-28 flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : completa || esActual ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700')} />
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  completa && 'bg-green-500 text-white',
                  esActual && (observado ? 'bg-amber-500 text-white ring-4 ring-amber-500/20' : 'bg-primary text-white ring-4 ring-primary/20'),
                  !completa && !esActual && 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                )}
              >
                {completa ? <Icon name="check" className="text-base!" /> : esActual && observado ? <Icon name="priority_high" className="text-base!" /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === d.etapas.length - 1 ? 'bg-transparent' : completa ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700')} />
            </div>
            <span className={cn('text-xs font-semibold', esActual ? (observado ? 'text-amber-600' : 'text-primary') : completa ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400')}>
              {d.nombreOficina(etapa.oficinaId)}
            </span>
            <span className="text-[11px] text-slate-400">{etapa.nombre}</span>
          </li>
        )
      })}
    </ol>
  )
}
