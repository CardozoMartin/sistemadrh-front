import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { CircuitoAlta, EtapaCircuito } from '../../backend.types'

/** El recorrido, en orden. La corrección se muestra sobre el paso de Catastro (carga). */
const PASOS: { etapas: EtapaCircuito[]; oficina: string; detalle: string }[] = [
  { etapas: ['CARGA', 'CORRECCION'], oficina: 'Catastro', detalle: 'Carga' },
  { etapas: ['RECAUDACION'], oficina: 'Recaudación', detalle: 'Deuda' },
  { etapas: ['DISTRITO'], oficina: 'Distrito', detalle: 'Informe técnico' },
  { etapas: ['JURIDICO'], oficina: 'Jurídico', detalle: 'Dictamen' },
  { etapas: ['SECRETARIA_GENERAL'], oficina: 'Secretaría Gral.', detalle: 'Resolución' },
  { etapas: ['CIERRE'], oficina: 'Catastro', detalle: 'Verificación final' },
  { etapas: ['ESPERA_PADRON'], oficina: 'Rentas', detalle: 'Padrón' },
]

/**
 * Barra de progreso del circuito (Fase 2 del plan): pasos completados en verde, el actual
 * en azul (ámbar si está observado o en espera, rojo si se rechazó) y los que faltan en gris.
 */
export function BarraEtapas({ circuito }: { circuito: CircuitoAlta }) {
  const actual = PASOS.findIndex((p) => p.etapas.includes(circuito.etapa))
  const finalizado = circuito.estado === 'FINALIZADO'
  const rechazado = circuito.estado === 'RECHAZADO'
  const alerta = circuito.estado === 'OBSERVADO' || circuito.estado === 'EN_ESPERA'

  return (
    <ol className="flex overflow-x-auto pb-1">
      {PASOS.map((p, i) => {
        const hecho = finalizado || i < actual
        const esActual = !finalizado && i === actual
        const color = hecho
          ? 'bg-green-600 text-white'
          : esActual
            ? rechazado
              ? 'bg-red-600 text-white'
              : alerta
                ? 'bg-amber-500 text-white'
                : 'bg-primary text-white ring-4 ring-primary/20'
            : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
        return (
          <li key={p.detalle} className="flex min-w-[7.5rem] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'invisible' : hecho || esActual ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700')} />
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold', color)}>
                {hecho ? <Icon name="check" className="text-[18px]!" /> : rechazado && esActual ? <Icon name="close" className="text-[18px]!" /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === PASOS.length - 1 ? 'invisible' : hecho ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700')} />
            </div>
            <span className={cn('mt-1.5 text-xs font-semibold', esActual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{p.oficina}</span>
            <span className="text-[11px] text-slate-400">{circuito.etapa === 'CORRECCION' && i === 0 ? 'Corrección' : p.detalle}</span>
          </li>
        )
      })}
    </ol>
  )
}
