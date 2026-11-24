// Respuestas del backend real para el Cambio de Titularidad (GET /tramites/cambio-titularidad…).
// Mismos nombres que devuelve el backend (src/tramites/cambio-titularidad/cambio-titularidad.service.ts).
// Lo de Recaudación (deuda, aviso por correo) es común a los trámites: se reusan los tipos del alta.
import type { AvisoDeudaBackend } from '../AltaDeConcesion/backend.types'

export type { AntecedentesDeuda, AvisoDeudaBackend, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../AltaDeConcesion/backend.types'
import type { Oficina } from '@/types/domain'

/** Una persona (titular actual o propuesto). Los datos sensibles pueden venir ocultos según el permiso. */
export interface PersonaCambio {
  personaId: string
  nombreCompleto: string
  tipoPersona: 'FISICA' | 'JURIDICA'
  tipoDocumento: 'DNI' | 'CUIL' | 'CUIT' | null
  documento: string | null
  apellido: string | null
  nombre: string | null
  fechaNacimiento: string | null
  razonSocial: string | null
  fechaConstitucion: string | null
  email: string | null
  telefono: string | null
}

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

/** POST …/distrito y …/juridico. */
export interface DictamenDto {
  resultado: AptoNoApto
  observaciones?: string
}

/** POST …/resolucion (multipart): los datos de la resolución y el PDF escaneado. */
export interface ResolucionDto {
  numero: string
  anio: number
  fecha: string
  observaciones?: string
  archivo: File
}

/** Dónde está el expediente (resumen común a todos los trámites). */
export interface ResumenExpediente {
  id: string
  numero: string
  tipoTramite: string
  estado: string
  etapa: string
  etapaNombre: string
  oficinaActual: string
  oficinaNombre: string
  tomadoPor: { id: string; nombre: string } | null
  tomadoEn: string | null
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

/** GET /catalogos/documentos/CAMBIO_TITULARIDAD (o ANULACION): un papel del checklist (solo los activos). */
export interface DocumentoChecklist {
  id: number
  tipoTramite: 'CAMBIO_TITULARIDAD' | 'ANULACION' | 'REUBICACION'
  descripcion: string
  obligatorio: boolean
  orden: number
  activo: boolean
}

/** Etapas en las que Catastro edita la propuesta: la carga y la corrección de lo observado (igual que el backend). */
const ETAPAS_DE_CARGA = ['CARGA', 'CORRECCION']

/** Catastro todavía puede editar (o «Continuar») la propuesta del cambio. */
export const estaEnCarga = (estado: EstadoCambio, etapa: string) => estado === 'EN_TRAMITE' && ETAPAS_DE_CARGA.includes(etapa)
