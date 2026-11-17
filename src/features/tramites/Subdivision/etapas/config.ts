import type { Expediente } from '@/types/domain'
import { personaDeTitular, type ConfigTramite, type PersonaExpediente } from '../../shared/etapas/config'
import { FraccionesDetalle } from '../components/FraccionesDetalle'
import type { DatosExpedienteSubdivision } from '../types'

export const datosSubdivision = (e: Expediente) => e.datos as DatosExpedienteSubdivision | null

/**
 * Personas del expediente: los titulares de la concesión madre y los de cada fracción.
 * Si una persona figura en varias, aparece una sola vez con todos sus roles (Recaudación
 * le verifica la deuda una vez).
 */
function personas(e: Expediente): PersonaExpediente[] {
  const datos = datosSubdivision(e)
  if (!datos) return [{ clave: 'titular', rol: 'Titular', nombre: e.titular, documento: '—', correo: '' }]
  const todas = [
    ...datos.titulares.map((t, i) => personaDeTitular(t, `madre-${i}`, 'Titular de la concesión madre')),
    ...datos.fracciones.flatMap((f) => (f.carga?.titulares ?? []).map((t, i) => personaDeTitular(t, `${f.clave}-${i}`, `Titular de ${f.nombre}`))),
  ]
  const porDocumento = new Map<string, PersonaExpediente>()
  for (const p of todas) {
    const clave = p.documento === '—' ? p.clave : p.documento
    const previa = porDocumento.get(clave)
    porDocumento.set(clave, previa ? { ...previa, rol: `${previa.rol} · ${p.rol.replace('Titular de ', '')}`, correo: previa.correo || p.correo } : p)
  }
  return [...porDocumento.values()]
}

/**
 * Lo que la subdivisión aporta a las pantallas compartidas: titulares de la madre y de
 * las fracciones, el resumen de la división, el mapa con las fracciones y el pedido de
 * un número de concesión por fracción en Secretaría General.
 */
export const CONFIG_SUBDIVISION: ConfigTramite = {
  personas,
  datosResumen: (e) => {
    const datos = datosSubdivision(e)
    if (!datos) return [{ label: 'Titular', valor: e.titular, ancho: true }]
    return [
      { label: 'Titular (concesión madre)', valor: e.titular, ancho: true },
      { label: 'Concesión madre', valor: `N° ${datos.numeroConcesion} · ${datos.madre.hectareas.toFixed(2)} ha` },
      { label: 'Fracciones', valor: String(datos.fracciones.length) },
      { label: 'Detalle', valor: datos.fracciones.map((f) => `${f.nombre}: ${f.hectareas.toFixed(2)} ha`).join(' · '), ancho: true },
    ]
  },
  Detalle: FraccionesDetalle,
  concesionesNuevas: (e) => (datosSubdivision(e)?.fracciones ?? []).map((f) => f.nombre),
  aplicarNumerosConcesion: (e, numeros) => {
    const datos = datosSubdivision(e)
    if (!datos) return {}
    return { datos: { ...datos, fracciones: datos.fracciones.map((f, i) => ({ ...f, numeroConcesion: numeros[i] })) } }
  },
}
