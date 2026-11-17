import type { ReactNode } from 'react'
import { Outlet, useNavigate, type RouteObject } from 'react-router'
import { EmptyState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes'
import { useDominio } from '@/hooks/useDominio'
import type { Oficina } from '@/types/domain'
import { useSesion } from '../context'
import { useActor } from '../useActor'

function SinAcceso({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const navigate = useNavigate()
  return (
    <EmptyState icon="lock" titulo={titulo} descripcion={descripcion}>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="secondary" iconLeft="manage_search" onClick={() => navigate(ROUTES.busqueda)}>
          Buscar un expediente
        </Button>
        <Button size="sm" onClick={() => navigate(ROUTES.dashboard)}>
          Ir al inicio
        </Button>
      </div>
    </EmptyState>
  )
}

/** Pantallas de una oficina: solo sus usuarios (y los administradores). El backend también lo controla. */
export function RutaDeOficina({ oficina, children }: { oficina: string; children: ReactNode }) {
  const actor = useActor()
  const nombre = useDominio().oficina(oficina as Oficina)?.nombre ?? oficina
  if (!actor.puedeActuarEn(oficina)) {
    return <SinAcceso titulo={`Esta sección es de ${nombre}`} descripcion="Solo pueden entrar los usuarios de esa oficina. Los expedientes se pueden consultar desde la búsqueda." />
  }
  return <>{children}</>
}

/** Pantallas de una acción (ej: iniciar un alta): exige el permiso. */
export function RutaConPermiso({ permiso, accion, children }: { permiso: string; accion: string; children: ReactNode }) {
  const actor = useActor()
  if (!actor.puede(permiso)) {
    return <SinAcceso titulo={`No tiene permiso para ${accion}`} descripcion="Si lo necesita, pídaselo a Informática." />
  }
  return <>{children}</>
}

/** Agrupa rutas que son solo de una oficina (ruta sin path que solo controla el acceso). */
export const deOficina = (oficina: string, children: RouteObject[]): RouteObject => ({
  element: (
    <RutaDeOficina oficina={oficina}>
      <Outlet />
    </RutaDeOficina>
  ),
  children,
})

/** Hook para mostrar u ocultar acciones según los permisos (el backend los controla igual). */
export function usePuede() {
  return useSesion().puede
}
