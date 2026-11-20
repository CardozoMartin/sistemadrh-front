import { useEffect } from 'react'
import { RUTA_BANDEJA } from '@/config/routes'
import { useSesion } from '@/features/auth/context'
import { useNotificaciones } from '@/features/notificaciones/context'
import { storage } from '@/lib/storage'
import { USA_JSON_SERVER } from '@/services/demo/modo'
import type { TipoTramite } from '@/types/domain'
import { usePedidosNumeroPendientes } from '../pedidosNumero'

/** Pedidos ya avisados a este usuario (para no repetir el aviso al recargar). */
const claveAvisados = (usuarioId: string) => `drh_pedidos_numero_avisados_${usuarioId}`

/**
 * Avisa a los usuarios de Catastro cuando Secretaría General pide un número de concesión:
 * cartel emergente («Ver bandeja» lleva al panel de pedidos) y notificación en la campana,
 * con el expediente y quién lo pidió. Cada pedido se avisa una sola vez por usuario; los que
 * estaban pendientes al entrar también se avisan (si todavía no se le avisaron).
 * Solo con el backend real: en la demo los avisos llegan por el servidor de eventos.
 */
export function AvisoPedidosNumero() {
  const { usuario } = useSesion()
  const esCatastro = !USA_JSON_SERVER && usuario?.oficina?.codigo === 'catastro'
  const pedidos = usePedidosNumeroPendientes(esCatastro)
  const { mostrarAviso, agregarNotificacion } = useNotificaciones()

  useEffect(() => {
    if (!esCatastro || !usuario || !pedidos.data) return
    const clave = claveAvisados(usuario.id)
    const avisados = new Set(storage.get<string[]>(clave, []))
    const nuevos = pedidos.data.filter((p) => !avisados.has(p.id))

    for (const p of nuevos) {
      const tramite = p.expediente.tipoTramite.toLowerCase() as TipoTramite
      mostrarAviso({
        titulo: `Secretaría General necesita el número de concesión del expediente ${p.expediente.numero}`,
        detalle: `Lo pidió ${p.solicitadoPor}${p.expediente.titular ? ` · ${p.expediente.titular}` : ''}. Cárguelo desde la bandeja de Catastro.`,
        icono: 'pin',
        // El panel de pedidos está arriba de todo en la bandeja de Catastro.
        ruta: RUTA_BANDEJA.catastro,
      })
      agregarNotificacion({
        tipo: 'solicitud_numero',
        usuarioNombre: p.solicitadoPor,
        oficinaOrigenId: 'secretaria_general',
        fecha: p.solicitadoEn,
        expediente: { id: p.expediente.id, numero: p.expediente.numero, tramiteId: tramite, titular: p.expediente.titular ?? '', oficinaId: 'catastro', estadoId: 'en_tramite' },
      })
    }
    // Se guardan solo los que siguen pendientes: la lista no crece con los ya asignados.
    if (nuevos.length || avisados.size !== pedidos.data.length) storage.set(clave, pedidos.data.map((p) => p.id))
  }, [esCatastro, usuario, pedidos.data, mostrarAviso, agregarNotificacion])

  return null
}
