// Contrato del registro de pozo de oficio. Hoy lo responde el backend emulado del modo demo
// (services/demo/servidor/pozos.ts): sirve de especificación para cuando se haga en el backend.
import type { PozoBackend } from '../BajaDePozo/types'

type Coordenada = { x: number; y: number } | { latitud: number; longitud: number }

/** POST /pozos/oficio */
export interface AltaPozoOficioDto {
  motivo: string
  causante: string
  domicilio: string | null
  /** DNI o CUIT, solo dígitos. */
  documento: string | null
  telefono: string | null
  empresa: string | null
  fechaIngreso: string
  asunto: string | null
  jurisdiccionDrh: boolean
  estado: 'EN_USO' | 'PARADO' | 'FUERA_DE_SERVICIO'
  /** Solicitante del servicio: nombre, razón social o alias operativo. */
  alias: string | null
  telefonoServicio: string | null
  ubicacion: {
    cuencaSuperficial: string | null
    cuencaSubterranea: string | null
    paraje: string | null
    comuna: string | null
    zona: string | null
    departamento: string
    localidad: string
    distrito: string
    /** Metros sobre el nivel del mar. */
    cota: number | null
  }
  /** X/Y POSGAR 2007 faja 3 o latitud/longitud: el servidor calcula la otra forma (criterio único). */
  coordenada: Coordenada
  nombrePozo: string | null
  caracteristicas: string | null
  litologia: { desde: number; hasta: number; tipo: string; observacion: string | null }[]
  construccion: {
    profundidad: number | null
    tramos: { desde: number; hasta: number; material: string | null; diametro: number | null }[]
    filtros: { desde: number; hasta: number; diametro: number | null; aberturas: number | null }[]
  }
  equipo: { profundidadBomba: number | null; nivelCementacion: number | null; tipoBomba: string | null; regimenM3h: number | null }
  /** Primer monitoreo hidráulico (queda en el historial con su fecha). */
  hidraulico: { fecha: string; nivelEstatico: number | null; nivelDinamico: number | null; caudalM3h: number | null } | null
  usos: { uso: string; cantidad: number; unidad: string }[]
  /** Primer informe químico (queda en el historial con su fecha). */
  quimico: { fecha: string; parametros: { parametro: string; tipoResultado: 'VALOR' | 'MENOR'; simbolo: string | null; resultado: string; unidad: string | null; observacion: string | null }[] } | null
  observaciones: string | null
}

export interface AltaPozoOficioRespuesta {
  /** Número que le dio el sistema al registro de oficio (ej: «OF-0001/2026»). */
  expediente: string
  /** Expediente del circuito (queda en Catastro). */
  expedienteId: string
  pozo: PozoBackend
}
