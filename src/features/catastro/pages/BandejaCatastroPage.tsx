import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaExpedientes } from '@/features/expedientes/components/BandejaExpedientes'
import { USA_JSON_SERVER } from '@/services/demo/modo'
import { SolicitudesNumeroPanel } from '../components/SolicitudesNumeroPanel'

/**
 * Bandeja de Catastro: expedientes en la oficina, sin revisar y pendientes (altas en carga, en corrección o en el cierre),
 * pedidos de número de concesión y expedientes que vuelven para el cierre.
 */
export default function BandejaCatastroPage() {
  return (
    <BandejaOficina oficina="catastro">
      <BandejaExpedientes oficina="catastro" />
      <BandejaRegistrosPozo oficina="catastro" />
      {/* Los pedidos de N° todavía leen de json-server: en el modo real, el N° se asigna desde el expediente. */}
      {USA_JSON_SERVER && <SolicitudesNumeroPanel />}
    </BandejaOficina>
  )
}
