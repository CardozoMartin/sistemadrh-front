// Backend emulado del modo demo: recibe la petición que armó el adaptador de axios, la pasa a
// la ruta que corresponde y guarda los cambios en el navegador.
import { rutasAlta, titularDeAltaExpediente } from './alta'
import { rutasBaja, titularDeBaja } from './baja'
import { guardar, obtenerDb, type Db } from './db'
import { rutasExpedientes } from './expedientes'
import { encontrar, error403, error404, ErrorDemo, type Ruta } from './http'
import { rutasPozos } from './pozos'
import { rutasRegistroPozo, titularDeRegistroPozo } from './registroPozo'
import { rutasSig } from './sig'

export { ErrorDemo }
export { reiniciarDb as reiniciarDemo } from './db'

const RUTAS: Ruta[] = [
  ...rutasExpedientes((db, e) => (e.tipoTramite === 'BAJA_POZO' ? titularDeBaja(db, e) : e.tipoTramite === 'REGISTRO_POZO' ? titularDeRegistroPozo(db, e) : titularDeAltaExpediente(db, e))),
  ...rutasAlta,
  ...rutasPozos,
  ...rutasRegistroPozo,
  ...rutasBaja,
  ...rutasSig,
]

export interface PeticionDemo {
  metodo: string
  url: string
  params: Record<string, unknown>
  cuerpo: unknown
  usuarioId: string
}

/** Atiende una petición sobre la base indicada (la semilla la usa para recorrer el circuito). */
export async function atender(db: Db, { metodo, url, params, cuerpo, usuarioId }: PeticionDemo): Promise<unknown> {
  const destino = encontrar(RUTAS, metodo, url)
  if (!destino) throw error404(`El modo demo todavía no emula ${metodo} ${url}.`)
  const usuario = db.usuarios.find((u) => u.id === usuarioId)
  if (!usuario) throw error403('Usuario desconocido.')
  const query = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === undefined || v === null ? undefined : String(v)]))
  // Copia de trabajo: si la acción falla a mitad de camino, no deja datos a medias (como una transacción).
  const copia = metodo === 'GET' ? db : structuredClone(db)
  const resultado = await destino.manejador({ db: copia, usuario, ruta: destino.ruta, query, cuerpo })
  if (metodo !== 'GET') Object.assign(db, copia)
  return resultado
}

export async function responder(peticion: PeticionDemo): Promise<unknown> {
  const db = await obtenerDb()
  const resultado = await atender(db, peticion)
  if (peticion.metodo !== 'GET') guardar()
  return resultado
}
