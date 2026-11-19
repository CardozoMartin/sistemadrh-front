import { describe, expect, it } from 'vitest'
import { anioActual } from '../shared/schemas/expediente'
import { crearNuevoTitularSchema, faltantesDelChecklist, inicioCambioSchema, nuevoTitularVacio } from './schemas'

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

describe('inicio del cambio', () => {
  const valido = { concesionId: '15', expediente: { numero: '123', reparticion: '332', anio: anioActual() }, documentacionPresentada: [1, 3] }

  it('acepta la concesión, el expediente del año en curso y los papeles marcados', () => {
    expect(inicioCambioSchema.safeParse(valido).success).toBe(true)
  })

  it('exige elegir la concesión', () => {
    const r = inicioCambioSchema.safeParse({ ...valido, concesionId: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Seleccione la concesión.')
  })

  it('el expediente tiene que ser del año en curso', () => {
    const r = inicioCambioSchema.safeParse({ ...valido, expediente: { ...valido.expediente, anio: '2020' } })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('El expediente tiene que ser del año en curso.')
  })
})

describe('nuevo titular (pasos 6-8)', () => {
  const titular = {
    ...nuevoTitularVacio().titulares[0],
    tipoPersona: 'fisica' as const,
    tipoDocumento: 'dni' as const,
    documento: '30123456',
    apellido: 'PÉREZ',
    nombre: 'JUAN',
    fechaNacimiento: '1980-05-10',
    correo: 'juan@ejemplo.com',
    telefono: '3815551234',
  }
  const domicilio = { calle: 'Av. Siempreviva', numero: '742', departamento: 'CAPITAL', localidad: 'SAN MIGUEL DE TUCUMAN', distrito: 'I' }

  it('acepta un titular nuevo con su domicilio', () => {
    expect(crearNuevoTitularSchema(['20111111']).safeParse({ titulares: [titular], domicilios: [domicilio] }).success).toBe(true)
  })

  it('rechaza que el nuevo sea el titular actual (también si se carga con su CUIL)', () => {
    for (const documento of ['30123456', '20301234569']) {
      const r = crearNuevoTitularSchema(['30123456']).safeParse({ titulares: [{ ...titular, documento, tipoDocumento: documento.length === 11 ? 'cuil' : 'dni' }], domicilios: [domicilio] })
      expect(r.success).toBe(false)
      expect(r.error?.issues.some((i) => i.message.startsWith('Es titular actual de la concesión'))).toBe(true)
    }
  })

  it('puede quedar un cotitular actual si entra uno nuevo', () => {
    const otro = { ...titular, documento: '28999888' }
    expect(crearNuevoTitularSchema(['30123456']).safeParse({ titulares: [titular, otro], domicilios: [domicilio] }).success).toBe(true)
  })
})
