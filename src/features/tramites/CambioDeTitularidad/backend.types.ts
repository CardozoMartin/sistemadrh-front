// Respuestas del backend real para el Cambio de Titularidad (GET /tramites/cambio-titularidad…).
// Mismos nombres que devuelve el backend (src/tramites/cambio-titularidad/cambio-titularidad.service.ts).
// Lo común a los trámites (personas, resumen del expediente, checklist, deuda) vive en shared.
import type { Oficina } from '@/types/domain'
import type { AvisoDeudaBackend } from '../shared/circuito/deuda.types'
import type { PersonaTramite as PersonaCambio, ResumenExpediente } from '../shared/tipos'

// Comunes a los trámites (viven en shared); se re-exportan para no cambiar los imports del cambio.
export type { AntecedentesDeuda, AvisoDeudaBackend, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../shared/circuito/deuda.types'
export type { DocumentoChecklist } from '../shared/checklist'
export type { PersonaTramite as PersonaCambio, ResumenExpediente } from '../shared/tipos'

/** Domicilio legal: nombres del catálogo y código del distrito (los mismos valores que el formulario). */
export interface DomicilioCambio {
  calle: string | null
  numero: string | null
  departamento: string | null
  localidad: string | null
  distrito: string | null
}

export type EstadoCambio = 'EN_TRAMITE' | 'FINALIZADO' | 'RECHAZADO' | 'ANULADO'

/** Lo que decide cada oficina (Recaudación, Distrito, Jurídico). */
export type AptoNoApto = 'APTO' | 'NO_APTO'

/** POST …/recaudacion: por cada concesión, si tiene deuda. */
export interface VerificacionDeudaDto {
  resultado: AptoNoApto
  concesiones: { concesionId: string; tieneDeuda: boolean }[]
  observaciones?: string
}

/** POST …/distrito y …/juridico (el panel común; el cambio no ofrece «observado»). */
export type { Dictamen as DictamenDto } from '../shared/circuito/PanelDictamen'

/** POST …/resolucion (multipart): los datos de la resolución y el PDF escaneado. */
export interface ResolucionDto {
  numero: string
  anio: number
  fecha: string
  observaciones?: string
  archivo: File
}

/** GET /tramites/cambio-titularidad/:id (y lo que devuelve cada acción). */
export interface CambioBackend {
  expediente: ResumenExpediente
  cambio: {
    id: string
    estado: EstadoCambio
    /** `padron`: padrón vinculado (el del inmueble vigente), para Recaudación (paso 14). */
    concesion: {
      id: string
      numero: string | null
      estado: string
      fechaOtorgamiento: string | null
      padron: string | null
      /** Dónde está (inmueble vigente): lo que mira Distrito para decidir. */
      ubicacion: { departamento: string | null; localidad: string | null; distrito: string | null }
    }
    /** Lo vigente hoy: con el cambio FINALIZADO, son los nuevos. */
    titularesActuales: PersonaCambio[]
    domiciliosActuales: DomicilioCambio[]
    /** Solo con el cambio FINALIZADO: quiénes eran titulares hasta la resolución. */
    titularesAnteriores: PersonaCambio[]
    nuevosTitulares: PersonaCambio[]
    nuevosDomicilios: DomicilioCambio[]
    cargaCompleta: boolean
    /** Papeles del checklist que trajo el expediente al iniciar. */
    documentacionPresentada: { id: number; descripcion: string }[]
    /** `numero` viene como «N/AAAA». `conArchivo`: hay PDF escaneado para descargar. */
    resolucion: { numero: string; fecha: string; observaciones: string | null; conArchivo: boolean } | null
  }
  /** Recaudación le dio curso con deuda (null: pasó sin deuda o todavía no pasó). */
  avisoDeuda: AvisoDeudaBackend | null
}

/** GET /tramites/cambio-titularidad: un cambio en trámite. */
export interface CambioEnLista {
  expedienteId: string
  expediente: string
  concesion: { id: string; numero: string | null }
  estado: EstadoCambio
  etapa: string
  oficinaActual: Oficina
  nuevoTitular: string | null
  creadoEn: string
}

/** Etapas en las que Catastro edita la propuesta: la carga y la corrección de lo observado (igual que el backend). */
const ETAPAS_DE_CARGA = ['CARGA', 'CORRECCION']

/** Catastro todavía puede editar (o «Continuar») la propuesta del cambio. */
export const estaEnCarga = (estado: EstadoCambio, etapa: string) => estado === 'EN_TRAMITE' && ETAPAS_DE_CARGA.includes(etapa)
