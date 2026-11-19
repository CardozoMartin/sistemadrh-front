// Reglas para iniciar un trámite sobre una concesión vigente (cambio de titularidad,
// anulación…). Con el backend real las valida el servidor y responde 409.
import { concesionesApi } from '@/features/concesiones/api'
import type { Concesion } from '@/features/concesiones/datos'
import { expedientesApi } from '@/features/expedientes/api'
import { ApiError } from '@/services/api/errors'
import type { EstadoExpediente } from '@/types/domain'
import { z } from 'zod'
import { expedienteSchema, formatearExpediente } from './schemas/expediente'

/** Paso 1 de un trámite sobre una concesión: la concesión elegida + el expediente asignado. */
/** El expediente se pide en tres campos; a la salida queda el número completo ("123/332-2026"). */
export const inicioSobreConcesionSchema = z
  .object({
    /** Id de la concesión vigente (ver features/concesiones). */
    concesionId: z.string().min(1, 'Seleccione la concesión.'),
    expediente: expedienteSchema,
  })
  .transform(({ concesionId, expediente }) => ({
    concesionId,
    numeroExpediente: formatearExpediente(expediente),
    /** Las tres partes, como las pide el backend real ({ numero, reparticion, anio }). */
    expediente: { numero: expediente.numero, reparticion: expediente.reparticion, anio: Number(expediente.anio) },
  }))

/** Lo que se edita en el diálogo (expediente en tres campos). */
export type InicioSobreConcesionCampos = z.input<typeof inicioSobreConcesionSchema>
/** `expediente` (las tres partes) viene del diálogo; las pantallas que rearman el inicio desde la URL solo tienen el número completo. */
export type InicioSobreConcesionForm = Omit<z.output<typeof inicioSobreConcesionSchema>, 'expediente'> &
  Partial<Pick<z.output<typeof inicioSobreConcesionSchema>, 'expediente'>>

export interface InicioSobreConcesionInput {
  numeroExpediente: string
  concesionId: string
  /** Estados que cuentan como trámite en curso (de /estados). */
  estadosPendientes: EstadoExpediente[]
}

/**
 * El N° de expediente no puede estar usado, la concesión tiene que estar vigente y sin
 * otro trámite en curso. Devuelve la concesión.
 */
export async function validarInicioSobreConcesion({ numeroExpediente, concesionId, estadosPendientes }: InicioSobreConcesionInput): Promise<Concesion> {
  if (await expedientesApi.buscarPorNumero(numeroExpediente)) {
    throw new ApiError(`El expediente ${numeroExpediente} ya está registrado.`, 409, 'EXPEDIENTE_EXISTENTE')
  }
  const concesion = await concesionesApi.obtener(concesionId)
  const enCurso = await concesionesApi.tramiteEnCurso(concesionId, estadosPendientes)
  if (enCurso) {
    throw new ApiError(
      `La concesión ${concesion.numeroConcesion} tiene un trámite en curso (expediente ${enCurso.numero}). Espere a que finalice.`,
      409,
      'CONCESION_CON_TRAMITE',
    )
  }
  return concesion
}
