import { describe, expect, it } from 'vitest'
import { hectareas, litrosPorSegundo, nombres, numeroConcesion, ubicacionConcesion } from './formato'

describe('hectareas y litrosPorSegundo', () => {
  it('con coma decimal y hasta 4 / 3 decimales', () => {
    expect(hectareas(21.27345)).toBe('21,2735 ha')
    expect(hectareas(10)).toBe('10 ha')
    expect(litrosPorSegundo(12.5)).toBe('12,5 l/s')
    expect(litrosPorSegundo(0.0456)).toBe('0,046 l/s')
  })
})

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
