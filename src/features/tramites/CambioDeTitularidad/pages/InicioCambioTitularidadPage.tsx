import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { InicioSobreConcesion } from '../../shared/components/InicioSobreConcesion'
import { CambiosEnCurso } from '../components/CambiosEnCurso'
import { useIniciarCambio } from '../hooks'

/**
 * Paso 1 (Catastro): motor de búsqueda de la concesión → «Iniciar trámite» crea el expediente
 * en el backend real y sigue en la carga del nuevo titular.
 */
export default function InicioCambioTitularidadPage() {
  const navigate = useNavigate()
  const iniciar = useIniciarCambio()

  return (
    <InicioSobreConcesion
      titulo="Cambio de Titularidad"
      descripcion="Busque la concesión vigente, selecciónela e inicie el trámite con el número de expediente."
      accion="el cambio de titularidad"
      onComenzar={async (values) => {
        const cambio = await iniciar.mutateAsync(values)
        navigate(ROUTES.tramites.cambioTitularidad.datos(cambio.expediente.id))
      }}
      comenzando={iniciar.isPending}
      error={iniciar.error}
      onCerrar={iniciar.reset}
    >
      <CambiosEnCurso />
    </InicioSobreConcesion>
  )
}
