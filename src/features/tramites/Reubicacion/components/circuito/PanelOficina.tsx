import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { mensajeDeError } from '@/services/api/errors'
import { numeroConcesion } from '../../../shared/formato'
import { DocumentacionRevision } from '../../../shared/circuito/DocumentacionRevision'
import { PanelDictamen, type TextosDictamen } from '../../../shared/circuito/PanelDictamen'
import { PanelRecaudacion, type HooksRecaudacion } from '../../../shared/circuito/PanelRecaudacion'
import { PanelResolucion } from '../../../shared/circuito/PanelResolucion'
import type { Terminado } from '../../../shared/circuito/terminado'
import type { ReubicacionBackend } from '../../backend.types'
import {
  useAntecedentesDeudaReubicacion,
  useBorradorAvisoReubicacion,
  useChecklistReubicacion,
  useCursoConDeudaReubicacion,
  useDictaminarReubicacion,
  useNotificarDeudaReubicacion,
  useResolucionReubicacion,
  useTomarReubicacion,
  useVerificarDeudaReubicacion,
} from '../../hooks'
import { ObservacionJuridico } from '../Avisos'
import { CierreReubicacion } from './CierreReubicacion'

type AlTerminar = (t: Terminado) => void

const HOOKS_RECAUDACION: HooksRecaudacion = {
  useAntecedentes: useAntecedentesDeudaReubicacion,
  useVerificar: useVerificarDeudaReubicacion,
  useBorradorAviso: useBorradorAvisoReubicacion,
  useNotificar: useNotificarDeudaReubicacion,
  useCursoConDeuda: useCursoConDeudaReubicacion,
}

const TEXTOS_RECAUDACION = {
  deudaTitulares: 'La reubicación no avanza si el titular tiene deuda.',
  concesiones: (titulares: string) => `Del titular: ${titulares}. Tener otras concesiones solo se informa; lo que frena la reubicación es la deuda.`,
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

const TEXTOS_RESOLUCION = {
  destino: 'Catastro · cierre de la reubicación',
  mensajeRegistrada: (resolucion: string, expediente: string) =>
    `Resolución ${resolucion} registrada. El expediente ${expediente} pasó a Catastro para el cierre: recién ahí el nuevo lugar y la forma de servicio rigen en la concesión.`,
}

interface Panel {
  titulo: string
  icono: string
  /** «Tome el expediente para …». */
  accion: string
  contenido: (d: ReubicacionBackend, onTerminado: AlTerminar) => ReactNode
}

/** Lo que hace cada oficina en su etapa. Las que no están acá todavía no tienen pantalla. */
const PANELES: Record<string, Panel> = {
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
        textos={TEXTOS_RECAUDACION}
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
    contenido: (d, onTerminado) => <Dictamen datos={d} oficina="distrito" onTerminado={onTerminado} />,
  },
  JURIDICO: {
    titulo: 'Jurídico · Dictamen',
    icono: 'gavel',
    accion: 'dictaminar',
    contenido: (d, onTerminado) => <DictamenJuridico datos={d} onTerminado={onTerminado} />,
  },
  SECRETARIA_GENERAL: {
    titulo: 'Secretaría General · Resolución',
    icono: 'history_edu',
    accion: 'cargar la resolución',
    contenido: (d, onTerminado) => (
      <PanelResolucion
        expediente={d.expediente}
        concesion={numeroConcesion(d.reubicacion.concesion)}
        useResolucion={useResolucionReubicacion}
        textos={TEXTOS_RESOLUCION}
        onTerminado={onTerminado}
      />
    ),
  },
  CIERRE: {
    titulo: 'Catastro · Cierre de la reubicación',
    icono: 'task_alt',
    accion: 'cerrar la reubicación',
    contenido: (d, onTerminado) => <CierreReubicacion datos={d} onTerminado={onTerminado} />,
  },
  CORRECCION: {
    titulo: 'Catastro · Corrección de lo observado',
    icono: 'rate_review',
    accion: 'corregir la propuesta',
    contenido: (d) => <CorreccionCatastro datos={d} />,
  },
}

/** Lo que tiene que hacer la oficina donde está el expediente (si es la del usuario y lo tomó). */
export function PanelOficina({ datos, onTerminado }: { datos: ReubicacionBackend; onTerminado: AlTerminar }) {
  const actor = useActor()
  const { expediente } = datos
  const tomar = useTomarReubicacion(expediente.id)
  const panel = PANELES[expediente.etapa]

  if (!actor.puedeActuarEn(expediente.oficinaActual)) {
    return (
      <Card className="p-6">
        <AvisoSoloConsulta oficina={expediente.oficinaNombre} />
      </Card>
    )
  }

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

/** Distrito (apto / no apto) y Jurídico (apto / observado / no apto, con la revisión de la documentación). */
function Dictamen({ datos, oficina, revision, onTerminado }: { datos: ReubicacionBackend; oficina: 'distrito' | 'juridico'; revision?: ReactNode; onTerminado: AlTerminar }) {
  return (
    <PanelDictamen
      expediente={datos.expediente}
      concesion={numeroConcesion(datos.reubicacion.concesion)}
      oficina={oficina}
      useDictaminar={useDictaminarReubicacion}
      textos={TEXTOS_DICTAMEN}
      revision={revision}
      onTerminado={onTerminado}
    />
  )
}

/**
 * Jurídico: revisa la documentación presentada en Catastro y, en la misma pantalla, el lugar vigente
 * contra el propuesto (el «croquis», más abajo en «La reubicación»).
 */
function DictamenJuridico({ datos, onTerminado }: { datos: ReubicacionBackend; onTerminado: AlTerminar }) {
  const checklist = useChecklistReubicacion()
  return (
    <Dictamen
      datos={datos}
      oficina="juridico"
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
      {observacion && <ObservacionJuridico observacion={observacion} />}
      <Button iconRight="edit" onClick={() => navigate(ROUTES.tramites.reubicacion.propuesta(datos.expediente.id))}>
        Corregir la propuesta
      </Button>
    </div>
  )
}
