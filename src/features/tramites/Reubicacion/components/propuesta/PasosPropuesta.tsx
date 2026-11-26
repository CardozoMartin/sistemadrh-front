import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { PasoPropuesta } from '../../formato'

/** Adónde lleva cada paso (las secciones de la página). */
const ANCLA: Record<PasoPropuesta['id'], string> = {
  poligono: 'paso-poligono',
  servicio: 'paso-servicio',
  enviar: 'paso-enviar',
}

/**
 * La guía de la propuesta: 1) Nuevo lugar, 2) Forma de servicio, 3) Revisar y enviar. Cada paso
 * muestra si está listo (tilde) y lleva a su sección. El primero pendiente queda resaltado.
 */
export function PasosPropuesta({ pasos }: { pasos: PasoPropuesta[] }) {
  const actual = pasos.findIndex((p) => !p.listo)
  const ir = (id: PasoPropuesta['id']) => document.getElementById(ANCLA[id])?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <nav aria-label="Pasos de la propuesta" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-surface-dark">
      <ol className="grid gap-2 sm:grid-cols-3">
        {pasos.map((p, i) => {
          const esActual = i === actual
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => ir(p.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                  p.listo && 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10',
                  esActual && 'border-primary bg-primary/5',
                  !p.listo && !esActual && 'border-slate-200 dark:border-slate-700',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    p.listo ? 'bg-green-600 text-white' : esActual ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                  )}
                >
                  {p.listo ? <Icon name="check" className="text-base!" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{p.titulo}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{p.listo ? 'Listo' : esActual ? 'Ahora' : 'Pendiente'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
