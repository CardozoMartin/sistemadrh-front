import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import { InicioSobreConcesion } from '../../shared/components/InicioSobreConcesion'
import { CambioEnCargaError } from '../api'
import { CambiosEnCurso } from '../components/CambiosEnCurso'
import { useIniciarCambio } from '../hooks'

/**
 * Paso 1 (Catastro), prototipo inicioTramite.html: búsqueda de la concesión → «Iniciar
 * trámite» asigna el expediente y sigue en la pre-carga del nuevo titular.
 */
export default function InicioCambioTitularidadPage() {
  const navigate = useNavigate()
  const iniciar = useIniciarCambio()

  return (
    <InicioSobreConcesion
      titulo="Cambio de Titularidad - Inicio de Trámite"
      descripcion="Gestione la transferencia de derechos sobre una concesión. Busque el expediente y verifique los datos antes de iniciar el circuito."
      accion="el cambio de titularidad"
      onComenzar={async (values) => {
        const borrador = await iniciar.mutateAsync(values)
        navigate(ROUTES.tramites.cambioTitularidad.datos(borrador.id))
      }}
      comenzando={iniciar.isPending}
      error={iniciar.error}
      onCerrar={iniciar.reset}
      accionDelError={(error) =>
        error instanceof CambioEnCargaError && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            iconRight="arrow_forward"
            onClick={() => navigate(ROUTES.tramites.cambioTitularidad.datos(error.borradorId))}
          >
            Continuar esa carga
          </Button>
        )
      }
    >
      <CambiosEnCurso />
    </InicioSobreConcesion>
  )
}
