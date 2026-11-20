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
import { nombres, numeroConcesion } from '../../CambioDeTitularidad/formato'
import { DocumentacionRevision } from '../../shared/circuito/DocumentacionRevision'
import { PanelDictamen, type TextosDictamen } from '../../shared/circuito/PanelDictamen'
import { PanelRecaudacion, type HooksRecaudacion } from '../../shared/circuito/PanelRecaudacion'
import type { Terminado } from '../../shared/circuito/terminado'
import type { AnulacionBackend } from '../backend.types'
import {
  useAnulacion,
  useChecklistAnulacion,
  useAntecedentesDeudaAnulacion,
  useBorradorAvisoAnulacion,
  useCursoConDeudaAnulacion,
  useDictaminarAnulacion,
  useNotificarDeudaAnulacion,
  useTomarAnulacion,
  useVerificarDeudaAnulacion,
} from '../hooks'

const TITULO = 'Expediente de anulación'

const TERMINADO: Record<string, string> = {
  FINALIZADO: 'Finalizado: la concesión quedó anulada',
  RECHAZADO: 'Rechazado: la concesión sigue vigente',
  ANULADO: 'Cancelado: iniciado por error',
}

const HOOKS_RECAUDACION: HooksRecaudacion = {
  useAntecedentes: useAntecedentesDeudaAnulacion,
  useVerificar: useVerificarDeudaAnulacion,
  useBorradorAviso: useBorradorAvisoAnulacion,
  useNotificar: useNotificarDeudaAnulacion,
  useCursoConDeuda: useCursoConDeudaAnulacion,
}

const TEXTOS_DICTAMEN: TextosDictamen = {
  informeTecnico: 'Informe técnico de la anulación',
  avisoRechazo: 'La anulación se rechaza: la concesión sigue vigente. No se puede deshacer.',
  botonRechazo: 'Rechazar la anulación',
  tituloConfirmarRechazo: '¿Rechazar la anulación?',
  mensajeConfirmarRechazo: 'El expediente queda rechazado y la concesión sigue vigente. No se puede deshacer.',
  tituloRechazado: 'Anulación rechazada',
  mensajeRechazado: (numero) => `El expediente ${numero} quedó rechazado: la concesión sigue vigente.`,
}

/**
 * Una anulación en el circuito de oficinas (backend real): dónde está, qué hace la oficina que la
 * tiene, los datos de la concesión que se anula y el historial completo.
 * Etapas con pantalla: Recaudación, Distrito y Jurídico. Las demás se suman en los próximos incrementos.
 */
export default function CircuitoAnulacionPage() {
  const { expedienteId } = useParams()
  const anulacion = useAnulacion(expedienteId)
  const navigate = useNavigate()
  /** «Trámite enviado»: vive acá porque, al pasar de oficina, el panel de trabajo desaparece. */
  const [terminado, setTerminado] = useState<(Terminado & { oficina: string }) | null>(null)

  if (anulacion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (anulacion.isError) {
    const error = toApiError(anulacion.error)
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(anulacion.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : error.status === 403 ? (
          <EmptyState icon="lock" titulo="No puede ver este expediente" descripcion={error.message} />
        ) : (
          <ErrorState error={anulacion.error} onRetry={() => void anulacion.refetch()} reintentando={anulacion.isFetching} />
        )}
      </>
    )
  }

  const datos = anulacion.data
  const { expediente, anulacion: a } = datos
  return (
    <>
      <PageHeader title={`${TITULO} ${expediente.numero}`} description={`Concesión ${numeroConcesion(a.concesion)} · ${nombres(a.titulares) || 'sin titular registrado'}`} />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <DondeEsta
            oficina={expediente.oficinaNombre}
            etapa={expediente.etapaNombre}
            tomadoPor={expediente.tomadoPor?.nombre ?? null}
            tomadoEn={expediente.tomadoEn}
            terminado={a.estado === 'EN_TRAMITE' ? null : TERMINADO[a.estado]}
          />
        </Card>

        {datos.avisoDeuda && <AvisoDeuda aviso={datos.avisoDeuda} />}

        {a.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} onTerminado={(t) => setTerminado({ ...t, oficina: expediente.oficinaActual })} />}

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Verificación de datos</h2>
          <DatosAnulacion datos={datos} />
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
function PanelOficina({ datos, onTerminado }: { datos: AnulacionBackend; onTerminado: (t: Terminado) => void }) {
  const actor = useActor()
  const { expediente } = datos
  const tomar = useTomarAnulacion(expediente.id)

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
        <Alert tone="info">La etapa «{expediente.etapaNombre}» de la anulación todavía no está disponible en esta pantalla. Se suma en la próxima entrega.</Alert>
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
const PANELES: Record<string, { titulo: string; icono: string; accion: string; contenido: (d: AnulacionBackend, onTerminado: (t: Terminado) => void) => ReactNode }> = {
  RECAUDACION: {
    titulo: 'Recaudación · Verificación de deuda',
    icono: 'payments',
    accion: 'verificar la deuda',
    contenido: (d, onTerminado) => (
      <PanelRecaudacion
        expediente={d.expediente}
        concesionDelTramite={{ id: d.anulacion.concesion.id, etiqueta: 'La que se anula' }}
        actuales={d.anulacion.titulares.map((t) => t.personaId)}
        nuevos={[]}
        textos={{
          deudaTitulares: 'La anulación no avanza si el titular tiene deuda.',
          concesiones: (titulares) => `Del titular: ${titulares}. Tener otras concesiones solo se informa; lo que frena la anulación es la deuda.`,
        }}
        enEspera={d.expediente.estado === 'EN_ESPERA'}
        hooks={HOOKS_RECAUDACION}
        onTerminado={onTerminado}
      />
    ),
  },
  DISTRITO: {
    titulo: 'Jefatura de Distrito · Dictamen técnico',
    icono: 'water_drop',
    accion: 'dictaminar',
    contenido: (d, onTerminado) => (
      <PanelDictamen
        expediente={d.expediente}
        concesion={numeroConcesion(d.anulacion.concesion)}
        oficina="distrito"
        useDictaminar={useDictaminarAnulacion}
        textos={TEXTOS_DICTAMEN}
        onTerminado={onTerminado}
      />
    ),
  },
  JURIDICO: {
    titulo: 'Jurídico · Dictamen',
    icono: 'gavel',
    accion: 'dictaminar',
    contenido: (d, onTerminado) => <DictamenJuridico datos={d} onTerminado={onTerminado} />,
  },
}

/** Jurídico (pasos 13-16): revisa la documentación presentada en Catastro y dictamina. */
function DictamenJuridico({ datos, onTerminado }: { datos: AnulacionBackend; onTerminado: (t: Terminado) => void }) {
  const checklist = useChecklistAnulacion()
  return (
    <PanelDictamen
      expediente={datos.expediente}
      concesion={numeroConcesion(datos.anulacion.concesion)}
      oficina="juridico"
      useDictaminar={useDictaminarAnulacion}
      textos={TEXTOS_DICTAMEN}
      revision={<DocumentacionRevision checklist={checklist.data} presentados={datos.anulacion.documentacionPresentada} />}
      onTerminado={onTerminado}
    />
  )
}

/** La concesión que se anula: ubicación, titulares, motivo y papeles presentados en Catastro. */
function DatosAnulacion({ datos }: { datos: AnulacionBackend }) {
  const { concesion, titulares, motivo, documentacionPresentada } = datos.anulacion
  const u = concesion.ubicacion
  const ubicacion = [u.localidad, u.departamento, u.distrito].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
        <span>
          <span className="text-slate-500 dark:text-slate-400">Concesión {numeroConcesion(concesion)}: </span>
          <strong className="text-slate-900 dark:text-white">{ubicacion || 'ubicación no registrada'}</strong>
          {concesion.padron && <span className="text-slate-500 dark:text-slate-400"> · Padrón {concesion.padron}</span>}
        </span>
        <a href={ROUTES.visorConcesion(concesion.id)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
          <Icon name="map" className="text-[18px]!" />
          Ver en el visor
        </a>
      </div>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Titulares</dt>
          <dd className="text-slate-900 dark:text-white">
            {titulares.length
              ? titulares.map((t) => (
                  <p key={t.personaId}>
                    {t.nombreCompleto}
                    {t.documento && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        · {t.tipoDocumento} {t.documento}
                      </span>
                    )}
                  </p>
                ))
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Motivo de la anulación</dt>
          <dd className="whitespace-pre-line text-slate-900 dark:text-white">{motivo}</dd>
        </div>
      </dl>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Documentación presentada en Catastro: {documentacionPresentada.map((d) => d.descripcion).join(' · ') || 'no registrada'}.
      </p>
    </div>
  )
}
