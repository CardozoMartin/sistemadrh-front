import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { InicioSobreConcesion } from '../../shared/components/InicioSobreConcesion'
import { useValidarInicioAnulacion } from '../hooks'

/**
 * Paso 1 (Catastro), prototipo Anulacion/inicioTramite.html: búsqueda de la concesión →
 * «Iniciar trámite» asigna el expediente y sigue en la verificación de datos.
 */
export default function InicioAnulacionPage() {
  const navigate = useNavigate()
  const validar = useValidarInicioAnulacion()

  return (
    <InicioSobreConcesion
      titulo="Anulación de Concesión - Inicio de Trámite"
      descripcion="Gestione la baja definitiva de una concesión. Busque el expediente y verifique los datos antes de iniciar el circuito."
      accion="la anulación"
      onComenzar={async (values) => {
        await validar.mutateAsync(values)
        navigate(ROUTES.tramites.anulacion.verificacion(values.concesionId, values.numeroExpediente))
      }}
      comenzando={validar.isPending}
      error={validar.error}
      onCerrar={validar.reset}
    />
  )
}
