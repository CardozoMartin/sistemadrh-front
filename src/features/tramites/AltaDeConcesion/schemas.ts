import { z } from 'zod'
import type { UsoInfo } from '@/types/domain'
// Se importan los schemas directo (no desde el barril '../shared') para que la
// página de inicio no arrastre componentes pesados como el mapa.
import { catastralSchema, catastralVacio } from '../shared/schemas/catastral'
import { domicilioSchema, domicilioVacio, ubicacionSchema } from '../shared/schemas/domicilio'
import { expedienteSchema, formatearExpediente } from '../shared/schemas/expediente'
import { poligonoSchema } from '../shared/schemas/poligono'
import { registralSchema, registralVacio } from '../shared/schemas/registral'
import { suministroSchema, suministroVacio } from '../shared/schemas/suministro'
import { titularSchema, titularVacio } from '../shared/schemas/titular'
import { crearUsosSchema, usosVacio } from '../shared/schemas/usos'

// --- Paso 1: inicio del alta ------------------------------------------------

/** El formulario pide el expediente en tres campos; a la salida queda el número completo ("123/332-2026"). */
export const inicioAltaSchema = z
  .object({
    expediente: expedienteSchema,
    /** Id de /situacionesLegales. */
    situacionLegalId: z.string({ error: 'Seleccione la situación legal del solicitante.' }).min(1, 'Seleccione la situación legal del solicitante.'),
    documentacionPresentada: z.array(z.string()),
  })
  .transform(({ expediente, ...resto }) => ({ ...resto, numeroExpediente: formatearExpediente(expediente) }))

/** Lo que se edita en pantalla (expediente en tres campos). */
export type InicioAltaCampos = z.input<typeof inicioAltaSchema>
/** Lo que se envía y se guarda en el borrador. */
export type InicioAltaForm = z.output<typeof inicioAltaSchema>

// --- Paso 2: pre carga de datos (6 secciones) -----------------------------------
// Los bloques salen de tramites/shared; acá solo se arma la forma del formulario del alta.
// Es una fábrica porque algunas reglas dependen de datos de la API (ej: qué usos
// exigen punto de entrega).

export function crearPreCargaSchema(dominio: { usos: UsoInfo[] }) {
  return z.object({
    // 1. Titular
    titulares: z.array(titularSchema).min(1),
    domicilios: z.array(domicilioSchema).min(1),
    // 2. Ubicación del inmueble + polígono de la concesión
    ubicacion: ubicacionSchema.extend({ poligono: poligonoSchema.nullable() }),
    // 3. Catastral
    catastral: catastralSchema,
    // 4. Registral
    registral: registralSchema,
    // 5. Usos
    usos: crearUsosSchema(dominio.usos.filter((u) => u.requierePuntoEntrega).map((u) => u.id)),
    // 6. Suministro
    suministro: suministroSchema,
  })
}

export type PreCargaForm = z.infer<ReturnType<typeof crearPreCargaSchema>>

export const preCargaVacia = (): PreCargaForm => ({
  titulares: [titularVacio()],
  domicilios: [domicilioVacio()],
  ubicacion: { departamento: '', localidad: '', distrito: '', poligono: null },
  catastral: catastralVacio(),
  registral: registralVacio(),
  usos: usosVacio(),
  suministro: suministroVacio(),
})

/** Completa un borrador guardado con una versión anterior del formulario (secciones nuevas vacías). */
export function completarPreCarga(datos: Partial<PreCargaForm> | undefined): PreCargaForm {
  return { ...preCargaVacia(), ...datos }
}
