// Reglas de la subdivisión (prototipo subdivision/comienzoTramite.html): cantidad de
// fracciones, superficies, validación de los polígonos y datos iniciales de cada nueva
// concesión. Funciones puras, sin API.
import { analizarCobertura, calcularHectareas, distanciaAlBordeMetros, dividirPoligono, puntoEnPoligono, type LatLng } from '@/lib/geo'
import type { UsoInfo } from '@/types/domain'
import type { PreCargaForm } from '../AltaDeConcesion/schemas'
import { recalcularCaudal } from '../ReduccionAmpliacion/superficie'
import { redondear2 } from '../shared/dotacion'
import type { FraccionSubdivision, MadreSubdivision } from './types'

export const MIN_FRACCIONES = 2
export const MAX_FRACCIONES = 8

/** Colores de las fracciones (mismos que el prototipo). */
const COLORES = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#65a30d']

/** Diferencia de superficie que se tolera entre la suma de las fracciones y la madre (fracción del total). */
const TOLERANCIA = 0.01
/** Un vértice a menos de esta distancia del borde de la madre cuenta como «sobre el borde». */
const TOLERANCIA_BORDE_M = 3

const claveDe = (i: number) => String.fromCharCode(65 + i)

function fraccionVacia(i: number, objetivo: number): FraccionSubdivision {
  return { clave: claveDe(i), nombre: `Lote ${claveDe(i)}`, color: COLORES[i % COLORES.length], objetivo, coordenadas: [], hectareas: 0, caudal: null, carga: null }
}

/** Reparte la superficie en partes iguales (la diferencia del redondeo va a la primera). */
export function superficiesIguales(total: number, n: number): number[] {
  const base = redondear2(total / n)
  const partes = Array.from({ length: n }, () => base)
  partes[0] = redondear2(partes[0] + total - base * n)
  return partes
}

/** Fracciones iniciales: `n` lotes de igual superficie, ya divididos sobre el polígono madre. */
export function fraccionesIniciales(madre: MadreSubdivision, n = MIN_FRACCIONES): FraccionSubdivision[] {
  const objetivos = superficiesIguales(madre.hectareas, n)
  return dividirAutomaticamente(
    objetivos.map((o, i) => fraccionVacia(i, o)),
    madre,
  )
}

/** Cambia la cantidad de fracciones conservando las que ya estaban (las nuevas quedan sin dibujar). */
export function cambiarCantidad(fracciones: FraccionSubdivision[], n: number, madre: MadreSubdivision): FraccionSubdivision[] {
  const cantidad = Math.min(MAX_FRACCIONES, Math.max(MIN_FRACCIONES, n))
  if (cantidad <= fracciones.length) return fracciones.slice(0, cantidad)
  const asignado = fracciones.reduce((a, f) => a + f.objetivo, 0)
  const resto = Math.max(0, madre.hectareas - asignado)
  const nuevas = Array.from({ length: cantidad - fracciones.length }, (_, k) => fraccionVacia(fracciones.length + k, redondear2(resto / (cantidad - fracciones.length))))
  return [...fracciones, ...nuevas]
}

/** Superficie de cada fracción a partir de su polígono (y el caudal proporcional). */
export function conSuperficie(f: FraccionSubdivision, madre: MadreSubdivision): FraccionSubdivision {
  const hectareas = f.coordenadas.length >= 3 ? redondear2(calcularHectareas(f.coordenadas)) : 0
  const caudal = madre.caudal == null || madre.hectareas <= 0 ? null : redondear2((madre.caudal * hectareas) / madre.hectareas)
  return { ...f, hectareas, caudal }
}

/** Divide el polígono madre en franjas con las superficies objetivo de cada fracción. */
export function dividirAutomaticamente(fracciones: FraccionSubdivision[], madre: MadreSubdivision): FraccionSubdivision[] {
  const partes = dividirPoligono(
    madre.coordenadas,
    fracciones.map((f) => f.objetivo),
  )
  return fracciones.map((f, i) => conSuperficie({ ...f, coordenadas: partes[i] ?? [] }, madre))
}

export interface EvaluacionSubdivision {
  valido: boolean
  errores: string[]
  /** Suma de las superficies dibujadas (ha). */
  totalDibujado: number
  /** Suma de las superficies objetivo (ha). */
  totalObjetivo: number
  /** Superficie de la madre sin asignar / superpuesta / fuera (ha, estimado). */
  sinAsignar: number
  superpuesta: number
  fuera: number
}

const dentroDeLaMadre = (p: LatLng, madre: LatLng[]) => puntoEnPoligono(p, madre) || distanciaAlBordeMetros(p, madre) <= TOLERANCIA_BORDE_M

/**
 * Una subdivisión es válida si: tiene entre 2 y 8 fracciones con nombre (sin repetir),
 * todas dibujadas, dentro de la concesión madre, sin superponerse entre sí y cubriendo
 * toda la superficie (con una tolerancia del 1 %).
 */
export function evaluarSubdivision(fracciones: FraccionSubdivision[], madre: MadreSubdivision): EvaluacionSubdivision {
  const errores: string[] = []
  const totalDibujado = redondear2(fracciones.reduce((a, f) => a + f.hectareas, 0))
  const totalObjetivo = redondear2(fracciones.reduce((a, f) => a + f.objetivo, 0))
  const tolerancia = Math.max(madre.hectareas * TOLERANCIA, 0.01)

  if (fracciones.length < MIN_FRACCIONES || fracciones.length > MAX_FRACCIONES) errores.push(`La subdivisión tiene que tener entre ${MIN_FRACCIONES} y ${MAX_FRACCIONES} fracciones.`)
  const nombres = fracciones.map((f) => f.nombre.trim().toLowerCase())
  if (nombres.some((n) => !n)) errores.push('Todas las fracciones necesitan un nombre.')
  else if (new Set(nombres).size !== nombres.length) errores.push('Hay fracciones con el mismo nombre.')

  const sinDibujar = fracciones.filter((f) => f.coordenadas.length < 3)
  if (sinDibujar.length) errores.push(`Falta dibujar: ${sinDibujar.map((f) => f.nombre).join(', ')}.`)
  const chicas = fracciones.filter((f) => f.coordenadas.length >= 3 && f.hectareas < 0.01)
  if (chicas.length) errores.push(`Superficie demasiado chica: ${chicas.map((f) => f.nombre).join(', ')}.`)
  const afuera = fracciones.filter((f) => f.coordenadas.length >= 3 && !f.coordenadas.every((p) => dentroDeLaMadre(p, madre.coordenadas)))
  if (afuera.length) errores.push(`Tienen vértices fuera de la concesión madre: ${afuera.map((f) => f.nombre).join(', ')}.`)

  const cobertura = analizarCobertura(
    madre.coordenadas,
    fracciones.map((f) => f.coordenadas),
  )
  const r = (n: number) => redondear2(n)
  if (sinDibujar.length === 0) {
    if (cobertura.superpuesta > tolerancia) errores.push(`Las fracciones se superponen (≈ ${r(cobertura.superpuesta).toFixed(2)} ha).`)
    if (cobertura.fuera > tolerancia && afuera.length === 0) errores.push(`Parte de las fracciones queda fuera de la concesión madre (≈ ${r(cobertura.fuera).toFixed(2)} ha).`)
    if (cobertura.sinAsignar > tolerancia) errores.push(`Quedan ≈ ${r(cobertura.sinAsignar).toFixed(2)} ha de la concesión madre sin asignar a ninguna fracción.`)
    if (Math.abs(totalDibujado - madre.hectareas) > tolerancia) {
      errores.push(`Las fracciones suman ${totalDibujado.toFixed(2)} ha y la concesión madre tiene ${madre.hectareas.toFixed(2)} ha.`)
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    totalDibujado,
    totalObjetivo,
    sinAsignar: r(cobertura.sinAsignar),
    superpuesta: r(cobertura.superpuesta),
    fuera: r(cobertura.fuera),
  }
}

/**
 * Datos iniciales de la nueva concesión de una fracción: parte de la concesión madre
 * (titular, ubicación, registro, suministro), con el polígono de la fracción, los usos
 * y el caudal en proporción a su superficie. Los datos catastrales propios de la parcela
 * nueva (padrón, matrícula, parcela) quedan en blanco.
 */
export function cargaInicial(base: PreCargaForm, f: FraccionSubdivision, madre: MadreSubdivision, buscarUso: (id: string) => UsoInfo | undefined): PreCargaForm {
  const { caudal, usos } = recalcularCaudal(madre.usos, madre.caudal, madre.hectareas, f.hectareas, buscarUso)
  return {
    ...base,
    titulares: base.titulares.map((t) => ({ ...t })),
    domicilios: base.domicilios.map((d) => ({ ...d })),
    ubicacion: {
      departamento: base.ubicacion.departamento,
      localidad: base.ubicacion.localidad,
      distrito: base.ubicacion.distrito,
      poligono: poligonoDe(f),
    },
    catastral: { ...base.catastral, padron: '', matricula: '', parcela: '', orden: '' },
    usos: { ...base.usos, items: usos.length ? usos : base.usos.items },
    suministro: { ...base.suministro, caudalAsignado: caudal == null ? base.suministro.caudalAsignado : String(caudal) },
  }
}

const poligonoDe = (f: FraccionSubdivision) => ({ nombreArchivo: `fraccion-${f.clave}.kml`, tamanioBytes: 0, coordenadas: f.coordenadas, hectareas: f.hectareas })

/**
 * Si el polígono de una fracción cambió después de cargar sus datos, se actualiza en el
 * formulario y, si cambió la superficie, se vuelven a repartir usos y caudal.
 */
export function ajustarCarga(f: FraccionSubdivision, madre: MadreSubdivision, buscarUso: (id: string) => UsoInfo | undefined): FraccionSubdivision {
  if (!f.carga) return f
  const anterior = f.carga.ubicacion.poligono?.hectareas ?? 0
  const carga: PreCargaForm = { ...f.carga, ubicacion: { ...f.carga.ubicacion, poligono: poligonoDe(f) } }
  if (Math.abs(anterior - f.hectareas) < 0.01) return { ...f, carga }
  const { caudal, usos } = recalcularCaudal(madre.usos, madre.caudal, madre.hectareas, f.hectareas, buscarUso)
  return {
    ...f,
    carga: {
      ...carga,
      usos: { ...carga.usos, items: usos.length ? usos : carga.usos.items },
      suministro: { ...carga.suministro, caudalAsignado: caudal == null ? carga.suministro.caudalAsignado : String(caudal) },
    },
  }
}

/** % de la concesión madre. */
export const porcentaje = (f: FraccionSubdivision, madre: MadreSubdivision) => (madre.hectareas > 0 ? (f.hectareas / madre.hectareas) * 100 : 0)
