import { itemVisible, NAVIGATION } from '@/config/navigation'
import { ActionCard } from '@/components/ui/ActionCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { useSesion } from '@/features/auth/context'
import { useDominio } from '@/hooks/useDominio'

// Descripción de módulos que todavía no están en la API.
const DESCRIPCION_MODULO: Record<string, string> = {
  pozo: 'Autorización, registro y seguimiento de pozos.',
  busqueda: 'Consultar cualquier expediente: dónde está, de qué oficina vino y su historial.',
  visor: 'Concesiones, pozos y capas de la DRH en el mapa.',
}

const accesos = NAVIGATION.filter((s) => s.key === 'oficinas' || s.key === 'modulos' || s.key === 'herramientas').flatMap((s) => s.items)

export default function DashboardPage() {
  const { oficina } = useDominio()
  const { usuario } = useSesion()
  return (
    <>
      <PageHeader
        title="Bienvenido al Sistema Integral DRH"
        description="Accedé a las oficinas y gestioná los trámites de la Dirección de Recursos Hídricos desde un solo lugar."
      />
      {/* Fase 4: KPIs, últimos trámites y alertas de vencimiento */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accesos.filter((item) => itemVisible(item, usuario)).map((item) => {
          // Las oficinas toman nombre y descripción de /oficinas.
          const info = item.bandejaDe ? oficina(item.bandejaDe) : undefined
          const oficinaDelGrupo = item.children?.find((c) => c.bandejaDe)?.bandejaDe
          const infoGrupo = oficinaDelGrupo ? oficina(oficinaDelGrupo) : undefined
          const datos = info ?? infoGrupo
          return (
            <ActionCard
              key={item.key}
              to={item.children?.[0]?.path ?? item.path}
              icon={item.icon}
              title={datos?.nombre ?? item.label}
              description={datos?.descripcion ?? DESCRIPCION_MODULO[item.key] ?? ''}
            />
          )
        })}
        {usuario?.esAdministrador && (
          <ActionCard
            to={ROUTES.informatica.root}
            icon="computer"
            title="Informática"
            description="Usuarios del sistema, oficinas, roles y lo que puede hacer cada uno."
          />
        )}
      </div>
    </>
  )
}
