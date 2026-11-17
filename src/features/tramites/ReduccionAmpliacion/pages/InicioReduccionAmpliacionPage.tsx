import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { InicioSobreConcesion } from '../../shared/components/InicioSobreConcesion'
import { useValidarInicioModificacion } from '../hooks'

/**
 * Paso 1 (Catastro), prototipo ReduccionAmpliacion/inicioTramite.html: búsqueda de la
 * concesión → «Iniciar trámite» asigna el expediente y sigue en la definición de superficie.
 */
export default function InicioReduccionAmpliacionPage() {
  const navigate = useNavigate()
  const validar = useValidarInicioModificacion()

  return (
    <InicioSobreConcesion
      titulo="Ampliación / Reducción de Concesión - Inicio de Trámite"
      descripcion="Gestione la modificación de superficie o caudal de una concesión. Busque el expediente y verifique los datos antes de iniciar el circuito."
      accion="la modificación de superficie"
      onComenzar={async (values) => {
        await validar.mutateAsync(values)
        navigate(ROUTES.tramites.reduccionAmpliacion.superficie(values.concesionId, values.numeroExpediente))
      }}
      comenzando={validar.isPending}
      error={validar.error}
      onCerrar={validar.reset}
    />
  )
}
