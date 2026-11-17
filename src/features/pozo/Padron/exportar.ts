// Exportación del resultado de la consulta de pozos a CSV (se abre con Excel).
import { ESTADO_POZO, formatoFecha } from '../BajaDePozo/estilos'
import { origenDe } from './estilos'
import type { PozoEnPadron } from './types'

const ORIGEN_BAJA = { DE_OFICIO: 'De oficio', A_SOLICITUD: 'A solicitud' } as const

/** Campo de CSV: entre comillas si tiene separador, comillas o saltos de línea. */
const campo = (v: string | number | null | undefined) => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Número con coma decimal (configuración regional de Argentina). */
const decimal = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

/**
 * Descarga los pozos como CSV separado por «;» y con BOM, que es lo que Excel en español abre
 * directo con acentos y columnas bien separadas.
 */
export function exportarPozosCsv(pozos: PozoEnPadron[]) {
  const encabezado = [
    'ID interno', 'Alias', 'Estado', 'Origen del alta', 'Fecha de alta', 'Registro de oficio', 'Motivo del registro', 'Causante', 'CUIT/DNI causante',
    'Concesión', 'Expediente de la concesión', 'Titular', 'CUIT/DNI titular', 'Baja', 'Estado de la baja', 'Fecha de baja', 'Expediente de la baja', 'Motivo de la baja',
    'Departamento', 'Localidad', 'Distrito', 'Jurisdicción DRH', 'Profundidad (m)', 'Caudal (l/s)', 'POSGAR X', 'POSGAR Y', 'Latitud', 'Longitud',
  ]
  const filas = pozos.map((p) => [
    p.idInterno, p.alias, ESTADO_POZO[p.estado].texto, origenDe(p.origen).texto, p.fechaAlta && formatoFecha(p.fechaAlta), p.registro?.expediente, p.registro?.motivo, p.registro?.causante, p.registro?.documento,
    p.concesion?.numero ?? p.baja?.concesionAnterior, p.concesion?.expediente, p.concesion?.titular, p.concesion?.documento,
    p.baja && ORIGEN_BAJA[p.baja.origen], p.baja?.estado, p.baja?.fechaBaja && formatoFecha(p.baja.fechaBaja), p.baja?.expediente, p.baja?.motivo,
    p.departamento, p.localidad, p.distrito, p.jurisdiccionDrh ? 'Sí' : 'No', decimal(p.profundidadM), decimal(p.caudalLps), decimal(p.coordX), decimal(p.coordY), decimal(p.latitud), decimal(p.longitud),
  ])
  const csv = '﻿' + [encabezado, ...filas].map((f) => f.map(campo).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `pozos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
