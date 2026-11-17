import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { EventoEmpresa, TipoEvento } from '../types'

const EVENTOS: Record<TipoEvento, { titulo: string; icono: string; color: string }> = {
  ALTA: { titulo: 'Alta de la empresa (Planificación)', icono: 'add_business', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  DICTAMEN: { titulo: 'Dictamen de Jurídico', icono: 'gavel', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  RESOLUCION: { titulo: 'Resolución de Secretaría General', icono: 'verified', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  OBSERVACION: { titulo: 'Observada (devuelta a Planificación)', icono: 'undo', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  RECHAZO: { titulo: 'Alta rechazada', icono: 'cancel', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  REENVIO: { titulo: 'Corregida y reenviada', icono: 'redo', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  MODIFICACION: { titulo: 'Modificación de datos', icono: 'edit', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  BAJA: { titulo: 'Baja de la empresa', icono: 'domain_disabled', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  REACTIVACION: { titulo: 'Reactivación de la empresa', icono: 'restart_alt', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  ALTA_MAQUINA: { titulo: 'Alta de máquina', icono: 'precision_manufacturing', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  MODIFICACION_MAQUINA: { titulo: 'Modificación de máquina', icono: 'build', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  BAJA_MAQUINA: { titulo: 'Baja de máquina', icono: 'block', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  REACTIVACION_MAQUINA: { titulo: 'Reactivación de máquina', icono: 'restart_alt', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Línea de tiempo de la empresa y sus máquinas: quién, cuándo, qué cambió y por qué (RF22). */
export function HistorialEmpresa({ eventos }: { eventos: EventoEmpresa[] }) {
  if (eventos.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Sin movimientos.</p>
  return (
    <ol className="flex flex-col gap-4">
      {eventos.map((ev) => {
        const info = EVENTOS[ev.tipo]
        return (
          <li key={ev.id} className="flex gap-3">
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', info.color)}>
              <Icon name={info.icono} className="text-lg!" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                {info.titulo}
                {ev.maquina && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{ev.maquina}</span>}
                {!!ev.cambios?.length && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    {ev.cambios.length} {ev.cambios.length === 1 ? 'campo' : 'campos'}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fechaHora(ev.fecha)} · {ev.usuario}
              </p>
              {ev.observacion && <p className="mt-1 text-sm text-slate-700 italic dark:text-slate-300">“{ev.observacion}”</p>}
              {!!ev.cambios?.length && (
                <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                  {ev.cambios.map((c) => (
                    <li key={c.etiqueta} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{c.etiqueta}:</span>
                      <span className="text-slate-400 line-through">{c.antes || '(vacío)'}</span>
                      <Icon name="arrow_right_alt" className="text-sm! text-slate-400" />
                      <span className="font-semibold text-primary">{c.ahora || '(vacío)'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
