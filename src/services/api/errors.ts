import { isAxiosError } from 'axios'

/** Error normalizado de la API: todas las pantallas reciben este tipo. */
export class ApiError extends Error {
  readonly status: number | null
  readonly code: string | undefined

  constructor(message: string, status: number | null, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const MENSAJES_HTTP: Record<number, string> = {
  400: 'La solicitud tiene datos inválidos.',
  401: 'Su sesión expiró. Vuelva a ingresar.',
  403: 'No tiene permisos para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con datos existentes.',
  500: 'Error interno del servidor.',
}

/** Convierte cualquier error (axios, red, código) en un ApiError con mensaje para el usuario. */
const SIN_CONEXION = 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución (npm run start:dev en backend/).'

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    // Pantalla que todavía lee de json-server, en el modo real (services/api/client.ts).
    if (error.code === 'PENDIENTE_MIGRAR') return new ApiError(error.message, null, error.code)
    if (!error.response) return new ApiError(SIN_CONEXION, null, 'NETWORK')
    const { status, data } = error.response
    // 502/503/504: el proxy (o un gateway) no llega a la API.
    if (status === 502 || status === 503 || status === 504) return new ApiError(SIN_CONEXION, status, 'NETWORK')
    const mensajeServidor = typeof data === 'object' && data && 'message' in data ? String(data.message) : undefined
    return new ApiError(mensajeServidor ?? MENSAJES_HTTP[status] ?? `Error inesperado (HTTP ${status}).`, status)
  }
  return new ApiError(error instanceof Error ? error.message : 'Error inesperado.', null)
}

/** Mensaje para mostrar en pantalla a partir de cualquier error. */
export const mensajeDeError = (error: unknown) => toApiError(error).message

export const esNoEncontrado = (error: unknown) => toApiError(error).status === 404
