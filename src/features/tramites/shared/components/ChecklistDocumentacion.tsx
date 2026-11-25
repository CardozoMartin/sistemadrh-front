import { Icon } from '@/components/ui/Icon'
import type { DocumentoChecklist } from '../checklist'

interface Props {
  checklist: DocumentoChecklist[]
  /** Ids de los papeles marcados como presentados. */
  marcados: number[]
  onToggle: (id: number) => void
  /** Ids de los papeles obligatorios que faltan (se resaltan después de intentar iniciar). */
  faltantes?: number[]
}

/** Checklist de la documentación que trae el expediente (caso de uso, pasos 4-5). */
export function ChecklistDocumentacion({ checklist, marcados, onToggle, faltantes = [] }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold tracking-wide text-slate-700 uppercase dark:text-slate-200">Documentación presentada</p>
        <Icon name="folder_open" className="text-[22px]! text-primary" />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Marque los papeles que trae el expediente. Los indicados con <span className="text-red-600">*</span> son obligatorios para iniciar.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {checklist.map((papel) => {
          const falta = faltantes.includes(papel.id)
          return (
            <label
              key={papel.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                falta ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'
              }`}
            >
              <input type="checkbox" checked={marcados.includes(papel.id)} onChange={() => onToggle(papel.id)} className="mt-0.5 size-4 shrink-0 accent-primary" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {papel.descripcion}
                {papel.obligatorio && <span className="ml-0.5 text-red-600">*</span>}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
