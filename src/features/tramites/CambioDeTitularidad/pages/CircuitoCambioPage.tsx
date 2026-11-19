import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ROUTES, RUTA_BANDEJA } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { esNoEncontrado, mensajeDeError, toApiError } from '@/services/api/errors'
import { AvisoDeuda } from '../../AltaDeConcesion/components/circuito/AvisoDeuda'
import { DondeEsta } from '../../AltaDeConcesion/components/circuito/DondeEsta'
import { HistorialAlta } from '../../AltaDeConcesion/components/circuito/HistorialAlta'
import type { CambioBackend } from '../backend.types'
import { CierreCambio } from '../components/circuito/CierreCambio'
import { DatosTitularesCambio } from '../components/circuito/DatosTitularesCambio'
import { DictamenCambio } from '../components/circuito/DictamenCambio'
import { RecaudacionCambio } from '../components/circuito/RecaudacionCambio'
import { ResolucionCambio, ResolucionCargada } from '../components/circuito/ResolucionCambio'
import type { Terminado } from '../components/circuito/terminado'
import { nombres, numeroConcesion } from '../formato'
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
 * Etapas con pantalla: Recaudación, Distrito, Jurídico, Secretaría General y la verificación final en Catastro.
 */
export default function CircuitoCambioPage() {
  const { expedienteId } = useParams()
  const cambio = useCambio(expedienteId)
  const navigate = useNavigate()
  /** «Trámite enviado»: vive acá porque, al pasar de oficina, el panel de trabajo desaparece. */
  const [terminado, setTerminado] = useState<(Terminado & { oficina: string }) | null>(null)

  if (cambio.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (cambio.isError) {
    const error = toApiError(cambio.error)
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(cambio.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : error.status === 403 ? (
          // Ej: personal de un distrito que abre un expediente de otro distrito.
          <EmptyState icon="lock" titulo="No puede ver este expediente" descripcion={error.message} />
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
        description={`Concesión ${numeroConcesion(c.concesion)} · ${
          c.estado === 'FINALIZADO'
            ? `${nombres(c.titularesAnteriores) || 'titular anterior'} → ${nombres(c.titularesActuales)}`
            : `${nombres(c.titularesActuales)} → ${nombres(c.nuevosTitulares) || 'sin nuevo titular'}`
        }`}
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

        {c.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} onTerminado={(t) => setTerminado({ ...t, oficina: expediente.oficinaActual })} />}

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Verificación de datos</h2>
          <UbicacionConcesion datos={datos} />
          {c.resolucion && (
            <div className="mb-4">
              <ResolucionCargada datos={datos} />
            </div>
          )}
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

      <ConfirmDialog
        open={!!terminado}
        tone="success"
        title={terminado?.titulo ?? ''}
        message={terminado?.mensaje ?? ''}
        confirmLabel="Volver a la bandeja"
        cancelLabel="Ver el expediente"
        onConfirm={() => navigate(RUTA_BANDEJA[terminado!.oficina as keyof typeof RUTA_BANDEJA] ?? '/')}
        onCancel={() => setTerminado(null)}
      />
    </>
  )
}

/** Lo que tiene que hacer la oficina donde está el expediente (si es la del usuario). */
function PanelOficina({ datos, onTerminado }: { datos: CambioBackend; onTerminado: (t: Terminado) => void }) {
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

  const panel = PANELES[expediente.etapa]
  // Las etapas que todavía no tienen pantalla en el sistema nuevo.
  if (!panel) {
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
        <Icon name={panel.icono} className="text-primary" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{panel.titulo}</h2>
      </div>
      {loTengoYo ? (
        panel.contenido(datos, onTerminado)
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {expediente.tomadoPor
              ? `Lo tiene ${expediente.tomadoPor.nombre}. Para trabajarlo tiene que tomarlo usted (si la oficina lo permite).`
              : `Tome el expediente para ${panel.accion}.`}
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

/** Lo que hace cada oficina en su etapa. Las que no están acá todavía no tienen pantalla. */
const PANELES: Record<string, { titulo: string; icono: string; accion: string; contenido: (d: CambioBackend, onTerminado: (t: Terminado) => void) => ReactNode }> = {
  RECAUDACION: {
    titulo: 'Recaudación · Verificación de deuda',
    icono: 'payments',
    accion: 'verificar la deuda',
    contenido: (d, onTerminado) => <RecaudacionCambio datos={d} enEspera={d.expediente.estado === 'EN_ESPERA'} onTerminado={onTerminado} />,
  },
  DISTRITO: {
    titulo: 'Jefatura de Distrito · Dictamen técnico',
    icono: 'water_drop',
    accion: 'dictaminar',
    contenido: (d, onTerminado) => <DictamenCambio datos={d} oficina="distrito" onTerminado={onTerminado} />,
  },
  JURIDICO: {
    titulo: 'Jurídico · Dictamen',
    icono: 'gavel',
    accion: 'dictaminar',
    contenido: (d, onTerminado) => <DictamenCambio datos={d} oficina="juridico" onTerminado={onTerminado} />,
  },
  SECRETARIA_GENERAL: {
    titulo: 'Secretaría General · Resolución',
    icono: 'history_edu',
    accion: 'cargar la resolución',
    contenido: (d, onTerminado) => <ResolucionCambio datos={d} onTerminado={onTerminado} />,
  },
  CIERRE: {
    titulo: 'Catastro · Verificación final',
    icono: 'task_alt',
    accion: 'hacer la verificación final',
    contenido: (d, onTerminado) => <CierreCambio datos={d} onTerminado={onTerminado} />,
  },
}

/** Dónde está la concesión (lo que mira Distrito para decidir), con acceso a la ficha en el visor. */
function UbicacionConcesion({ datos }: { datos: CambioBackend }) {
  const { concesion } = datos.cambio
  const u = concesion.ubicacion
  const texto = [u.localidad, u.departamento, u.distrito].filter(Boolean).join(' · ')
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
      <span>
        <span className="text-slate-500 dark:text-slate-400">Concesión {numeroConcesion(concesion)}: </span>
        <strong className="text-slate-900 dark:text-white">{texto || 'ubicación no registrada'}</strong>
        {concesion.padron && <span className="text-slate-500 dark:text-slate-400"> · Padrón {concesion.padron}</span>}
      </span>
      <a href={ROUTES.visorConcesion(concesion.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
        <Icon name="map" className="text-[18px]!" />
        Ver en el visor
      </a>
    </div>
  )
}
