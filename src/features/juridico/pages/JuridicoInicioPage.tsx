import { BandejaOficina } from '@/features/expedientes/components/BandejaOficina'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'
import { BandejaExpedientes } from '@/features/expedientes/components/BandejaExpedientes'
import { BandejaBajasPozo } from '@/features/pozo/BajaDePozo/components/BandejaBajasPozo'
import { EmpresasPendientesPanel } from '@/features/pozo/EmpresasPerforadoras/components/EmpresasPendientesPanel'

/** Bandeja de la oficina: expedientes del circuito, altas de concesión, altas de empresas perforadoras y bajas de pozo para dictaminar. */
export default function JuridicoInicioPage() {
  return (
    <BandejaOficina oficina="juridico">
      <BandejaExpedientes oficina="juridico" />
      <BandejaRegistrosPozo oficina="juridico" />
      <BandejaBajasPozo oficina="juridico" />
      <EmpresasPendientesPanel oficina="juridico" />
    </BandejaOficina>
  )
}
