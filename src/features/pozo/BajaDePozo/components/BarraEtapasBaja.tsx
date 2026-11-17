import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { BajaBackend, EtapaBaja } from '../types'

/** El recorrido de la baja a solicitud. La corrección se muestra sobre el paso de antecedentes de Pozos. */
const PASOS: { etapas: EtapaBaja[]; oficina: string; detalle: string }[] = [
  { etapas: ['INICIO_POZOS'], oficina: 'Pozos', detalle: 'Mesa de entrada' },
  { etapas: ['ANTECEDENTES_POZOS'], oficina: 'Pozos', detalle: 'Antecedentes' },
  { etapas: ['EVALUACION_TECNICA_POZOS', 'CORRECCION_POZOS'], oficina: 'Pozos', detalle: 'Evaluación técnica' },
  { etapas: ['JURIDICO'], oficina: 'Jurídico', detalle: 'Dictamen y concesión' },
  { etapas: ['SECRETARIA_GENERAL'], oficina: 'Secretaría Gral.', detalle: 'Resolución' },
  { etapas: ['CLAUSURA_POZOS'], oficina: 'Pozos', detalle: 'Clausura física' },
]

/**
 * Progreso de la baja: pasos completados en verde, el actual en azul (ámbar si está en espera
 * u observado, rojo si se rechazó) y los que faltan en gris. La clausura solo aparece si la
 * evaluación técnica dijo que corresponde (o mientras no se sabe).
 */
export function BarraEtapasBaja({ b }: { b: BajaBackend }) {
  const e = b.expediente
  const pasos = b.baja.requiereClausura === false ? PASOS.filter((p) => !p.etapas.includes('CLAUSURA_POZOS')) : PASOS
  const todos = [...pasos, { etapas: [] as EtapaBaja[], oficina: 'Pozo dado de baja', detalle: 'Fin del trámite' }]
  const actual = todos.findIndex((p) => p.etapas.includes(e.etapa))
  const finalizado = e.estado === 'FINALIZADO'
  const rechazado = e.estado === 'RECHAZADO'
  const alerta = e.estado === 'OBSERVADO' || e.estado === 'EN_ESPERA'

  return (
    <ol className="flex overflow-x-auto pb-1">
      {todos.map((p, i) => {
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
          <li key={`${p.oficina}-${p.detalle}`} className="flex min-w-28 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'invisible' : hecho || esActual ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700')} />
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold', color)}>
                {hecho ? <Icon name="check" className="text-[18px]!" /> : rechazado && esActual ? <Icon name="close" className="text-[18px]!" /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === todos.length - 1 ? 'invisible' : hecho ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700')} />
            </div>
            <span className={cn('mt-1.5 text-xs font-semibold', esActual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{p.oficina}</span>
            <span className="text-[11px] text-slate-400">{e.etapa === 'CORRECCION_POZOS' && p.etapas.includes('CORRECCION_POZOS') ? 'Corrección' : p.detalle}</span>
          </li>
        )
      })}
    </ol>
  )
}
