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
import { ubicacionConcesion } from '../../Anulacion/formato'
import { nombres, numeroConcesion } from '../../CambioDeTitularidad/formato'
import { DocumentacionRevision } from '../../shared/circuito/DocumentacionRevision'
import { PanelDictamen, type TextosDictamen } from '../../shared/circuito/PanelDictamen'
import { PanelRecaudacion, type HooksRecaudacion } from '../../shared/circuito/PanelRecaudacion'
import type { Terminado } from '../../shared/circuito/terminado'
import type { ReubicacionBackend } from '../backend.types'
import { ComparacionPoligono, ComparacionServicio } from '../components/ComparacionReubicacion'
import { formatearFecha } from '@/config/expedientes'
import { terminado as terminadoComo } from '../formato'
import {
  useAntecedentesDeudaReubicacion,
  useChecklistReubicacion,
  useBorradorAvisoReubicacion,
  useCursoConDeudaReubicacion,
  useDictaminarReubicacion,
  useNotificarDeudaReubicacion,
  useReubicacion,
  useTomarReubicacion,
  useVerificarDeudaReubicacion,
} from '../hooks'

const TITULO = 'Expediente de reubicación'

const HOOKS_RECAUDACION: HooksRecaudacion = {
  useAntecedentes: useAntecedentesDeudaReubicacion,
  useVerificar: useVerificarDeudaReubicacion,
  useBorradorAviso: useBorradorAvisoReubicacion,
  useNotificar: useNotificarDeudaReubicacion,
  useCursoConDeuda: useCursoConDeudaReubicacion,
}

const TEXTOS_DICTAMEN: TextosDictamen = {
  informeTecnico: 'Informe técnico de la forma de servicio (fuente, sistema, toma, sistema de riego…)',
  avisoRechazo: 'La reubicación se rechaza: la concesión sigue como estaba. No se puede deshacer.',
  botonRechazo: 'Rechazar la reubicación',
  tituloConfirmarRechazo: '¿Rechazar la reubicación?',
  mensajeConfirmarRechazo: 'El expediente queda rechazado y la concesión sigue con su ubicación y forma de servicio actuales. No se puede deshacer.',
  tituloRechazado: 'Reubicación rechazada',
  mensajeRechazado: (numero) => `El expediente ${numero} quedó rechazado: la concesión sigue como estaba.`,
}

/**
 * Una reubicación en el circuito de oficinas (backend real): dónde está, qué hace la oficina que la
 * tiene, lo vigente contra lo propuesto y el historial completo.
 * Etapas con pantalla: Recaudación, Distrito, Jurídico y la corrección en Catastro (si Jurídico
 * la observa). Las demás se suman en las próximas entregas.
 */
export default function CircuitoReubicacionPage() {
  const { expedienteId } = useParams()
  const reubicacion = useReubicacion(expedienteId)
  const navigate = useNavigate()
  /** «Trámite enviado»: vive acá porque, al pasar de oficina, el panel de trabajo desaparece. */
  const [terminado, setTerminado] = useState<(Terminado & { oficina: string }) | null>(null)

  if (reubicacion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (reubicacion.isError) {
    const error = toApiError(reubicacion.error)
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(reubicacion.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : error.status === 403 ? (
          <EmptyState icon="lock" titulo="No puede ver este expediente" descripcion={error.message} />
        ) : (
          <ErrorState error={reubicacion.error} onRetry={() => void reubicacion.refetch()} reintentando={reubicacion.isFetching} />
        )}
      </>
    )
  }

  const datos = reubicacion.data
  const { expediente, reubicacion: r } = datos
  return (
    <>
      <PageHeader title={`${TITULO} ${expediente.numero}`} description={`Concesión ${numeroConcesion(r.concesion)} · ${nombres(r.titulares) || 'sin titular registrado'}`} />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <DondeEsta
            oficina={expediente.oficinaNombre}
            etapa={expediente.etapaNombre}
            tomadoPor={expediente.tomadoPor?.nombre ?? null}
            tomadoEn={expediente.tomadoEn}
            terminado={terminadoComo(r.estado)}
          />
        </Card>

        {datos.avisoDeuda && <AvisoDeuda aviso={datos.avisoDeuda} />}

        {r.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} onTerminado={(t) => setTerminado({ ...t, oficina: expediente.oficinaActual })} />}

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">La reubicación</h2>
          <DatosReubicacion datos={datos} />
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
function PanelOficina({ datos, onTerminado }: { datos: ReubicacionBackend; onTerminado: (t: Terminado) => void }) {
  const actor = useActor()
  const { expediente } = datos
  const tomar = useTomarReubicacion(expediente.id)

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
        <Alert tone="info">La etapa «{expediente.etapaNombre}» de la reubicación todavía no está disponible en esta pantalla. Se suma en la próxima entrega.</Alert>
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
const PANELES: Record<string, { titulo: string; icono: string; accion: string; contenido: (d: ReubicacionBackend, onTerminado: (t: Terminado) => void) => ReactNode }> = {
  RECAUDACION: {
    titulo: 'Recaudación · Verificación de deuda',
    icono: 'payments',
    accion: 'verificar la deuda',
    contenido: (d, onTerminado) => (
      <PanelRecaudacion
        expediente={d.expediente}
        concesionDelTramite={{ id: d.reubicacion.concesion.id, etiqueta: 'La que se reubica' }}
        actuales={d.reubicacion.titulares.map((t) => t.personaId)}
        nuevos={[]}
        textos={{
          deudaTitulares: 'La reubicación no avanza si el titular tiene deuda.',
          concesiones: (titulares) => `Del titular: ${titulares}. Tener otras concesiones solo se informa; lo que frena la reubicación es la deuda.`,
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
        concesion={numeroConcesion(d.reubicacion.concesion)}
        oficina="distrito"
        useDictaminar={useDictaminarReubicacion}
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
  CORRECCION: {
    titulo: 'Catastro · Corrección de lo observado',
    icono: 'rate_review',
    accion: 'corregir la propuesta',
    contenido: (d) => <CorreccionCatastro datos={d} />,
  },
}

/**
 * Jurídico: revisa la documentación presentada en Catastro y, en la misma pantalla, el lugar vigente
 * contra el propuesto (el «croquis»). Apto / observado (vuelve a Catastro) / no apto.
 */
function DictamenJuridico({ datos, onTerminado }: { datos: ReubicacionBackend; onTerminado: (t: Terminado) => void }) {
  const checklist = useChecklistReubicacion()
  return (
    <PanelDictamen
      expediente={datos.expediente}
      concesion={numeroConcesion(datos.reubicacion.concesion)}
      oficina="juridico"
      useDictaminar={useDictaminarReubicacion}
      textos={TEXTOS_DICTAMEN}
      revision={<DocumentacionRevision checklist={checklist.data} presentados={datos.reubicacion.documentacionPresentada} />}
      onTerminado={onTerminado}
    />
  )
}

/** Catastro: lo que observó Jurídico y el acceso a la propuesta para corregirla y reenviarla. */
function CorreccionCatastro({ datos }: { datos: ReubicacionBackend }) {
  const navigate = useNavigate()
  const { observacion } = datos.reubicacion
  return (
    <div className="flex flex-col items-start gap-4">
      {observacion && (
        <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">
            Observado por {observacion.oficina} el {formatearFecha(observacion.fecha)}
          </p>
          <p className="whitespace-pre-line">{observacion.texto ?? 'Sin detalle.'}</p>
        </div>
      )}
      <Button iconRight="edit" onClick={() => navigate(ROUTES.tramites.reubicacion.propuesta(datos.expediente.id))}>
        Corregir la propuesta
      </Button>
    </div>
  )
}

/** La concesión (que no se mueve), el motivo, los papeles y lo vigente contra lo propuesto. */
function DatosReubicacion({ datos }: { datos: ReubicacionBackend }) {
  const { concesion, titulares, motivoTexto, documentacionPresentada, vigente, propuesta, avisos } = datos.reubicacion
  const ubicacion = ubicacionConcesion(concesion.ubicacion)
  return (
    <div className="flex flex-col gap-5">
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
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Titulares (no cambian)</dt>
          <dd className="text-slate-900 dark:text-white">{nombres(titulares) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Motivo de la reubicación</dt>
          <dd className="whitespace-pre-line text-slate-900 dark:text-white">{motivoTexto}</dd>
        </div>
      </dl>

      <Seccion titulo="Nuevo lugar al que llega el agua">
        {propuesta.poligono ? <ComparacionPoligono vigente={vigente.poligono} propuesto={propuesta.poligono} /> : <p className="text-sm text-slate-500">Todavía no se cargó.</p>}
      </Seccion>

      <Seccion titulo="Forma de servicio">
        <ComparacionServicio vigente={vigente} propuesto={propuesta.servicio} />
      </Seccion>

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="mb-1 font-semibold">Avisos de Catastro</p>
          <ul className="list-disc pl-5">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Documentación presentada en Catastro: {documentacionPresentada.map((d) => d.descripcion).join(' · ') || 'no registrada'}.
      </p>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
      {children}
    </section>
  )
}
