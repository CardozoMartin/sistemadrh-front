// Cálculo de caudal según el módulo de dotación de cada uso.
// Los módulos (l/s por unidad) vienen de la API (/usos), no están en el código.
//
// Referencia: Art. 32 de la Ley 7139/7140 (Régimen de Aguas de Tucumán). Los valores
// cargados en la demo son ilustrativos.
import type { UsoInfo } from '@/types/domain'

// Mismo cálculo que el backend (backend/src/concesiones/caudal.ts): si no, el total que se
// vuelca al suministro difiere del que guardan los usos (ej: 1,38 ha × 0,75 = 1,035 → 1,04).

/** Redondeo a n decimales sin los errores de coma flotante (1.005 → 1.01). */
export function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales
  return Math.round((valor + Number.EPSILON) * factor) / factor
}

export const redondear2 = (n: number) => redondear(n, 2)

/** Caudal (l/s) de un uso: magnitud × dotación, con 3 decimales (lo que guarda el backend). */
export function caudalDeUso(uso: UsoInfo | undefined, magnitud: string | number): number {
  const m = Number(magnitud)
  if (!uso || !Number.isFinite(m) || m <= 0) return 0
  return redondear(m * uso.dotacion, 3)
}

/** Suma de los caudales de los usos, con 2 decimales. */
export function caudalTotal(items: { uso: string; magnitud: string }[], buscarUso: (id: string) => UsoInfo | undefined): number {
  return redondear2(items.reduce((acc, i) => acc + caudalDeUso(buscarUso(i.uso), i.magnitud), 0))
}
