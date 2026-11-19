import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaExpedientes } from '@/features/expedientes/components/BandejaExpedientes'
import { USA_JSON_SERVER } from '@/services/demo/modo'
import { SolicitudesNumeroPanel } from '../components/SolicitudesNumeroPanel'
import { PedidosNumeroPanel } from '../components/PedidosNumeroPanel'
import { PendientesPadronPanel } from '../components/PendientesPadronPanel'

/**
 * Bandeja de Catastro: expedientes en la oficina, sin revisar y pendientes (altas en carga, en corrección o en el cierre),
 * pedidos de número de concesión y expedientes que vuelven para el cierre.
 */
export default function BandejaCatastroPage() {
  return (
    <BandejaOficina oficina="catastro">
      {/* Pedidos de N° de concesión de Secretaría General, arriba de todo: frenan la resolución. */}
      {USA_JSON_SERVER ? <SolicitudesNumeroPanel /> : <PedidosNumeroPanel />}
      <BandejaExpedientes oficina="catastro" />
      {!USA_JSON_SERVER && <PendientesPadronPanel />}
      <BandejaRegistrosPozo oficina="catastro" />
    </BandejaOficina>
  )
}
