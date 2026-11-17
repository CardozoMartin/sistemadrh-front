import { useController } from 'react-hook-form'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface OpcionResultado {
  value: string
  label: string
  descripcion: string
  icono: string
  tono: 'positivo' | 'negativo'
}

const TONOS = {
  positivo: { activo: 'border-green-500 bg-green-50 dark:bg-green-500/10', icono: 'text-green-600' },
  negativo: { activo: 'border-red-500 bg-red-50 dark:bg-red-500/10', icono: 'text-red-600' },
}

/** Decisión de la oficina (Apto / No apto, Con / Sin deuda) como dos tarjetas de color. */
export function ResultadoSelector({ name, label, opciones }: { name: string; label: string; opciones: OpcionResultado[] }) {
  const { field } = useController({ name })
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-200">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {opciones.map((op) => {
          const activo = field.value === op.value
          const t = TONOS[op.tono]
          return (
            <label
              key={op.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                activo ? t.activo : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
              )}
            >
              <input
                type="radio"
                name={field.name}
                value={op.value}
                checked={activo}
                onChange={() => field.onChange(op.value)}
                ref={op === opciones[0] ? field.ref : undefined}
                className="sr-only"
              />
              <Icon name={op.icono} filled={activo} className={cn('text-2xl!', activo ? t.icono : 'text-slate-400')} />
              <span className="flex-1">
                <span className="block font-semibold text-slate-900 dark:text-white">{op.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{op.descripcion}</span>
              </span>
              {activo && <Icon name="check" className={cn('text-xl!', t.icono)} />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
