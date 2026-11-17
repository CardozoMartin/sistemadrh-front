import type { ColorEstado } from '@/types/domain'

/** Clases de la etiqueta de estado según el color que define la API (/estados). */
export const CLASE_COLOR_ESTADO: Record<ColorEstado, string> = {
  azul: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  ambar: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  verde: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  gris: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  rojo: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

/**
 * Fecha para mostrar (dd/mm/aaaa). Una fecha sola ('AAAA-MM-DD', de un <input type="date">)
 * se toma como día local: `new Date('2026-09-29')` es medianoche UTC y en Argentina
 * mostraría el 28.
 */
export function formatearFecha(iso: string) {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const fecha = soloFecha ? new Date(+soloFecha[1], +soloFecha[2] - 1, +soloFecha[3]) : new Date(iso)
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
