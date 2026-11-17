import { errorEjePosgar, RANGO_POSGAR_FAJA3 } from './posgar-faja3'

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/** Valida el dígito verificador de un CUIT/CUIL (11 dígitos, sin guiones). */
export function esCuitValido(valor: string): boolean {
  if (!/^\d{11}$/.test(valor)) return false
  const digitos = [...valor].map(Number)
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * digitos[i], 0)
  const resto = 11 - (suma % 11)
  const verificador = resto === 11 ? 0 : resto
  return verificador !== 10 && verificador === digitos[10]
}

/** 'AAAA-MM-DD' (valor de <input type="date">) posterior a hoy. */
export function esFechaFutura(fecha: string): boolean {
  return fecha > new Date().toISOString().slice(0, 10)
}

/**
 * Coordenadas POSGAR 2007 faja 3 (EPSG:5345) válidas para Tucumán, en metros. Sale de la regla
 * compartida con el backend (lib/posgar-faja3.ts, copia idéntica de comun/validadores/posgar-faja3.ts).
 */
export const RANGO_POSGAR_TUCUMAN = RANGO_POSGAR_FAJA3

/** Valida una X o Y POSGAR (7 cifras enteras, hasta 2 decimales, en Tucumán). Mensaje de error o null. */
export const validarPosgar = (valor: string, eje: 'x' | 'y', contexto: string): string | null => errorEjePosgar(valor, eje, contexto)

/** Prefijos de CUIL / CUIT de personas físicas: en el medio llevan el DNI (20-12345678-9). */
const PREFIJOS_FISICA = ['20', '23', '24', '27']

/**
 * DNI que contiene un documento (sin ceros a la izquierda), o null si no lleva uno:
 *   "12345678" → "12345678" · "20123456786" → "12345678" · "30712345678" (jurídica) → null.
 * Sirve para reconocer a la misma persona física cargada una vez con DNI y otra con CUIL / CUIT.
 * Es la misma regla que el backend (comun/validadores/cuit.ts).
 */
export function dniDeDocumento(documento: string): string | null {
  if (/^\d{7,8}$/.test(documento)) return documento.replace(/^0+/, '')
  if (/^\d{11}$/.test(documento) && PREFIJOS_FISICA.includes(documento.slice(0, 2))) return documento.slice(2, 10).replace(/^0+/, '')
  return null
}

/** Clave para comparar documentos: el DNI si lo lleva, si no el documento tal cual. */
export const claveDeDocumento = (documento: string) => {
  const dni = dniDeDocumento(documento)
  return dni ? `DNI:${dni}` : documento
}

/**
 * Teléfono: solo números, espacios, guiones, paréntesis y «+», con entre 7 y 15 números
 * («(0381) 452-6393», «+54 9 381 123-4567»). Igual que en el backend (comun/validadores/telefono.ts).
 */
export function esTelefonoValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '').length
  return /^[\d\s()+-]+$/.test(valor) && digitos >= 7 && digitos <= 15
}
