import { ActionCard } from '@/components/ui/ActionCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { useSesion } from '@/features/auth/context'

/** Configuración de la cuenta del usuario. La administración de usuarios está en Informática. */
export default function ConfiguracionPage() {
  const { usuario } = useSesion()
  return (
    <>
      <PageHeader title="Configuración" description="Su cuenta en el sistema." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard to={ROUTES.cambiarClave} icon="key" title="Cambiar contraseña" description="Elija una contraseña nueva. Se cierran las sesiones abiertas en otras computadoras." cta="Cambiar" />
        {usuario?.esAdministrador && (
          <ActionCard to={ROUTES.informatica.root} icon="computer" title="Informática" description="Usuarios del sistema, roles y permisos." cta="Ir" />
        )}
      </div>
    </>
  )
}
