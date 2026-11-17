// Buscador general de Catastro (prototipo catastro/busquedaCatastro.html): filtra todos los
// expedientes de cualquier circuito, en curso o terminados. Funciones puras, sin API.
import { datosConcesion } from '@/features/concesiones/datos'
import type { DominioContextValue } from '@/hooks/useDominio'
import type { EstadoExpediente, Expediente, TipoTramite } from '@/types/domain'

/** Concesión a la que pertenece el expediente: el alta finalizada (o anulada después) es la concesión misma. */
export function concesionDeExpediente(e: Expediente): string | null {
  if (e.tramiteId === 'alta_concesion') return ['finalizado', 'anulado', 'subdividido'].includes(e.estadoId) && e.numeroConcesion ? e.id : null
  return e.concesionOrigenId ?? null
}

export interface FiltrosBusqueda {
  /** Vista rápida «Todos los trámites»: lista todo sin otro filtro. */
  todos?: boolean
  /** N° de concesión, expediente, titular o trámite. */
  texto?: string
  numeroConcesion?: string
  estadoId?: EstadoExpediente | 'pendientes'
  tramiteId?: TipoTramite
  resolucion?: string
  /** Fecha de la última actualización ('AAAA-MM-DD'). */
  desde?: string
  hasta?: string
  concesionDesde?: string
  concesionHasta?: string
  padron?: string
  circunscripcion?: string
  seccion?: string
  parcela?: string
  matricula?: string
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const contiene = (valor: string | null | undefined, buscado: string | undefined) => !buscado || normalizar(valor ?? '').includes(normalizar(buscado))

export const hayFiltros = (f: FiltrosBusqueda) => Object.values(f).some(Boolean)

/**
 * Filtra en memoria (con el backend real lo hace el servidor). Los datos catastrales
 * se buscan en la concesión del expediente: un cambio de titularidad se encuentra por
 * el padrón de su concesión.
 */
export function buscarExpedientes(todos: Expediente[], f: FiltrosBusqueda, d: DominioContextValue): Expediente[] {
  const porId = new Map(todos.map((e) => [e.id, e]))
  return todos.filter((e) => {
    const concesionId = concesionDeExpediente(e)
    const concesion = concesionId ? porId.get(concesionId) : undefined
    const catastral = (concesion ? datosConcesion(concesion) : datosConcesion(e))?.catastral
    const fecha = e.fechaActualizacion.slice(0, 10)
    const nConcesion = Number(e.numeroConcesion)

    if (f.texto) {
      const texto = [e.numero, e.numeroConcesion, e.titular, d.nombreTramite(e.tramiteId)].join(' ')
      if (!contiene(texto, f.texto)) return false
    }
    if (f.numeroConcesion && !(e.numeroConcesion ?? '').includes(f.numeroConcesion)) return false
    if (f.estadoId === 'pendientes' ? !d.estadosPendientes.includes(e.estadoId) : f.estadoId && e.estadoId !== f.estadoId) return false
    if (f.tramiteId && e.tramiteId !== f.tramiteId) return false
    if (f.resolucion && !contiene(e.resolucion?.numero, f.resolucion)) return false
    if (f.desde && fecha < f.desde) return false
    if (f.hasta && fecha > f.hasta) return false
    if (f.concesionDesde && !(nConcesion >= Number(f.concesionDesde))) return false
    if (f.concesionHasta && !(nConcesion <= Number(f.concesionHasta))) return false
    if (!contiene(catastral?.padron, f.padron)) return false
    if (!contiene(catastral?.circunscripcion, f.circunscripcion)) return false
    if (!contiene(catastral?.seccion, f.seccion)) return false
    if (!contiene(catastral?.parcela, f.parcela)) return false
    if (!contiene(catastral?.matricula, f.matricula)) return false
    return true
  })
}

/** Última observación registrada en el historial (columna "Observación"). */
export function ultimaObservacion(e: Expediente): string {
  return [...e.historial].reverse().find((p) => p.observaciones)?.observaciones ?? ''
}
