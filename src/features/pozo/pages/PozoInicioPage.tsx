import { NAVIGATION } from '@/config/navigation'
import { ActionCard } from '@/components/ui/ActionCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { BandejaRegistrosPozo } from '@/features/pozo/CircuitoPozo/components/BandejaRegistrosPozo'

const DESCRIPCIONES: Record<string, string> = {
  'pozo-autorizacion': 'Solicitud y gestión de autorizaciones para la perforación de pozos.',
  'pozo-registro': 'Con autorización de perforación o de oficio, para pozos sin trámite previo.',
  'pozo-empresas': 'Alta, búsqueda y baja de las empresas habilitadas para perforar.',
  'pozo-autorizaciones': 'Seguimiento del circuito y habilitación de autorizaciones.',
  'pozo-registrados': 'Padrón de pozos por origen: los registrados de oficio separados de los que tienen autorización y del padrón anterior.',
  'pozo-consulta': 'Búsqueda de pozos y concesiones por distrito, expediente, alias o solicitante.',
  'pozo-bajas': 'Baja de un pozo a solicitud del titular o de oficio: Pozos → Distrito → Jurídico → Secretaría General.',
}

// Las opciones salen del mismo menú lateral, así nunca quedan desincronizadas.
const opciones = NAVIGATION.flatMap((s) => s.items).find((i) => i.key === 'pozo')?.children ?? []

export default function PozoInicioPage() {
  return (
    <>
      <PageHeader title="Pozos" description="Autorización, registro y seguimiento de pozos de agua subterránea." />
      {/* Registros de pozo que volvieron a Pozos: para corregir lo observado o para el cierre. */}
      <BandejaRegistrosPozo oficina="pozos" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {opciones.map((o) => (
          <ActionCard key={o.key} to={o.path} icon={o.icon} title={o.label} description={DESCRIPCIONES[o.key] ?? ''} />
        ))}
      </div>
    </>
  )
}
