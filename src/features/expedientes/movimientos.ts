// Trazabilidad legible de un expediente: junta el historial (revisiones de cada oficina)
// con las recepciones (quién tomó el expediente) en una sola línea de tiempo.
// Ej: "S. Herrera (Recaudación) tomó el expediente 240100."
import type { DominioContextValue } from '@/hooks/useDominio'
import type { Expediente, Oficina } from '@/types/domain'
import { esAprobado } from './circuito'

export type TipoMovimiento = 'inicio' | 'recepcion' | 'derivacion' | 'observacion' | 'finalizacion'

export interface Movimiento {
  /** Clave estable para listas. */
  clave: string
  tipo: TipoMovimiento
  fecha: string // ISO
  expedienteId: string
  numeroExpediente: string
  oficinaId: Oficina
  usuarioId: string
  /** Frase completa: "M. Rodríguez (Catastro) inició el Alta de Concesión — expediente 240100." */
  texto: string
  observaciones?: string
}

export const ICONO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  inicio: 'note_add',
  recepcion: 'move_to_inbox',
  derivacion: 'send',
  observacion: 'priority_high',
  finalizacion: 'task_alt',
}

/** Movimientos de un expediente en orden cronológico. */
export function movimientosDe(e: Expediente, d: DominioContextValue): Movimiento[] {
  const quien = (usuarioId: string, oficinaId: Oficina) => `${d.usuario(usuarioId)?.nombre ?? usuarioId} (${d.nombreOficina(oficinaId)})`
  const base = { expedienteId: e.id, numeroExpediente: e.numero }
  const lista: Movimiento[] = []

  // Revisiones: las aprobadas avanzan una etapa; con eso se sabe a qué oficina pasó.
  let aprobadas = 0
  e.historial.forEach((p, i) => {
    const autor = quien(p.usuarioId, p.oficinaId)
    const etapa = d.etapa(p.etapaId)?.nombre ?? p.etapaId
    const comun = { ...base, clave: `h-${i}`, fecha: p.fecha, oficinaId: p.oficinaId, usuarioId: p.usuarioId, observaciones: p.observaciones }

    if (!esAprobado(p)) {
      lista.push({ ...comun, tipo: 'observacion', texto: `${autor} observó el expediente ${e.numero} en «${etapa}». Queda detenido en ${d.nombreOficina(p.oficinaId)}.` })
      return
    }
    aprobadas += 1
    const siguiente = d.etapas[aprobadas]
    if (i === 0) {
      // Catastro inicia el trámite (fecha de inicio) y, al terminar la carga, lo deriva.
      lista.push({
        ...comun,
        clave: 'inicio',
        tipo: 'inicio',
        fecha: e.fechaInicio < p.fecha ? e.fechaInicio : p.fecha,
        observaciones: undefined,
        texto: `${autor} inició el trámite de ${d.nombreTramite(e.tramiteId)} — expediente ${e.numero}.`,
      })
    }
    if (!siguiente) {
      lista.push({ ...comun, tipo: 'finalizacion', texto: `${autor} cerró el trámite de ${d.nombreTramite(e.tramiteId)} — expediente ${e.numero}.` })
    } else {
      lista.push({ ...comun, tipo: 'derivacion', texto: `${autor} completó «${etapa}» y derivó el expediente ${e.numero} a ${d.nombreOficina(siguiente.oficinaId)}.` })
    }
  })

  ;(e.recepciones ?? []).forEach((r, i) => {
    lista.push({
      ...base,
      clave: `r-${i}`,
      tipo: 'recepcion',
      fecha: r.fecha,
      oficinaId: r.oficinaId,
      usuarioId: r.usuarioId,
      texto: `${quien(r.usuarioId, r.oficinaId)} tomó el expediente ${e.numero} («${d.etapa(r.etapaId)?.nombre ?? r.etapaId}»).`,
    })
  })

  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
}
