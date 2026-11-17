import { Icon } from '@/components/ui/Icon'
import { formatearFecha } from '@/config/expedientes'
import { esAprobado } from '@/features/expedientes/circuito'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'

/** Visto bueno de cada oficina del circuito (según el historial), para la pantalla de cierre. */
export function ChecksCircuito({ expediente, mensaje }: { expediente: Expediente; mensaje: string }) {
  const d = useDominio()
  const aprobadas = expediente.historial.filter(esAprobado)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
        <Icon name="check_circle" filled className="text-green-600" />
        <div>
          <p className="font-semibold text-green-800 dark:text-green-200">Validación final</p>
          <p className="text-sm text-green-700 dark:text-green-300">{mensaje}</p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {d.etapas.slice(0, -1).map((etapa) => {
          const ok = [...aprobadas].reverse().find((a) => a.etapaId === etapa.id)
          return (
            <li key={etapa.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
              <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} filled={!!ok} className={ok ? 'text-green-600' : 'text-slate-300'} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{d.nombreOficina(etapa.oficinaId)}</p>
                <p className="truncate text-xs text-slate-500">
                  {etapa.nombre}
                  {ok && ` · ${d.usuario(ok.usuarioId)?.nombre ?? ''} · ${formatearFecha(ok.fecha)}`}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
