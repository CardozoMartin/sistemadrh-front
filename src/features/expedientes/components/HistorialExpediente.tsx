import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { recepcionVigente } from '../circuito'
import { movimientosDe } from '../movimientos'
import { LineaDeTiempo, PieLineaDeTiempo } from './LineaDeTiempo'

/**
 * Trazabilidad del expediente: quién lo inició, quién lo tomó en cada oficina, quién lo
 * derivó u observó, y dónde está ahora.
 */
export function HistorialExpediente({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const pendiente = d.estadosPendientes.includes(expediente.estadoId)
  const oficina = d.nombreOficina(expediente.oficinaId)
  const recepcion = pendiente ? recepcionVigente(expediente, d) : null
  const yaIniciado = expediente.historial.length > 0

  return (
    <LineaDeTiempo
      movimientos={movimientosDe(expediente, d)}
      pie={
        pendiente &&
        yaIniciado && (
          <PieLineaDeTiempo
            titulo={`En ${oficina}`}
            detalle={
              recepcion
                ? `Tomado por ${d.usuario(recepcion.usuarioId)?.nombre ?? recepcion.usuarioId}, en revisión.`
                : `Pendiente: ${oficina} todavía no tomó el expediente.`
            }
          />
        )
      }
    />
  )
}
