import { describe, expect, it } from 'vitest'
import { formatearFecha } from '@/config/expedientes'
import { dondeQuedo, estaEnCarga, faltaEnBaja, mensajeBaja, terminado } from './formato'

describe('estaEnCarga (Catastro todavía puede enviarla o cancelarla)', () => {
  it('solo en trámite y en la etapa de carga', () => {
    expect(estaEnCarga('EN_TRAMITE', 'CARGA')).toBe(true)
    expect(estaEnCarga('EN_TRAMITE', 'RECAUDACION')).toBe(false)
    expect(estaEnCarga('ANULADO', 'CARGA')).toBe(false)
    expect(estaEnCarga('FINALIZADO', 'CIERRE')).toBe(false)
  })
})

describe('terminado (cómo terminó, en «Dónde está»)', () => {
  it('en trámite no terminó', () => expect(terminado('EN_TRAMITE')).toBeNull())
  it('finalizada: la concesión quedó anulada', () => expect(terminado('FINALIZADO')).toMatch(/anulada/))
  it('rechazada: la concesión sigue vigente', () => expect(terminado('RECHAZADO')).toMatch(/sigue vigente/))
  it('cancelada: iniciada por error', () => expect(terminado('ANULADO')).toMatch(/Cancelado/))
})

describe('dondeQuedo (verificación de datos que ya no está en Catastro)', () => {
  const expediente = { numero: '123/332-2026', oficinaNombre: 'Recaudación', etapaNombre: 'Verificación de deuda' }
  it('en trámite: la oficina y la etapa', () => {
    expect(dondeQuedo('EN_TRAMITE', expediente)).toBe('Expediente 123/332-2026: está en Recaudación (Verificación de deuda).')
  })
  it('terminada: el estado', () => {
    expect(dondeQuedo('RECHAZADO', expediente)).toBe('Expediente 123/332-2026: quedó rechazado.')
  })
})

describe('faltaEnBaja (Catastro, visto bueno final)', () => {
  it('sin resolución no se da la baja (aunque haya cotejado)', () => {
    expect(faltaEnBaja({ conResolucion: false, cotejado: true })).toBe('Falta la resolución de Secretaría General.')
  })
  it('hay que confirmar el cotejo con la concesión y el motivo', () => {
    expect(faltaEnBaja({ conResolucion: true, cotejado: false })).toBe('Confirme que cotejó la resolución con los datos de la concesión y el motivo.')
  })
  it('con todo, se puede', () => expect(faltaEnBaja({ conResolucion: true, cotejado: true })).toBeNull())
})

describe('mensajeBaja («Trámite finalizado»)', () => {
  it('con la fecha de la resolución', () => {
    expect(mensajeBaja({ concesion: 'N° 906', expediente: '123/332-2026', fechaResolucion: '2026-11-10' })).toBe(
      `La concesión N° 906 quedó anulada desde el ${formatearFecha('2026-11-10')}. El expediente 123/332-2026 queda en el historial.`,
    )
  })
  it('sin fecha, sin el «desde»', () => {
    expect(mensajeBaja({ concesion: 'N° 906', expediente: '123/332-2026', fechaResolucion: null })).toBe(
      'La concesión N° 906 quedó anulada. El expediente 123/332-2026 queda en el historial.',
    )
  })
})
