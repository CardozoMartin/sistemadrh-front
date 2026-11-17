// Datos de referencia del dominio: oficinas, circuito, trámites, estados, usos, etc.
// Salen de la base (backend GET /dominio); json-server solo en el modo demo o dev:mock.
import type {
  EstadoInfo,
  EtapaInfo,
  OficinaInfo,
  OpcionCatalogo,
  SituacionLegalInfo,
  TramiteInfo,
  UsoInfo,
  Usuario,
} from '@/types/domain'
import { backend } from './api/backend'
import { api } from './api/client'
import { USA_JSON_SERVER } from './demo/modo'

export interface Dominio {
  oficinas: OficinaInfo[]
  etapas: EtapaInfo[]
  tramites: TramiteInfo[]
  estados: EstadoInfo[]
  situacionesLegales: SituacionLegalInfo[]
  usos: UsoInfo[]
  circunscripciones: OpcionCatalogo[]
  seccionesCatastrales: OpcionCatalogo[]
  caracteres: OpcionCatalogo[]
  codigosServicio: OpcionCatalogo[]
  tiposConcesion: OpcionCatalogo[]
  /** Documentos que Jurídico puede marcar como faltantes. */
  documentosJuridicos: OpcionCatalogo[]
  usuarios: Usuario[]
}

const COLECCIONES: (keyof Dominio)[] = [
  'oficinas',
  'etapas',
  'tramites',
  'estados',
  'situacionesLegales',
  'usos',
  'circunscripciones',
  'seccionesCatastrales',
  'caracteres',
  'codigosServicio',
  'tiposConcesion',
  'documentosJuridicos',
  'usuarios',
]

/**
 * Los trámites y estados del front usan los códigos en minúscula (alta_concesion, en_tramite);
 * la base, los del backend (ALTA_CONCESION, EN_TRAMITE). Se traducen acá hasta unificarlos.
 */
const ID_TRAMITE_FRONT: Record<string, string> = { AMPLIACION_REDUCCION: 'reduccion_ampliacion' }
const idTramiteFront = (codigo: string) => ID_TRAMITE_FRONT[codigo] ?? codigo.toLowerCase()

/** Trae todos los datos de referencia de la base en una sola petición. */
export async function fetchDominio(): Promise<Dominio> {
  if (!USA_JSON_SERVER) {
    const { data } = await backend.get<Dominio>('/dominio')
    return {
      ...data,
      tramites: data.tramites.map((t) => ({ ...t, id: idTramiteFront(t.id) as TramiteInfo['id'], codigo: t.id })),
      estados: data.estados.map((e) => ({ ...e, id: e.id.toLowerCase() as EstadoInfo['id'], codigo: e.id })),
    }
  }
  const respuestas = await Promise.all(COLECCIONES.map((c) => api.get<unknown[]>(`/${c}`)))
  const dominio = Object.fromEntries(COLECCIONES.map((c, i) => [c, respuestas[i].data])) as unknown as Dominio
  dominio.etapas = [...dominio.etapas].sort((a, b) => a.orden - b.orden)
  return dominio
}
