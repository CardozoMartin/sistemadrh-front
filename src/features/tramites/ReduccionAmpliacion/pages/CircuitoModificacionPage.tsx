import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES, RUTA_BANDEJA } from '@/config/routes'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { esNoEncontrado, mensajeDeError, toApiError } from '@/services/api/errors'
import { AvisoDeuda } from '../../shared/circuito/AvisoDeuda'
import { DondeEsta } from '../../shared/circuito/DondeEsta'
import { HistorialExpediente } from '../../shared/circuito/HistorialExpediente'
import { DocumentacionRevision } from '../../shared/circuito/DocumentacionRevision'
import { PanelDictamen, type OficinaDictamen, type TextosDictamen } from '../../shared/circuito/PanelDictamen'
import { PanelRecaudacion } from '../../shared/circuito/PanelRecaudacion'
import { PanelResolucion, ResolucionCargada } from '../../shared/circuito/PanelResolucion'
import type { Terminado } from '../../shared/circuito/terminado'
import { hectareas, numeroConcesion } from '../../shared/formato'
import { modificacionApi } from '../api'
import { NOMBRE_TIPO, type ModificacionBackend } from '../backend.types'
import { CierreModificacion } from '../components/CierreModificacion'
import { SuperficieResumen } from '../components/SuperficieResumen'
import { TitularesModificacion } from '../components/TitularesModificacion'
import { HOOKS_RECAUDACION_MODIFICACION, useChecklistModificacion, useDictaminarModificacion, useModificacion, useResolucionModificacion, useTomarModificacion } from '../hooks'

const TITULO = 'Expediente de ampliación / reducción'

const TEXTOS_RECAUDACION = {
  deudaTitulares: 'La ampliación / reducción no avanza si algún titular tiene deuda.',
  concesiones: (titulares: string) => `De ${titulares}. Tener otras concesiones solo se informa; lo que frena el trámite es la deuda.`,
}

const TEXTOS_DICTAMEN: TextosDictamen = {
  informeTecnico: 'Informe técnico (inspección: el plano, la forma de servicio y el suministro)',
  avisoRechazo: 'Se rechaza la ampliación / reducción: la concesión sigue igual, con su superficie. No se puede deshacer.',
  botonRechazo: 'Rechazar el trámite',
  tituloConfirmarRechazo: '¿Rechazar el trámite?',
  mensajeConfirmarRechazo: 'El expediente queda rechazado: la concesión sigue igual, con su superficie. No se puede deshacer.',
  tituloRechazado: 'Trámite rechazado',
  mensajeRechazado: (numero) => `El expediente ${numero} quedó rechazado: la concesión sigue igual, con su superficie.`,
}

const TEXTOS_RESOLUCION = {
  destino: 'Catastro · verificación final',
  mensajeRegistrada: (resolucion: string, expediente: string) =>
    `Resolución ${resolucion} registrada. El expediente ${expediente} pasó a Catastro para la verificación final: ahí se carga el caudal asignado y la concesión queda con la nueva superficie.`,
}

const TERMINADO: Record<string, string> = {
  FINALIZADO: 'Finalizado: la concesión quedó con la nueva superficie',
  RECHAZADO: 'Rechazado: la concesión sigue igual',
  ANULADO: 'Anulado: iniciado por error',
}

/**
 * Una ampliación / reducción en el circuito de oficinas (backend real): dónde está, qué hace la
 * oficina que lo tiene, la superficie antes y después, los titulares y el historial completo.
 */
export default function CircuitoModificacionPage() {
  const { expedienteId } = useParams()
  const consulta = useModificacion(expedienteId)
  const navigate = useNavigate()
  /** «Trámite enviado»: vive acá porque, al pasar de oficina, el panel de trabajo desaparece. */
  const [terminado, setTerminado] = useState<(Terminado & { oficina: string }) | null>(null)

  if (consulta.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (consulta.isError) {
    const error = toApiError(consulta.error)
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(consulta.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : error.status === 403 ? (
          // Ej: un jefe de Distrito que abre un expediente en curso de otro distrito.
          <EmptyState icon="lock" titulo="No puede ver este expediente" descripcion={error.message} />
        ) : (
          <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} reintentando={consulta.isFetching} />
        )}
      </>
    )
  }

  const datos = consulta.data
  const { expediente, modificacion: m } = datos
  const nueva = m.superficie.nuevaHa === null ? 'sin plano' : hectareas(m.superficie.nuevaHa)
  return (
    <>
      <PageHeader title={`${TITULO} ${expediente.numero}`} description={`${NOMBRE_TIPO[m.tipo]} de la concesión ${numeroConcesion(m.concesion)} · ${hectareas(m.superficie.actualHa)} → ${nueva}`} />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <DondeEsta
            oficina={expediente.oficinaNombre}
            etapa={expediente.etapaNombre}
            tomadoPor={expediente.tomadoPor?.nombre ?? null}
            tomadoEn={expediente.tomadoEn}
            terminado={m.estado === 'EN_TRAMITE' ? null : TERMINADO[m.estado]}
          />
        </Card>

        {datos.avisoDeuda && <AvisoDeuda aviso={datos.avisoDeuda} />}

        {m.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} onTerminado={(t) => setTerminado({ ...t, oficina: expediente.oficinaActual })} />}

        <Card className="flex flex-col gap-5 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Verificación de datos</h2>
          <UbicacionConcesion datos={datos} />
          {m.resolucion && <ResolucionCargada expedienteId={expediente.id} resolucion={m.resolucion} descargar={modificacionApi.archivoResolucion} />}
          <SuperficieResumen datos={datos} />
          <TitularesModificacion datos={datos} />
          <p className="text-xs text-slate-500 dark:text-slate-400">Documentación presentada en Catastro: {m.documentacionPresentada.map((d) => d.descripcion).join(' · ') || 'no registrada'}.</p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial del expediente</h2>
          <HistorialExpediente expedienteId={expediente.id} />
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
function PanelOficina({ datos, onTerminado }: { datos: ModificacionBackend; onTerminado: (t: Terminado) => void }) {
  const actor = useActor()
  const navigate = useNavigate()
  const { expediente } = datos
  const tomar = useTomarModificacion(expediente.id)

  if (!actor.puedeActuarEn(expediente.oficinaActual)) {
    return (
      <Card className="p-6">
        <AvisoSoloConsulta oficina={expediente.oficinaNombre} />
      </Card>
    )
  }

  // Catastro: la carga y la corrección se hacen en la pantalla del plano.
  if (expediente.etapa === 'CARGA' || expediente.etapa === 'CORRECCION') {
    const correccion = expediente.etapa === 'CORRECCION'
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <div className="flex items-center gap-2">
          <Icon name={correccion ? 'edit_note' : 'map'} className="text-primary" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{correccion ? 'Catastro · Corregir lo observado' : 'Catastro · Carga del plano'}</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {correccion ? 'Una oficina observó el trámite (ver el historial). Corrija o complete y reenvíelo: vuelve a la oficina que lo observó.' : 'Falta terminar la carga y enviarlo a Recaudación.'}
        </p>
        <Button iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.datos(expediente.id))}>
          {correccion ? 'Corregir y reenviar' : 'Continuar la carga'}
        </Button>
      </Card>
    )
  }

  const panel = panelDe(datos, onTerminado)
  if (!panel) {
    return (
      <Card className="p-6">
        <Alert tone="info">La etapa «{expediente.etapaNombre}» no tiene acciones en esta pantalla.</Alert>
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
        panel.contenido
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {expediente.tomadoPor ? `Lo tiene ${expediente.tomadoPor.nombre}. Para trabajarlo tiene que tomarlo usted (si la oficina lo permite).` : `Tome el expediente para ${panel.accion}.`}
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

/** Lo que hace cada oficina en su etapa. */
function panelDe(datos: ModificacionBackend, onTerminado: (t: Terminado) => void): { titulo: string; icono: string; accion: string; contenido: ReactNode } | null {
  const { expediente, modificacion: m } = datos
  switch (expediente.etapa) {
    case 'RECAUDACION':
      return {
        titulo: 'Recaudación · Verificación de deuda',
        icono: 'payments',
        accion: 'verificar la deuda',
        contenido: (
          <PanelRecaudacion
            expediente={expediente}
            concesionDelTramite={{ id: m.concesion.id, etiqueta: 'La del trámite' }}
            actuales={m.titularesActuales.map((t) => t.personaId)}
            nuevos={m.nuevosTitulares.map((t) => t.personaId)}
            textos={TEXTOS_RECAUDACION}
            enEspera={expediente.estado === 'EN_ESPERA'}
            hooks={HOOKS_RECAUDACION_MODIFICACION}
            onTerminado={onTerminado}
          />
        ),
      }
    case 'DISTRITO':
      return {
        titulo: 'Jefatura de Distrito · Inspección e informe técnico',
        icono: 'water_drop',
        accion: 'dictaminar',
        contenido: (
          <Dictamen
            datos={datos}
            oficina="distrito"
            revision={
              <Alert tone="info">
                Revise la superficie, el plano y el caudal en «Verificación de datos» (abajo) e informe la inspección: si la forma de servicio o el suministro no alcanzan, corresponde «No apto».
              </Alert>
            }
            onTerminado={onTerminado}
          />
        ),
      }
    case 'JURIDICO':
      return { titulo: 'Jurídico · Dictamen', icono: 'gavel', accion: 'dictaminar', contenido: <DictamenJuridico datos={datos} onTerminado={onTerminado} /> }
    case 'SECRETARIA_GENERAL':
      return {
        titulo: 'Secretaría General · Resolución',
        icono: 'history_edu',
        accion: 'cargar la resolución',
        contenido: <PanelResolucion expediente={expediente} concesion={numeroConcesion(m.concesion)} useResolucion={useResolucionModificacion} textos={TEXTOS_RESOLUCION} onTerminado={onTerminado} />,
      }
    case 'CIERRE':
      return { titulo: 'Catastro · Verificación final', icono: 'task_alt', accion: 'hacer la verificación final', contenido: <CierreModificacion datos={datos} onTerminado={onTerminado} /> }
    default:
      return null
  }
}

/** Distrito y Jurídico: apto, observado (vuelve a Catastro) o no apto, con el panel común. */
function Dictamen({ datos, oficina, revision, onTerminado }: { datos: ModificacionBackend; oficina: OficinaDictamen; revision?: ReactNode; onTerminado: (t: Terminado) => void }) {
  return (
    <PanelDictamen
      expediente={datos.expediente}
      concesion={numeroConcesion(datos.modificacion.concesion)}
      oficina={oficina}
      useDictaminar={useDictaminarModificacion}
      textos={TEXTOS_DICTAMEN}
      revision={revision}
      conObservado
      onTerminado={onTerminado}
    />
  )
}

/** Jurídico revisa la documentación presentada en Catastro contra el checklist del trámite. */
function DictamenJuridico({ datos, onTerminado }: { datos: ModificacionBackend; onTerminado: (t: Terminado) => void }) {
  const checklist = useChecklistModificacion()
  return (
    <Dictamen datos={datos} oficina="juridico" revision={<DocumentacionRevision checklist={checklist.data} presentados={datos.modificacion.documentacionPresentada} />} onTerminado={onTerminado} />
  )
}

/** Dónde está la concesión, con acceso a la ficha en el visor. */
function UbicacionConcesion({ datos }: { datos: ModificacionBackend }) {
  const { concesion } = datos.modificacion
  const u = concesion.ubicacion
  const texto = [u.localidad, u.departamento, u.distrito].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
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
