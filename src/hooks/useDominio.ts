import { createContext, useContext } from 'react'
import type { Dominio } from '@/services/dominio'
import type {
  EstadoExpediente,
  EstadoInfo,
  EtapaInfo,
  Oficina,
  OficinaInfo,
  SituacionLegalInfo,
  TipoTramite,
  TramiteInfo,
  UsoInfo,
  Usuario,
} from '@/types/domain'

/** Dominio cargado + búsquedas por id (resuelven las relaciones de expedientes). */
export interface DominioContextValue extends Dominio {
  oficina: (id: Oficina) => OficinaInfo | undefined
  tramite: (id: TipoTramite) => TramiteInfo | undefined
  estado: (id: EstadoExpediente) => EstadoInfo | undefined
  etapa: (id: string) => EtapaInfo | undefined
  situacionLegal: (id: string) => SituacionLegalInfo | undefined
  uso: (id: string) => UsoInfo | undefined
  usuario: (id: string) => Usuario | undefined
  /** Nombre para mostrar; si el id no existe se muestra el id. */
  nombreOficina: (id: Oficina) => string
  nombreTramite: (id: TipoTramite) => string
  /** Oficinas del circuito en orden (una por etapa). */
  circuito: Oficina[]
  /** Ids de estados que cuentan como pendientes. */
  estadosPendientes: EstadoExpediente[]
}

export const DominioContext = createContext<DominioContextValue | null>(null)

/** Datos de referencia del dominio. Siempre están cargados dentro de <DominioProvider>. */
export function useDominio(): DominioContextValue {
  const ctx = useContext(DominioContext)
  if (!ctx) throw new Error('useDominio debe usarse dentro de <DominioProvider>')
  return ctx
}

/** Arma el contexto con índices por id (se calcula una sola vez por carga). */
export function crearContextoDominio(d: Dominio): DominioContextValue {
  const indice = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const oficinas = indice(d.oficinas)
  const tramites = indice(d.tramites)
  const estados = indice(d.estados)
  const etapas = indice(d.etapas)
  const situaciones = indice(d.situacionesLegales)
  const usos = indice(d.usos)
  const usuarios = indice(d.usuarios)

  return {
    ...d,
    oficina: (id) => oficinas.get(id),
    tramite: (id) => tramites.get(id),
    estado: (id) => estados.get(id),
    etapa: (id) => etapas.get(id),
    situacionLegal: (id) => situaciones.get(id),
    uso: (id) => usos.get(id),
    usuario: (id) => usuarios.get(id),
    nombreOficina: (id) => oficinas.get(id)?.nombre ?? id,
    nombreTramite: (id) => tramites.get(id)?.nombre ?? id,
    circuito: d.etapas.map((e) => e.oficinaId),
    estadosPendientes: d.estados.filter((e) => e.pendiente).map((e) => e.id),
  }
}
