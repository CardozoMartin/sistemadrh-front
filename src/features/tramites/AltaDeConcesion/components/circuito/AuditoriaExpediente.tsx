import type { ReactNode } from 'react'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { UsuarioAuditado } from '../../backend.types'
import { useAuditoria } from '../../hooks'

const formatear = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Quien({ u }: { u: UsuarioAuditado | null }) {
  if (!u) return <span className="text-slate-400">—</span>
  return (
    <span>
      <span className="font-medium text-slate-800 dark:text-slate-100">{u.nombre}</span>
      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({u.legajo})</span>
    </span>
  )
}

function Hito({ icono, titulo, children, tono }: { icono: string; titulo: string; children: ReactNode; tono: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', tono)}>
        <Icon name={icono} className="text-[18px]!" />
      </span>
      <div className="text-sm">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{titulo}</p>
        {children}
      </div>
    </div>
  )
}

/**
 * Auditoría del expediente (exp_auditoria): quién lo inició, por qué oficinas pasó y quién lo
 * tomó y lo pasó en cada una, y quién lo finalizó.
 */
export function AuditoriaExpediente({ expedienteId }: { expedienteId: string }) {
  const auditoria = useAuditoria(expedienteId)
  if (auditoria.isPending) return <LoadingState mensaje="Cargando auditoría…" className="py-6" />
  if (auditoria.isError) return <ErrorState error={auditoria.error} onRetry={() => void auditoria.refetch()} className="py-6" />
  const { iniciado, finalizado, recorrido, eventos } = auditoria.data
  const correcciones = eventos.filter((e) => e.accion === 'CORRECCION')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Hito icono="flag" titulo="Inició" tono="bg-primary/10 text-primary">
          {iniciado ? (
            <>
              <Quien u={iniciado.usuario} />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {iniciado.oficina} · {formatear(iniciado.fecha)}
              </p>
            </>
          ) : (
            <p className="text-slate-500">Sin registro</p>
          )}
        </Hito>
        <Hito icono={finalizado ? 'task_alt' : 'pending'} titulo={finalizado ? finalizado.estadoNombre : 'Sin finalizar'} tono={finalizado ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}>
          {finalizado ? (
            <>
              <Quien u={finalizado.usuario} />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {finalizado.oficina} · {formatear(finalizado.fecha)}
              </p>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">El expediente sigue circulando.</p>
          )}
        </Hito>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Oficina</th>
              <th className="px-4 py-3">Llegó</th>
              <th className="px-4 py-3">Lo tomó</th>
              <th className="px-4 py-3">Salió / cerró</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {recorrido.map((p, i) => (
              <tr key={i} className="align-top">
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{p.oficina}</span>
                  {p.esDevolucion && <span className="ml-2 text-xs font-semibold text-amber-600">devuelto</span>}
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{p.etapa}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block tabular-nums">{formatear(p.llego)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{p.enviadoPor ? <>enviado por <Quien u={p.enviadoPor} /></> : 'se inició acá'}</span>
                </td>
                <td className="px-4 py-3">
                  {p.tomadoPor ? (
                    <>
                      <Quien u={p.tomadoPor} />
                      <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-400">{formatear(p.tomadoEn!)}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600">Todavía nadie lo tomó</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.salio ? (
                    <>
                      <span className="block tabular-nums">{formatear(p.salio)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        por <Quien u={p.salidaPor} />
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Está acá</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {correcciones.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <Icon name="edit_note" className="text-[18px]!" />
            Correcciones de datos ({correcciones.length})
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {correcciones.map((c) => (
              <li key={c.id} className="text-slate-700 dark:text-slate-300">
                <span className="tabular-nums">{formatear(c.fecha)}</span> · <Quien u={c.usuario} /> · {c.oficina}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">El motivo y el detalle de cada dato corregido están en el historial.</p>
        </div>
      )}
    </div>
  )
}
