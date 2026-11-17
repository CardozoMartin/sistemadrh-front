// Peticiones de la Subdivisión. Solo hablan con la API (sin estado ni caché): eso lo
// resuelven los hooks de ./hooks.ts con TanStack Query.
import { api } from '@/services/api/client'
import { ApiError } from '@/services/api/errors'
import { filtro } from '@/services/api/jsonServer'
import { datosConcesion, domiciliosDe, titularesDe, titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import type { EstadoExpediente, Expediente, Oficina } from '@/types/domain'
import { expedientesApi } from '../../expedientes/api'
import { preCargaVacia, type PreCargaForm } from '../AltaDeConcesion/schemas'
import { validarInicioSobreConcesion, type InicioSobreConcesionForm } from '../shared/inicioSobreConcesion'
import { fraccionesIniciales } from './fracciones'
import type { BorradorSubdivision, DatosExpedienteSubdivision, FraccionSubdivision, MadreSubdivision } from './types'

const BORRADORES = '/borradoresSubdivision'

/** Ya hay una subdivisión en carga con ese número de expediente o sobre esa concesión. */
export class SubdivisionEnCargaError extends ApiError {
  readonly borradorId: string
  constructor(mensaje: string, borradorId: string) {
    super(mensaje, 409, 'SUBDIVISION_EN_CARGA')
    this.borradorId = borradorId
  }
}

export interface EnviarSubdivisionInput {
  borrador: BorradorSubdivision
  estadosPendientes: EstadoExpediente[]
  /** Etapa que completa Catastro (primera etapa del circuito, de /etapas). */
  etapaId: string
  oficinaOrigen: Oficina
  oficinaDestino: Oficina
  usuarioId: string
}

/** "Lote A (12.50 ha), Lote B (7.50 ha)" para el historial y los listados. */
export const resumenFracciones = (fracciones: FraccionSubdivision[]) => fracciones.map((f) => `${f.nombre} (${f.hectareas.toFixed(2)} ha)`).join(', ')

function madreDe(c: Concesion): MadreSubdivision {
  return {
    coordenadas: c.poligono?.coordenadas ?? [],
    hectareas: c.poligono?.hectareas ?? 0,
    caudal: c.caudalAsignado,
    usoId: c.usoId,
    usos: datosConcesion(c)?.usos.items ?? [],
    titular: titularPrincipal(c),
    padron: datosConcesion(c)?.catastral.padron ?? '',
  }
}

/** Datos de la concesión madre con la forma de la pre carga del Alta (solo esas secciones). */
function baseDe(c: Concesion): PreCargaForm {
  const vacia = preCargaVacia()
  const d = datosConcesion(c)
  if (!d) return { ...vacia, titulares: vacia.titulares, ubicacion: { ...c.ubicacion, poligono: null } }
  return {
    titulares: d.titulares ?? vacia.titulares,
    domicilios: d.domicilios ?? vacia.domicilios,
    ubicacion: { ...(d.ubicacion ?? c.ubicacion), poligono: null },
    catastral: d.catastral ?? vacia.catastral,
    registral: d.registral ?? vacia.registral,
    usos: d.usos ?? vacia.usos,
    suministro: d.suministro ?? vacia.suministro,
  }
}

export const subdivisionApi = {
  async listarBorradores(): Promise<BorradorSubdivision[]> {
    const { data } = await api.get<BorradorSubdivision[]>(BORRADORES, { params: { _sort: '-actualizado' } })
    return data
  },

  async obtenerBorrador(id: string): Promise<BorradorSubdivision> {
    const { data } = await api.get<BorradorSubdivision>(`${BORRADORES}/${id}`)
    return data
  },

  /**
   * Paso 1. Valida el expediente y la concesión (vigente, con polígono y sin otro trámite
   * en curso) y crea la carga con dos fracciones iguales como punto de partida.
   */
  async iniciar(form: InicioSobreConcesionForm, estadosPendientes: EstadoExpediente[]): Promise<BorradorSubdivision> {
    const { numeroExpediente, concesionId } = form
    const { data: mismoNumero } = await api.get<BorradorSubdivision[]>(BORRADORES, { params: filtro({ numeroExpediente }) })
    if (mismoNumero[0]) throw new SubdivisionEnCargaError(`Ya hay una subdivisión en carga con el expediente ${numeroExpediente}.`, mismoNumero[0].id)
    const { data: mismaConcesion } = await api.get<BorradorSubdivision[]>(BORRADORES, { params: filtro({ concesionId }) })
    if (mismaConcesion[0]) throw new SubdivisionEnCargaError('Ya hay una subdivisión en carga para esa concesión.', mismaConcesion[0].id)

    const concesion = await validarInicioSobreConcesion({ numeroExpediente, concesionId, estadosPendientes })
    if (!concesion.poligono || concesion.poligono.coordenadas.length < 3) {
      throw new ApiError('La concesión no tiene polígono cargado: no se puede subdividir.', 409, 'CONCESION_SIN_POLIGONO')
    }

    const madre = madreDe(concesion)
    const ahora = new Date().toISOString()
    const { data } = await api.post<BorradorSubdivision>(BORRADORES, {
      ...form,
      numeroConcesion: concesion.numeroConcesion ?? '',
      madre,
      base: baseDe(concesion),
      fracciones: fraccionesIniciales(madre),
      creado: ahora,
      actualizado: ahora,
    } satisfies Omit<BorradorSubdivision, 'id'>)
    return data
  },

  /** Guarda las fracciones (polígonos y/o datos de cada nueva concesión). */
  async guardarFracciones(id: string, fracciones: FraccionSubdivision[]): Promise<BorradorSubdivision> {
    const { data } = await api.patch<BorradorSubdivision>(`${BORRADORES}/${id}`, { fracciones, actualizado: new Date().toISOString() })
    return data
  },

  async eliminarBorrador(id: string): Promise<void> {
    await api.delete(`${BORRADORES}/${id}`)
  },

  /**
   * Cierra la carga en Catastro: vuelve a validar, crea el expediente en la siguiente
   * oficina y borra la carga. La concesión madre no cambia hasta el cierre.
   */
  async enviar({ borrador, estadosPendientes, etapaId, oficinaOrigen, oficinaDestino, usuarioId }: EnviarSubdivisionInput): Promise<Expediente> {
    const concesion = await validarInicioSobreConcesion({
      numeroExpediente: borrador.numeroExpediente,
      concesionId: borrador.concesionId,
      estadosPendientes,
    })
    const ahora = new Date().toISOString()
    const datos: DatosExpedienteSubdivision = {
      numeroExpediente: borrador.numeroExpediente,
      concesionId: concesion.id,
      numeroConcesion: concesion.numeroConcesion ?? borrador.numeroConcesion,
      titulares: titularesDe(concesion),
      domicilios: domiciliosDe(concesion),
      madre: borrador.madre,
      fracciones: borrador.fracciones,
    }
    const expediente = await expedientesApi.crear({
      numero: borrador.numeroExpediente,
      tramiteId: 'subdivision',
      estadoId: 'en_tramite',
      oficinaId: oficinaDestino,
      fechaInicio: borrador.creado,
      fechaActualizacion: ahora,
      titular: titularPrincipal(concesion),
      // Durante el circuito el expediente muestra la concesión madre; las nuevas se crean al cierre.
      ubicacion: concesion.ubicacion,
      poligono: concesion.poligono,
      usoId: concesion.usoId,
      caudalAsignado: concesion.caudalAsignado,
      numeroConcesion: concesion.numeroConcesion,
      concesionOrigenId: concesion.id,
      resolucion: null,
      padronRentasPendiente: false,
      historial: [
        {
          oficinaId: oficinaOrigen,
          etapaId,
          resultado: 'aprobado',
          fecha: ahora,
          usuarioId,
          observaciones: `Subdivisión en ${borrador.fracciones.length} fracciones: ${resumenFracciones(borrador.fracciones)}.`,
        },
      ],
      datos,
    })
    await subdivisionApi.eliminarBorrador(borrador.id)
    return expediente
  },
}
