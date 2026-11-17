// Lo geográfico del backend emulado: lo que en el backend real hace PostGIS (leer el archivo,
// validar, medir, superposiciones, cauce más cercano). Acá se calcula en el navegador con una
// proyección local: alcanza para la demo (diferencias de pocos metros cuadrados).
import type { MultiPolygon } from 'geojson'
import type { AnalisisGeometria, Superposicion } from '@/services/sig'
import { LIMITES_TUCUMAN } from '@/lib/coordenadas'
import { calcularHectareas, centroide, distanciaAlBordeMetros, parsearPoligono, perimetroMetros, poligonosSeSuperponen, puntoEnPoligono, type LatLng } from '@/lib/geo'
import { aPosgar } from '@/lib/posgar'
import type { Db } from './db'
import { error400 } from './http'

/** Igual que el backend: más lejos que esto de un río o canal, se avisa. */
const DISTANCIA_MAX_CAUCE_M = 2000

/** Primer anillo de un MultiPolygon como [lat, lng] (sin repetir el primer vértice al final). */
export function anilloDe(g: MultiPolygon): LatLng[] {
  const anillo = (g.coordinates[0]?.[0] ?? []).map(([lng, lat]) => [lat, lng] as LatLng)
  const [a, b] = [anillo[0], anillo.at(-1)]
  if (a && b && anillo.length > 1 && a[0] === b[0] && a[1] === b[1]) anillo.pop()
  return anillo
}

/** Anillo [lat, lng] → MultiPolygon GeoJSON ([lng, lat], cerrado). */
export function multiPoligono(anillo: LatLng[]): MultiPolygon {
  const coords = anillo.map(([lat, lng]) => [lng, lat])
  return { type: 'MultiPolygon', coordinates: [[[...coords, coords[0]]]] }
}

/** Polígono vigente de cada concesión (las del sistema lo tienen en el alta). */
export function poligonoDeConcesion(db: Db, concesionId: string): MultiPolygon | null {
  const c = db.concesiones.find((x) => x.id === concesionId)
  if (!c) return null
  if (c.migrada) return c.migrada.geom
  const alta = Object.values(db.altas).find((a) => a.concesionId === concesionId)
  return alta?.poligono?.geojson ?? null
}

/** Superficie en común entre dos polígonos (ha), por muestreo en una grilla. */
function superficieComunHa(p: LatLng[], q: LatLng[]): number {
  const lat = (a: LatLng[]) => a.map((v) => v[0])
  const lng = (a: LatLng[]) => a.map((v) => v[1])
  const sur = Math.max(Math.min(...lat(p)), Math.min(...lat(q)))
  const norte = Math.min(Math.max(...lat(p)), Math.max(...lat(q)))
  const oeste = Math.max(Math.min(...lng(p)), Math.min(...lng(q)))
  const este = Math.min(Math.max(...lng(p)), Math.max(...lng(q)))
  if (sur >= norte || oeste >= este) return 0
  const n = 60
  let dentro = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const punto: LatLng = [sur + ((i + 0.5) * (norte - sur)) / n, oeste + ((j + 0.5) * (este - oeste)) / n]
      if (puntoEnPoligono(punto, p) && puntoEnPoligono(punto, q)) dentro++
    }
  }
  const celda = calcularHectareas([
    [sur, oeste],
    [sur, este],
    [norte, este],
    [norte, oeste],
  ])
  return (celda * dentro) / (n * n)
}

/** Concesiones (sin anular ni denegar) cuyo polígono se superpone con el anillo. */
export function superposiciones(db: Db, anillo: LatLng[], excepto?: string): Superposicion[] {
  const resultado: Superposicion[] = []
  for (const c of db.concesiones) {
    if (c.id === excepto || c.estado === 'ANULADA' || c.estado === 'DENEGADA') continue
    const g = poligonoDeConcesion(db, c.id)
    if (!g) continue
    const otro = anilloDe(g)
    if (!poligonosSeSuperponen(anillo, otro)) continue
    const ha = superficieComunHa(anillo, otro)
    if (ha * 10_000 < 1) continue
    const alta = c.expedienteId ? db.altas[c.expedienteId] : undefined
    const exp = c.expedienteId ? db.expedientes.find((e) => e.id === c.expedienteId) : undefined
    resultado.push({
      concesionId: c.id,
      numero: c.numero,
      estado: c.estado,
      expediente: exp ? `${Number(exp.numero)}/${Number(exp.reparticion)}-${exp.anio}` : null,
      titular: c.migrada?.titular ?? (alta ? titularDeAlta(db, alta.titulares) : null),
      superficieHa: +ha.toFixed(4),
    })
  }
  return resultado
}

export function titularDeAlta(db: Db, personaIds: string[]): string | null {
  const nombres = personaIds
    .map((id) => db.personas.find((p) => p.id === id))
    .filter((p) => !!p)
    .map((p) => (p.tipoPersona === 'JURIDICA' ? p.razonSocial : `${p.apellido}, ${p.nombre}`))
  return nombres.length ? nombres.join(' / ') : null
}

/** Distancia en metros de un punto a una línea (proyección local). */
function distanciaALinea([lat, lng]: LatLng, linea: number[][]): number {
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const m = ([x, y]: number[]) => [x * mLng, y * 111320]
  const [px, py] = m([lng, lat])
  let minima = Infinity
  for (let i = 0; i < linea.length - 1; i++) {
    const [ax, ay] = m(linea[i])
    const [bx, by] = m(linea[i + 1])
    const largo2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / largo2))
    minima = Math.min(minima, Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py))
  }
  return minima
}

export interface CauceDemo {
  nombre: string | null
  tipo: 'RIO' | 'CANAL'
  largoKm: number
  linea: number[][]
}

let cauces: CauceDemo[] | null = null
/** Ríos y canales de OpenStreetMap (los mismos que carga el backend en sig.cauce). */
export async function obtenerCauces(): Promise<{ fuente: string; cauces: CauceDemo[] }> {
  const datos = (await import('../datos/cauces-osm.json')).default as { fuente: string; cauces: CauceDemo[] }
  cauces = datos.cauces
  return datos
}

async function cauceCercano(punto: LatLng): Promise<AnalisisGeometria['cauceCercano']> {
  const lista = cauces ?? (await obtenerCauces()).cauces
  let mejor: AnalisisGeometria['cauceCercano'] = null
  for (const c of lista) {
    const d = distanciaALinea(punto, c.linea)
    if (!mejor || d < mejor.distanciaM) mejor = { nombre: c.nombre, tipo: c.tipo, distanciaM: Math.round(d) }
  }
  return mejor
}

const dentroDeTucuman = ([lat, lng]: LatLng) => lat >= LIMITES_TUCUMAN.sur && lat <= LIMITES_TUCUMAN.norte && lng >= LIMITES_TUCUMAN.oeste && lng <= LIMITES_TUCUMAN.este

/**
 * POST /sig/kml/analizar y la carga del paso 3: lee el KML / GeoJSON (POSGAR faja 3 o
 * latitud/longitud), lo valida (3 vértices, dentro de Tucumán) y lo mide.
 */
export async function analizarArchivo(db: Db, texto: string, nombre: string, bytes: number, excepto?: string): Promise<AnalisisGeometria> {
  //1.- Lectura: el mismo lector que usa el formulario sin conexión (reconoce POSGAR).
  if (!/\.(kml|geojson|json)$/i.test(nombre)) throw error400('El archivo tiene que ser un KML o un GeoJSON.')
  const anillo = parsearPoligono(texto, nombre)
  if (!anillo || anillo.length < 3) throw error400('No se encontró un polígono en el archivo (hacen falta al menos 3 vértices).')
  const enPosgar = /\b[3-7]\d{6}(\.\d+)?\b/.test(texto)

  //2.- Dentro de Tucumán.
  if (!anillo.every(dentroDeTucuman)) {
    throw error400('El polígono cae fuera de Tucumán. Revise en QGIS el sistema de referencia del archivo y expórtelo en EPSG:5345 (POSGAR 2007 faja 3) o en latitud/longitud.')
  }

  //3.- Medidas, punto interior, superposiciones y río o canal más cercano.
  const centro = centroide(anillo)
  const interior = puntoEnPoligono(centro, anillo) ? centro : anillo[0]
  const cauce = await cauceCercano(interior)
  const avisos = [`Coordenadas en ${enPosgar ? 'POSGAR 2007 – Gauss-Krüger faja 3 (EPSG:5345)' : 'latitud/longitud WGS84 (EPSG:4326)'}.`]
  if (cauce && cauce.distanciaM > DISTANCIA_MAX_CAUCE_M) {
    avisos.push(
      `El polígono está a ${(cauce.distanciaM / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km del río o canal más cercano (${cauce.nombre ?? 'sin nombre'}). Las concesiones van a la vera de los cauces: verifique la ubicación.`,
    )
  }
  const p = aPosgar(interior[0], interior[1])
  return {
    archivo: { nombre, bytes },
    nombres: [nombre.replace(/\.[^.]+$/, '')],
    avisos,
    sistemaOrigen: enPosgar ? 'POSGAR_FAJA3' : 'WGS84',
    sistemaOrigenNombre: enPosgar ? 'POSGAR 2007 – Gauss-Krüger faja 3 (EPSG:5345)' : 'latitud/longitud WGS84 (EPSG:4326)',
    geojson: multiPoligono(anillo),
    superficieHa: +calcularHectareas(anillo).toFixed(4),
    perimetroM: Math.round(perimetroMetros(anillo)),
    puntoInterior: { latitud: interior[0], longitud: interior[1] },
    puntoInteriorPosgar: { x: +p.x.toFixed(2), y: +p.y.toFixed(2) },
    superposiciones: superposiciones(db, anillo, excepto),
    cauceCercano: cauce,
  }
}

/** Distancia (m) de un punto al polígono: 0 si cae dentro. */
export function distanciaAlPoligono(punto: LatLng, g: MultiPolygon): number {
  const anillo = anilloDe(g)
  return puntoEnPoligono(punto, anillo) ? 0 : Math.round(distanciaAlBordeMetros(punto, anillo))
}
