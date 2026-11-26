// Lo que devuelve el backend para Recaudación (deuda y aviso por correo): igual en todos los trámites.

/** Cómo quedó un correo que mandó el sistema (NO_ENVIADO_PRUEBA: no hay servidor de correo configurado). */
export type EstadoEmail = 'ENVIADO' | 'NO_ENVIADO_PRUEBA' | 'ERROR'

/** GET …/recaudacion/aviso-deuda: el correo de cada titular con deuda, con el texto base (editable). */
export interface BorradorAvisoDeuda {
  correos: { personaId: string; titular: string; email: string | null; asunto: string; cuerpo: string }[]
}

/** POST …/recaudacion/notificar-deuda: sin `textos`, el backend usa el texto base. */
export interface NotificarDeudaDto {
  observaciones?: string
  textos?: { personaId: string; asunto: string; cuerpo: string }[]
}

/** Recaudación le dio curso con deuda: su nota y las deudas, con el estado de hoy. */
export interface AvisoDeudaBackend {
  fecha: string
  usuario: string
  observaciones: string
  deudas: { id: string; detalle: string; titular: string; pendiente: boolean; canceladaEn: string | null }[]
  /** false si después se pagó todo. */
  sigueConDeuda: boolean
}

/** GET /tramites/…/:id/recaudacion: lo que verifica Recaudación (igual en todos los trámites). */
export interface AntecedentesDeuda {
  titulares: { personaId: string; nombre: string; documento: string | null }[]
  /** Concesiones otorgadas de los titulares, con todos sus titulares y si tienen deuda (sí / no). */
  concesiones: {
    id: string
    numero: string | null
    departamento: string | null
    localidad: string | null
    titulares: { personaId: string; nombre: string }[]
    /** Cuáles de los titulares del trámite son titulares de esta concesión. */
    deTitulares: string[]
    tieneDeuda: boolean
  }[]
  /** Deudas pendientes registradas sin concesión (de antes). */
  otrasDeudas: { id: string; personaId: string; detalle: string }[]
}

/** POST …/recaudacion/notificar-deuda: a quién se mandó y quién no tiene correo cargado. */
export interface ResultadoAvisoDeuda {
  enviados: { id: string; titular: string; para: string[]; estado: EstadoEmail; error: string | null }[]
  sinCorreo: string[]
}
