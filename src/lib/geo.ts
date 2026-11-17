import { dePosgar, pareceaPosgar } from './posgar'
/** [latitud, longitud] */
export type LatLng = [number, number]

/** Centro de San Miguel de Tucumán, vista inicial de los mapas. */
export const CENTRO_TUCUMAN: LatLng = [-26.8083, -65.2176]

/**
 * Superficie aproximada en hectáreas (fórmula del área de Gauss con proyección
 * métrica local). Suficiente para parcelas; no reemplaza un cálculo geodésico.
 */
export function calcularHectareas(puntos: LatLng[]): number {
  if (puntos.length < 3) return 0
  const latRef = puntos.reduce((acc, [lat]) => acc + lat, 0) / puntos.length
  const mLng = 111320 * Math.cos((latRef * Math.PI) / 180)
  const mLat = 111320
  const pp = puntos.map(([lat, lng]) => [lng * mLng, lat * mLat])
  let area = 0
  for (let i = 0; i < pp.length; i++) {
    const [x1, y1] = pp[i]
    const [x2, y2] = pp[(i + 1) % pp.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2) / 10000
}

/** Centroide simple (promedio de vértices). Suficiente para escalar parcelas. */
export function centroide(puntos: LatLng[]): LatLng {
  const n = puntos.length || 1
  return [puntos.reduce((a, [lat]) => a + lat, 0) / n, puntos.reduce((a, [, lng]) => a + lng, 0) / n]
}

/** Escala el polígono respecto de `centro` (factor lineal: 1.1 = 10% más grande en cada dirección). */
export function escalarPoligono(puntos: LatLng[], factor: number, centro: LatLng = centroide(puntos)): LatLng[] {
  const [cLat, cLng] = centro
  return puntos.map(([lat, lng]) => [+(cLat + (lat - cLat) * factor).toFixed(7), +(cLng + (lng - cLng) * factor).toFixed(7)])
}

/** Perímetro aproximado en metros (proyección métrica local). */
export function perimetroMetros(puntos: LatLng[]): number {
  if (puntos.length < 2) return 0
  const mLng = 111320 * Math.cos((centroide(puntos)[0] * Math.PI) / 180)
  let total = 0
  for (let i = 0; i < puntos.length; i++) {
    const [lat1, lng1] = puntos[i]
    const [lat2, lng2] = puntos[(i + 1) % puntos.length]
    total += Math.hypot((lng2 - lng1) * mLng, (lat2 - lat1) * 111320)
  }
  return total
}

/** El punto está dentro del polígono (ray casting). */
export function puntoEnPoligono([lat, lng]: LatLng, poligono: LatLng[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [latI, lngI] = poligono[i]
    const [latJ, lngJ] = poligono[j]
    if (latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI || Number.EPSILON) + lngI) dentro = !dentro
  }
  return dentro
}

function segmentosSeCruzan(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const orient = (p: LatLng, q: LatLng, r: LatLng) => Math.sign((q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]))
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b)
}

/** Dos polígonos se superponen (un vértice dentro del otro o bordes que se cruzan). */
export function poligonosSeSuperponen(p: LatLng[], q: LatLng[]): boolean {
  if (p.some((v) => puntoEnPoligono(v, q)) || q.some((v) => puntoEnPoligono(v, p))) return true
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      if (segmentosSeCruzan(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true
    }
  }
  return false
}

/** Extrae el anillo exterior del primer polígono de un KML o GeoJSON. */
export function parsearPoligono(texto: string, nombreArchivo: string): LatLng[] | null {
  const anillo = leerAnillo(texto, nombreArchivo)
  if (!anillo) return null
  // La oficina trabaja en POSGAR 2007 faja 3 (X ≈ 3.500.000, Y ≈ 7.000.000): se pasa a lat/long.
  return anillo.map(([lat, lng]) => {
    if (!pareceaPosgar(lat, lng)) return [lat, lng] as LatLng
    // En POSGAR el «lat» leído es Y y el «lng» es X (el archivo trae X, Y). Si vienen invertidas, se corrigen.
    const [x, y] = lng < lat ? [lng, lat] : [lat, lng]
    const p = dePosgar(x, y)
    return [+p.lat.toFixed(7), +p.lng.toFixed(7)] as LatLng
  })
}

/** Primer anillo del archivo tal como viene: [segundo valor, primer valor] de cada coordenada. */
function leerAnillo(texto: string, nombreArchivo: string): LatLng[] | null {
  if (nombreArchivo.toLowerCase().endsWith('.kml')) {
    const m = texto.match(/<coordinates>([\s\S]*?)<\/coordinates>/)
    if (!m) return null
    return m[1]
      .trim()
      .split(/\s+/)
      .map((t) => {
        const [lng, lat] = t.split(',').map(Number)
        return [lat, lng] as LatLng
      })
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
  }

  try {
    const gj = JSON.parse(texto)
    const anillo: [number, number][] | undefined =
      gj.type === 'FeatureCollection'
        ? gj.features?.[0]?.geometry?.coordinates?.[0]
        : gj.type === 'Feature'
          ? gj.geometry?.coordinates?.[0]
          : gj.type === 'Polygon'
            ? gj.coordinates?.[0]
            : undefined
    return anillo ? anillo.map(([lng, lat]) => [lat, lng] as LatLng) : null
  } catch {
    return null
  }
}

// --- Subdivisión -------------------------------------------------------------------

/** Proyección métrica local (metros) alrededor de una latitud de referencia. */
function proyeccion(latRef: number) {
  const mLng = 111320 * Math.cos((latRef * Math.PI) / 180)
  const mLat = 111320
  return {
    aMetros: ([lat, lng]: LatLng): [number, number] => [lng * mLng, lat * mLat],
    aLatLng: ([x, y]: [number, number]): LatLng => [+(y / mLat).toFixed(7), +(x / mLng).toFixed(7)],
  }
}

/** Área de un anillo en coordenadas métricas (m²). */
function areaMetros(pp: [number, number][]): number {
  let a = 0
  for (let i = 0; i < pp.length; i++) {
    const [x1, y1] = pp[i]
    const [x2, y2] = pp[(i + 1) % pp.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a / 2)
}

/**
 * Recorta un anillo con el semiplano `eje <= corte` (o `>=` si `mayor`), Sutherland–Hodgman.
 * eje 0 = x (este-oeste), 1 = y (norte-sur).
 */
function recortar(pp: [number, number][], eje: 0 | 1, corte: number, mayor: boolean): [number, number][] {
  const dentro = (p: [number, number]) => (mayor ? p[eje] >= corte : p[eje] <= corte)
  const salida: [number, number][] = []
  for (let i = 0; i < pp.length; i++) {
    const a = pp[i]
    const b = pp[(i + 1) % pp.length]
    if (dentro(a)) salida.push(a)
    if (dentro(a) !== dentro(b)) {
      const t = (corte - a[eje]) / (b[eje] - a[eje])
      salida.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  // Sin vértices repetidos seguidos (quedan al cortar justo por un vértice).
  return salida.filter((p, i) => {
    const q = salida[(i + 1) % salida.length]
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6
  })
}

/**
 * Divide un polígono en franjas con las superficies pedidas (en ha, en orden), cortando
 * en paralelo al lado corto. Las superficies se escalan para que sumen el total del
 * polígono. Sirve de punto de partida: después los vértices se pueden ajustar a mano.
 */
export function dividirPoligono(poligono: LatLng[], hectareas: number[]): LatLng[][] {
  if (poligono.length < 3 || hectareas.length === 0) return []
  const { aMetros, aLatLng } = proyeccion(centroide(poligono)[0])
  let resto = poligono.map(aMetros)
  const total = areaMetros(resto)
  const suma = hectareas.reduce((a, h) => a + Math.max(h, 0), 0) || 1
  const objetivos = hectareas.map((h) => (Math.max(h, 0) / suma) * total)
  // Se corta a lo largo del lado más largo del rectángulo que lo contiene.
  const xs = resto.map((p) => p[0])
  const ys = resto.map((p) => p[1])
  const eje: 0 | 1 = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 0 : 1

  const partes: [number, number][][] = []
  for (const objetivo of objetivos.slice(0, -1)) {
    const valores = resto.map((p) => p[eje])
    let bajo = Math.min(...valores)
    let alto = Math.max(...valores)
    for (let k = 0; k < 50; k++) {
      const medio = (bajo + alto) / 2
      if (areaMetros(recortar(resto, eje, medio, false)) < objetivo) bajo = medio
      else alto = medio
    }
    const corte = (bajo + alto) / 2
    partes.push(recortar(resto, eje, corte, false))
    resto = recortar(resto, eje, corte, true)
  }
  partes.push(resto)
  return partes.map((p) => p.map(aLatLng))
}

/** Distancia en metros de un punto al borde de un polígono. */
export function distanciaAlBordeMetros(punto: LatLng, poligono: LatLng[]): number {
  const { aMetros } = proyeccion(punto[0])
  const [px, py] = aMetros(punto)
  let minima = Infinity
  for (let i = 0; i < poligono.length; i++) {
    const [ax, ay] = aMetros(poligono[i])
    const [bx, by] = aMetros(poligono[(i + 1) % poligono.length])
    const largo2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / largo2))
    minima = Math.min(minima, Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py))
  }
  return minima
}

/** Cómo cubren las fracciones al polígono madre (en ha, estimado por muestreo). */
export interface CoberturaSubdivision {
  /** Superficie que queda dentro de dos o más fracciones. */
  superpuesta: number
  /** Superficie de las fracciones que cae fuera del polígono madre. */
  fuera: number
  /** Superficie del polígono madre que no quedó en ninguna fracción. */
  sinAsignar: number
}

/**
 * Estima superposiciones, partes fuera de la madre y superficie sin asignar con una
 * grilla de puntos (`resolucion` × `resolucion`). Tolera bordes compartidos, que es lo
 * normal en una subdivisión (los chequeos por vértice dan falsos positivos ahí).
 */
export function analizarCobertura(madre: LatLng[], fracciones: LatLng[][], resolucion = 90): CoberturaSubdivision {
  const validas = fracciones.filter((f) => f.length >= 3)
  const todos = [madre, ...validas].flat()
  if (madre.length < 3 || todos.length === 0) return { superpuesta: 0, fuera: 0, sinAsignar: 0 }
  const lats = todos.map((p) => p[0])
  const lngs = todos.map((p) => p[1])
  const [latMin, latMax, lngMin, lngMax] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const dLat = (latMax - latMin) / resolucion
  const dLng = (lngMax - lngMin) / resolucion
  const mLng = 111320 * Math.cos((((latMin + latMax) / 2) * Math.PI) / 180)
  const celdaHa = (dLat * 111320 * dLng * mLng) / 10000

  let superpuesta = 0
  let fuera = 0
  let sinAsignar = 0
  for (let i = 0; i < resolucion; i++) {
    for (let j = 0; j < resolucion; j++) {
      const p: LatLng = [latMin + (i + 0.5) * dLat, lngMin + (j + 0.5) * dLng]
      const enMadre = puntoEnPoligono(p, madre)
      const cuantas = validas.reduce((n, f) => n + (puntoEnPoligono(p, f) ? 1 : 0), 0)
      if (cuantas >= 2) superpuesta += celdaHa
      if (cuantas >= 1 && !enMadre) fuera += celdaHa
      if (enMadre && cuantas === 0) sinAsignar += celdaHa
    }
  }
  return { superpuesta, fuera, sinAsignar }
}

/**
 * Punto para poner la etiqueta de un polígono GeoJSON ([lng, lat]), garantizado adentro:
 * en la parte más grande se traza una horizontal por la mitad de su alto y se toma el centro
 * del tramo interior más ancho. En formas en L o en U el centro del recuadro puede caer
 * afuera; así no. Devuelve el punto [lat, lng], el ancho de ese tramo (grados de longitud) y
 * el alto de la parte (grados de latitud), para saber si el texto entra en el polígono.
 */
export function puntoEtiqueta(partes: number[][][][]): { punto: LatLng; ancho: number; alto: number } | null {
  let mejor: { anillos: number[][][]; area: number } | null = null
  for (const anillos of partes) {
    const exterior = anillos[0]
    if (!exterior || exterior.length < 4) continue
    let a = 0
    for (let i = 0; i < exterior.length - 1; i++) a += exterior[i][0] * exterior[i + 1][1] - exterior[i + 1][0] * exterior[i][1]
    if (!mejor || Math.abs(a) > mejor.area) mejor = { anillos, area: Math.abs(a) }
  }
  if (!mejor) return null
  const lats = mejor.anillos[0].map((p) => p[1])
  const y = (Math.min(...lats) + Math.max(...lats)) / 2
  // Cruces de la horizontal con todos los anillos (los huecos también cortan).
  const cruces: number[] = []
  for (const anillo of mejor.anillos) {
    for (let i = 0; i < anillo.length - 1; i++) {
      const [x1, y1] = anillo[i]
      const [x2, y2] = anillo[i + 1]
      if (y1 > y !== y2 > y) cruces.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
    }
  }
  cruces.sort((a, b) => a - b)
  let ancho = -1
  let x = mejor.anillos[0][0][0]
  for (let i = 0; i + 1 < cruces.length; i += 2) {
    if (cruces[i + 1] - cruces[i] > ancho) {
      ancho = cruces[i + 1] - cruces[i]
      x = (cruces[i] + cruces[i + 1]) / 2
    }
  }
  return { punto: [y, x], ancho, alto: Math.max(...lats) - Math.min(...lats) }
}
