import type { ReactNode } from 'react'
import { controlClass } from '@/components/form/styles'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

// Piezas de formulario de las pantallas de cada oficina del circuito (todos los trámites y la baja de pozo).

/** Un campo con su etiqueta y, si hace falta, una ayuda debajo. */
export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-slate-500 dark:text-slate-400">{ayuda}</span>}
    </label>
  )
}

export function Observaciones({ valor, onChange, obligatorio, placeholder }: { valor: string; onChange: (v: string) => void; obligatorio?: boolean; placeholder?: string }) {
  return (
    <Campo etiqueta={obligatorio ? 'Observaciones (obligatorio)' : 'Observaciones'}>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={controlClass({ className: 'resize-y' })} />
    </Campo>
  )
}

/**
 * Opciones tipo tarjeta (apto / observado / no apto, sin deuda / con deuda).
 * `grande`: botones grandes y centrados, con su color al pasar el mouse (`hover` de cada opción).
 */
export function Opciones<T extends string>({
  valor,
  onChange,
  opciones,
  grande,
}: {
  valor: T | ''
  onChange: (v: T) => void
  opciones: { valor: T; texto: string; icono: string; color: string; hover?: string }[]
  grande?: boolean
}) {
  if (grande) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            aria-pressed={valor === o.valor}
            className={cn(
              'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 px-4 py-5 text-center text-lg font-bold shadow-sm transition-all',
              'hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:outline-none active:translate-y-0',
              valor === o.valor ? cn(o.color, 'shadow-md') : cn('border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300', o.hover),
            )}
          >
            <Icon name={o.icono} className="text-[40px]!" />
            {o.texto}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={cn(
            'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
            valor === o.valor ? o.color : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
          )}
        >
          <Icon name={o.icono} className="text-[20px]!" />
          {o.texto}
        </button>
      ))}
    </div>
  )
}
