import { CLASE_COLOR_ESTADO } from '@/config/expedientes'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import type { EstadoExpediente } from '@/types/domain'

export function EstadoBadge({ estadoId }: { estadoId: EstadoExpediente }) {
  const estado = useDominio().estado(estadoId)
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', CLASE_COLOR_ESTADO[estado?.color ?? 'gris'])}>
      {estado?.nombre ?? estadoId}
    </span>
  )
}
