import { z } from 'zod'
// Schemas directos (no el barril '../shared') para no arrastrar el mapa a la página de inicio.
import { domicilioSchema, domicilioVacio } from '../shared/schemas/domicilio'
import { expedienteSchema } from '../shared/schemas/expediente'
import { titularSchema, titularVacio, type TitularForm } from '../shared/schemas/titular'
import type { DocumentoChecklist } from '../shared/components/ChecklistDocumentacion'
import type { ModificacionBackend } from './backend.types'

// --- Inicio: concesión elegida + tipo + expediente en papel + checklist ------------------

export const inicioModificacionSchema = z.object({
  /** Id de la concesión vigente (de la búsqueda del backend). */
  concesionId: z.string().min(1, 'Seleccione la concesión.'),
  tipo: z.enum(['AMPLIACION', 'REDUCCION'], { message: 'Indique si es una ampliación o una reducción.' }),
  expediente: expedienteSchema,
  /** Ids de los papeles del checklist que trae el expediente. */
  documentacionPresentada: z.array(z.number()),
})

export type InicioModificacionForm = z.infer<typeof inicioModificacionSchema>

/** Papeles obligatorios sin marcar (el backend controla lo mismo: flujo alterno 4.1). */
export function faltantesDelChecklist<T extends Pick<DocumentoChecklist, 'id' | 'obligatorio'>>(checklist: T[], marcados: number[]): T[] {
  return checklist.filter((d) => d.obligatorio && !marcados.includes(d.id))
}

// --- Carga: nuevos titulares (optativo) ----------------------------------------------

export const titularesSchema = z.object({
  titulares: z.array(titularSchema).min(1),
  domicilios: z.array(domicilioSchema).min(1),
})

export type TitularesForm = z.infer<typeof titularesSchema>

const t = (v: string | null | undefined) => v ?? ''

/** Backend → formulario: los nuevos titulares ya cargados (o uno vacío). */
export function titularesAFormulario({ modificacion: m }: ModificacionBackend): TitularesForm {
  return {
    titulares: m.nuevosTitulares.length
      ? m.nuevosTitulares.map((p) => ({
          tipoPersona: p.tipoPersona === 'JURIDICA' ? 'juridica' : 'fisica',
          tipoDocumento: (p.tipoDocumento?.toLowerCase() ?? 'dni') as TitularForm['tipoDocumento'],
          documento: t(p.documento),
          correo: t(p.email),
          telefono: t(p.telefono),
          apellido: t(p.apellido),
          nombre: t(p.nombre),
          fechaNacimiento: t(p.fechaNacimiento),
          razonSocial: t(p.razonSocial),
          fechaConstitucion: t(p.fechaConstitucion),
        }))
      : [titularVacio()],
    domicilios: m.nuevosDomicilios.length
      ? m.nuevosDomicilios.map((d) => ({ calle: t(d.calle), numero: t(d.numero), departamento: t(d.departamento), localidad: t(d.localidad), distrito: t(d.distrito) }))
      : [domicilioVacio()],
  }
}

// --- El plano ------------------------------------------------------------------------

/** Tope del plano (igual que el backend para KML / GeoJSON). */
export const MAX_MB_PLANO = 5

/** Qué está mal en el archivo antes de subirlo (null: se puede). El backend vuelve a controlar todo. */
export function faltaEnPlano(archivo: { name: string; size: number } | null): string | null {
  if (!archivo) return 'Elija el archivo del plano (KML o GeoJSON).'
  if (/\.kmz$/i.test(archivo.name)) return 'Los KMZ todavía no se aceptan: exporte el polígono como .kml.'
  if (!/\.(kml|geojson|json)$/i.test(archivo.name)) return 'El plano tiene que ser un archivo .kml o .geojson.'
  if (!archivo.size) return 'El archivo está vacío.'
  if (archivo.size > MAX_MB_PLANO * 1024 * 1024) return `El archivo supera los ${MAX_MB_PLANO} MB.`
  return null
}
