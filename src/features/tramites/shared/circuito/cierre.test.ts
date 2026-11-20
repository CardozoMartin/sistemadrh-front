import { describe, expect, it } from 'vitest'
import { faltaEnVerificacionFinal } from './cierre'
import { errorMotivoCancelacion, MIN_MOTIVO_CANCELACION, motivoCancelacionValido } from './motivo'

describe('faltaEnVerificacionFinal (común a cambio de titularidad y anulación)', () => {
  const cotejo = 'los datos del trámite'
  it('la resolución va primero', () => expect(faltaEnVerificacionFinal({ conResolucion: false, cotejado: false }, cotejo)).toMatch(/resolución de Secretaría/))
  it('el mensaje del cotejo dice con qué se coteja', () =>
    expect(faltaEnVerificacionFinal({ conResolucion: true, cotejado: false }, cotejo)).toBe('Confirme que cotejó la resolución con los datos del trámite.'))
  it('con todo, se puede', () => expect(faltaEnVerificacionFinal({ conResolucion: true, cotejado: true }, cotejo)).toBeNull())
})

describe('motivo de cancelación (trámite iniciado por error)', () => {
  it(`al menos ${MIN_MOTIVO_CANCELACION} caracteres, sin contar espacios de los bordes`, () => {
    expect(motivoCancelacionValido('Error de carga')).toBe(true)
    expect(motivoCancelacionValido('   corto    ')).toBe(false)
    expect(motivoCancelacionValido('x'.repeat(MIN_MOTIVO_CANCELACION))).toBe(true)
  })
  it('vacío no muestra error (todavía no escribió nada)', () => expect(errorMotivoCancelacion('')).toBeUndefined())
  it('corto muestra el error; válido, no', () => {
    expect(errorMotivoCancelacion('corto')).toBe(`Explique el motivo (al menos ${MIN_MOTIVO_CANCELACION} caracteres).`)
    expect(errorMotivoCancelacion('Iniciada sobre otra concesión')).toBeUndefined()
  })
})
