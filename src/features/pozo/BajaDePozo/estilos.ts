import type { EstadoBaja, OrigenBaja, PozoBackend } from './types'

export const NOMBRE_ORIGEN: Record<OrigenBaja, string> = {
  A_SOLICITUD: 'A solicitud del titular',
  DE_OFICIO: 'De oficio (sin trámite)',
}

export const ESTADO_BAJA: Record<EstadoBaja, { texto: string; color: string }> = {
  EN_TRAMITE: { texto: 'En análisis', color: 'bg-primary/10 text-primary' },
  EN_ESPERA: { texto: 'En espera', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  OBSERVADA: { texto: 'Observada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  CLAUSURA_PENDIENTE: { texto: 'Aprobada · clausura pendiente', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  CONFIRMADA: { texto: 'Aprobada', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  RECHAZADA: { texto: 'Rechazada', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
}

/** La baja todavía requiere que alguien actúe (incluye la clausura pendiente). */
export const bajaSinTerminar = (estado: EstadoBaja) => estado === 'EN_TRAMITE' || estado === 'EN_ESPERA' || estado === 'OBSERVADA' || estado === 'CLAUSURA_PENDIENTE'

export const ESTADO_POZO: Record<PozoBackend['estado'], { texto: string; color: string }> = {
  EN_USO: { texto: 'En uso', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  PARADO: { texto: 'Parado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  FUERA_DE_SERVICIO: { texto: 'Fuera de servicio', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  BAJA: { texto: 'Dado de baja', color: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  ANULADO: { texto: 'Anulado', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
}

export const formatoNumero = (n: number, decimales = 1) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales })
export const formatoFecha = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-AR')
export const formatoPesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
