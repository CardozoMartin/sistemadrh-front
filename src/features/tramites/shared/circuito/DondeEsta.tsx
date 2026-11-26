import { Icon } from '@/components/ui/Icon'

const formatear = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Consulta (búsqueda general): dónde está el expediente y quién lo tiene. En lugar del panel de
 * trabajo de la oficina, que solo se usa desde la bandeja.
 */
export function DondeEsta({ oficina, etapa, tomadoPor, tomadoEn, terminado }: { oficina: string; etapa: string; tomadoPor: string | null; tomadoEn: string | null; terminado?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon name={terminado ? 'task_alt' : 'location_on'} className="text-[20px]!" />
      </span>
      <div className="text-sm">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{terminado ? 'Terminado' : 'Dónde está'}</p>
        <p className="font-semibold text-slate-900 dark:text-white">{terminado ?? `${oficina} · ${etapa}`}</p>
        {!terminado && (
          <p className="text-slate-600 dark:text-slate-300">
            {tomadoPor ? `Lo tiene ${tomadoPor} desde ${formatear(tomadoEn!)}` : <span className="font-semibold text-amber-600">Todavía nadie de la oficina lo tomó</span>}
          </p>
        )}
      </div>
    </div>
  )
}
