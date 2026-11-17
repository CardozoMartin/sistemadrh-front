import { Icon } from '@/components/ui/Icon'
import { MODO_DEMO } from '@/services/demo/modo'
import { USUARIO_SISTEMA, useUsuarioActualId } from '@/services/sesion'
import { useSesion } from './context'

/**
 * Quién actúa en las pantallas de un expediente: el usuario de la sesión (en el modo demo, el
 * elegido en la barra superior). `puedeActuarEn(oficina)`: es de esa oficina o administrador.
 * Solo guía la pantalla: el backend controla todo igual.
 */
export function useActor() {
  const { usuario, puede } = useSesion()
  const idDemo = useUsuarioActualId()
  if (MODO_DEMO) {
    return { id: idDemo, esAdministrador: idDemo === USUARIO_SISTEMA, puede: () => true, puedeActuarEn: () => true }
  }
  const esAdministrador = !!usuario?.esAdministrador
  return {
    id: usuario?.id ?? '',
    esAdministrador,
    puede,
    puedeActuarEn: (oficina: string | null | undefined) => esAdministrador || (!!oficina && usuario?.oficina?.codigo === oficina),
  }
}

/** Para quien consulta un expediente que está en otra oficina: lo ve, pero no actúa. */
export function AvisoSoloConsulta({ oficina }: { oficina: string | null | undefined }) {
  return (
    <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
      <Icon name="visibility" className="mt-0.5 text-[18px]!" />
      <span>
        Consulta: el expediente está en <strong>{oficina ?? 'otra oficina'}</strong>. Solo pueden trabajarlo los usuarios de esa oficina.
      </span>
    </p>
  )
}
