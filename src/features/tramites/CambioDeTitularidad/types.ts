import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'
import type { NuevoTitularForm } from './schemas'

/**
 * Lo que se guarda en `expediente.datos` para un cambio de titularidad.
 * `titulares`/`domicilios`: durante el circuito son los datos **propuestos** (pre-carga);
 * en la carga final de Catastro pasan a ser los definitivos.
 */
export interface DatosExpedienteCambioTitularidad extends NuevoTitularForm {
  numeroExpediente: string
  concesionId: string
  numeroConcesion: string
  /** Titulares de la concesión al iniciar el trámite (los que dejan de serlo). */
  titularesAnteriores: TitularForm[]
  domiciliosAnteriores: DomicilioForm[]
  /** Carga final del titular en Catastro (con la resolución firmada). */
  cargaFinal?: {
    numeroResolucion: string
    fecha: string // ISO
    /** Lo que se había pre-cargado al iniciar, por si la carga final lo corrigió. */
    propuesto: NuevoTitularForm
  }
}
