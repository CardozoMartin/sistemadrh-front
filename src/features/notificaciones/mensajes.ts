import type { DominioContextValue } from '@/hooks/useDominio'
import type { EventoExpediente } from '@/services/realtime'
import type { Oficina } from '@/types/domain'

export interface MensajeEvento {
  titulo: string
  detalle: string
  icon: string
  /** Oficina a cuya bandeja lleva el aviso. */
  oficina: Oficina
}

/** Texto de un aviso. Los nombres de oficinas y trámites salen del dominio (API). */
export function describirEvento(e: EventoExpediente, d: DominioContextValue): MensajeEvento {
  const { numero, tramiteId, titular, oficinaId } = e.expediente
  const tramite = `${d.nombreTramite(tramiteId)} · ${titular}`
  const oficina = d.nombreOficina(oficinaId)
  // La oficina que asigna números de concesión es la que inicia el circuito (Catastro).
  const oficinaNumeros = d.etapas[0]?.oficinaId ?? oficinaId

  switch (e.tipo) {
    case 'nuevo':
      return { titulo: `Nuevo expediente ${numero} en ${oficina}`, detalle: tramite, icon: 'note_add', oficina: oficinaId }
    case 'finalizado':
      return { titulo: `Expediente ${numero} finalizado`, detalle: tramite, icon: 'task_alt', oficina: oficinaId }
    case 'observado':
      return { titulo: `Expediente ${numero} observado en ${oficina}`, detalle: tramite, icon: 'report', oficina: oficinaId }
    case 'solicitud_numero':
      return {
        titulo: `${e.oficinaOrigenId ? d.nombreOficina(e.oficinaOrigenId) : oficina} pide número de concesión`,
        detalle: `Expediente ${numero} · ${tramite}${e.usuarioNombre ? ` · lo pidió ${e.usuarioNombre}` : ''}`,
        icon: 'pin',
        oficina: oficinaNumeros,
      }
    case 'numero_asignado':
      return {
        // Una subdivisión pide varios números a la vez (llegan separados por coma).
        titulo: e.numeroConcesion?.includes(',') ? `Números de concesión ${e.numeroConcesion} asignados` : `Número de concesión ${e.numeroConcesion ?? ''} asignado`,
        detalle: `${d.nombreOficina(oficinaNumeros)} asignó ${e.numeroConcesion?.includes(',') ? 'los números' : 'el número'} al expediente ${numero}`,
        icon: 'verified',
        oficina: oficinaId,
      }
    case 'derivado':
      return {
        titulo: `Expediente ${numero} llegó a ${oficina}`,
        detalle: e.oficinaOrigenId ? `Derivado desde ${d.nombreOficina(e.oficinaOrigenId)} · ${tramite}` : tramite,
        icon: 'move_to_inbox',
        oficina: oficinaId,
      }
  }
}
