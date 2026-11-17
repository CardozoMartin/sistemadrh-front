import type { EstadoConexion } from '@/services/realtime'
import { cn } from '@/lib/cn'
import { useNotificaciones } from '../context'

const ESTADOS: Record<EstadoConexion, { label: string; punto: string; titulo: string }> = {
  en_vivo: { label: 'En vivo', punto: 'bg-green-500', titulo: 'Recibiendo avisos de expedientes en tiempo real' },
  conectando: { label: 'Conectando…', punto: 'bg-amber-400 animate-pulse', titulo: 'Conectando con el servidor de avisos' },
  desconectado: {
    label: 'Sin conexión',
    punto: 'bg-slate-400',
    titulo: 'Sin avisos en vivo: las bandejas se actualizan cada 30 s (¿está corriendo npm run dev?)',
  },
  sin_servicio: {
    label: 'Se actualiza cada 30 s',
    punto: 'bg-slate-400',
    titulo: 'El backend todavía no publica avisos en vivo: las bandejas se actualizan cada 30 s',
  },
}

export function IndicadorConexion({ className }: { className?: string }) {
  const { estadoConexion } = useNotificaciones()
  const e = ESTADOS[estadoConexion]
  return (
    <span title={e.titulo} className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400', className)}>
      <span className={cn('size-2 rounded-full', e.punto)} />
      {e.label}
    </span>
  )
}
