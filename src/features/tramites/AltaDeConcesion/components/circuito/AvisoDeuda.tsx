import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { AvisoDeudaBackend } from '../../backend.types'

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Recaudación le dio curso al expediente con deuda: lo ven todas las oficinas, arriba de todo,
 * con la nota de por qué y las deudas (si después se pagaron, se indica).
 */
export function AvisoDeuda({ aviso }: { aviso: AvisoDeudaBackend }) {
  const debe = aviso.sigueConDeuda
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border-2 p-5',
        debe ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200',
      )}
    >
      <Icon name={debe ? 'warning' : 'task_alt'} filled className={cn('text-[28px]!', debe ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-400')} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-bold">{debe ? 'El titular tiene deuda: Recaudación le dio curso sin cobrarla' : 'Pasó por Recaudación con deuda, que después se pagó'}</p>

        <div className={cn('rounded-lg border px-4 py-3 text-sm', debe ? 'border-red-200 bg-white/70 dark:border-red-500/30 dark:bg-slate-900/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40')}>
          <p className="text-xs font-semibold tracking-wide uppercase opacity-70">Nota de Recaudación</p>
          <p className="mt-1 whitespace-pre-line">{aviso.observaciones}</p>
          <p className="mt-2 text-xs opacity-70">
            {aviso.usuario} · {fecha(aviso.fecha)}
          </p>
        </div>

        {aviso.deudas.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {aviso.deudas.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{d.titular}</span>
                <span className="opacity-80">· {d.detalle}</span>
                {d.pendiente ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Pendiente</span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                    Pagada{d.canceladaEn ? ` el ${new Date(d.canceladaEn).toLocaleDateString('es-AR')}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
