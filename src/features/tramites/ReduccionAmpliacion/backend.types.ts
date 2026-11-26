// Respuestas del backend real para la Ampliación / Reducción (GET /tramites/ampliacion-reduccion…).
// Mismos nombres que devuelve el backend (src/tramites/ampliacion-reduccion/ampliacion-reduccion.service.ts).
import type { MultiPolygon } from 'geojson'
import type { Oficina } from '@/types/domain'
import type { AvisoDeudaBackend } from '../shared/circuito/deuda.types'
import type { ResolucionRegistrada as ResolucionBackend } from '../shared/circuito/resolucion'
import type { DomicilioTramite as DomicilioBackend, PersonaTramite as PersonaBackend, ResumenExpediente } from '../shared/tipos'

export type { DomicilioBackend, PersonaBackend }

export type TipoModificacionBackend = 'AMPLIACION' | 'REDUCCION'
export type EstadoModificacion = 'EN_TRAMITE' | 'FINALIZADO' | 'RECHAZADO' | 'ANULADO'

/** Un uso de la concesión, antes y después (las magnitudes nuevas son null hasta que se sube el plano). */
export interface UsoModificacion {
  tipoUso: string
  nombre: string
  unidad: string
  magnitudActual: number
  caudalActualLps: number
  magnitudNueva: number | null
  caudalNuevoLps: number | null
}

/** GET /tramites/ampliacion-reduccion/:id (y lo que devuelve cada acción). */
export interface ModificacionBackend {
  expediente: ResumenExpediente
  modificacion: {
    id: string
    tipo: TipoModificacionBackend
    estado: EstadoModificacion
    concesion: {
      id: string
      numero: string | null
      estado: string
      padron: string | null
      ubicacion: { departamento: string | null; localidad: string | null; distrito: string | null }
    }
    superficie: {
      actualHa: number
      /** POLIGONO: medida del polígono vigente; USOS: suma de los usos en hectáreas (no tenía polígono). */
      origenActual: 'POLIGONO' | 'USOS'
      nuevaHa: number | null
      diferenciaHa: number | null
    }
    /** Polígono vigente (WGS84), si la concesión lo tiene. */
    poligonoActual: { geojson: MultiPolygon; superficieHa: number } | null
    /** El plano cargado (WGS84). null hasta que Catastro lo sube. */
    poligonoPropuesto: {
      geojson: MultiPolygon
      superficieHa: number
      perimetroM: number
      sistemaOrigen: string | null
      archivo: { nombre: string; bytes: number }
      avisos: string[]
    } | null
    usos: UsoModificacion[]
    caudal: { actualLps: number | null; nuevoLps: number | null }
    titularesActuales: PersonaBackend[]
    domiciliosActuales: DomicilioBackend[]
    /** Optativo: vacío si la concesión conserva sus titulares. */
    nuevosTitulares: PersonaBackend[]
    nuevosDomicilios: DomicilioBackend[]
    cambiaTitular: boolean
    cargaCompleta: boolean
    documentacionPresentada: { id: number; descripcion: string }[]
    resolucion: ResolucionBackend | null
  }
  avisoDeuda: AvisoDeudaBackend | null
}

/** PUT …/superficie: el trámite actualizado y lo que se informó del plano. */
export type ModificacionConAvisos = ModificacionBackend & { avisos: string[] }

/** GET /tramites/ampliacion-reduccion: un trámite en curso. */
export interface ModificacionEnLista {
  expedienteId: string
  expediente: string
  concesion: { id: string; numero: string | null }
  tipo: TipoModificacionBackend
  estado: EstadoModificacion
  etapa: string
  oficinaActual: Oficina
  superficieActualHa: number
  superficieNuevaHa: number | null
  creadoEn: string
}

/** Etapas en las que Catastro edita la propuesta: la carga y la corrección de lo observado (igual que el backend). */
const ETAPAS_DE_CARGA = ['CARGA', 'CORRECCION']

/** Catastro todavía puede editar (o «Continuar») la propuesta. */
export const estaEnCarga = (estado: EstadoModificacion, etapa: string) => estado === 'EN_TRAMITE' && ETAPAS_DE_CARGA.includes(etapa)

export const NOMBRE_TIPO: Record<TipoModificacionBackend, string> = { AMPLIACION: 'Ampliación', REDUCCION: 'Reducción' }
