import { describe, expect, it } from 'vitest'
import { anioDeFecha, faltaEnResolucion, resolucionAFormData, tamanio } from './resolucion'

const pdf = { name: 'Resolución 279.PDF', size: 120_000 }
const ok = { numero: '279', fecha: '2026-11-10', archivo: pdf }
const hoy = '2026-11-19'

describe('faltaEnResolucion (Secretaría General)', () => {
  it('con todo cargado, se puede', () => expect(faltaEnResolucion(ok, hoy)).toBeNull())
  it('número de hasta 6 dígitos', () => {
    expect(faltaEnResolucion({ ...ok, numero: '' }, hoy)).toMatch(/número/)
    expect(faltaEnResolucion({ ...ok, numero: '1234567' }, hoy)).toMatch(/número/)
  })
  it('la fecha de firma es obligatoria y no futura', () => {
    expect(faltaEnResolucion({ ...ok, fecha: '' }, hoy)).toMatch(/fecha/)
    expect(faltaEnResolucion({ ...ok, fecha: '2026-11-20' }, hoy)).toMatch(/futura/)
  })
  it('el PDF es obligatorio, .pdf, no vacío y hasta 10 MB', () => {
    expect(faltaEnResolucion({ ...ok, archivo: null }, hoy)).toMatch(/Adjunte/)
    expect(faltaEnResolucion({ ...ok, archivo: { name: 'r.jpg', size: 10 } }, hoy)).toMatch(/PDF/)
    expect(faltaEnResolucion({ ...ok, archivo: { name: 'r.pdf', size: 0 } }, hoy)).toMatch(/vacío/)
    expect(faltaEnResolucion({ ...ok, archivo: { name: 'r.pdf', size: 11 * 1024 * 1024 } }, hoy)).toMatch(/10 MB/)
  })
  it('el año sale de la fecha de firma', () => expect(anioDeFecha('2026-03-01')).toBe(2026))
  it('tamaño legible', () => {
    expect(tamanio(500)).toBe('1 KB')
    expect(tamanio(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('resolucionAFormData (POST …/resolucion, común a los trámites)', () => {
  const archivo = new File(['%PDF'], 'resolucion.pdf', { type: 'application/pdf' })
  it('manda número, año, fecha y el PDF', () => {
    const form = resolucionAFormData({ numero: '279', anio: 2026, fecha: '2026-11-10', archivo })
    expect(form.get('numero')).toBe('279')
    expect(form.get('anio')).toBe('2026')
    expect(form.get('fecha')).toBe('2026-11-10')
    expect((form.get('archivo') as File).name).toBe('resolucion.pdf')
    expect(form.has('observaciones')).toBe(false)
  })
  it('las observaciones van solo si hay', () => {
    expect(resolucionAFormData({ numero: '1', anio: 2026, fecha: '2026-01-02', archivo, observaciones: '' }).has('observaciones')).toBe(false)
    expect(resolucionAFormData({ numero: '1', anio: 2026, fecha: '2026-01-02', archivo, observaciones: 'Firmada' }).get('observaciones')).toBe('Firmada')
  })
})
