import { Link } from 'react-router'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { cn } from '@/lib/cn'
import { EstadoBadge } from './EstadoBadge'

/** Tabla de expedientes reutilizable (seguimiento, búsquedas, visor). */
export function TablaExpedientes({ expedientes, atenuada }: { expedientes: Expediente[]; atenuada?: boolean }) {
  const { nombreTramite, nombreOficina } = useDominio()
  return (
    <div className={cn('overflow-x-auto transition-opacity', atenuada && 'opacity-60')}>
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Expediente</th>
            <th className="px-4 py-3">Trámite</th>
            <th className="px-4 py-3">Titular</th>
            <th className="px-4 py-3">Ubicación</th>
            <th className="px-4 py-3">Oficina actual</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Superficie</th>
            <th className="px-4 py-3">Actualizado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {expedientes.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-3 font-semibold tabular-nums">
                <Link to={ROUTES.expediente(e.id)} className="text-primary hover:underline" title="Ver historial del expediente">
                  {e.numero}
                </Link>
              </td>
              <td className="px-4 py-3">{nombreTramite(e.tramiteId)}</td>
              <td className="px-4 py-3">{e.titular}</td>
              <td className="px-4 py-3">
                <span className="block">{e.ubicacion.localidad}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {e.ubicacion.departamento} · Distrito {e.ubicacion.distrito}
                </span>
              </td>
              <td className="px-4 py-3">{nombreOficina(e.oficinaId)}</td>
              <td className="px-4 py-3">
                <EstadoBadge estadoId={e.estadoId} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{e.poligono ? `${e.poligono.hectareas.toFixed(2)} ha` : '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatearFecha(e.fechaActualizacion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
