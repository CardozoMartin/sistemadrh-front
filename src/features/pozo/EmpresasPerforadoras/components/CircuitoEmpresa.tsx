import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { EmpresaRegistro, OficinaEmpresa } from '../types'

/** Pasos del alta: dos de carga (Planificación) y dos oficinas. */
export const PASOS_EMPRESA = ['Datos de la empresa', 'Máquinas', 'Jurídico', 'Secretaría General'] as const

const PASO_OFICINA: Record<OficinaEmpresa, number> = { juridico: 2, secretaria_general: 3 }

type EstadoPaso = 'hecho' | 'actual' | 'pendiente' | 'observado' | 'rechazado'

/** Estado de cada paso según dónde está la empresa (o el paso de carga, en el alta). */
function estados(empresa: Pick<EmpresaRegistro, 'estado' | 'tramite' | 'observacion' | 'rechazo'> | null, pasoCarga: number): EstadoPaso[] {
  const n = PASOS_EMPRESA.length
  const hasta = (i: number, ultimo: EstadoPaso) => Array.from({ length: n }, (_, k): EstadoPaso => (k < i ? 'hecho' : k === i ? ultimo : 'pendiente'))
  if (!empresa) return hasta(pasoCarga, 'actual')
  switch (empresa.estado) {
    case 'EN_TRAMITE':
      return hasta(PASO_OFICINA[empresa.tramite?.oficina ?? 'juridico'], 'actual')
    case 'OBSERVADA':
      return hasta(PASO_OFICINA[empresa.observacion?.oficina ?? 'juridico'], 'observado')
    case 'RECHAZADA':
      return hasta(PASO_OFICINA[empresa.rechazo?.oficina ?? 'juridico'], 'rechazado')
    default:
      return Array.from({ length: n }, (): EstadoPaso => 'hecho')
  }
}

const ESTILO: Record<EstadoPaso, { circulo: string; texto: string; icono?: string }> = {
  hecho: { circulo: 'bg-green-600 text-white', texto: 'text-green-700 dark:text-green-400', icono: 'check' },
  actual: { circulo: 'bg-primary text-white ring-4 ring-primary/20', texto: 'text-primary' },
  pendiente: { circulo: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400', texto: 'text-slate-500 dark:text-slate-400' },
  observado: { circulo: 'bg-amber-500 text-white ring-4 ring-amber-500/20', texto: 'text-amber-700 dark:text-amber-400', icono: 'undo' },
  rechazado: { circulo: 'bg-red-600 text-white', texto: 'text-red-700 dark:text-red-400', icono: 'close' },
}

const DETALLE: Partial<Record<EstadoPaso, string>> = { actual: 'En curso', observado: 'Observado', rechazado: 'Rechazado' }

interface Props {
  /** Empresa ya registrada (ficha, revisión). Sin empresa: alta, en el paso `pasoCarga`. */
  empresa?: Pick<EmpresaRegistro, 'estado' | 'tramite' | 'observacion' | 'rechazo'> | null
  pasoCarga?: number
}

/** Barra del trámite de alta: Datos de la empresa → Máquinas → Jurídico → Secretaría General. */
export function CircuitoEmpresa({ empresa = null, pasoCarga = 0 }: Props) {
  const pasos = estados(empresa, pasoCarga)
  const habilitada = empresa && (empresa.estado === 'ACTIVA' || empresa.estado === 'BAJA')
  const actual = pasos.findIndex((p) => p !== 'hecho')
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-surface-dark">
      <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {habilitada ? 'Trámite de alta completo: empresa habilitada por resolución' : `Paso ${actual + 1} de ${PASOS_EMPRESA.length}: ${PASOS_EMPRESA[actual]}`}
      </p>
      <ol className="flex overflow-x-auto">
        {PASOS_EMPRESA.map((paso, i) => {
          const e = ESTILO[pasos[i]]
          return (
            <li key={paso} className="flex min-w-28 flex-1 flex-col items-center gap-2 text-center">
              <div className="flex w-full items-center">
                <span className={cn('h-1 flex-1', i === 0 ? 'bg-transparent' : pasos[i] === 'pendiente' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-green-500')} />
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold', e.circulo)}>
                  {e.icono ? <Icon name={e.icono} className="text-sm!" /> : i + 1}
                </span>
                <span className={cn('h-1 flex-1', i === PASOS_EMPRESA.length - 1 ? 'bg-transparent' : pasos[i] === 'hecho' && pasos[i + 1] !== 'pendiente' ? 'bg-green-500' : 'bg-slate-100 dark:bg-slate-700')} />
              </div>
              <span className={cn('text-xs font-semibold', e.texto)}>{paso}</span>
              {DETALLE[pasos[i]] && <span className={cn('-mt-1.5 text-[11px]', e.texto)}>{DETALLE[pasos[i]]}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
