import { toApiError } from '@/services/api/errors'

/**
 * El backend avisa así que el número de expediente ya está usado: «El expediente 12/332-2026 ya
 * está registrado.» Los demás 409 (la concesión tiene otro trámite en curso, no está vigente…)
 * son de la concesión, no del número.
 */
export function esNumeroOcupado(error: unknown): boolean {
  const { status, message } = toApiError(error)
  return status === 409 && /^El expediente .+ ya está registrado/.test(message)
}
