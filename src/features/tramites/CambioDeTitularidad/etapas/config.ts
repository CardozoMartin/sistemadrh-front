import type { Expediente } from '@/types/domain'
import { personaDeTitular, type ConfigTramite } from '../../shared/etapas/config'
import { nombreTitular } from '../../shared/schemas/titular'
import type { DatosExpedienteCambioTitularidad } from '../types'

export const datosCambio = (e: Expediente) => e.datos as DatosExpedienteCambioTitularidad | null

/** Hasta la carga final en Catastro (con resolución) el nuevo titular es solo una propuesta. */
const rolNuevo = (e: Expediente) => (datosCambio(e)?.cargaFinal ? 'Nuevo titular' : 'Nuevo titular (propuesto)')

/**
 * Lo que el cambio de titularidad aporta a las pantallas compartidas: Recaudación
 * verifica la deuda del titular actual y del nuevo; los avisos van a los dos.
 */
export const CONFIG_CAMBIO: ConfigTramite = {
  personas: (e) => {
    const datos = datosCambio(e)
    if (!datos) return [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }]
    return [
      ...datos.titularesAnteriores.map((t, i) => personaDeTitular(t, `actual-${i}`, 'Titular actual')),
      ...datos.titulares.map((t, i) => personaDeTitular(t, `nuevo-${i}`, rolNuevo(e))),
    ]
  },
  datosResumen: (e) => {
    const datos = datosCambio(e)
    if (!datos) return [{ label: 'Titular', valor: e.titular, ancho: true }]
    const nuevo = datos.titulares[0] ? personaDeTitular(datos.titulares[0], 'nuevo', 'Nuevo titular') : null
    return [
      { label: datos.cargaFinal ? 'Titular anterior' : 'Titular actual', valor: datos.titularesAnteriores.map(nombreTitular).join('; ') || '—', ancho: true },
      { label: rolNuevo(e), valor: datos.titulares.map(nombreTitular).join('; '), ancho: true },
      ...(nuevo ? [{ label: 'Documento nuevo titular', valor: nuevo.documento, ancho: true }] : []),
    ]
  },
}
