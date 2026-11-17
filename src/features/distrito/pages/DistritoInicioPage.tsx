import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaExpedientes } from '@/features/expedientes/components/BandejaExpedientes'
import { AvisosDistrito } from '@/features/pozo/BajaDePozo/components/AvisosDistrito'

/** Bandeja de la oficina: expedientes del circuito, altas de concesión para el informe técnico y bajas de pozo para tomar conocimiento. */
export default function DistritoInicioPage() {
  return (
    <BandejaOficina oficina="distrito">
      <BandejaExpedientes oficina="distrito" />
      <BandejaRegistrosPozo oficina="distrito" />
      <AvisosDistrito />
    </BandejaOficina>
  )
}
