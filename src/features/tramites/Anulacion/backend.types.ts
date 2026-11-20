// Respuestas del backend real para la Anulación de Concesión (GET /tramites/anulacion…).
// Mismos nombres que devuelve el backend (src/tramites/anulacion-concesion/anulacion.service.ts).
// Personas, domicilios, resumen del expediente y checklist son los mismos que el cambio de titularidad.
import type { Oficina } from '@/types/domain'
import type { AvisoDeudaBackend } from '../AltaDeConcesion/backend.types'
import type { DomicilioCambio, PersonaCambio, ResumenExpediente } from '../CambioDeTitularidad/backend.types'

export type { DocumentoChecklist } from '../CambioDeTitularidad/backend.types'

export type EstadoAnulacion = 'EN_TRAMITE' | 'FINALIZADO' | 'RECHAZADO' | 'ANULADO'

/** GET /tramites/anulacion/:id (y lo que devuelve cada acción). */
export interface AnulacionBackend {
  expediente: ResumenExpediente
  anulacion: {
    id: string
    estado: EstadoAnulacion
    motivo: string
    concesion: {
      id: string
      numero: string | null
      estado: string
      fechaOtorgamiento: string | null
      padron: string | null
      ubicacion: { departamento: string | null; localidad: string | null; distrito: string | null }
    }
    /** Titulares vigentes: lo siguen siendo hasta que la anulación finaliza. */
    titulares: PersonaCambio[]
    domicilios: DomicilioCambio[]
    /** Papeles del checklist que trajo el expediente al iniciar. */
    documentacionPresentada: { id: number; descripcion: string }[]
    resolucion: { numero: string; fecha: string; observaciones: string | null; conArchivo: boolean } | null
  }
  avisoDeuda: AvisoDeudaBackend | null
}

/** GET /tramites/anulacion: una anulación en trámite. */
export interface AnulacionEnLista {
  expedienteId: string
  expediente: string
  concesion: { id: string; numero: string | null }
  estado: EstadoAnulacion
  etapa: string
  oficinaActual: Oficina
  titular: string | null
  motivo: string
  creadoEn: string
}

/** Catastro todavía puede «Iniciar anulación» (enviarla) o cancelarla: está en la carga. */
export const estaEnCarga = (estado: EstadoAnulacion, etapa: string) => estado === 'EN_TRAMITE' && etapa === 'CARGA'
