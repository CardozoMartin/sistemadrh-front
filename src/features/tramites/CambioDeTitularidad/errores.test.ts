import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/api/errors'
import { esNumeroOcupado } from './errores'

// Regresión: el aviso de «trámite en curso» menciona un expediente y se mostraba como si el
// número cargado estuviera ocupado.
describe('esNumeroOcupado', () => {
  it('solo el número de expediente ya registrado va junto al campo', () => {
    expect(esNumeroOcupado(new ApiError('El expediente 12026/332-2026 ya está registrado.', 409))).toBe(true)
  })

  it('los demás 409 son de la concesión', () => {
    expect(esNumeroOcupado(new ApiError('La concesión N° 906 tiene un trámite en curso (Cambio de titularidad, expediente 12026/332-2026). Espere a que finalice.', 409))).toBe(false)
    expect(esNumeroOcupado(new ApiError('La concesión N° 906 no está vigente (anulada): no admite un cambio de titularidad.', 409))).toBe(false)
  })

  it('el mismo texto con otro código no cuenta', () => {
    expect(esNumeroOcupado(new ApiError('El expediente 12026/332-2026 ya está registrado.', 400))).toBe(false)
    expect(esNumeroOcupado(new Error('sin conexión'))).toBe(false)
  })
})
