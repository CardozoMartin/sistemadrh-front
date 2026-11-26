// Respuestas del backend real para la Reubicación (GET /tramites/reubicacion…).
// Mismos nombres que devuelve el backend (src/tramites/reubicacion/reubicacion.service.ts).
// Personas, resumen del expediente, checklist y deuda son comunes a los trámites (shared).
import type { Oficina } from '@/types/domain'
import type { AvisoDeudaBackend } from '../shared/circuito/deuda.types'
import type { ResolucionRegistrada } from '../shared/circuito/resolucion'
import type { PersonaTramite, ResumenExpediente } from '../shared/tipos'

export type { DocumentoChecklist } from '../shared/checklist'

export type EstadoReubicacion = 'EN_TRAMITE' | 'FINALIZADO' | 'RECHAZADO' | 'ANULADO'

export type MotivoReubicacion = 'DIVISION_INMUEBLE' | 'ALTERACION_TERRENO' | 'OTRO'

/** El camino del árbol de suministro (vigente o propuesto). */
export interface SuministroReubicacion {
  fuentes: string[]
  sistemaDistribucion: string | null
  canalPrincipal: string | null
  canalSecundario: string | null
  canalTerciario: string | null
  canalCuarto: string | null
  canalQuinto: string | null
  desague: string | null
  observacion: string | null
}

/** Un punto con sus dos formas (`sistema`: en cuál se cargó). */
export interface PuntoReubicacion {
  sistema: string
  x: number | null
  y: number | null
  latitud: number
  longitud: number
  referencia: string | null
}

/** Polígono (vigente o propuesto) en WGS84. */
/** De dónde salió el polígono propuesto: el KML del plano, el KML ajustado en el mapa o el vigente ajustado. */
export type CargaPoligono = 'KML' | 'KML_AJUSTADO' | 'DIBUJADO'

export interface PoligonoReubicacion {
  geojson: { type: 'MultiPolygon'; coordinates: number[][][][] }
  superficieHa: number
  perimetroM: number
  archivo: { nombre: string; bytes: number; sistemaOrigen: string | null } | null
  /** Solo en el propuesto (null en el vigente). */
  carga?: CargaPoligono | null
}

/** GET /tramites/reubicacion/:id (y lo que devuelve cada acción). */
export interface ReubicacionBackend {
  expediente: ResumenExpediente
  reubicacion: {
    id: string
    estado: EstadoReubicacion
    motivo: MotivoReubicacion
    motivoDetalle: string | null
    /** «División del inmueble» u «Otro: …». */
    motivoTexto: string
    concesion: {
      id: string
      numero: string | null
      estado: string
      fechaOtorgamiento: string | null
      padron: string | null
      /** `distrito` es el código: la clave del árbol de suministro. */
      ubicacion: { departamento: string | null; localidad: string | null; distrito: string | null }
    }
    /** Titulares vigentes (no cambian en una reubicación). */
    titulares: PersonaTramite[]
    documentacionPresentada: { id: number; descripcion: string }[]
    /** Lo que rige hoy: sigue vigente hasta que la reubicación finaliza. */
    vigente: { poligono: PoligonoReubicacion | null; suministro: SuministroReubicacion | null; puntoEntrega: PuntoReubicacion | null }
    /** Lo que propone Catastro (null mientras no se cargó). */
    propuesta: {
      poligono: PoligonoReubicacion | null
      servicio: { suministro: SuministroReubicacion; puntoEntrega: PuntoReubicacion | null } | null
    }
    /** Lo que Catastro tiene que revisar antes de enviarla (no bloquea). */
    avisos: string[]
    cargaCompleta: boolean
    /** Lo que pidió Jurídico al observarla (null si no está observada). */
    observacion: { oficina: string; texto: string | null; fecha: string } | null
    resolucion: ResolucionRegistrada | null
  }
  avisoDeuda: AvisoDeudaBackend | null
}

/** PUT …/:id/poligono: además, los avisos de la lectura del archivo. */
export type ReubicacionConAvisosArchivo = ReubicacionBackend & { avisosArchivo: string[] }

/** GET /tramites/reubicacion: una reubicación en trámite. */
export interface ReubicacionEnLista {
  expedienteId: string
  expediente: string
  concesion: { id: string; numero: string | null }
  estado: EstadoReubicacion
  etapa: string
  oficinaActual: Oficina
  titular: string | null
  motivo: string
  creadoEn: string
}
