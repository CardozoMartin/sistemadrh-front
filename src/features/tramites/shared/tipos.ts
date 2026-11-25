// Tipos del backend comunes a los trámites sobre una concesión (cambio de titularidad, anulación, reubicación…).

/** Una persona (titular actual o propuesto de cualquier trámite). Los datos sensibles pueden venir ocultos según el permiso. */
export interface PersonaTramite {
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
