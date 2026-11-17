// Circuito del registro de pozo. PROTOTIPO: lo responde el backend emulado
// (services/demo/servidor/registroPozo.ts). Sirve de especificación para el backend.
//
//   Pozos (alta) → Catastro → Distrito (toma conocimiento) → Recaudación → Jurídico → Secretaría General → Pozos (cierre)
import type { EstadoExpedienteBackend } from '@/features/tramites/AltaDeConcesion/backend.types'
import type { AltaPozoOficioDto } from '../AltaDePozo/types'
import type { PozoBackend } from '../BajaDePozo/types'
import type { UsoConcesion } from './caudales'

export type EtapaPozo = 'CATASTRO_POZO' | 'TOMA_CONOCIMIENTO_DISTRITO' | 'RECAUDACION' | 'JURIDICO' | 'SECRETARIA_GENERAL' | 'CORRECCION_POZOS' | 'CIERRE_POZO'
export type OficinaPozo = 'pozos' | 'catastro' | 'distrito' | 'recaudacion' | 'juridico' | 'secretaria_general'

export const CARACTERES_TITULAR = ['TITULAR', 'USUARIO', 'POSEEDOR', 'ARRENDATARIO'] as const

export interface TitularPozo {
  /** Lo pone el servidor (persona única por documento). */
  personaId?: string
  documento: string
  nombre: string
  domicilio: string | null
  caracter: (typeof CARACTERES_TITULAR)[number]
}

/** Lo que completa Catastro (PUT /tramites/registro-pozo/:id/catastro). */
export interface DatosCatastroPozo {
  tipoConcesion: 'DEFINITIVO' | 'PROVISORIA' | null
  numeroConcesion: string | null
  rigeDesde: string | null
  rigeHasta: string | null
  titulares: TitularPozo[]
  catastral: { padron: string | null; circunscripcion: string | null; seccion: string | null; lamina: string | null; parcela: string | null; matricula: string | null; orden: string | null }
  dominio: { matricula: string | null; libro: string | null; folio: string | null; serie: string | null; anio: number | null }
  /** Define si el pozo genera cobro (fuera de servicio: sin cobro). */
  estadoPozo: 'EN_USO' | 'PARADO' | 'FUERA_DE_SERVICIO'
  uso: UsoConcesion | null
}

export interface RegistroPozoBackend {
  expediente: {
    id: string
    numero: string
    estado: EstadoExpedienteBackend
    etapa: EtapaPozo
    etapaNombre: string
    oficinaActual: OficinaPozo
    oficinaNombre: string
    tomadoPor: { id: string; nombre: string } | null
    tomadoEn: string | null
    fechaIngreso: string
  }
  /** La ficha que cargó Pozos en el alta (sin los monitoreos). */
  ficha: Omit<AltaPozoOficioDto, 'coordenada' | 'hidraulico' | 'quimico'> & { sistemaCoordenada: 'POSGAR_FAJA3' | 'WGS84'; registradoPor: string; registradoEn: string }
  pozo: PozoBackend
  /** Caudal de bombeo del último monitoreo hidráulico y régimen declarado (m³/h), para los caudales. */
  caudalM3h: number | null
  regimenM3h: number | null
  catastro: DatosCatastroPozo | null
  /** Siguiente número de concesión libre (referencia para Catastro). */
  numeroSugerido: string
  resolucion: { numero: string; anio: number; fecha: string } | null
  /** Concesión creada al cerrar (null mientras no se cierra o si el pozo no es de jurisdicción DRH). */
  concesion: { id: string; numero: string | null; estado: string } | null
  deudasPendientes: { id: string; persona: string; detalle: string; monto: number | null }[]
}
