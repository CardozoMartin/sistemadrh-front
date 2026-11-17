// Caudales de la concesión de un pozo: lo que Catastro liquida. Copiado del prototipo
// (shared/state.js: calcularCaudalesConcesion, REGLAS_TRIBUTARIO).
//
// ⚠ A VALIDAR CON LA OFICINA: son las reglas que tenía el prototipo, no una norma verificada,
// y no coinciden con la dotación por uso del Alta de Concesión (Art. 32, Ley 7139/7140).
//
//   Erogado:     el MAYOR entre el caudal de bombeo y el régimen de bombeo, en l/s (m³/h ÷ 3,6).
//   Tributario:  el erogado redondeado HACIA ARRIBA según el uso de la concesión.
//   Hectáreas:   el equivalente que sale del tributario según el uso.

/** Uso de la concesión: la clasificación de Catastro (distinta de los usos del agua del alta). */
export const USOS_CONCESION = ['COMUN', 'RIEGO Y OTROS', 'INDUSTRIAL A', 'INDUSTRIAL B'] as const
export type UsoConcesion = (typeof USOS_CONCESION)[number]

interface Regla {
  multiplo: number
  texto: string
  has: { op: 'dividir' | 'multiplicar'; factor: number }
  textoHas: string
}

/** COMUN (consumo humano) no tributa: no tiene regla. */
export const REGLAS_TRIBUTARIO: Partial<Record<UsoConcesion, Regla>> = {
  'RIEGO Y OTROS': { multiplo: 4, texto: 'Múltiplo de 4 hacia arriba', has: { op: 'dividir', factor: 4 }, textoHas: 'Tributario ÷ 4' },
  'INDUSTRIAL A': { multiplo: 0.25, texto: 'Múltiplo de 0,25 hacia arriba', has: { op: 'multiplicar', factor: 4 }, textoHas: 'Tributario × 4' },
  'INDUSTRIAL B': { multiplo: 0.5, texto: 'Múltiplo de 0,5 hacia arriba', has: { op: 'multiplicar', factor: 2 }, textoHas: 'Tributario × 2' },
}

const m3hALps = (m3h: number | null) => (m3h === null ? null : m3h / 3.6)

/** Siempre hacia arriba: el tributario nunca queda por debajo del erogado (el epsilon evita que 20,00 suba a 24). */
function redondearArriba(valor: number, multiplo: number) {
  return Number((Math.ceil(valor / multiplo - 1e-9) * multiplo).toFixed(4))
}

export interface Caudales {
  bombeoLps: number | null
  regimenLps: number | null
  /** El mayor de los dos, con 2 decimales (el número que ve el operador). */
  erogadoLps: number | null
  origenErogado: 'caudal' | 'regimen' | null
  tributarioLps: number | null
  equivalenteHa: number | null
  regla: Regla | null
}

export function calcularCaudales(caudalM3h: number | null, regimenM3h: number | null, uso: string | null): Caudales {
  const bombeo = m3hALps(caudalM3h)
  const regimen = m3hALps(regimenM3h)
  // Ante empate se informa el caudal de bombeo, que es lo medido.
  const usaRegimen = regimen !== null && (bombeo === null || regimen > bombeo)
  const erogado = usaRegimen ? regimen : bombeo
  const base = erogado === null ? null : Number(erogado.toFixed(2))
  const regla = (uso && REGLAS_TRIBUTARIO[uso as UsoConcesion]) || null
  const tributario = regla && base !== null ? redondearArriba(base, regla.multiplo) : null
  const equivalenteHa = regla && tributario !== null ? Number((regla.has.op === 'dividir' ? tributario / regla.has.factor : tributario * regla.has.factor).toFixed(4)) : null
  return {
    bombeoLps: bombeo === null ? null : Number(bombeo.toFixed(2)),
    regimenLps: regimen === null ? null : Number(regimen.toFixed(2)),
    erogadoLps: base,
    origenErogado: erogado === null ? null : usaRegimen ? 'regimen' : 'caudal',
    tributarioLps: tributario,
    equivalenteHa,
    regla,
  }
}

/** El código de servicio no se elige: COMUN no se cobra (sin código); cualquier otro uso, código 0. */
export const codigoServicioDe = (uso: string | null) => (!uso || uso === 'COMUN' ? null : 0)
