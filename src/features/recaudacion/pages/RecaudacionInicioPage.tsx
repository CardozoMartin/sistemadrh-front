import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaExpedientes } from '@/features/expedientes/components/BandejaExpedientes'

/** Bandeja de la oficina. Las acciones propias de la oficina se agregarán acá. */
export default function RecaudacionInicioPage() {
  return (
    <BandejaOficina oficina="recaudacion">
      <BandejaExpedientes oficina="recaudacion" />
      <BandejaRegistrosPozo oficina="recaudacion" />
    </BandejaOficina>
  )
}
