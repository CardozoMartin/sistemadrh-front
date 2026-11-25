// GET /expedientes/:id/historial: el historial es el mismo para cualquier expediente.

/**
 * Lo que resolvió una oficina. Si quien mira es de otra oficina (reservado), solo se sabe
 * quién actuó, dónde y cuándo: sin el tipo, el resultado, las observaciones ni los datos.
 */
export type ActuacionHistorial = {
  tipo: 'ACTUACION'
  fecha: string
  oficina: string
  etapa: string
  usuario: string
} & (
  | { reservado?: false; actuacion: string; resultado: string; observaciones: string | null; datos: Record<string, unknown> | null }
  | { reservado: true; actuacion: null; resultado: null; observaciones: null; datos: null }
)

/** Una entrada del historial: un pase entre oficinas, una actuación de una oficina o un cambio de estado. */
export type EntradaHistorial =
  | {
      tipo: 'PASE'
      fecha: string
      oficinaOrigen: string | null
      oficinaDestino: string
      etapa: string
      enviadoPor: string
      recibidoPor: string | null
      recibidoEn: string | null
      esDevolucion: boolean
      /** true: quien mira no es de la oficina que lo envió ni de la que lo recibe (sin dictamen ni observaciones). */
      reservado?: boolean
      dictamen: string | null
      observaciones: string | null
    }
  | ActuacionHistorial
  | {
      tipo: 'ESTADO'
      fecha: string
      oficina: string
      /** Código del estado nuevo (el nombre sale del catálogo de la base). */
      estado: string
      estadoNombre: string
      estadoAnteriorNombre: string | null
      usuario: string
    }
