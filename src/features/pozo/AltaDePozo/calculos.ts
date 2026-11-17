// Cálculos del alta de pozo (los mismos del prototipo). Funciones puras: las usan los
// formularios para mostrar los derivados y el schema para validar.

/** Texto del formulario → número (acepta coma decimal). null si está vacío o no es un número. */
export function aNumero(texto: string | undefined | null): number | null {
  if (texto === undefined || texto === null || texto.trim() === '') return null
  const n = Number(texto.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const redondear = (n: number, decimales = 2) => Number(n.toFixed(decimales))
export const formatear = (n: number | null, decimales = 2) => (n === null ? '' : n.toLocaleString('es-AR', { maximumFractionDigits: decimales }))

// ---------------------------------------------------------------------------
// Ensayo de bombeo (RN-08 y RN-09)
// ---------------------------------------------------------------------------

/** RN-08: l/s = m³/h ÷ 3,6. Catastro liquida en l/s; en el campo se mide en m³/h. */
export const m3hALps = (m3h: number | null) => (m3h === null ? null : redondear(m3h / 3.6, 3))

/** Depresión (s): la separación entre el nivel estático y el dinámico (los dos pueden ser negativos). */
export function depresion(estatico: number | null, dinamico: number | null): number | null {
  if (estatico === null || dinamico === null) return null
  return redondear(Math.abs(dinamico - estatico))
}

/** RN-09: caudal específico (productividad) = caudal de bombeo ÷ depresión, en m³/h/m. */
export function caudalEspecifico(caudalM3h: number | null, s: number | null): number | null {
  if (caudalM3h === null || s === null || s === 0) return null
  return redondear(caudalM3h / s, 3)
}

// ---------------------------------------------------------------------------
// Construcción: tramos ciegos, filtros y profundidad
// ---------------------------------------------------------------------------

export interface Intervalo {
  desde: number
  hasta: number
  diametro?: number | null
}

/** Intervalos válidos (desde < hasta) de una tabla, en número. */
export function leerIntervalos<T extends { desde: string; hasta: string; diametro?: string }>(filas: T[]): Intervalo[] {
  return filas.flatMap((f) => {
    const desde = aNumero(f.desde)
    const hasta = aNumero(f.hasta)
    return desde !== null && hasta !== null && hasta > desde ? [{ desde, hasta, diametro: aNumero(f.diametro) }] : []
  })
}

/** Profundidad que cubren los tramos: el «hasta» más profundo. */
export const profundidadDe = (intervalos: Intervalo[]) => intervalos.reduce((m, t) => Math.max(m, t.hasta), 0)

/** Pares de intervalos que se pisan (para avisar). */
export function solapes(intervalos: Intervalo[]): [Intervalo, Intervalo][] {
  const orden = [...intervalos].sort((a, b) => a.desde - b.desde)
  const choques: [Intervalo, Intervalo][] = []
  for (let i = 1; i < orden.length; i++) if (orden[i].desde < orden[i - 1].hasta) choques.push([orden[i - 1], orden[i]])
  return choques
}

/**
 * «Calcular los filtros»: los intervalos que los tramos ciegos dejan libres hasta la
 * profundidad. Cada filtro hereda el diámetro del caño más cercano (continúa la sección).
 */
export function huecos(tramos: Intervalo[], profundidad: number): Intervalo[] {
  const orden = [...tramos].sort((a, b) => a.desde - b.desde)
  const libres: Intervalo[] = []
  let cursor = 0
  for (const t of orden) {
    if (t.desde > cursor) libres.push({ desde: cursor, hasta: Math.min(t.desde, profundidad) })
    cursor = Math.max(cursor, t.hasta)
    if (cursor >= profundidad) break
  }
  if (cursor < profundidad) libres.push({ desde: cursor, hasta: profundidad })
  return libres
    .filter((h) => h.hasta > h.desde)
    .map((h) => {
      const anterior = orden.filter((t) => t.hasta <= h.desde).at(-1)
      const siguiente = orden.find((t) => t.desde >= h.hasta)
      return { ...h, diametro: anterior?.diametro ?? siguiente?.diametro ?? null }
    })
}

// ---------------------------------------------------------------------------
// Litología: capas continuas desde la superficie
// ---------------------------------------------------------------------------

/**
 * Las capas tienen que ser CONTINUAS: la primera arranca en 0 y cada una donde terminó la
 * anterior. Devuelve el primer problema encontrado (o null).
 */
export function problemaLitologia(filas: { desde: string; hasta: string; tipo: string }[]): { fila: number; campo: 'desde' | 'hasta' | 'tipo'; mensaje: string } | null {
  let anterior = 0
  for (let i = 0; i < filas.length; i++) {
    const desde = aNumero(filas[i].desde)
    const hasta = aNumero(filas[i].hasta)
    if (desde === null) return { fila: i, campo: 'desde', mensaje: 'Ingrese desde qué profundidad.' }
    if (hasta === null) return { fila: i, campo: 'hasta', mensaje: 'Ingrese hasta qué profundidad.' }
    if (hasta <= desde) return { fila: i, campo: 'hasta', mensaje: '«Hasta» tiene que ser mayor que «desde».' }
    if (desde !== anterior) return { fila: i, campo: 'desde', mensaje: i === 0 ? 'La primera capa arranca en 0 m (la superficie).' : `Tiene que arrancar donde termina la anterior (${formatear(anterior)} m).` }
    if (!filas[i].tipo) return { fila: i, campo: 'tipo', mensaje: 'Elija el tipo de capa.' }
    anterior = hasta
  }
  return null
}
