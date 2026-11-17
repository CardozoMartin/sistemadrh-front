import type { Option } from '@/components/form'

/** Convierte una colección de la API ({ id, nombre }) en opciones de <select>. */
export const opcionesDe = (xs: readonly { id: string; nombre: string }[]): Option[] => xs.map((x) => ({ value: x.id, label: x.nombre }))
