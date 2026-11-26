// Reglas y textos de la Anulación de Concesión que no dependen de la pantalla (testeables).
// El backend vuelve a validar todo; esto es para guiar al usuario y armar los mensajes.
import { formatearFecha } from '@/config/expedientes'
import { faltaEnVerificacionFinal, type EstadoCierre } from '../shared/circuito/cierre'
import type { EstadoAnulacion } from './backend.types'

/** Cómo se ve un trámite que ya no está en curso (en «Dónde está»). */
export const TERMINADO: Record<Exclude<EstadoAnulacion, 'EN_TRAMITE'>, string> = {
  FINALIZADO: 'Finalizado: la concesión quedó anulada',
  RECHAZADO: 'Rechazado: la concesión sigue vigente',
  ANULADO: 'Cancelado: iniciado por error',
}

/** null mientras está en trámite; si terminó, cómo terminó. */
export const terminado = (estado: EstadoAnulacion): string | null => (estado === 'EN_TRAMITE' ? null : TERMINADO[estado])

/** Catastro todavía puede «Iniciar anulación» (enviarla) o cancelarla: está en la carga. */
export const estaEnCarga = (estado: EstadoAnulacion, etapa: string) => estado === 'EN_TRAMITE' && etapa === 'CARGA'

/** Por qué la verificación de datos ya no se puede hacer: dónde está o cómo terminó. */
export function dondeQuedo(estado: EstadoAnulacion, expediente: { numero: string; oficinaNombre: string; etapaNombre: string }): string {
  const donde = estado === 'EN_TRAMITE' ? `está en ${expediente.oficinaNombre} (${expediente.etapaNombre})` : `quedó ${estado.toLowerCase()}`
  return `Expediente ${expediente.numero}: ${donde}.`
}


// --- Baja en Catastro (visto bueno final) ------------------------------------------

/** Qué falta para dar la baja (null: se puede). */
export const faltaEnBaja = (estado: EstadoCierre): string | null =>
  faltaEnVerificacionFinal(estado, 'los datos de la concesión y el motivo')

/** El mensaje de «Trámite finalizado» después de la baja. */
export function mensajeBaja({ concesion, expediente, fechaResolucion }: { concesion: string; expediente: string; fechaResolucion: string | null }): string {
  const desde = fechaResolucion ? ` desde el ${formatearFecha(fechaResolucion)}` : ''
  return `La concesión ${concesion} quedó anulada${desde}. El expediente ${expediente} queda en el historial.`
}
