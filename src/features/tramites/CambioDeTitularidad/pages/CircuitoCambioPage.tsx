import { useParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { AvisoDeuda } from '../../AltaDeConcesion/components/circuito/AvisoDeuda'
import { DondeEsta } from '../../AltaDeConcesion/components/circuito/DondeEsta'
import { HistorialAlta } from '../../AltaDeConcesion/components/circuito/HistorialAlta'
import type { CambioBackend } from '../backend.types'
import { DatosTitularesCambio } from '../components/circuito/DatosTitularesCambio'
import { RecaudacionCambio } from '../components/circuito/RecaudacionCambio'
import { useCambio, useTomarCambio } from '../hooks'

const TITULO = 'Expediente de cambio de titularidad'

const TERMINADO: Record<string, string> = {
  FINALIZADO: 'Finalizado: la concesión cambió de titular',
  RECHAZADO: 'Rechazado: la concesión sigue con el titular actual',
  ANULADO: 'Anulado: iniciado por error',
}

/**
 * Un cambio de titularidad en el circuito de oficinas (backend real): dónde está, qué hace la
 * oficina que lo tiene, los datos del titular actual y del nuevo, y el historial completo.
 * Por ahora la oficina que trabaja acá es Recaudación; las demás etapas se van sumando.
 */
export default function CircuitoCambioPage() {
  const { expedienteId } = useParams()
  const cambio = useCambio(expedienteId)

  if (cambio.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (cambio.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(cambio.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : (
          <ErrorState error={cambio.error} onRetry={() => void cambio.refetch()} reintentando={cambio.isFetching} />
        )}
      </>
    )
  }

  const datos = cambio.data
  const { expediente, cambio: c } = datos
  return (
    <>
      <PageHeader
        title={`${TITULO} ${expediente.numero}`}
        description={`Concesión N° ${c.concesion.numero ?? c.concesion.id} · ${c.titularesActuales.map((t) => t.nombreCompleto).join(', ')} → ${c.nuevosTitulares.map((t) => t.nombreCompleto).join(', ') || 'sin nuevo titular'}`}
      />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <DondeEsta
            oficina={expediente.oficinaNombre}
            etapa={expediente.etapaNombre}
            tomadoPor={expediente.tomadoPor?.nombre ?? null}
            tomadoEn={expediente.tomadoEn}
            terminado={c.estado === 'EN_TRAMITE' ? null : TERMINADO[c.estado]}
          />
        </Card>

        {datos.avisoDeuda && <AvisoDeuda aviso={datos.avisoDeuda} />}

        {c.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} />}

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Verificación de datos</h2>
          <DatosTitularesCambio datos={datos} />
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Documentación presentada en Catastro: {c.documentacionPresentada.map((d) => d.descripcion).join(' · ') || 'no registrada'}.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial del expediente</h2>
          <HistorialAlta expedienteId={expediente.id} />
        </Card>
      </div>
    </>
  )
}

/** Lo que tiene que hacer la oficina donde está el expediente (si es la del usuario). */
function PanelOficina({ datos }: { datos: CambioBackend }) {
  const actor = useActor()
  const { expediente } = datos
  const tomar = useTomarCambio(expediente.id)

  if (!actor.puedeActuarEn(expediente.oficinaActual)) {
    return (
      <Card className="p-6">
        <AvisoSoloConsulta oficina={expediente.oficinaNombre} />
      </Card>
    )
  }

  // Las etapas que todavía no tienen pantalla en el sistema nuevo.
  if (expediente.etapa !== 'RECAUDACION') {
    return (
      <Card className="p-6">
        <Alert tone="info">
          La etapa «{expediente.etapaNombre}» del cambio de titularidad todavía no está disponible en esta pantalla. Se suma en la próxima entrega.
        </Alert>
      </Card>
    )
  }

  const loTengoYo = expediente.tomadoPor?.id === actor.id
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="payments" className="text-primary" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Recaudación · Verificación de deuda</h2>
      </div>
      {loTengoYo ? (
        <RecaudacionCambio datos={datos} enEspera={expediente.estado === 'EN_ESPERA'} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {expediente.tomadoPor
              ? `Lo tiene ${expediente.tomadoPor.nombre}. Para trabajarlo tiene que tomarlo usted (si la oficina lo permite).`
              : 'Tome el expediente para verificar la deuda.'}
          </p>
          {tomar.error && <Alert>{mensajeDeError(tomar.error)}</Alert>}
          <Button iconLeft="pan_tool" loading={tomar.isPending} onClick={() => tomar.mutate()}>
            Tomar expediente
          </Button>
        </div>
      )}
    </Card>
  )
}
