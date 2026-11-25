import { describe, expect, it } from 'vitest'
import { faltaEnCierre } from './cierre'
import { nombres } from '../shared/formato'

describe('faltaEnCierre (verificación final en Catastro)', () => {
  it('sin resolución no se finaliza', () => expect(faltaEnCierre({ conResolucion: false, cotejado: true })).toMatch(/resolución/))
  it('hay que confirmar el cotejo', () => expect(faltaEnCierre({ conResolucion: true, cotejado: false })).toMatch(/cotejó/))
  it('con todo, se puede', () => expect(faltaEnCierre({ conResolucion: true, cotejado: true })).toBeNull())
})

describe('nombres', () => {
  it('uno, dos o más', () => {
    expect(nombres([{ nombreCompleto: 'PÉREZ, ANA' }])).toBe('PÉREZ, ANA')
    expect(nombres([{ nombreCompleto: 'A' }, { nombreCompleto: 'B' }, { nombreCompleto: 'C' }])).toBe('A, B y C')
    expect(nombres([])).toBe('')
  })
})
