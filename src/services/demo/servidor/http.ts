// Piezas comunes de las rutas del backend emulado: la petición, los errores (mismos códigos
// que el backend real) y un enrutador chico por patrón ('/tramites/alta-concesion/:id/usos').
import type { Db, UsuarioDemo } from './db'

/** Error con código HTTP. El adaptador lo devuelve como lo haría el backend ({ message }). */
export class ErrorDemo extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const error400 = (m: string) => new ErrorDemo(400, m)
export const error403 = (m: string) => new ErrorDemo(403, m)
export const error404 = (m: string) => new ErrorDemo(404, m)
export const error409 = (m: string) => new ErrorDemo(409, m)

export interface Peticion {
  db: Db
  usuario: UsuarioDemo
  /** Parámetros de la ruta (:id) y de la query string. */
  ruta: Record<string, string>
  query: Record<string, string | undefined>
  cuerpo: unknown
}

export type Manejador = (p: Peticion) => unknown | Promise<unknown>
export type Ruta = [metodo: string, patron: string, manejador: Manejador]

/** Busca la ruta que corresponde: devuelve el manejador y los parámetros (:id), o null. */
export function encontrar(rutas: Ruta[], metodo: string, url: string): { manejador: Manejador; ruta: Record<string, string> } | null {
  const partes = url.split('?')[0].split('/').filter(Boolean)
  for (const [m, patron, manejador] of rutas) {
    if (m !== metodo) continue
    const esperado = patron.split('/').filter(Boolean)
    if (esperado.length !== partes.length) continue
    const ruta: Record<string, string> = {}
    const coincide = esperado.every((p, i) => {
      if (p.startsWith(':')) {
        ruta[p.slice(1)] = decodeURIComponent(partes[i])
        return true
      }
      return p === partes[i]
    })
    if (coincide) return { manejador, ruta }
  }
  return null
}

/** El cuerpo como objeto (vacío si no vino). */
export const cuerpoDe = <T = Record<string, unknown>>(p: Peticion) => (p.cuerpo && typeof p.cuerpo === 'object' ? p.cuerpo : {}) as T

/** Texto obligatorio del cuerpo (400 con el mensaje si falta). */
export function exigirTexto(valor: unknown, mensaje: string): string {
  if (typeof valor !== 'string' || !valor.trim()) throw error400(mensaje)
  return valor.trim()
}
