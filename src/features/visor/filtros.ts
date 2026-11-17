// Filtros y capas del visor. Los usan la lista y el mapa, así los dos muestran siempre lo mismo.
import { valorDe, type CriterioColor } from './colores'
import type { ConcesionGeo } from './types'

export interface FiltrosVisor {
  busqueda: string
  /** Por qué se colorean las concesiones (la leyenda es también el filtro). */
  criterio: CriterioColor
  /** Valores del criterio que están apagados en la leyenda (no se ven en el mapa ni en la lista). */
  ocultos: Set<string>
}

export const filtrosIniciales = (): FiltrosVisor => ({ busqueda: '', criterio: 'estado', ocultos: new Set() })

/** Capas que se pueden prender y apagar. */
export interface CapasVisor {
  concesiones: boolean
  pozos: boolean
  /** Desagües y puntos de entrega. */
  puntos: boolean
  cauces: boolean
  /** Número de cada concesión en rojo sobre su polígono (con el mapa acercado). */
  etiquetas: boolean
}

export const CAPAS_TODAS: CapasVisor = { concesiones: true, pozos: true, puntos: true, cauces: true, etiquetas: true }
export const CAPAS_NINGUNA: CapasVisor = { concesiones: false, pozos: false, puntos: false, cauces: false, etiquetas: false }

/** Para buscar sin importar mayúsculas ni tildes. */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Donde se busca: número, expediente, titular, documento, padrón, matrícula, ubicación, fuente. */
const textoBuscable = ({ properties: p }: ConcesionGeo) =>
  normalizar([p.numero, p.expediente, p.titular, p.documento, p.padron, p.matricula_catastral, p.localidad, p.departamento, p.fuente, p.sistema].filter(Boolean).join(' '))

export function filtrar(concesiones: ConcesionGeo[], { busqueda, criterio, ocultos }: FiltrosVisor): ConcesionGeo[] {
  const q = normalizar(busqueda.trim())
  return concesiones.filter((f) => !ocultos.has(valorDe(f.properties, criterio)) && (!q || textoBuscable(f).includes(q)))
}

/** Recuadro [oeste, sur, este, norte] de un conjunto de concesiones (para encuadrar el mapa). */
export function recuadroDe(concesiones: ConcesionGeo[]): [number, number, number, number] | null {
  let o = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const f of concesiones) {
    for (const poligono of f.geometry.coordinates) {
      for (const [x, y] of poligono[0]) {
        if (x < o) o = x
        if (x > e) e = x
        if (y < s) s = y
        if (y > n) n = y
      }
    }
  }
  return Number.isFinite(o) ? [o, s, e, n] : null
}
