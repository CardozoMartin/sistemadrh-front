import { describe, expect, it } from 'vitest'
import { anioDeFecha, estadoDeudaPorPersona, faltaEnDecision, faltaEnDictamen, faltaEnResolucion, hectareas, nombres } from './reglas'

describe('faltaEnDecision (Recaudación)', () => {
  it('apto sin deudas sueltas se puede; no apto exige concesión marcada y motivo', () => {
    expect(faltaEnDecision({ decision: 'APTO', conDeuda: 0, otrasDeudas: 0, observaciones: '' })).toBeNull()
    expect(faltaEnDecision({ decision: 'APTO', conDeuda: 0, otrasDeudas: 1, observaciones: '' })).toMatch(/sin concesión/)
    expect(faltaEnDecision({ decision: 'NO_APTO', conDeuda: 0, otrasDeudas: 0, observaciones: 'x' })).toMatch(/Marque/)
    expect(faltaEnDecision({ decision: 'NO_APTO', conDeuda: 1, otrasDeudas: 0, observaciones: ' ' })).toMatch(/motivo/)
    expect(faltaEnDecision({ decision: 'NO_APTO', conDeuda: 1, otrasDeudas: 0, observaciones: 'Tasa 2025' })).toBeNull()
  })
})

describe('faltaEnDictamen (Distrito / Jurídico)', () => {
  it('Distrito: el informe técnico es obligatorio siempre', () => {
    expect(faltaEnDictamen('APTO', 'corto', true)).toMatch(/observaciones técnicas/)
    expect(faltaEnDictamen('APTO', 'Inspección realizada.', true)).toBeNull()
  })

  it('observado y no apto exigen el motivo; apto en Jurídico no', () => {
    expect(faltaEnDictamen('APTO', '')).toBeNull()
    expect(faltaEnDictamen('OBSERVADO', '')).toMatch(/corregir o completar/)
    expect(faltaEnDictamen('NO_APTO', '')).toMatch(/motivo/)
    expect(faltaEnDictamen('', '')).toBeNull()
  })
})

describe('faltaEnResolucion (Secretaría General)', () => {
  const pdf = { name: 'resolucion.pdf', size: 2048 }
  it('número, fecha no futura y PDF', () => {
    expect(faltaEnResolucion({ numero: '', fecha: '2026-11-20', archivo: pdf }, '2026-11-20')).toMatch(/número/)
    expect(faltaEnResolucion({ numero: '12', fecha: '2026-11-21', archivo: pdf }, '2026-11-20')).toMatch(/futura/)
    expect(faltaEnResolucion({ numero: '12', fecha: '2026-11-20', archivo: null }, '2026-11-20')).toMatch(/Adjunte/)
    expect(faltaEnResolucion({ numero: '12', fecha: '2026-11-20', archivo: { name: 'r.docx', size: 10 } }, '2026-11-20')).toMatch(/PDF/)
    expect(faltaEnResolucion({ numero: '12', fecha: '2026-11-20', archivo: pdf }, '2026-11-20')).toBeNull()
    expect(anioDeFecha('2026-11-20')).toBe(2026)
  })
})

describe('estadoDeudaPorPersona', () => {
  it('cada persona con sus concesiones y deudas; los actuales primero', () => {
    const r = estadoDeudaPorPersona(
      {
        titulares: [
          { personaId: 'n', nombre: 'Nuevo' },
          { personaId: 'a', nombre: 'Actual' },
        ],
        concesiones: [{ id: '1', numero: '906', deTitulares: ['a'], tieneDeuda: true }],
        otrasDeudas: [],
      },
      ['a'],
      ['n'],
    )
    expect(r.map((p) => p.rol)).toEqual(['actual', 'nuevo'])
    expect(r[0].deudas).toEqual(['Concesión N° 906'])
    expect(r[1].concesiones).toEqual([])
  })
})

describe('formato', () => {
  it('nombres y hectáreas', () => {
    expect(nombres([{ nombreCompleto: 'A' }, { nombreCompleto: 'B' }, { nombreCompleto: 'C' }])).toBe('A, B y C')
    expect(hectareas(12.5)).toBe('12,5 ha')
  })
})
