import { Icon } from '@/components/ui/Icon'
import type { SituacionLegalInfo } from '@/types/domain'

interface Props {
  /** Situación legal elegida (de /situacionesLegales), con la documentación que exige. */
  situacion: SituacionLegalInfo
  presentados: string[]
  onToggle: (papel: string) => void
}

export function DocumentacionRequerida({ situacion, presentados, onToggle }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold tracking-wide text-slate-700 uppercase dark:text-slate-200">{situacion.titulo}</p>
        <Icon name="folder_open" className="text-[22px]! text-primary" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {situacion.documentacion.map((papel) => (
          <label
            key={papel}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <input
              type="checkbox"
              checked={presentados.includes(papel)}
              onChange={() => onToggle(papel)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">{papel}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
