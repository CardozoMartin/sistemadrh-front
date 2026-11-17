import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { Campo, Observaciones, Opciones } from '@/features/tramites/AltaDeConcesion/components/circuito/AccionesOficina'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { bajaPozoApi } from '../api'
import { formatoFecha, formatoPesos } from '../estilos'
import { useAccionBaja, useDocumentosBaja } from '../hooks'
import type { BajaBackend, DictamenJuridicoDto, EvaluacionTecnicaDto } from '../types'
import { aDatosBajaDto, DatosSolicitudCampos, faltaEnSolicitud, obligatoriosFaltantes, type DatosSolicitudForm } from './DatosBajaForm'

const hoy = () => new Date().toISOString().slice(0, 10)
const formSolicitud = (b: BajaBackend): DatosSolicitudForm => ({
  motivo: b.baja.motivo,
  solicitanteNombre: b.baja.solicitanteNombre ?? '',
  solicitanteDocumento: b.baja.solicitanteDocumento ?? '',
  documentacionPresentada: b.baja.documentacion.filter((d) => d.presentado).map((d) => d.codigo),
})

/** Pregunta de sí / no como dos botones. */
function SiNo({ valor, onChange, si = 'Sí', no = 'No' }: { valor: boolean | null; onChange: (v: boolean) => void; si?: string; no?: string }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={valor === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-lg border-2 px-4 py-1.5 text-sm font-semibold',
            valor === v ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
          )}
        >
          {v ? si : no}
        </button>
      ))}
    </div>
  )
}

/** Bloque con título dentro de un formulario. */
function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
      {children}
    </div>
  )
}

/** Deuda de la tasa de uso del agua de los titulares de la concesión. */
function DeudasTasa({ b }: { b: BajaBackend }) {
  if (!b.baja.concesionAnterior) return <p className="text-sm text-slate-500 dark:text-slate-400">El pozo no abastece ninguna concesión: no hay tasa asociada.</p>
  if (!b.deudasTasa.length) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
        <Icon name="check_circle" className="text-[18px]!" /> Sin deudas registradas de la tasa (concesión {b.baja.concesionAnterior}).
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1 text-sm text-amber-800 dark:text-amber-300">
      {b.deudasTasa.map((d, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <Icon name="warning" className="text-[18px]!" />
          {d.persona}: {d.detalle}
          {d.monto !== null && ` · ${formatoPesos(d.monto)}`}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Pozos: mesa de entrada (documentación) y corrección
// ---------------------------------------------------------------------------

function AccionDocumentacion({ b }: { b: BajaBackend }) {
  const documentos = useDocumentosBaja()
  const [datos, setDatos] = useState(() => formSolicitud(b))
  const [observaciones, setObservaciones] = useState('')
  const guardar = useAccionBaja(b.expediente.id, bajaPozoApi.actualizar)
  const controlar = useAccionBaja(b.expediente.id, bajaPozoApi.documentacion)
  const falta = faltaEnSolicitud(datos)
  const faltantes = obligatoriosFaltantes(documentos.data ?? [], datos.documentacionPresentada)
  const enEspera = b.expediente.estado === 'EN_ESPERA'

  /** Guarda lo que se ve y, si salió bien, registra el resultado del control. */
  const registrar = (resultado: 'COMPLETA' | 'PENDIENTE') =>
    guardar.mutate(aDatosBajaDto(datos), { onSuccess: () => controlar.mutate({ resultado, observaciones: observaciones.trim() || undefined }) })

  return (
    <div className="flex flex-col gap-4">
      {enEspera ? (
        <Alert tone="info">El expediente está en espera: falta documentación. Cuando el titular la presente, márquela y registre la documentación completa.</Alert>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Controle la solicitud y la documentación presentada. Si falta algo obligatorio, el expediente queda en espera hasta que se complete.</p>
      )}
      <DatosSolicitudCampos valor={datos} onChange={setDatos} />
      <Observaciones valor={observaciones} onChange={setObservaciones} placeholder={faltantes.length ? 'Qué falta y a quién se le pidió' : undefined} />
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {(guardar.error || controlar.error) && <Alert>{mensajeDeError(guardar.error ?? controlar.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button iconRight="arrow_forward" disabled={!!falta || faltantes.length > 0} loading={controlar.isPending && controlar.variables?.resultado === 'COMPLETA'} onClick={() => registrar('COMPLETA')}>
          Documentación completa: verificar antecedentes
        </Button>
        {faltantes.length > 0 && (
          <Button variant="secondary" iconLeft="pause_circle" disabled={!!falta} loading={controlar.isPending && controlar.variables?.resultado === 'PENDIENTE'} onClick={() => registrar('PENDIENTE')}>
            {enEspera ? 'Sigue faltando: actualizar' : 'Falta documentación: dejar en espera'}
          </Button>
        )}
        <Button variant="ghost" iconLeft="save" disabled={!!falta} loading={guardar.isPending && !controlar.isPending} onClick={() => guardar.mutate(aDatosBajaDto(datos))}>
          Guardar
        </Button>
      </div>
    </div>
  )
}

function AccionCorreccion({ b }: { b: BajaBackend }) {
  const [datos, setDatos] = useState(() => formSolicitud(b))
  const [observaciones, setObservaciones] = useState('')
  const guardar = useAccionBaja(b.expediente.id, bajaPozoApi.actualizar)
  const reenviar = useAccionBaja(b.expediente.id, (id, obs: string | undefined) => bajaPozoApi.reenviar(id, obs))
  const falta = faltaEnSolicitud(datos)
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">Jurídico observó la baja (el motivo está en el historial). Corrija lo que haga falta y reenvíela: vuelve a Jurídico.</Alert>
      <DatosSolicitudCampos valor={datos} onChange={setDatos} />
      <Observaciones valor={observaciones} onChange={setObservaciones} placeholder="Qué se corrigió" />
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {(guardar.error || reenviar.error) && <Alert>{mensajeDeError(guardar.error ?? reenviar.error)}</Alert>}
      <div>
        <Button iconRight="send" disabled={!!falta} loading={guardar.isPending || reenviar.isPending} onClick={() => guardar.mutate(aDatosBajaDto(datos), { onSuccess: () => reenviar.mutate(observaciones.trim() || undefined) })}>
          Reenviar a Jurídico
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pozos: antecedentes
// ---------------------------------------------------------------------------

function AccionAntecedentes({ b }: { b: BajaBackend }) {
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionBaja(b.expediente.id, (id, obs: string | undefined) => bajaPozoApi.antecedentes(id, obs))
  const p = b.pozo
  const anteriores = p.expedientes.filter((e) => e.id !== b.expediente.id)
  const titular = p.concesion?.titular

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Lo que la DRH ya tiene registrado del pozo. Verifique que coincida con la solicitud.</p>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 dark:bg-slate-800/60">
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Perforación en el registro</dt>
          <dd className="text-slate-800 dark:text-slate-100">
            {p.idInterno} · {p.estado === 'EN_USO' ? 'en uso' : p.estado.toLowerCase().replaceAll('_', ' ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Ubicación</dt>
          <dd className="text-slate-800 dark:text-slate-100">{[p.concesion?.localidad, p.concesion?.departamento].filter(Boolean).join(', ') || `${p.latitud.toFixed(5)}, ${p.longitud.toFixed(5)}`}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Titular registrado</dt>
          <dd className="text-slate-800 dark:text-slate-100">{titular ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Solicitante</dt>
          <dd className="text-slate-800 dark:text-slate-100">
            {b.baja.solicitanteNombre}
            {titular && b.baja.solicitanteNombre && !titular.toUpperCase().includes(b.baja.solicitanteNombre.toUpperCase().split(' ')[0]) && (
              <span className="ml-1 text-xs font-semibold text-amber-700 dark:text-amber-300">(no coincide con el titular: revisar poder)</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Concesión asociada</dt>
          <dd className="text-slate-800 dark:text-slate-100">{p.concesion ? `${p.concesion.numero ?? 's/n'} · ${p.concesion.estado.toLowerCase()}` : 'Ninguna'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400 uppercase">Trámites anteriores</dt>
          <dd className="text-slate-800 dark:text-slate-100">{anteriores.length ? anteriores.map((e) => e.numero).join(', ') : 'Ninguno en el sistema'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="mb-1 text-xs font-semibold text-slate-400 uppercase">Tasa de uso del agua</dt>
          <dd>
            <DeudasTasa b={b} />
          </dd>
        </div>
      </dl>
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="arrow_forward" loading={accion.isPending} onClick={() => accion.mutate(observaciones.trim() || undefined)}>
          Antecedentes verificados: evaluación técnica
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pozos: evaluación técnica
// ---------------------------------------------------------------------------

function AccionEvaluacion({ b }: { b: BajaBackend }) {
  const [inspeccion, setInspeccion] = useState<boolean | null>(b.baja.inspeccionRealizada)
  const [fecha, setFecha] = useState(b.baja.fechaInspeccion ?? '')
  const [observacionesInspeccion, setObservacionesInspeccion] = useState(b.baja.observacionesInspeccion ?? '')
  const [informe, setInforme] = useState(b.baja.informeTecnico ?? '')
  const [clausura, setClausura] = useState<boolean | null>(b.baja.requiereClausura)
  const [resultado, setResultado] = useState<EvaluacionTecnicaDto['resultado'] | ''>('')
  const accion = useAccionBaja(b.expediente.id, bajaPozoApi.evaluacionTecnica)
  const enEspera = b.expediente.estado === 'EN_ESPERA'

  const falta =
    inspeccion === null
      ? 'Indique si se hizo inspección de campo.'
      : inspeccion && !fecha
        ? 'Ingrese la fecha de la inspección.'
        : !informe.trim()
          ? 'Cargue el informe técnico.'
          : !resultado
            ? 'Elija el resultado de la evaluación.'
            : resultado === 'FAVORABLE' && clausura === null
              ? 'Indique si corresponde la clausura física.'
              : null

  const enviar = () =>
    accion.mutate({
      resultado: resultado as EvaluacionTecnicaDto['resultado'],
      inspeccionRealizada: !!inspeccion,
      fechaInspeccion: inspeccion ? fecha : undefined,
      observacionesInspeccion: observacionesInspeccion.trim() || undefined,
      informeTecnico: informe.trim(),
      requiereClausura: resultado === 'FAVORABLE' ? !!clausura : undefined,
    })

  return (
    <div className="flex flex-col gap-4">
      {enEspera ? (
        <Alert tone="info">En espera de subsanación (el pedido está en el historial). Cuando se resuelva, vuelva a evaluar.</Alert>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Determine qué corresponde hacer con la perforación.</p>
      )}
      <Bloque titulo="Inspección de campo">
        <div className="flex flex-col gap-3">
          <SiNo valor={inspeccion} onChange={setInspeccion} si="Se hizo inspección" no="Sin inspección" />
          {inspeccion && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo etiqueta="Fecha">
                <input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} className={controlClass({})} />
              </Campo>
              <div className="sm:col-span-2">
                <Campo etiqueta="Qué se constató">
                  <textarea value={observacionesInspeccion} onChange={(e) => setObservacionesInspeccion(e.target.value)} rows={2} className={controlClass({ className: 'resize-y' })} />
                </Campo>
              </div>
            </div>
          )}
        </div>
      </Bloque>
      <Campo etiqueta="Informe técnico">
        <textarea value={informe} onChange={(e) => setInforme(e.target.value)} rows={4} className={controlClass({ className: 'resize-y' })} />
      </Campo>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'FAVORABLE', texto: 'Favorable', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'REQUIERE_SUBSANACION', texto: 'Requiere subsanación', icono: 'pending_actions', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
        ]}
      />
      {resultado === 'FAVORABLE' && (
        <Bloque titulo="¿Corresponde la clausura física (sellado) de la perforación?">
          <SiNo valor={clausura} onChange={setClausura} si="Sí, hay que clausurarla" no="No corresponde" />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Si corresponde, después de la resolución el expediente vuelve a Pozos para registrar el acta de clausura.</p>
        </Bloque>
      )}
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight={resultado === 'REQUIERE_SUBSANACION' ? 'pause_circle' : 'send'} disabled={!!falta} loading={accion.isPending} onClick={enviar}>
          {resultado === 'REQUIERE_SUBSANACION' ? 'Dejar en espera de subsanación' : 'Favorable: pasar a Jurídico'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Jurídico
// ---------------------------------------------------------------------------

function AccionJuridico({ b }: { b: BajaBackend }) {
  const [resultado, setResultado] = useState<DictamenJuridicoDto['resultado'] | ''>('')
  const [anular, setAnular] = useState<boolean | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionBaja(b.expediente.id, bajaPozoApi.juridico)
  const concesion = b.baja.concesionAnterior

  const falta = !resultado
    ? null
    : resultado !== 'APTO' && !observaciones.trim()
      ? resultado === 'OBSERVADO'
        ? 'Indique qué tiene que corregir Pozos.'
        : 'Indique el motivo por el que no es apto.'
      : resultado === 'APTO' && concesion && anular === null
        ? 'Indique si se anula también la concesión.'
        : null
  const enviar = () =>
    accion.mutate({ resultado: resultado as DictamenJuridicoDto['resultado'], anularConcesion: resultado === 'APTO' && concesion ? !!anular : undefined, observaciones: observaciones.trim() || undefined })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">¿La documentación y los aspectos legales de la baja están en regla?</p>
      {concesion && (
        <Bloque titulo={`El pozo abastece la concesión ${concesion}: ¿se anula también?`}>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">La baja de la perforación y la anulación de la concesión son actuaciones distintas. Antes de anularla, controle la documentación y la tasa:</p>
            <DeudasTasa b={b} />
            <SiNo valor={anular} onChange={setAnular} si="Sí, anular la concesión" no="No, la concesión sigue" />
          </div>
        </Bloque>
      )}
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'APTO', texto: 'Apto', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'OBSERVADO', texto: 'Observado (corregir)', icono: 'edit_note', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
          { valor: 'NO_APTO', texto: 'No apto', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />
      <Observaciones
        valor={observaciones}
        onChange={setObservaciones}
        obligatorio={resultado === 'OBSERVADO' || resultado === 'NO_APTO'}
        placeholder={resultado === 'OBSERVADO' ? 'Qué tiene que corregir Pozos' : resultado === 'NO_APTO' ? 'Motivo por el que no corresponde la baja' : undefined}
      />
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="send" disabled={!resultado || !!falta} loading={accion.isPending} onClick={() => (resultado === 'NO_APTO' ? setConfirmar(true) : enviar())}>
          {resultado === 'APTO' ? 'Apto: pasar a Secretaría General' : resultado === 'OBSERVADO' ? 'Devolver a Pozos' : resultado === 'NO_APTO' ? 'Dictaminar no apto' : 'Registrar'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Dictaminar no apto?"
        message="El trámite termina: el expediente queda rechazado y el pozo sigue como estaba. No se puede deshacer."
        confirmLabel="Sí, no apto"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          enviar()
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Secretaría General
// ---------------------------------------------------------------------------

function AccionSecretaria({ b }: { b: BajaBackend }) {
  const [decision, setDecision] = useState<'APROBAR' | 'RECHAZAR' | ''>('')
  const [datos, setDatos] = useState({ numero: '', anio: String(new Date().getFullYear()), fecha: hoy(), observaciones: '' })
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionBaja(b.expediente.id, bajaPozoApi.resolucion)
  const completo = !!decision && !!datos.numero && datos.anio.length === 4 && !!datos.fecha && (decision === 'APROBAR' || !!datos.observaciones.trim())
  const anula = b.baja.anularConcesion && b.baja.concesionAnterior

  const consecuencias =
    decision === 'RECHAZAR'
      ? 'El trámite termina rechazado y el pozo sigue como estaba.'
      : [
          `El pozo ${b.pozo.idInterno} pasa a estado BAJA (se conserva todo su registro técnico).`,
          anula ? `La concesión ${b.baja.concesionAnterior} queda ANULADA.` : b.baja.concesionAnterior ? `La concesión ${b.baja.concesionAnterior} sigue vigente.` : null,
          b.baja.requiereClausura ? 'El expediente vuelve a Pozos para registrar la clausura física.' : 'El trámite finaliza.',
          'Distrito recibe el aviso para tomar conocimiento.',
        ]
          .filter(Boolean)
          .join(' ')

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
        <li>✓ Documentación completa y antecedentes verificados (Pozos)</li>
        <li>✓ Evaluación técnica favorable{b.baja.requiereClausura ? ': corresponde clausura física' : ': sin clausura física'}</li>
        <li>✓ Jurídico apto{b.baja.concesionAnterior ? (anula ? `: anular la concesión ${b.baja.concesionAnterior}` : `: la concesión ${b.baja.concesionAnterior} sigue`) : ''}</li>
      </ul>
      <Opciones
        valor={decision}
        onChange={setDecision}
        opciones={[
          { valor: 'APROBAR', texto: 'Aprobar la baja', icono: 'task_alt', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'RECHAZAR', texto: 'Rechazar', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Número de resolución">
          <input value={datos.numero} inputMode="numeric" onChange={(e) => setDatos({ ...datos, numero: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Año">
          <input value={datos.anio} inputMode="numeric" onChange={(e) => setDatos({ ...datos, anio: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className={controlClass({})} />
        </Campo>
      </div>
      <Observaciones
        valor={datos.observaciones}
        onChange={(v) => setDatos({ ...datos, observaciones: v })}
        obligatorio={decision === 'RECHAZAR'}
        placeholder={decision === 'RECHAZAR' ? 'Razón del rechazo (queda registrada)' : undefined}
      />
      {decision && <p className="text-sm text-slate-600 dark:text-slate-300">{consecuencias}</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button variant={decision === 'RECHAZAR' ? 'danger' : 'primary'} iconRight="gavel" disabled={!completo} loading={accion.isPending} onClick={() => setConfirmar(true)}>
          {decision === 'RECHAZAR' ? 'Registrar resolución de rechazo' : 'Registrar resolución y dar de baja'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        tone={decision === 'RECHAZAR' ? 'danger' : 'info'}
        title={`Resolución ${datos.numero}/${datos.anio}: ¿${decision === 'RECHAZAR' ? 'rechazar' : 'aprobar'} la baja?`}
        message={consecuencias}
        confirmLabel={decision === 'RECHAZAR' ? 'Sí, rechazar' : 'Sí, aprobar'}
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          accion.mutate({ decision: decision as 'APROBAR' | 'RECHAZAR', numero: datos.numero, anio: Number(datos.anio), fecha: datos.fecha, observaciones: datos.observaciones.trim() || undefined })
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pozos: clausura física
// ---------------------------------------------------------------------------

function AccionClausura({ b }: { b: BajaBackend }) {
  const [datos, setDatos] = useState({ fecha: hoy(), acta: '', observaciones: '' })
  const accion = useAccionBaja(b.expediente.id, bajaPozoApi.clausura)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        La baja ya está aprobada (resolución {b.baja.resolucion}). Registre la clausura física de la perforación cuando se haga: con el acta, el trámite finaliza.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Fecha de la clausura">
          <input type="date" value={datos.fecha} max={hoy()} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className={controlClass({})} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta="Número de acta">
            <input value={datos.acta} onChange={(e) => setDatos({ ...datos, acta: e.target.value.slice(0, 50) })} className={controlClass({})} />
          </Campo>
        </div>
      </div>
      <Observaciones valor={datos.observaciones} onChange={(v) => setDatos({ ...datos, observaciones: v })} placeholder="Cómo se selló la perforación" />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button
          iconRight="lock"
          disabled={!datos.fecha || !datos.acta.trim()}
          loading={accion.isPending}
          onClick={() => accion.mutate({ fecha: datos.fecha, acta: datos.acta.trim(), observaciones: datos.observaciones.trim() || undefined })}
        >
          Registrar clausura y finalizar
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Lo que puede hacer la oficina donde está la baja: tomarla, o el formulario de su etapa.
 * El backend valida todo igual (oficina, etapa, tomado); acá solo se guía al usuario.
 */
export function AccionesBaja({ b }: { b: BajaBackend }) {
  const actor = useActor()
  const usuarioId = actor.id
  const tomar = useAccionBaja(b.expediente.id, (id, _: void) => bajaPozoApi.tomar(id))
  const e = b.expediente

  if (e.estado === 'FINALIZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-500/10 dark:text-green-300">
        <Icon name="verified" filled className="text-[28px]!" />
        <div className="text-sm">
          <p className="text-base font-bold">Trámite finalizado: el pozo {b.pozo.idInterno} quedó dado de baja.</p>
          <p>
            Resolución {b.baja.resolucion}
            {b.baja.fechaBaja && ` del ${formatoFecha(b.baja.fechaBaja)}`}
            {b.baja.anularConcesion && b.baja.concesionAnterior && ` · concesión ${b.baja.concesionAnterior} anulada`}
            {b.baja.clausura && ` · clausurado el ${formatoFecha(b.baja.clausura.fecha)} (acta ${b.baja.clausura.acta})`}.
          </p>
        </div>
      </div>
    )
  }
  if (e.estado === 'RECHAZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <Icon name="block" className="text-[28px]!" />
        <div className="text-sm">
          <p className="text-base font-bold">Baja rechazada: el pozo sigue como estaba.</p>
          <p>{b.baja.resolucion ? `Resolución ${b.baja.resolucion}. ` : ''}El motivo está en el historial.</p>
        </div>
      </div>
    )
  }

  // Quien no es de la oficina donde está el expediente, lo consulta sin actuar.
  if (!actor.puedeActuarEn(e.oficinaActual)) return <AvisoSoloConsulta oficina={e.oficinaNombre} />

  if (!e.tomadoPor) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          El expediente llegó a <strong>{e.oficinaNombre}</strong>. Para trabajarlo, alguien de la oficina tiene que tomarlo: queda registrado en el historial quién lo recibió y cuándo.
        </p>
        {tomar.error && <Alert>{mensajeDeError(tomar.error)}</Alert>}
        <div>
          <Button iconLeft="back_hand" loading={tomar.isPending} onClick={() => tomar.mutate()}>
            Tomar expediente
          </Button>
        </div>
      </div>
    )
  }
  // Lo tiene otra persona (el administrador «Sistema» puede actuar igual: lo controla el backend).
  if (e.tomadoPor.id !== usuarioId && !actor.esAdministrador) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Icon name="person" className="text-[18px]!" />
        Lo está trabajando <strong>{e.tomadoPor.nombre}</strong> ({e.oficinaNombre}).
      </p>
    )
  }

  // key: al cambiar de etapa, cada formulario arranca con los datos guardados.
  switch (e.etapa) {
    case 'INICIO_POZOS':
      return <AccionDocumentacion key={e.etapa} b={b} />
    case 'ANTECEDENTES_POZOS':
      return <AccionAntecedentes key={e.etapa} b={b} />
    case 'EVALUACION_TECNICA_POZOS':
      return <AccionEvaluacion key={e.etapa} b={b} />
    case 'CORRECCION_POZOS':
      return <AccionCorreccion key={e.etapa} b={b} />
    case 'JURIDICO':
      return <AccionJuridico key={e.etapa} b={b} />
    case 'SECRETARIA_GENERAL':
      return <AccionSecretaria key={e.etapa} b={b} />
    case 'CLAUSURA_POZOS':
      return <AccionClausura key={e.etapa} b={b} />
  }
}
