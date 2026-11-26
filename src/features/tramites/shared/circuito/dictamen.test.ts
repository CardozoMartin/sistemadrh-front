import { describe, expect, it } from 'vitest'
import { faltaEnDictamen } from './dictamen'

describe('dictamen de Jurídico (observaciones solo si no apto)', () => {
  it('apto no exige observaciones', () => {
    expect(faltaEnDictamen('APTO', '')).toBeNull()
  })

  it('no apto exige el motivo', () => {
    expect(faltaEnDictamen('NO_APTO', '')).toContain('motivo')
    expect(faltaEnDictamen('NO_APTO', '   ')).toContain('motivo')
    expect(faltaEnDictamen('NO_APTO', 'Falta el poder del apoderado')).toBeNull()
  })

  it('observado exige qué corregir', () => {
    expect(faltaEnDictamen('OBSERVADO', '')).toContain('corregir')
    expect(faltaEnDictamen('OBSERVADO', 'Falta el informe de registro inmobiliario')).toBeNull()
  })

  it('sin elegir todavía no hay nada que avisar', () => {
    expect(faltaEnDictamen('', '')).toBeNull()
  })
})

describe('dictamen de Distrito: observaciones técnicas obligatorias (paso 20)', () => {
  it('también con «apto»', () => {
    expect(faltaEnDictamen('APTO', '', true)).toContain('observaciones técnicas')
    expect(faltaEnDictamen('NO_APTO', '', true)).toContain('observaciones técnicas')
  })

  it('al menos 10 caracteres', () => {
    expect(faltaEnDictamen('APTO', '  corto  ', true)).toContain('al menos 10')
    expect(faltaEnDictamen('APTO', 'Hay caudal disponible en el canal.', true)).toBeNull()
  })
})
