// Coordenadas de un punto cargado a mano (desagüe, punto de entrega, pozo). Criterio único
// del sistema, el mismo que el backend (GeometriaService.normalizarPunto):
//
//   - Se carga en UNO de dos sistemas:
//       POSGAR 2007 faja 3 (EPSG:5345): X/Y en metros, como en los planos. X ≈ 3.500.000, Y ≈ 7.000.000.
//       Latitud/longitud en grados (GPS, Google Earth): -27.0536 / -65.2312, o 27°03'13" S.
//       Las geográficas POSGAR 07 y las WGS84 difieren menos de 1 m: son la misma cosa a efectos del mapa.
//   - El backend calcula la otra forma con PostGIS y guarda las dos. El mapa usa latitud/longitud.
//
// Acá se lee lo que escribe el usuario, se valida y se muestra la conversión en vivo (proj4,
// difiere de PostGIS menos de 1 m: lo que se guarda lo calcula el backend).
import { aPosgar, dePosgar, formatearPosgar } from './posgar'
import { errorPuntoConvertido, LIMITES_TUCUMAN_GRADOS } from './posgar-faja3'
import { RANGO_POSGAR_TUCUMAN, validarPosgar } from './validaciones'

export type SistemaCoordenada = 'posgar' | 'grados'

/** Rectángulo de Tucumán en grados (regla compartida con el backend, lib/posgar-faja3.ts). */
export const LIMITES_TUCUMAN = LIMITES_TUCUMAN_GRADOS

/** Lo que guarda el formulario para cada punto: el sistema elegido y los valores de los dos. */
export interface CoordenadaForm {
  sistema: SistemaCoordenada
  x: string
  y: string
  latitud: string
  longitud: string
}

export const coordenadaVacia = (): CoordenadaForm => ({ sistema: 'posgar', x: '', y: '', latitud: '', longitud: '' })

export interface Punto {
  x: number
  y: number
  latitud: number
  longitud: number
}

const grados = (n: number) => n.toLocaleString('es-AR')

/**
 * Lee un ángulo en grados:
 *   decimal:                   -27.0536   -27,0536   -27.0536°
 *   grados, minutos, segundos: 27°03'13.2" S   27 3 13.2 S   S 27°03'13"   -27°03'13"
 *   grados y minutos:          27°03.22' S
 * Sur y Oeste (S, O, W) son negativos. Sin signo ni hemisferio se toma Sur / Oeste: en
 * Argentina la latitud y la longitud siempre son negativas (`supuesto` lo indica).
 * null si no se entiende.
 */
export function leerGrados(texto: string): { valor: number; supuesto: boolean } | null {
  let t = texto
    .trim()
    .toUpperCase()
    .replace(/,/g, '.')
    .replace(/[′’´`]/g, "'")
    .replace(/[″”“]|''/g, '"')
  if (!t) return null

  //1.- Hemisferio (al principio o al final) y signo.
  let hemisferio: string | null = null
  const letra = /^([NSEOW])\s*|\s*([NSEOW])$/.exec(t)
  if (letra) {
    hemisferio = letra[1] ?? letra[2]
    t = t.replace(letra[0], '')
  }
  const negativo = t.startsWith('-')
  t = t.replace(/^[-+]\s*/, '')

  //2.- Grados, minutos y segundos (los dos últimos opcionales).
  const partes = t.split(/\s*[°º'"]\s*|\s+/).filter(Boolean)
  if (!partes.length || partes.length > 3 || partes.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  const [g, m = 0, s = 0] = partes.map(Number)
  if (partes.length > 1 && (!Number.isInteger(g) || m >= 60 || s >= 60)) return null
  if (partes.length > 2 && !Number.isInteger(m)) return null
  const valor = g + m / 60 + s / 3600

  //3.- Signo: el del texto o el del hemisferio; si no hay ninguno, Sur / Oeste.
  if (negativo || hemisferio === 'S' || hemisferio === 'O' || hemisferio === 'W') return { valor: -valor, supuesto: false }
  if (hemisferio === 'N' || hemisferio === 'E') return { valor, supuesto: false }
  return { valor: -valor, supuesto: true }
}

const enRango = (v: number, min: number, max: number) => v >= min && v <= max
const esLatitud = (v: number) => enRango(v, LIMITES_TUCUMAN.sur, LIMITES_TUCUMAN.norte)
const esLongitud = (v: number) => enRango(v, LIMITES_TUCUMAN.oeste, LIMITES_TUCUMAN.este)
const pareceMetros = (texto: string) => /^\d{6,8}([.,]\d+)?$/.test(texto.trim())

export interface LecturaCoordenada {
  /** El punto con las dos formas, si los dos valores son válidos. */
  punto: Punto | null
  /** Error de cada campo (por nombre: x, y, latitud, longitud). */
  errores: Partial<Record<'x' | 'y' | 'latitud' | 'longitud', string>>
  /** Algo que conviene que el usuario sepa aunque sea válido (ej: se supuso Sur / Oeste). */
  aviso: string | null
}

/** Lee y valida la coordenada de un punto en el sistema elegido. `contexto`: «del desagüe». */
export function leerCoordenada(c: CoordenadaForm, contexto: string): LecturaCoordenada {
  return c.sistema === 'posgar' ? leerPosgar(c, contexto) : leerLatLong(c, contexto)
}

function leerPosgar({ x, y }: CoordenadaForm, contexto: string): LecturaCoordenada {
  //1.- Si cargaron grados en los campos de POSGAR, se lo dice (es el error más probable).
  const lat = leerGrados(y)
  const lon = leerGrados(x)
  if (x && y && lat && lon && ((esLatitud(lat.valor) && esLongitud(lon.valor)) || (esLatitud(lon.valor) && esLongitud(lat.valor)))) {
    const msj = 'Eso es latitud/longitud: elija «Latitud / longitud» arriba.'
    return { punto: null, errores: { x: msj, y: msj }, aviso: null }
  }

  //2.- X e Y en metros, dentro del rango de Tucumán (avisa si están invertidas).
  const errores = { x: validarPosgar(x, 'x', contexto) ?? undefined, y: validarPosgar(y, 'y', contexto) ?? undefined }
  if (errores.x || errores.y) return { punto: null, errores, aviso: null }

  //3.- La latitud/longitud, para mostrarla: tiene que caer en Tucumán (lo mismo controla el backend).
  const p = dePosgar(Number(x), Number(y))
  const fuera = errorPuntoConvertido(p.lat, p.lng, contexto)
  if (fuera) return { punto: null, errores: { x: fuera, y: fuera }, aviso: null }
  return { punto: { x: Number(x), y: Number(y), latitud: p.lat, longitud: p.lng }, errores: {}, aviso: null }
}

function leerLatLong({ latitud, longitud }: CoordenadaForm, contexto: string): LecturaCoordenada {
  //1.- Si cargaron X/Y POSGAR en los campos de grados, se lo dice.
  if (pareceMetros(latitud) || pareceMetros(longitud)) {
    const msj = 'Eso parece X/Y POSGAR (metros): elija «POSGAR 07 faja 3» arriba.'
    return { punto: null, errores: { latitud: pareceMetros(latitud) ? msj : undefined, longitud: pareceMetros(longitud) ? msj : undefined }, aviso: null }
  }

  //2.- Cada valor tiene que entenderse como grados.
  const formato = 'Use grados decimales (ej: -27.0536) o grados, minutos y segundos (ej: 27°03\'13" S).'
  const lat = leerGrados(latitud)
  const lon = leerGrados(longitud)
  const errores: LecturaCoordenada['errores'] = {
    latitud: !latitud.trim() ? `Ingrese la latitud ${contexto}.` : !lat ? `No se entiende la latitud. ${formato}` : undefined,
    longitud: !longitud.trim() ? `Ingrese la longitud ${contexto}.` : !lon ? `No se entiende la longitud. ${formato}` : undefined,
  }
  if (!lat || !lon) return { punto: null, errores, aviso: null }

  //3.- Dentro de Tucumán (avisa si están invertidas).
  if (!esLatitud(lat.valor) || !esLongitud(lon.valor)) {
    if (esLatitud(lon.valor) && esLongitud(lat.valor)) {
      const msj = 'Parecen invertidas: la latitud ronda -27 y la longitud -65.'
      return { punto: null, errores: { latitud: msj, longitud: msj }, aviso: null }
    }
    return {
      punto: null,
      errores: {
        latitud: esLatitud(lat.valor) ? undefined : `La latitud en Tucumán va de ${grados(LIMITES_TUCUMAN.sur)} a ${grados(LIMITES_TUCUMAN.norte)}.`,
        longitud: esLongitud(lon.valor) ? undefined : `La longitud en Tucumán va de ${grados(LIMITES_TUCUMAN.oeste)} a ${grados(LIMITES_TUCUMAN.este)}.`,
      },
      aviso: null,
    }
  }

  //4.- X/Y POSGAR, para mostrarla.
  const p = aPosgar(lat.valor, lon.valor)
  const fueraPosgar = !enRango(p.x, RANGO_POSGAR_TUCUMAN.x.min, RANGO_POSGAR_TUCUMAN.x.max) || !enRango(p.y, RANGO_POSGAR_TUCUMAN.y.min, RANGO_POSGAR_TUCUMAN.y.max)
  if (fueraPosgar) return { punto: null, errores: { latitud: 'El punto cae fuera de Tucumán.' }, aviso: null }
  return {
    punto: { x: p.x, y: p.y, latitud: lat.valor, longitud: lon.valor },
    errores: {},
    aviso: lat.supuesto || lon.supuesto ? 'Sin signo ni hemisferio se tomó como Sur / Oeste (en Argentina la latitud y la longitud son negativas).' : null,
  }
}

/** "≈ X 3.577.293 · Y 7.035.340" o "≈ -27.053629, -65.231224": la forma que NO se cargó. */
export function textoConversion(sistema: SistemaCoordenada, p: Punto): string {
  return sistema === 'posgar'
    ? `Latitud/longitud: ${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}`
    : `POSGAR 07 faja 3: ${formatearPosgar(p)}`
}

/** Lo que recibe la API (CoordenadaDto): X/Y o latitud/longitud, según lo que se cargó. */
export function coordenadaADto(c: CoordenadaForm): { x: number; y: number } | { latitud: number; longitud: number } | undefined {
  const { punto } = leerCoordenada(c, '')
  if (!punto) return undefined
  return c.sistema === 'posgar' ? { x: punto.x, y: punto.y } : { latitud: Number(punto.latitud.toFixed(8)), longitud: Number(punto.longitud.toFixed(8)) }
}

/** Lo que devuelve la API (X/Y, latitud/longitud y en qué sistema se cargó) → formulario. */
export function coordenadaDesdeApi(r: { sistema?: string | null; x: number | null; y: number | null; latitud: number; longitud: number } | null | undefined): CoordenadaForm {
  if (!r) return coordenadaVacia()
  const t = (n: number | null) => (n === null ? '' : String(n))
  return {
    // Los puntos viejos no tienen X/Y: se muestran en grados.
    sistema: r.sistema === 'WGS84' || r.x === null ? 'grados' : 'posgar',
    x: t(r.x),
    y: t(r.y),
    latitud: String(r.latitud),
    longitud: String(r.longitud),
  }
}
