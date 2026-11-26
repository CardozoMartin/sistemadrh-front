// Las tarjetas «apto / no apto» de las oficinas (componente Opciones del alta), con los mismos colores.

/** Lo que decide cada oficina (Recaudación, Distrito, Jurídico). */
export type AptoNoApto = 'APTO' | 'NO_APTO'

/** Una tarjeta de Opciones: `color` cuando está elegida, `hover` al pasar el mouse (botones grandes). */
export interface OpcionTarjeta<T extends string> {
  valor: T
  texto: string
  icono: string
  color: string
  hover: string
}

export const VERDE = {
  color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  hover: 'hover:border-green-500 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-500/10 dark:hover:text-green-300',
}
export const AMBAR = {
  color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  hover: 'hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:text-amber-300',
}
export const ROJO = {
  color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  hover: 'hover:border-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300',
}

/** `apto` / `noApto`: el texto de cada tarjeta (ej: «No posee deuda (apto)»). */
export const opcionesAptoNoApto = (apto: string, noApto: string): OpcionTarjeta<AptoNoApto>[] => [
  { valor: 'APTO', texto: apto, icono: 'check_circle', ...VERDE },
  { valor: 'NO_APTO', texto: noApto, icono: 'block', ...ROJO },
]
