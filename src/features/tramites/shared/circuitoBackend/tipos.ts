// Tipos del circuito por las oficinas contra el BACKEND REAL, comunes a los trámites sobre una
// concesión (ampliación / reducción; el cambio de titularidad tiene los suyos, iguales, en su carpeta).
// Lo de Recaudación (deuda, aviso por correo) es común a todos: se reusan los tipos del alta.
export type { AntecedentesDeuda, AvisoDeudaBackend, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from '../../AltaDeConcesion/backend.types'

/** Lo que decide Recaudación. */
export type AptoNoApto = 'APTO' | 'NO_APTO'

/** Lo que decide Distrito o Jurídico: OBSERVADO devuelve el expediente a Catastro para corregir o completar. */
export type ResultadoDictamen = 'APTO' | 'OBSERVADO' | 'NO_APTO'

/** POST …/recaudacion: por cada concesión, si tiene deuda. */
export interface VerificacionDeudaDto {
  resultado: AptoNoApto
  concesiones: { concesionId: string; tieneDeuda: boolean }[]
  observaciones?: string
}

/** POST …/distrito y …/juridico. */
export interface DictamenDto {
  resultado: ResultadoDictamen
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

/** POST …/verificacion-final: Catastro cierra el trámite. */
export interface VerificacionFinalDto {
  observaciones?: string
  /** Ampliación / reducción: el caudal asignado (l/s) que fijó la resolución. */
  caudalAsignadoLps?: number
}

/** Dónde está el expediente (resumen común a todos los trámites: ExpedientesService.resumen). */
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

/** Una persona (titular actual o propuesto). Los datos sensibles pueden venir ocultos según el permiso. */
export interface PersonaBackend {
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
export interface DomicilioBackend {
  calle: string | null
  numero: string | null
  departamento: string | null
  localidad: string | null
  distrito: string | null
}

/** Resolución de Secretaría General. `numero` viene como «N/AAAA». `conArchivo`: hay PDF escaneado. */
export interface ResolucionBackend {
  numero: string
  fecha: string
  observaciones: string | null
  conArchivo: boolean
}

/** Lo que se muestra al terminar una acción de la oficina (caso de uso: «trámite enviado»). */
export interface Terminado {
  titulo: string
  mensaje: string
}
