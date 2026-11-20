// Las tarjetas «apto / no apto» de las oficinas (componente Opciones del alta), con los mismos colores.
import type { AptoNoApto } from '../../backend.types'

/** `apto` / `noApto`: el texto de cada tarjeta (ej: «No posee deuda (apto)»). */
export const opcionesAptoNoApto = (apto: string, noApto: string): { valor: AptoNoApto; texto: string; icono: string; color: string }[] => [
  { valor: 'APTO', texto: apto, icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
  { valor: 'NO_APTO', texto: noApto, icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
]
