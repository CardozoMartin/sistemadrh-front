import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { EtapaPozo, RegistroPozoBackend } from '../types'

/** El recorrido del registro de pozo (prototipo: PASOS_POZO de shared/state.js). */
const PASOS: { etapas: (EtapaPozo | 'ALTA')[]; oficina: string; detalle: string }[] = [
  { etapas: ['ALTA', 'CORRECCION_POZOS'], oficina: 'Pozos', detalle: 'Alta del pozo' },
  { etapas: ['CATASTRO_POZO'], oficina: 'Catastro', detalle: 'Concesión y N°' },
  { etapas: ['TOMA_CONOCIMIENTO_DISTRITO'], oficina: 'Distrito', detalle: 'Toma conocimiento' },
  { etapas: ['RECAUDACION'], oficina: 'Recaudación', detalle: 'Deuda' },
  { etapas: ['JURIDICO'], oficina: 'Jurídico', detalle: 'Dictamen' },
  { etapas: ['SECRETARIA_GENERAL'], oficina: 'Secretaría Gral.', detalle: 'Resolución' },
  { etapas: ['CIERRE_POZO'], oficina: 'Pozos', detalle: 'Cierre' },
]

/** Pasos hechos en verde, el actual en azul (ámbar si está observado o en espera, rojo si se rechazó). */
export function BarraEtapasPozo({ expediente }: { expediente: RegistroPozoBackend['expediente'] }) {
  const actual = PASOS.findIndex((p) => p.etapas.includes(expediente.etapa))
  const finalizado = expediente.estado === 'FINALIZADO'
  const rechazado = expediente.estado === 'RECHAZADO'
  const alerta = expediente.estado === 'OBSERVADO' || expediente.estado === 'EN_ESPERA'

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
            <span className="text-[11px] text-slate-400">{expediente.etapa === 'CORRECCION_POZOS' && i === 0 ? 'Corrección' : p.detalle}</span>
          </li>
        )
      })}
    </ol>
  )
}
