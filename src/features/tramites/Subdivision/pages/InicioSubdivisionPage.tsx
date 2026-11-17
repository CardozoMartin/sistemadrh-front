import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import { InicioSobreConcesion } from '../../shared/components/InicioSobreConcesion'
import { SubdivisionEnCargaError } from '../api'
import { SubdivisionesEnCurso } from '../components/SubdivisionesEnCurso'
import { useIniciarSubdivision } from '../hooks'
import { PASOS_SUBDIVISION } from '../pasos'

/**
 * Paso 1 (Catastro), prototipo subdivision/busquedasubdivision.html: búsqueda de la
 * concesión → «Iniciar trámite» asigna el expediente y sigue en el editor de fracciones.
 */
export default function InicioSubdivisionPage() {
  const navigate = useNavigate()
  const iniciar = useIniciarSubdivision()

  return (
    <InicioSobreConcesion
      titulo="Subdivisión de Concesión - Inicio de Trámite"
      descripcion="Gestione la división de una concesión en dos o más fracciones. Busque el expediente y verifique los datos antes de iniciar el circuito."
      accion="la subdivisión"
      pasos={PASOS_SUBDIVISION}
      onComenzar={async (values) => {
        const borrador = await iniciar.mutateAsync(values)
        navigate(ROUTES.tramites.subdivision.fracciones(borrador.id))
      }}
      comenzando={iniciar.isPending}
      error={iniciar.error}
      onCerrar={iniciar.reset}
      accionDelError={(error) =>
        error instanceof SubdivisionEnCargaError && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            iconRight="arrow_forward"
            onClick={() => navigate(ROUTES.tramites.subdivision.fracciones(error.borradorId))}
          >
            Continuar esa carga
          </Button>
        )
      }
    >
      <SubdivisionesEnCurso />
    </InicioSobreConcesion>
  )
}
