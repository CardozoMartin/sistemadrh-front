import { z } from 'zod'
import { mismaPersona } from '@/features/concesiones/datos'
// Schemas directos (no el barril '../shared') para no arrastrar el mapa a la página de inicio.
import { domicilioSchema, domicilioVacio } from '../shared/schemas/domicilio'
import { titularSchema, titularVacio } from '../shared/schemas/titular'

// --- Paso 1: concesión encontrada + expediente asignado (común a los trámites sobre una concesión)

export { inicioSobreConcesionSchema as inicioCambioSchema, type InicioSobreConcesionForm as InicioCambioForm } from '../shared/inicioSobreConcesion'

// --- Paso 2: datos del nuevo titular --------------------------------------------------

const nuevoTitularBase = z.object({
  titulares: z.array(titularSchema).min(1),
  domicilios: z.array(domicilioSchema).min(1),
})

/** Puede quedar algún cotitular actual, pero al menos uno de los titulares tiene que ser nuevo. */
function validarQueCambie(documentosActuales: string[]) {
  return (v: { titulares: { documento: string }[] }, ctx: z.RefinementCtx) => {
    const esActual = (doc: string) => documentosActuales.some((d) => mismaPersona(d, doc))
    if (v.titulares.every((t) => esActual(t.documento))) {
      ctx.addIssue({
        code: 'custom',
        path: ['titulares', 0, 'documento'],
        message: 'Es titular actual de la concesión: cargue los datos del nuevo titular.',
      })
    }
  }
}

/** `documentosActuales`: documentos de los titulares actuales de la concesión. */
export const crearNuevoTitularSchema = (documentosActuales: string[]) => nuevoTitularBase.superRefine(validarQueCambie(documentosActuales))

export type NuevoTitularForm = z.infer<typeof nuevoTitularBase>

export const nuevoTitularVacio = (): NuevoTitularForm => ({ titulares: [titularVacio()], domicilios: [domicilioVacio()] })

// --- Cierre en Catastro: carga final del titular (prototipo CatastroFinalizacion.html) --
// Recién acá, con la resolución firmada y todas las oficinas de acuerdo, se cargan los
// datos definitivos del nuevo titular y la concesión cambia de manos.

const cierreBase = nuevoTitularBase.extend({
  /** Se transcribe de la resolución firmada; tiene que coincidir con la que registró Secretaría General. */
  numeroResolucion: z.string().trim().min(1, 'Ingrese el número de resolución.'),
})

const mismaResolucion = (a: string, b: string) => a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase()

/**
 * `documentosActuales`: titulares actuales de la concesión.
 * `resolucionRegistrada`: N° de resolución cargado por Secretaría General.
 */
export function crearCierreCambioSchema(documentosActuales: string[], resolucionRegistrada: string | null) {
  const queCambie = validarQueCambie(documentosActuales)
  return cierreBase.superRefine((v, ctx) => {
    queCambie(v, ctx)
    if (resolucionRegistrada && v.numeroResolucion && !mismaResolucion(v.numeroResolucion, resolucionRegistrada)) {
      ctx.addIssue({
        code: 'custom',
        path: ['numeroResolucion'],
        message: `No coincide con la resolución registrada por Secretaría General (${resolucionRegistrada}).`,
      })
    }
    // En la carga final el contacto es obligatorio: ahí llegan las notificaciones del trámite.
    v.titulares.forEach((t, i) => {
      if (!t.correo) ctx.addIssue({ code: 'custom', path: ['titulares', i, 'correo'], message: 'Ingrese el correo: se usa para las notificaciones.' })
      if (!t.telefono) ctx.addIssue({ code: 'custom', path: ['titulares', i, 'telefono'], message: 'Ingrese un teléfono de contacto.' })
    })
  })
}

export type CierreCambioForm = z.infer<typeof cierreBase>
