// Peticiones de catálogos de referencia: salen de la base (backend /catalogos/*), ya
// normalizados (mayúsculas, sin duplicados, ordenados). json-server solo en demo / dev:mock.
import { backend } from './api/backend'
import { api } from './api/client'
import { USA_JSON_SERVER } from './demo/modo'

/** departamento → localidad → distritos */
export type CatalogoLocalidades = Record<string, Record<string, string[]>>

/** Niveles del árbol de suministro, en orden: cada tramo cuelga de alguno de los anteriores. */
export type NivelSuministro = 'FUENTE' | 'SISTEMA' | 'CANAL_PRINCIPAL' | 'CANAL_SECUNDARIO' | 'CANAL_TERCIARIO' | 'CANAL_CUARTO' | 'CANAL_QUINTO' | 'DESAGUE'

export const NIVELES_SUMINISTRO: { nivel: NivelSuministro; nombre: string }[] = [
  { nivel: 'FUENTE', nombre: 'Fuente de agua' },
  { nivel: 'SISTEMA', nombre: 'Sistema de distribución' },
  { nivel: 'CANAL_PRINCIPAL', nombre: 'Canal principal' },
  { nivel: 'CANAL_SECUNDARIO', nombre: 'Canal secundario' },
  { nivel: 'CANAL_TERCIARIO', nombre: 'Canal terciario' },
  { nivel: 'CANAL_CUARTO', nombre: 'Canal cuarto' },
  { nivel: 'CANAL_QUINTO', nombre: 'Canal quinto' },
  { nivel: 'DESAGUE', nombre: 'Desagüe' },
]

/** 0 = fuente … 7 = desagüe. */
export const ordenDeNivel = (nivel: NivelSuministro) => NIVELES_SUMINISTRO.findIndex((n) => n.nivel === nivel)
export const nombreDeNivel = (nivel: NivelSuministro) => NIVELES_SUMINISTRO[ordenDeNivel(nivel)].nombre

/** Un tramo de la red de riego con lo que cuelga de él (fuente → sistema → canales → desagüe). */
export interface NodoSuministro {
  nombre: string
  nivel: NivelSuministro
  hijos: NodoSuministro[]
}

/** Código del distrito («I» … «VII») → sus fuentes, cada una con su árbol. */
export type CatalogoSuministro = Record<string, NodoSuministro[]>

export async function fetchCatalogoLocalidades(): Promise<CatalogoLocalidades> {
  const { data } = USA_JSON_SERVER
    ? await api.get<CatalogoLocalidades>('/catalogoLocalidades')
    : await backend.get<CatalogoLocalidades>('/catalogos/ubicaciones')
  return data
}

/**
 * El árbol de suministro de cada distrito (el backend también acepta ?distrito=II). El catálogo
 * viejo de json-server (por localidad) ya no se usa: en demo no hay árbol y el alta solo pide
 * observación y caudal.
 */
export async function fetchCatalogoSuministro(): Promise<CatalogoSuministro> {
  if (USA_JSON_SERVER) return {}
  const { data } = await backend.get<CatalogoSuministro>('/catalogos/suministro')
  return data
}
