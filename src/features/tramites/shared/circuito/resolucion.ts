// Reglas de la carga de la resolución en Secretaría General (pasos 32-36). Las mismas que valida
// el backend (ResolucionCambioDto y exigirPdf): número, fecha de firma no futura y el PDF escaneado.

/** POST …/resolucion (multipart, común a los trámites): los datos de la resolución y el PDF escaneado. */
export interface CargaResolucion {
  numero: string
  anio: number
  fecha: string
  observaciones?: string
  archivo: File
}

/** La resolución ya cargada, como la devuelve el backend (`numero` viene como «N/AAAA»). */
export interface ResolucionRegistrada {
  numero: string
  fecha: string
  observaciones: string | null
  conArchivo: boolean
}

/** Tope del PDF (igual que el backend: 10 MB). */
export const MAX_MB_RESOLUCION = 10

export interface DatosResolucion {
  numero: string
  /** Fecha de firma (AAAA-MM-DD). El año de la resolución sale de acá. */
  fecha: string
  archivo: { name: string; size: number; type?: string } | null
}

/** Qué falta o está mal para registrar la resolución (null: se puede). `hoy` en AAAA-MM-DD. */
export function faltaEnResolucion({ numero, fecha, archivo }: DatosResolucion, hoy: string): string | null {
  if (!/^\d{1,6}$/.test(numero.trim())) return 'Ingrese el número de resolución (hasta 6 dígitos).'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Ingrese la fecha de firma.'
  if (fecha > hoy) return 'La fecha de firma no puede ser futura.'
  if (!archivo) return 'Adjunte la resolución escaneada (PDF).'
  if (!/\.pdf$/i.test(archivo.name)) return 'La resolución tiene que ser un archivo PDF.'
  if (!archivo.size) return 'El PDF está vacío.'
  if (archivo.size > MAX_MB_RESOLUCION * 1024 * 1024) return `El PDF supera los ${MAX_MB_RESOLUCION} MB: escanéelo con menos resolución.`
  return null
}

/** El año de la resolución es el de la fecha de firma. */
export const anioDeFecha = (fecha: string) => Number(fecha.slice(0, 4))

/** Tamaño legible del archivo (para el resumen). */
export const tamanio = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
