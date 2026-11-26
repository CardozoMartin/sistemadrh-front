import { describe, expect, it } from 'vitest'
import { nombres, numeroConcesion, ubicacionConcesion } from './formato'

describe('numeroConcesion y nombres', () => {
  it('usa el número y, si todavía no tiene, el id', () => {
    expect(numeroConcesion({ id: '15', numero: '906' })).toBe('N° 906')
    expect(numeroConcesion({ id: '15', numero: null })).toBe('N° 15')
  })

  it('une los nombres con comas y «y»', () => {
    expect(nombres([])).toBe('')
    expect(nombres([{ nombreCompleto: 'A' }])).toBe('A')
    expect(nombres([{ nombreCompleto: 'A' }, { nombreCompleto: 'B' }, { nombreCompleto: 'C' }])).toBe('A, B y C')
  })
})

describe('ubicacionConcesion', () => {
  it('une lo que hay, sin huecos', () => {
    expect(ubicacionConcesion({ localidad: 'TAFÍ VIEJO', departamento: 'TAFÍ VIEJO', distrito: 'II' })).toBe('TAFÍ VIEJO · TAFÍ VIEJO · II')
    expect(ubicacionConcesion({ localidad: null, departamento: 'CAPITAL', distrito: null })).toBe('CAPITAL')
    expect(ubicacionConcesion({ localidad: null, departamento: null, distrito: null })).toBe('')
  })
})
