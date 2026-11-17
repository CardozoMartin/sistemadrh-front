import type { OrigenPozo } from './types'

/** Cómo entró cada pozo al padrón: la marca que lo diferencia en listas, fichas y el visor. */
export const ORIGEN_POZO: Record<OrigenPozo, { texto: string; corto: string; icono: string; color: string }> = {
  OFICIO: { texto: 'Registrado de oficio', corto: 'De oficio', icono: 'gavel', color: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  AUTORIZACION: { texto: 'Con autorización de perforación', corto: 'Con autorización', icono: 'verified', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  MIGRACION: { texto: 'Padrón anterior (migrado)', corto: 'Padrón anterior', icono: 'history', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
}

export const origenDe = (origen: string) => ORIGEN_POZO[origen as OrigenPozo] ?? { texto: origen, corto: origen, icono: 'help', color: 'bg-slate-100 text-slate-600' }
