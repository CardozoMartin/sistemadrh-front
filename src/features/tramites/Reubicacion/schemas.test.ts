import { describe, expect, it } from 'vitest'
import { coordenadaVacia } from '@/lib/coordenadas'
import { suministroVacio } from '../shared/schemas/suministro'
import { anioActual } from '../shared/schemas/expediente'
import { detalleValido, inicioReubicacionSchema, servicioReubicacionSchema } from './schemas'

const mensajes = (r: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) => r.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? []

const inicio = (cambios: object = {}) => ({
  concesionId: '15',
  expediente: { numero: '856', reparticion: '332', anio: String(anioActual()) },
  documentacionPresentada: [1, 6],
  motivo: 'DIVISION_INMUEBLE',
  motivoDetalle: '',
  ...cambios,
})

describe('inicio de la reubicación: motivo de lista cerrada', () => {
  it('un motivo de la lista no necesita detalle', () => {
    expect(inicioReubicacionSchema.safeParse(inicio()).success).toBe(true)
  })

  it('sin motivo, o fuera de la lista, no pasa', () => {
    expect(mensajes(inicioReubicacionSchema.safeParse(inicio({ motivo: '' })))).toContain('motivo: Seleccione el motivo de la reubicación.')
    expect(mensajes(inicioReubicacionSchema.safeParse(inicio({ motivo: 'MUDANZA' })))).toContain('motivo: Seleccione el motivo de la reubicación.')
  })

  it('«Otro» exige un detalle real', () => {
    expect(mensajes(inicioReubicacionSchema.safeParse(inicio({ motivo: 'OTRO' })))).toContain('motivoDetalle: Describa el motivo de la reubicación (al menos 10 caracteres).')
    expect(inicioReubicacionSchema.safeParse(inicio({ motivo: 'OTRO', motivoDetalle: 'Cambio del sistema de riego a goteo' })).success).toBe(true)
  })

  it('el detalle no puede ser texto de relleno', () => {
    for (const relleno of ['xxxxxxxxxx', '——————————', '1234567890', 'corto']) expect(detalleValido(relleno), relleno).toBe(false)
    expect(detalleValido('Venta de una fracción del inmueble')).toBe(true)
  })
})

describe('forma de servicio', () => {
  const servicio = (cambios: object = {}) => ({ suministro: suministroVacio(), cambiaPuntoEntrega: false, puntoEntrega: { ...coordenadaVacia(), referencia: '' }, ...cambios })

  it('sin cambiar el punto de entrega no se valida la coordenada', () => {
    expect(servicioReubicacionSchema.safeParse(servicio()).success).toBe(true)
  })

  it('si cambia el punto de entrega, la coordenada es obligatoria y válida', () => {
    expect(servicioReubicacionSchema.safeParse(servicio({ cambiaPuntoEntrega: true })).success).toBe(false)
    const valido = servicio({ cambiaPuntoEntrega: true, puntoEntrega: { ...coordenadaVacia(), sistema: 'grados', latitud: '-26.6045', longitud: '-64.935', referencia: 'Estación de bombeo' } })
    expect(servicioReubicacionSchema.safeParse(valido).success).toBe(true)
  })
})
