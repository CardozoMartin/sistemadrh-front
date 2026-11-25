import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { PasosTramite } from '../../shared/components/PasosTramite'
import type { ReubicacionBackend } from '../backend.types'
import { ObservacionJuridico } from '../components/Avisos'
import { ConReubicacion } from '../components/ConReubicacion'
import { AccionesPropuesta } from '../components/propuesta/AccionesPropuesta'
import { DatosConcesion } from '../components/propuesta/DatosConcesion'
import { SeccionPoligono } from '../components/propuesta/SeccionPoligono'
import { SeccionServicio } from '../components/propuesta/SeccionServicio'
import { dondeQuedo, ETAPA_CORRECCION, seEditaEnCatastro } from '../formato'

const TITULO = 'Propuesta de Reubicación'

/** A dónde se deriva al enviarla (carga → Recaudación; corrección de lo observado → Jurídico). */
const destinoDe = (enCorreccion: boolean) => (enCorreccion ? 'Jurídico' : 'Recaudación')

/**
 * Paso 2 (Catastro), caso de uso pasos 10-14: el nuevo lugar al que llega el agua (KML) y la forma
 * de servicio, comparados con lo vigente. «Enviar a Recaudación» lo pone en circulación. Si Jurídico
 * la observa, vuelve acá (corrección) y «Reenviar a Jurídico» la devuelve. Nada cambia en la
 * concesión hasta que la reubicación termine.
 */
export default function PropuestaReubicacionPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const irAlInicio = () => navigate(ROUTES.tramites.reubicacion.inicio)
  /**
   * «Reubicación enviada»: vive acá porque, al derivarse, la reubicación vuelve del backend en otra
   * etapa y la propuesta deja de ser editable (se desmonta).
   */
  const [enviada, setEnviada] = useState<{ numero: string; enCorreccion: boolean } | null>(null)

  return (
    <>
      <ConReubicacion
        expedienteId={expedienteId}
        titulo={TITULO}
        mensajeCarga="Cargando el trámite…"
        tituloNoEncontrado="No se encontró la reubicación"
        accionNoEncontrado={
          <Button size="sm" onClick={irAlInicio}>
            Ir al inicio del trámite
          </Button>
        }
      >
        {(datos) =>
          seEditaEnCatastro(datos.reubicacion.estado, datos.expediente.etapa) ? (
            <Propuesta datos={datos} onEnviada={(enCorreccion) => setEnviada({ numero: datos.expediente.numero, enCorreccion })} />
          ) : (
            <>
              <PageHeader title={TITULO} />
              <EmptyState icon="lock" titulo="Esta reubicación ya no está en Catastro" descripcion={dondeQuedo(datos.reubicacion.estado, datos.expediente)}>
                <Button size="sm" onClick={irAlInicio}>
                  Ir al inicio del trámite
                </Button>
              </EmptyState>
            </>
          )
        }
      </ConReubicacion>

      <ConfirmDialog
        open={!!enviada}
        tone="success"
        title={enviada?.enCorreccion ? 'Reubicación reenviada' : 'Reubicación enviada'}
        message={enviada ? `El expediente ${enviada.numero} fue derivado a ${destinoDe(enviada.enCorreccion)}.` : ''}
        confirmLabel="Volver al inicio"
        onConfirm={irAlInicio}
      />
    </>
  )
}

function Propuesta({ datos, onEnviada }: { datos: ReubicacionBackend; onEnviada: (enCorreccion: boolean) => void }) {
  const { reubicacion, expediente } = datos
  const enCorreccion = expediente.etapa === ETAPA_CORRECCION
  const destino = destinoDe(enCorreccion)

  return (
    <>
      <PageHeader title={TITULO} description="Cargue el nuevo lugar al que llega el agua y la forma de servicio, y compárelos con lo vigente." />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo={enCorreccion ? 'Corrección de lo observado' : 'Propuesta'} carga="Propuesta" />

        {reubicacion.observacion && (
          <ObservacionJuridico observacion={reubicacion.observacion}>Corrija lo que corresponda (polígono o forma de servicio) y reenvíela a {destino}.</ObservacionJuridico>
        )}

        <DatosConcesion datos={datos} />
        <SeccionPoligono datos={datos} />
        <SeccionServicio datos={datos} />
        <AccionesPropuesta datos={datos} enCorreccion={enCorreccion} destino={destino} onEnviada={() => onEnviada(enCorreccion)} />
      </div>
    </>
  )
}
