import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { RUTA_BANDEJA } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { haceCuanto } from '@/lib/fechas'
import { cn } from '@/lib/cn'
import { useNotificaciones } from '../context'
import { useDominio } from '@/hooks/useDominio'
import { describirEvento } from '../mensajes'
import { IndicadorConexion } from './IndicadorConexion'

/** Campana del topnav con el historial de avisos de expedientes. */
export function CampanaNotificaciones() {
  const { notificaciones, noLeidas, marcarTodasLeidas, limpiarNotificaciones } = useNotificaciones()
  const dominio = useDominio()
  const [abierta, setAbierta] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  // Cerrar con clic afuera o Escape
  useEffect(() => {
    if (!abierta) return
    const onClick = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [abierta])

  function alternar() {
    // Al cerrar el panel se dan por leídas las notificaciones que se vieron.
    if (abierta) marcarTodasLeidas()
    setAbierta(!abierta)
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={noLeidas ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
        aria-expanded={abierta}
        className="relative rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-white/90 dark:hover:bg-white/10"
      >
        <Icon name="notifications" filled={noLeidas > 0} className={cn(noLeidas > 0 && 'text-celeste')} />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-surface-dark">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notificaciones</p>
              <IndicadorConexion />
            </div>
            <div className="flex gap-1 text-xs">
              <button type="button" onClick={marcarTodasLeidas} disabled={!noLeidas} className="rounded px-2 py-1 font-semibold text-primary hover:bg-primary/10 disabled:opacity-40">
                Marcar leídas
              </button>
              <button
                type="button"
                onClick={limpiarNotificaciones}
                disabled={!notificaciones.length}
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700/50"
              >
                Limpiar
              </button>
            </div>
          </div>

          {notificaciones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <Icon name="notifications_off" className="text-3xl! text-slate-400" />
              No hay notificaciones. Cuando un expediente llegue a una oficina se avisará acá.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/60">
              {notificaciones.map((n) => {
                const m = describirEvento(n.evento, dominio)
                return (
                  <li key={n.id}>
                    <Link
                      to={RUTA_BANDEJA[m.oficina]}
                      onClick={() => {
                        marcarTodasLeidas()
                        setAbierta(false)
                      }}
                      className={cn('flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50', !n.leida && 'bg-primary/5')}
                    >
                      <Icon name={m.icon} className={cn('mt-0.5 text-xl!', n.leida ? 'text-slate-400' : 'text-primary')} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', n.leida ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white')}>
                          {m.titulo}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.detalle}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{haceCuanto(n.evento.fecha)}</p>
                      </div>
                      {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
