import { FONDOS_VISOR } from '@/components/map/fondos'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

interface Props {
  fondo: string
  onFondo: (id: string) => void
}

/** Selector de mapa base con miniaturas (una tesela de Tucumán de cada uno). */
export function PanelFondos({ fondo, onFondo }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 p-3">
      {FONDOS_VISOR.map((f) => {
        const activo = f.id === fondo
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFondo(f.id)}
            aria-pressed={activo}
            className={cn(
              'group overflow-hidden rounded-xl border-2 text-left transition-colors',
              activo ? 'border-primary' : 'border-transparent ring-1 ring-slate-200 hover:ring-slate-300 dark:ring-slate-700 dark:hover:ring-slate-600',
            )}
          >
            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900">
              <img src={f.miniatura} alt="" loading="lazy" className="size-full object-cover" />
              {activo && (
                <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-primary text-white shadow">
                  <Icon name="check" className="text-[16px]!" />
                </span>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className={cn('truncate text-sm font-semibold', activo ? 'text-primary' : 'text-slate-800 dark:text-slate-100')}>{f.nombre}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{f.descripcion}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
