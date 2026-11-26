import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

type Papel = { id: number; descripcion: string }

/**
 * Jurídico revisa los papeles: el checklist del trámite con lo que trajo el expediente al iniciarse
 * en Catastro. Solo lectura. `checklist` undefined (no cargó o falló): se muestra al menos lo presentado.
 */
export function DocumentacionRevision({ checklist, presentados: lista }: { checklist: Papel[] | undefined; presentados: Papel[] }) {
  const presentados = new Set(lista.map((d) => d.id))
  const papeles = checklist ?? lista

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Documentación presentada</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Lo que marcó Catastro al iniciar el trámite. Los obligatorios ya se controlaron al iniciar.</p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {papeles.map((p) => {
          const esta = presentados.has(p.id)
          return (
            <li key={p.id} className={cn('flex items-start gap-2 text-sm', esta ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400')}>
              <Icon name={esta ? 'check_box' : 'check_box_outline_blank'} className={cn('text-[18px]!', esta ? 'text-green-600' : 'text-slate-300')} />
              <span>
                {p.descripcion}
                {!esta && ' (no presentado)'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
