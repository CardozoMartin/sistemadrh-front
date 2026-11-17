import { useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'

interface Props {
  /** Pasos propios del trámite antes del circuito de oficinas (ej: ['Búsqueda']). */
  previos: string[]
  /** Índice del paso actual (0 = primer paso previo). */
  actual: number
  /** Texto del paso actual en el encabezado (ej: "Búsqueda de concesión"). */
  titulo: string
  /** Nombre del paso de carga en Catastro (la primera etapa del circuito), si el trámite lo llama distinto. */
  carga?: string
}

/**
 * Barra "Paso N de M" de las pantallas de carga en Catastro (antes de que exista el
 * expediente). Después de los pasos previos siguen las oficinas del circuito (/etapas).
 */
export function PasosTramite({ previos, actual, titulo, carga }: Props) {
  const d = useDominio()
  const pasos = useMemo(
    () => [
      ...previos,
      ...d.etapas.map((e, i) =>
        i === d.etapas.length - 1 ? `${d.nombreOficina(e.oficinaId)} Finalización` : i === 0 && carga ? carga : d.nombreOficina(e.oficinaId),
      ),
    ],
    [previos, d, carga],
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-surface-dark">
      <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Paso {actual + 1} de {pasos.length}: {titulo}
      </p>
      <ol className="flex overflow-x-auto">
        {pasos.map((paso, i) => {
          const completo = i < actual
          const esActual = i === actual
          return (
            <li key={`${paso}-${i}`} className="flex min-w-24 flex-1 flex-col items-center gap-2 text-center">
              <div className="flex w-full items-center">
                <span className={cn('h-1 flex-1', i === 0 ? 'bg-transparent' : i <= actual ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-700')} />
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    completo && 'bg-primary text-white',
                    esActual && 'bg-primary text-white ring-4 ring-primary/20',
                    !completo && !esActual && 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                  )}
                >
                  {completo ? <Icon name="check" className="text-sm!" /> : i + 1}
                </span>
                <span className={cn('h-1 flex-1', i === pasos.length - 1 ? 'bg-transparent' : i < actual ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-700')} />
              </div>
              <span className={cn('text-xs font-medium', i <= actual ? 'text-primary' : 'text-slate-500 dark:text-slate-400')}>{paso}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
