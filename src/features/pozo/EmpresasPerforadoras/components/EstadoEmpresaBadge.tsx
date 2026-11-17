import { cn } from '@/lib/cn'
import { estadoDetallado } from '../reglas'
import type { EmpresaRegistro, EstadoEmpresa } from '../types'

const COLORES: Record<EstadoEmpresa, string> = {
  EN_TRAMITE: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  OBSERVADA: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  RECHAZADA: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  ACTIVA: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  BAJA: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

/** Estado de la empresa; si está en trámite dice en qué oficina («En Jurídico»…). */
export function EstadoEmpresaBadge({ empresa, className }: { empresa: Pick<EmpresaRegistro, 'estado' | 'tramite' | 'observacion'>; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', COLORES[empresa.estado], className)}>{estadoDetallado(empresa)}</span>
  )
}
