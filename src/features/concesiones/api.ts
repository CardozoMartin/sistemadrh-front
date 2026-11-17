// Peticiones de concesiones vigentes. Solo hablan con la API; el cacheo lo hacen los hooks.
import { api } from '@/services/api/client'
import { ApiError } from '@/services/api/errors'
import { filtro, leerPagina, paginacion, type Pagina, type RespuestaPaginada } from '@/services/api/jsonServer'
import type { PreCargaForm } from '@/features/tramites/AltaDeConcesion/schemas'
import type { DatosExpedienteAlta, SuperficieAnterior, TitularidadAnterior } from '@/features/tramites/AltaDeConcesion/types'
import type { DomicilioForm } from '@/features/tramites/shared/schemas/domicilio'
import { nombreTitular, type TitularForm } from '@/features/tramites/shared/schemas/titular'
import type { BajaConcesion, ConcesionDerivada, EstadoExpediente, Expediente, Oficina } from '@/types/domain'
import { datosConcesion, documentoABuscar, indiceDocumentos, tieneDocumento, type Concesion, type FiltrosConcesion } from './datos'

/** Hoy una concesión vigente es un alta finalizada (ver ./datos.ts). */
const VIGENTES = { tramiteId: 'alta_concesion', estadoId: 'finalizado' } as const
/** Condición de json-server para «concesión vigente» (con número asignado). */
const condicionVigentes = { tramiteId: { eq: VIGENTES.tramiteId }, estadoId: { eq: VIGENTES.estadoId }, numeroConcesion: { ne: null } }

/** Resultados por página en la búsqueda de concesiones. */
export const CONCESIONES_POR_PAGINA = 20

/**
 * Condición de búsqueda para json-server. Los documentos se buscan en el índice
 * `documentosTitulares` (json-server no filtra dentro del array de titulares) y solo
 * admite una condición por campo: si se cargan DNI y CUIT, el CUIT se aplica después.
 */
function condicionBusqueda(f: FiltrosConcesion) {
  const documento = documentoABuscar(f.dni || f.cuit || '')
  const fecha = { ...(f.desde && { gte: f.desde }), ...(f.hasta && { lte: `${f.hasta}T23:59:59.999Z` }) }
  return {
    _where: JSON.stringify({
      ...condicionVigentes,
      ...(f.numeroConcesion?.trim() && { numeroConcesion: { ne: null, contains: f.numeroConcesion.trim() } }),
      ...(f.distrito && { ubicacion: { distrito: { eq: f.distrito } } }),
      ...(documento && { documentosTitulares: { contains: documento } }),
      ...(Object.keys(fecha).length && { fechaOtorgamiento: fecha }),
    }),
  }
}

export interface CambioTitularesInput {
  concesion: Concesion
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
  /** Expediente de cambio de titularidad que lo resuelve. */
  expediente: Pick<Expediente, 'id' | 'numero'>
}

export interface AnularInput {
  concesion: Concesion
  baja: BajaConcesion
}

/** Una fracción de una subdivisión, lista para ser concesión. */
export interface FraccionAOtorgar {
  /** Nombre de la fracción (ej: "Lote A"). */
  fraccion: string
  numeroConcesion: string
  coordenadas: [number, number][]
  hectareas: number
  /** Datos de la nueva concesión (los del Alta). */
  carga: PreCargaForm
}

export interface SubdividirInput {
  madre: Concesion
  expediente: Pick<Expediente, 'id' | 'numero' | 'resolucion' | 'fechaInicio'>
  fracciones: FraccionAOtorgar[]
  /** Etapa, oficina y usuario del cierre (quedan en el historial de cada concesión nueva). */
  etapaId: string
  oficinaId: Oficina
  usuarioId: string
}

export interface ModificarSuperficieInput {
  concesion: Concesion
  tipo: SuperficieAnterior['tipo']
  nueva: { coordenadas: [number, number][]; hectareas: number; caudal: number | null; usos: { uso: string; magnitud: string }[] }
  expediente: Pick<Expediente, 'id' | 'numero' | 'resolucion'>
}

export const concesionesApi = {
  /**
   * Búsqueda paginada de concesiones vigentes: la hace el servidor, nunca se descargan
   * todas. Futuro: GET /concesiones?numero=&documento=&distrito=&desde=&hasta=&page=
   */
  async buscarVigentes(filtros: FiltrosConcesion, pagina: number): Promise<Pagina<Concesion>> {
    const { data } = await api.get<RespuestaPaginada<Concesion>>('/expedientes', {
      params: { ...condicionBusqueda(filtros), _sort: 'numeroConcesion', ...paginacion(pagina, CONCESIONES_POR_PAGINA) },
    })
    const resultado = leerPagina(data, pagina)
    // DNI y CUIT a la vez: el segundo se aplica sobre la página recibida.
    return filtros.dni && filtros.cuit ? { ...resultado, items: resultado.items.filter((c) => tieneDocumento(c, filtros.cuit!)) } : resultado
  },

  /** Concesiones vigentes de un departamento (para controlar superposición de polígonos). */
  async vigentesDelDepartamento(departamento: string): Promise<Concesion[]> {
    const { data } = await api.get<Concesion[]>('/expedientes', {
      params: { _where: JSON.stringify({ ...condicionVigentes, ubicacion: { departamento: { eq: departamento } } }) },
    })
    return data
  },

  async obtener(id: string): Promise<Concesion> {
    const { data } = await api.get<Concesion>(`/expedientes/${id}`)
    if (data.tramiteId !== VIGENTES.tramiteId || data.estadoId !== VIGENTES.estadoId || !data.numeroConcesion) {
      throw new ApiError('El expediente no corresponde a una concesión vigente.', 404, 'CONCESION_NO_VIGENTE')
    }
    return data
  },

  /** Todos los trámites que se hicieron sobre la concesión (en curso y terminados), sin el alta. */
  async tramites(concesionId: string): Promise<Expediente[]> {
    const { data } = await api.get<Expediente[]>('/expedientes', { params: { ...filtro({ concesionOrigenId: concesionId }), _sort: 'fechaInicio' } })
    return data
  },

  /** Trámites en curso sobre varias concesiones (las de una página de resultados). */
  async tramitesEnCurso(concesionIds: string[], estadosPendientes: EstadoExpediente[]): Promise<Expediente[]> {
    if (!concesionIds.length) return []
    const { data } = await api.get<Expediente[]>('/expedientes', {
      params: filtro({ concesionOrigenId: { in: concesionIds }, estadoId: { in: estadosPendientes } }),
    })
    return data
  },

  /** Trámite que ya está en curso sobre la concesión (solo puede haber uno a la vez). */
  async tramiteEnCurso(concesionId: string, estadosPendientes: EstadoExpediente[]): Promise<Expediente | null> {
    const { data } = await api.get<Expediente[]>('/expedientes', {
      params: filtro({ concesionOrigenId: concesionId, estadoId: { in: estadosPendientes } }),
    })
    return data[0] ?? null
  },

  /**
   * Baja lógica: la concesión pasa a estado `anulado` (deja de ser vigente) y guarda
   * cuándo, por qué expediente y con qué resolución. Nunca se borra.
   */
  async anular({ concesion, baja }: AnularInput): Promise<Concesion> {
    const { data } = await api.patch<Concesion>(`/expedientes/${concesion.id}`, {
      estadoId: 'anulado',
      bajaConcesion: baja,
      fechaActualizacion: baja.fecha,
    })
    return data
  },

  /**
   * Aplica la nueva superficie (polígono, hectáreas, caudal y magnitud de los usos) y
   * guarda la anterior en `datos.superficiesAnteriores` (no se pisa).
   */
  async modificarSuperficie({ concesion, tipo, nueva, expediente }: ModificarSuperficieInput): Promise<Concesion> {
    const datos = datosConcesion(concesion)
    const ahora = new Date().toISOString()
    const anterior: SuperficieAnterior = {
      tipo,
      coordenadas: concesion.poligono?.coordenadas ?? [],
      hectareas: concesion.poligono?.hectareas ?? 0,
      caudal: concesion.caudalAsignado,
      hectareasNueva: nueva.hectareas,
      caudalNuevo: nueva.caudal,
      fecha: ahora,
      expedienteId: expediente.id,
      numeroExpediente: expediente.numero,
      resolucion: expediente.resolucion,
    }
    const { data } = await api.patch<Concesion>(`/expedientes/${concesion.id}`, {
      poligono: { coordenadas: nueva.coordenadas, hectareas: nueva.hectareas },
      caudalAsignado: nueva.caudal,
      datos: datos && {
        ...datos,
        ubicacion: {
          ...datos.ubicacion,
          poligono: {
            nombreArchivo: `modificacion-${expediente.numero}.kml`,
            tamanioBytes: datos.ubicacion.poligono?.tamanioBytes ?? 0,
            coordenadas: nueva.coordenadas,
            hectareas: nueva.hectareas,
          },
        },
        usos: { ...datos.usos, items: nueva.usos.length ? nueva.usos : datos.usos.items },
        suministro: { ...datos.suministro, caudalAsignado: nueva.caudal == null ? datos.suministro.caudalAsignado : String(nueva.caudal) },
        superficiesAnteriores: [...(datos.superficiesAnteriores ?? []), anterior],
      },
    })
    return data
  },

  /**
   * Subdivisión: crea una concesión nueva por fracción (con su número, titular, polígono y
   * caudal) y la madre pasa a `subdividido` con la referencia a las nuevas. Nada se borra.
   * Si se reintenta, no duplica las concesiones ya creadas. Con el backend real va en una
   * sola transacción.
   */
  async subdividir({ madre, expediente, fracciones, etapaId, oficinaId, usuarioId }: SubdividirInput): Promise<Concesion> {
    const ahora = new Date().toISOString()
    const datosMadre = datosConcesion(madre)
    // Las nuevas comparten el N° de expediente de la subdivisión (json-server no filtra bien por campos anidados opcionales).
    const { data: mismoExpediente } = await api.get<Concesion[]>('/expedientes', { params: filtro({ numero: expediente.numero, tramiteId: 'alta_concesion' }) })
    const yaCreadas = mismoExpediente.filter((c) => datosConcesion(c)?.origen?.expedienteId === expediente.id)

    const derivadas: ConcesionDerivada[] = []
    for (const f of fracciones) {
      let concesion = yaCreadas.find((c) => c.numeroConcesion === f.numeroConcesion)
      if (!concesion) {
        const caudal = Number(f.carga.suministro.caudalAsignado)
        const datos: DatosExpedienteAlta = {
          numeroExpediente: expediente.numero,
          situacionLegalId: datosMadre?.situacionLegalId ?? 'titular',
          documentacionPresentada: [],
          ...f.carga,
          origen: {
            tipo: 'subdivision',
            concesionMadreId: madre.id,
            numeroConcesionMadre: madre.numeroConcesion ?? '',
            expedienteId: expediente.id,
            numeroExpediente: expediente.numero,
            fraccion: f.fraccion,
          },
        }
        const { data } = await api.post<Concesion>('/expedientes', {
          numero: expediente.numero,
          tramiteId: 'alta_concesion',
          estadoId: 'finalizado',
          oficinaId,
          fechaInicio: expediente.fechaInicio,
          fechaActualizacion: ahora,
          titular: nombreTitular(f.carga.titulares[0]),
          ubicacion: { departamento: f.carga.ubicacion.departamento, localidad: f.carga.ubicacion.localidad, distrito: f.carga.ubicacion.distrito },
          poligono: { coordenadas: f.coordenadas, hectareas: f.hectareas },
          usoId: f.carga.usos.items[0]?.uso || madre.usoId,
          caudalAsignado: f.carga.suministro.caudalAsignado && Number.isFinite(caudal) ? caudal : null,
          numeroConcesion: f.numeroConcesion,
          resolucion: expediente.resolucion,
          padronRentasPendiente: true,
          concesionOrigenId: null,
          fechaOtorgamiento: ahora,
          documentosTitulares: indiceDocumentos(f.carga.titulares),
          historial: [
            {
              oficinaId,
              etapaId,
              resultado: 'aprobado',
              fecha: ahora,
              usuarioId,
              observaciones: `Concesión otorgada por subdivisión de la N° ${madre.numeroConcesion} (${f.fraccion}, expediente ${expediente.numero}).`,
            },
          ],
          recepciones: [],
          datos,
        } satisfies Omit<Expediente, 'id'>)
        concesion = data
      }
      derivadas.push({ id: concesion.id, numeroConcesion: f.numeroConcesion, fraccion: f.fraccion, hectareas: f.hectareas })
    }

    const { data } = await api.patch<Concesion>(`/expedientes/${madre.id}`, {
      estadoId: 'subdividido',
      fechaActualizacion: ahora,
      subdivisionConcesion: {
        fecha: ahora,
        expedienteId: expediente.id,
        numeroExpediente: expediente.numero,
        resolucion: expediente.resolucion,
        concesiones: derivadas,
      },
    })
    return data
  },

  /**
   * Reemplaza los titulares de la concesión y guarda los anteriores (no se borran).
   * Con el backend real lo hace el servidor al cerrar el cambio de titularidad.
   */
  async cambiarTitulares({ concesion, titulares, domicilios, expediente }: CambioTitularesInput): Promise<Concesion> {
    const datos = datosConcesion(concesion)
    const anterior: TitularidadAnterior = {
      titulares: datos?.titulares ?? [],
      domicilios: datos?.domicilios ?? [],
      hasta: new Date().toISOString(),
      expedienteId: expediente.id,
      numeroExpediente: expediente.numero,
    }
    const { data } = await api.patch<Concesion>(`/expedientes/${concesion.id}`, {
      titular: nombreTitular(titulares[0]),
      documentosTitulares: indiceDocumentos(titulares),
      datos: { ...datos, titulares, domicilios, titularesAnteriores: [...(datos?.titularesAnteriores ?? []), anterior] },
    })
    return data
  },
}
