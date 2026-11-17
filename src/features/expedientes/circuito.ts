// Reglas del circuito de oficinas. El circuito NO está fijo en el código: sale de las
// etapas de la API (/etapas, ordenadas por `orden`).
//
// El historial guarda cada revisión. Solo las 'aprobado' hacen avanzar el expediente,
// así que la etapa actual es etapas[cantidad de aprobadas]. Una 'observado' lo deja
// detenido en la misma oficina hasta que vuelva a revisarse.
import type { DominioContextValue } from '@/hooks/useDominio'
import type { EtapaInfo, Expediente, Oficina, PasoHistorial, RecepcionExpediente } from '@/types/domain'

export const esAprobado = (p: PasoHistorial) => (p.resultado ?? 'aprobado') === 'aprobado'

export interface PasoSiguiente {
  /** 'derivar' pasa a otra oficina; 'finalizar' cierra el trámite. */
  accion: 'derivar' | 'finalizar'
  /** Etapa que completa la oficina actual (se agrega al historial). */
  etapaId: string
  destino: Oficina | null
  etiqueta: string
}

/** Índice de la etapa actual en el circuito (-1 si no se puede ubicar). */
export function posicionActual(e: Expediente, dominio: DominioContextValue): number {
  const { etapas } = dominio
  const aprobadas = e.historial.filter(esAprobado).length
  if (etapas[aprobadas]?.oficinaId === e.oficinaId) return aprobadas
  // Expediente finalizado: quedó en la última etapa.
  if (aprobadas >= etapas.length) return etapas.length - 1
  // Datos inconsistentes: se ubica por la oficina actual.
  return etapas.findIndex((et) => et.oficinaId === e.oficinaId)
}

export function etapaActual(e: Expediente, dominio: DominioContextValue): EtapaInfo | null {
  const pos = posicionActual(e, dominio)
  return pos >= 0 ? dominio.etapas[pos] : null
}

/**
 * Quién tomó el expediente en la etapa donde está ahora (null si todavía nadie lo tomó).
 * La etapa inicial (carga en Catastro) no se toma: el expediente nace ahí.
 */
export function recepcionVigente(e: Expediente, dominio: DominioContextValue): RecepcionExpediente | null {
  const pos = posicionActual(e, dominio)
  if (pos <= 0) return null
  const etapaId = dominio.etapas[pos].id
  return [...(e.recepciones ?? [])].reverse().find((r) => r.etapaId === etapaId && r.oficinaId === e.oficinaId) ?? null
}

/** El expediente está pendiente en una oficina que todavía no lo tomó. */
export function faltaTomar(e: Expediente, dominio: DominioContextValue): boolean {
  return dominio.estadosPendientes.includes(e.estadoId) && posicionActual(e, dominio) > 0 && !recepcionVigente(e, dominio)
}

/** Última revisión aprobada (la "nota del paso anterior"). */
export function ultimaAprobacion(e: Expediente): PasoHistorial | null {
  return [...e.historial].reverse().find(esAprobado) ?? null
}

/** Observación vigente: la última revisión es 'observado' y el expediente sigue observado. */
export function observacionVigente(e: Expediente): PasoHistorial | null {
  const ultima = e.historial.at(-1)
  return e.estadoId === 'observado' && ultima && !esAprobado(ultima) ? ultima : null
}

export function pasoSiguiente(e: Expediente, dominio: DominioContextValue): PasoSiguiente | null {
  if (!dominio.estadosPendientes.includes(e.estadoId)) return null
  const pos = posicionActual(e, dominio)
  if (pos < 0) return null

  const { etapas } = dominio
  const etapaId = etapas[pos].id
  if (pos === etapas.length - 1) return { accion: 'finalizar', etapaId, destino: null, etiqueta: 'Finalizar trámite' }

  const siguiente = etapas[pos + 1]
  const destino = siguiente.oficinaId
  const esUltima = pos + 1 === etapas.length - 1
  const etiqueta = esUltima
    ? `Devolver a ${dominio.nombreOficina(destino)} (${siguiente.nombre.toLowerCase()})`
    : `Derivar a ${dominio.nombreOficina(destino)}`
  return { accion: 'derivar', etapaId, destino, etiqueta }
}
