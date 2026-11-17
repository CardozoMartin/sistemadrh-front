// Lectura de los datos de una concesión y criterios de búsqueda (sin llamadas a la API).
import type { DatosExpedienteAlta } from '@/features/tramites/AltaDeConcesion/types'
import type { DomicilioForm } from '@/features/tramites/shared/schemas/domicilio'
import { nombreTitular, type TitularForm } from '@/features/tramites/shared/schemas/titular'
import type { Expediente } from '@/types/domain'

/**
 * Concesión vigente. Por ahora es el expediente de alta finalizado: tiene el número de
 * concesión, los titulares, la ubicación y el polígono. Con el backend real será un
 * recurso propio (GET /concesiones) y solo cambia ./api.ts.
 */
export type Concesion = Expediente

export const datosConcesion = (c: Concesion) => c.datos as DatosExpedienteAlta | null
export const titularesDe = (c: Concesion): TitularForm[] => datosConcesion(c)?.titulares ?? []
export const domiciliosDe = (c: Concesion): DomicilioForm[] => datosConcesion(c)?.domicilios ?? []

/** Nombre del titular principal con el mismo formato que los formularios ("Apellido, Nombre"). */
export function titularPrincipal(c: Concesion): string {
  const t = titularesDe(c)[0]
  return t ? nombreTitular(t) : c.titular
}

/** "Apellido, Nombre; Razón social…" de todos los titulares (o el nombre del listado). */
export function nombresTitulares(c: Concesion): string {
  const titulares = titularesDe(c)
  return titulares.length ? titulares.map(nombreTitular).join('; ') : c.titular
}

/** Período en el que un grupo de personas fue titular de la concesión. */
export interface PeriodoTitularidad {
  titulares: TitularForm[]
  desde: string // ISO
  /** null = titulares vigentes. En una concesión anulada, el último llega hasta la baja. */
  hasta: string | null
  /** Expediente que los hizo titulares (el alta o un cambio de titularidad). */
  numeroExpediente: string
  expedienteId: string
}

/**
 * Cadena completa de titulares, del más reciente al primero. Los anteriores no se
 * borran nunca: es lo que un cambio de titularidad tiene que poder demostrar.
 */
export function cadenaTitularidad(c: Concesion): PeriodoTitularidad[] {
  const anteriores = datosConcesion(c)?.titularesAnteriores ?? []
  const otorgada = fechaOtorgamiento(c)
  // Quién originó cada período: el alta para el primero; después, el cambio que cerró el período anterior.
  const origen = (i: number) => (i === 0 ? { numeroExpediente: c.numero, expedienteId: c.id } : { numeroExpediente: anteriores[i - 1].numeroExpediente, expedienteId: anteriores[i - 1].expedienteId })
  const periodos: PeriodoTitularidad[] = anteriores.map((a, i) => ({
    titulares: a.titulares,
    desde: i === 0 ? otorgada : anteriores[i - 1].hasta,
    hasta: a.hasta,
    ...origen(i),
  }))
  // Si la concesión se anuló o se subdividió, el último titular lo fue hasta ese momento.
  periodos.push({ titulares: titularesDe(c), desde: anteriores.at(-1)?.hasta ?? otorgada, hasta: c.bajaConcesion?.fecha ?? c.subdivisionConcesion?.fecha ?? null, ...origen(anteriores.length) })
  return periodos.reverse()
}

/** DNI contenido en un documento: el propio DNI, o los 8 dígitos del medio de un CUIL/CUIT. */
function nucleoDocumento(documento: string): string {
  const digitos = documento.replace(/\D/g, '')
  return digitos.length === 11 ? digitos.slice(2, 10) : digitos.padStart(8, '0')
}

/** Dos documentos (DNI, CUIL o CUIT) corresponden a la misma persona. */
export function mismaPersona(a: string, b: string): boolean {
  return !!a && !!b && nucleoDocumento(a) === nucleoDocumento(b)
}


/** Fecha (ISO) en que se otorgó la concesión: el cierre del alta en Catastro. */
export const fechaOtorgamiento = (c: Concesion): string => c.fechaOtorgamiento ?? c.historial.at(-1)?.fecha ?? c.fechaActualizacion

/** Índice `documentosTitulares` de la concesión: los documentos (solo dígitos) separados por espacio. */
export const indiceDocumentos = (titulares: TitularForm[]): string => titulares.map((t) => t.documento.replace(/\D/g, '')).join(' ')

/** Filtros de la búsqueda de concesiones (los del prototipo cambiodeTitularidad/inicioTramite.html). */
export interface FiltrosConcesion {
  numeroConcesion?: string
  dni?: string
  /** CUIL o CUIT. */
  cuit?: string
  distrito?: string
  /** Rango de fecha de otorgamiento ('AAAA-MM-DD'). */
  desde?: string
  hasta?: string
}

/** Hay al menos un criterio cargado: sin criterios no se busca (son decenas de miles de concesiones). */
export const hayCriterios = (f: FiltrosConcesion): boolean => Object.values(f).some((v) => !!v?.trim())

/**
 * Texto a buscar en `documentosTitulares` para un documento: un CUIL/CUIT completo se
 * busca por su DNI (así encuentra también al titular cargado con DNI); un DNI o un
 * documento parcial, tal cual (un DNI ya está contenido en su CUIL/CUIT).
 */
export function documentoABuscar(documento: string): string {
  const digitos = documento.replace(/\D/g, '')
  return digitos.length === 11 ? nucleoDocumento(digitos).replace(/^0+/, '') : digitos
}

/** Algún titular tiene ese documento (un DNI también encuentra su CUIL/CUIT y viceversa). */
export function tieneDocumento(c: Concesion, documento: string): boolean {
  const doc = documento.replace(/\D/g, '')
  return !doc || titularesDe(c).some((t) => t.documento.includes(doc) || mismaPersona(t.documento, doc))
}
