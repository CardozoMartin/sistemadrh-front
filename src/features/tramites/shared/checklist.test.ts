import { describe, expect, it } from 'vitest'
import { faltantesDelChecklist } from './checklist'

const checklist = [
  { id: 1, descripcion: 'CUIT / CUIL', obligatorio: true },
  { id: 2, descripcion: 'Poder (si firma un apoderado)', obligatorio: false },
  { id: 3, descripcion: 'Libre deuda de tasa de uso de agua', obligatorio: true },
]

describe('checklist de documentación (pasos 4-5, flujo alterno 4.1)', () => {
  it('con todos los obligatorios no falta nada (los opcionales pueden faltar)', () => {
    expect(faltantesDelChecklist(checklist, [1, 3])).toEqual([])
    expect(faltantesDelChecklist(checklist, [3, 2, 1])).toEqual([])
  })

  it('devuelve los obligatorios sin marcar, en el orden del checklist', () => {
    expect(faltantesDelChecklist(checklist, []).map((d) => d.descripcion)).toEqual(['CUIT / CUIL', 'Libre deuda de tasa de uso de agua'])
    expect(faltantesDelChecklist(checklist, [2, 3]).map((d) => d.descripcion)).toEqual(['CUIT / CUIL'])
  })
})
