import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { altaConcesionApi, type ResultadoDictamen } from '../../api'
import type { AltaBackend } from '../../backend.types'
import { useAccionAlta, useAntecedentesDeuda, useCancelarDeuda, useTomar } from '../../hooks'
import { AvisoDeudaEditable } from './AvisoDeudaEditable'

const hoy = () => new Date().toISOString().slice(0, 10)

// Campo, Observaciones y Opciones se exportan: los usan también otros circuitos (ej: baja de pozo).
export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-slate-500 dark:text-slate-400">{ayuda}</span>}
    </label>
  )
}

export function Observaciones({ valor, onChange, obligatorio, placeholder }: { valor: string; onChange: (v: string) => void; obligatorio?: boolean; placeholder?: string }) {
  return (
    <Campo etiqueta={obligatorio ? 'Observaciones (obligatorio)' : 'Observaciones'}>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={controlClass({ className: 'resize-y' })} />
    </Campo>
  )
}

/** Opciones tipo tarjeta (apto / observado / no apto, sin deuda / con deuda). */
export function Opciones<T extends string>({ valor, onChange, opciones }: { valor: T | ''; onChange: (v: T) => void; opciones: { valor: T; texto: string; icono: string; color: string }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={cn(
            'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
            valor === o.valor ? o.color : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
          )}
        >
          <Icon name={o.icono} className="text-[20px]!" />
          {o.texto}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recaudación
// ---------------------------------------------------------------------------

type DecisionDeuda = 'APTO' | 'NO_APTO'

/** Encabezado de cada paso de la pantalla de Recaudación. */
function Paso({ numero, titulo, children }: { numero: number; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{numero}</span>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
        {children && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{children}</p>}
      </div>
    </div>
  )
}

const MINIMO_NOTA_CURSO = 10

/**
 * En espera por deuda y no se pudo cobrar: Recaudación le da curso igual con una nota de por qué.
 * La deuda sigue pendiente; las oficinas siguientes ven el aviso con la nota.
 */
function CursoConDeuda({ alta, siguiente }: { alta: AltaBackend; siguiente: string }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionAlta(alta.id, altaConcesionApi.cursoConDeuda)
  const corta = nota.trim().length < MINIMO_NOTA_CURSO

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">¿No se pudo cobrar?</span> Puede darle curso igual con una nota de por qué; la deuda sigue registrada.
        </p>
        <Button size="sm" variant="secondary" iconLeft="forward" onClick={() => setAbierto(true)}>
          Dar curso con deuda
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/5">
      <div className="flex items-start gap-2">
        <Icon name="forward" className="mt-0.5 text-amber-700 dark:text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Dar curso con deuda</p>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
            Pasa a {siguiente} aunque el titular tenga deuda. La deuda no se cancela, y {siguiente} y las demás oficinas van a ver el aviso con esta nota.
          </p>
        </div>
      </div>
      <Observaciones valor={nota} onChange={setNota} obligatorio placeholder="Por qué se le da curso sin cobrar (ej: se intentó cobrar del 10 al 20/10 sin respuesta del titular; se continúa por…)" />
      {nota && corta && <p className="text-xs font-medium text-red-600 dark:text-red-400">Explique el motivo (al menos {MINIMO_NOTA_CURSO} caracteres).</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button iconRight="send" disabled={corta} loading={accion.isPending} onClick={() => setConfirmar(true)}>
          Pasar a {siguiente} con deuda
        </Button>
        <Button variant="secondary" disabled={accion.isPending} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        title="¿Dar curso con deuda?"
        message={`El expediente pasa a ${siguiente} con la deuda pendiente. Las demás oficinas van a ver el aviso y su nota. No se puede deshacer.`}
        confirmLabel="Sí, pasar con deuda"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          accion.mutate(nota.trim())
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}

/**
 * Recaudación: el sistema informa si los titulares tienen otras concesiones otorgadas, para
 * verificar si alguna tiene deuda. Se decide:
 *   - Apto: no tiene deuda → pasa a Distrito.
 *   - No apto: tiene deuda → se marca en qué concesión y el motivo; el expediente queda en espera
 *     en Recaudación. Cuando paga, se vuelve a entrar y se marca Apto: se levanta la deuda y sigue.
 * La deuda queda ligada a la concesión y a todos sus titulares (la ven sus otros trámites).
 */
function AccionRecaudacion({ alta, enEspera }: { alta: AltaBackend; enEspera: boolean }) {
  const antecedentes = useAntecedentesDeuda(alta.id)
  const [decision, setDecision] = useState<DecisionDeuda | ''>(enEspera ? 'NO_APTO' : '')
  /** Concesiones marcadas con deuda (solo con «No apto»); si no se tocan, las ya registradas. */
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, altaConcesionApi.recaudacion)
  const cancelar = useCancelarDeuda(alta.id)
  const [comprobante, setComprobante] = useState<Record<string, string>>({})

  if (antecedentes.isPending) return <p className="text-sm text-slate-500">Buscando las concesiones de los titulares…</p>
  if (antecedentes.isError) return <Alert>No se pudieron consultar las concesiones de los titulares: {mensajeDeError(antecedentes.error)}</Alert>

  const { titulares, concesiones, otrasDeudas } = antecedentes.data
  const tieneDeuda = (c: (typeof concesiones)[number]) => decision === 'NO_APTO' && (marcadas[c.id] ?? c.tieneDeuda)
  const conDeuda = concesiones.filter(tieneDeuda)
  const nombreDe = (personaId: string) => titulares.find((t) => t.personaId === personaId)?.nombre ?? personaId
  const siguiente = 'Distrito'

  // Lo mismo que valida el backend (validarDecisionDeuda), para avisar antes de mandar.
  const falta =
    decision === 'APTO' && otrasDeudas.length
      ? 'Quedan deudas registradas sin cancelar: registre el pago antes de marcar «Apto».'
      : decision === 'NO_APTO' && !conDeuda.length && !otrasDeudas.length
        ? concesiones.length
          ? 'Marque en qué concesión está la deuda.'
          : 'Los titulares no tienen otras concesiones ni deudas registradas: no hay deuda para marcar «No apto».'
        : decision === 'NO_APTO' && !observaciones.trim()
          ? 'Indique el motivo del «No apto» (qué se adeuda).'
          : null

  function enviar() {
    if (!decision || falta) return
    accion.mutate({
      resultado: decision,
      concesiones: concesiones.map((c) => ({ concesionId: c.id, tieneDeuda: tieneDeuda(c) })),
      observaciones: observaciones.trim() || undefined,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {enEspera && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <Icon name="pause_circle" className="mt-0.5 text-red-600 dark:text-red-300" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">En espera · pendiente de pago</p>
            <p>
              Cuando el titular pague, marque «Apto»: se levanta la deuda y pasa a {siguiente}. Mientras tanto puede avisarle por correo (paso 3). Si no se puede cobrar, al final puede darle curso con deuda.
            </p>
          </div>
        </div>
      )}

      <Paso numero={1} titulo="Concesiones de los titulares">
        Titulares del alta: {titulares.map((t) => t.nombre).join(' · ') || 'sin titulares cargados'}. Tener otras concesiones solo se informa; lo que frena el alta es la deuda.
      </Paso>

      {/* Lo que informa el sistema: las otras concesiones otorgadas de los titulares. */}
      {concesiones.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
          <Icon name="check_circle" filled />
          Los titulares no tienen otras concesiones otorgadas en el sistema.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {concesiones.length === 1 ? 'Tiene otra concesión' : `Tienen ${concesiones.length} concesiones más`}
          </p>
          <ul className="flex flex-col gap-2">
            {concesiones.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                  tieneDeuda(c) ? 'border-red-300 bg-red-50/50 dark:border-red-500/40 dark:bg-red-500/5' : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Concesión {c.numero ? `N° ${c.numero}` : `id ${c.id}`}
                    {(c.localidad || c.departamento) && <span className="font-normal text-slate-500 dark:text-slate-400"> · {[c.localidad, c.departamento].filter(Boolean).join(', ')}</span>}
                    {c.tieneDeuda && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Deuda registrada</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Titulares:{' '}
                    {c.titulares.map((t, i) => (
                      <span key={t.personaId}>
                        {i > 0 && ' · '}
                        <span className={c.deTitulares.includes(t.personaId) ? 'font-semibold text-slate-700 dark:text-slate-200' : undefined}>{t.nombre}</span>
                      </span>
                    ))}
                  </p>
                  <p className="text-xs text-slate-400">De {c.deTitulares.map(nombreDe).join(' y ')}, titular del alta.</p>
                </div>
                {/* La ficha completa (ubicación, usos, caudal, padrones, polígono) en el visor, en otra pestaña para no perder el expediente. */}
                <a
                  href={ROUTES.visorConcesion(c.id)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 dark:border-slate-700"
                >
                  <Icon name="map" className="text-[18px]!" />
                  Ver concesión
                </a>
                {decision === 'NO_APTO' && (
                  <label className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold dark:border-slate-700">
                    <input type="checkbox" className="size-4 accent-red-600" checked={tieneDeuda(c)} onChange={(e) => setMarcadas({ ...marcadas, [c.id]: e.target.checked })} />
                    Tiene deuda
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {otrasDeudas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Deudas registradas antes, sin concesión</p>
          {otrasDeudas.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
                {nombreDe(d.personaId)} · {d.detalle}
              </p>
              <input
                placeholder="N° de recibo / comprobante"
                value={comprobante[d.id] ?? ''}
                onChange={(e) => setComprobante({ ...comprobante, [d.id]: e.target.value })}
                className={controlClass({ className: 'w-56 py-2' })}
              />
              <Button size="sm" iconLeft="paid" loading={cancelar.isPending && cancelar.variables?.deudaId === d.id} onClick={() => cancelar.mutate({ deudaId: d.id, comprobante: comprobante[d.id] || undefined })}>
                Registrar pago
              </Button>
            </div>
          ))}
          {cancelar.error && <Alert>{mensajeDeError(cancelar.error)}</Alert>}
        </div>
      )}

      <Paso numero={2} titulo="Decisión">¿Los titulares tienen deuda en alguna de esas concesiones?</Paso>
      <Opciones
        valor={decision}
        onChange={(d) => {
          // El motivo de un «No apto» no tiene que viajar con un «Apto» (y al revés).
          if (d !== decision) setObservaciones('')
          setDecision(d)
        }}
        opciones={[
          { valor: 'APTO', texto: 'Apto (sin deuda)', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'NO_APTO', texto: 'No apto (tiene deuda)', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />

      {decision && (
        <>
          <Observaciones
            valor={observaciones}
            onChange={setObservaciones}
            obligatorio={decision === 'NO_APTO'}
            placeholder={decision === 'NO_APTO' ? 'Qué se adeuda (ej: canon de riego 2025 de la concesión 906)' : undefined}
          />
          <p className={cn('text-xs', decision === 'APTO' ? 'text-slate-500 dark:text-slate-400' : 'text-amber-800 dark:text-amber-300')}>
            {decision === 'APTO'
              ? `Pasa a ${siguiente}.${enEspera ? ' Se levantan las deudas marcadas antes.' : ''}`
              : 'El expediente queda en espera en Recaudación hasta que pague. La deuda queda registrada en la concesión.'}
          </p>
        </>
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button
          iconRight={decision === 'NO_APTO' ? 'pause_circle' : 'send'}
          variant={decision === 'NO_APTO' ? 'secondary' : 'primary'}
          loading={accion.isPending}
          disabled={!decision || !!falta || accion.isPending}
          onClick={enviar}
        >
          {decision === 'NO_APTO' ? (enEspera ? 'Guardar: sigue en espera' : 'No apto: dejar en espera') : `Apto: pasar a ${siguiente}`}
        </Button>
      </div>

      {enEspera && (
        <>
          <Paso numero={3} titulo="Avisar al titular">El correo se arma solo con las deudas de cada titular; puede editarlo antes de enviarlo.</Paso>
          <AvisoDeudaEditable alta={alta} />
          <CursoConDeuda alta={alta} siguiente={siguiente} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Distrito y Jurídico
// ---------------------------------------------------------------------------

function AccionDictamen({ alta, oficina }: { alta: AltaBackend; oficina: 'distrito' | 'juridico' }) {
  const [resultado, setResultado] = useState<ResultadoDictamen | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionAlta(alta.id, (id, dto: { resultado: ResultadoDictamen; observaciones?: string }) => altaConcesionApi.dictaminar(id, oficina, dto))
  const siguiente = oficina === 'distrito' ? 'Jurídico' : 'Secretaría General'
  const pregunta =
    oficina === 'distrito' ? '¿Hay agua disponible y la concesión es viable técnicamente?' : '¿La documentación y los aspectos legales están en regla?'

  const enviar = () => accion.mutate({ resultado: resultado as ResultadoDictamen, observaciones: observaciones || undefined })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{pregunta}</p>
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
        placeholder={resultado === 'OBSERVADO' ? 'Qué tiene que corregir Catastro' : resultado === 'NO_APTO' ? 'Motivo por el que no es apto' : undefined}
      />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button
          iconRight="send"
          disabled={!resultado || (resultado !== 'APTO' && !observaciones.trim())}
          loading={accion.isPending}
          onClick={() => (resultado === 'NO_APTO' ? setConfirmar(true) : enviar())}
        >
          {resultado === 'APTO' ? `Apto: pasar a ${siguiente}` : resultado === 'OBSERVADO' ? 'Devolver a Catastro' : resultado === 'NO_APTO' ? 'Dictaminar no apto' : 'Registrar'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Dictaminar no apto?"
        message="El trámite termina: el expediente queda rechazado y la concesión no se otorga. No se puede deshacer."
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

function AccionSecretaria({ alta }: { alta: AltaBackend }) {
  const numero = useAccionAlta(alta.id, (id, _: void) => altaConcesionApi.numeroConcesion(id))
  const resolucion = useAccionAlta(alta.id, altaConcesionApi.resolucion)
  const [datos, setDatos] = useState({ numero: '', anio: String(new Date().getFullYear()), fecha: hoy(), observaciones: '' })
  const asignado = alta.concesion.numero

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">1. Número de concesión</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{asignado ? 'Asignado. Va en la resolución.' : 'Se asigna el siguiente número libre (correlativo).'}</p>
        </div>
        {asignado ? (
          <span className="rounded-lg bg-green-50 px-4 py-2 text-lg font-bold text-green-700 dark:bg-green-500/10 dark:text-green-300">N° {asignado}</span>
        ) : (
          <Button iconLeft="pin" loading={numero.isPending} onClick={() => numero.mutate()}>
            Solicitar número
          </Button>
        )}
      </div>
      {numero.error && <Alert>{mensajeDeError(numero.error)}</Alert>}

      <div className={cn('flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700', !asignado && 'opacity-50')}>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">2. Resolución que otorga la concesión</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Número">
            <input value={datos.numero} disabled={!asignado} onChange={(e) => setDatos({ ...datos, numero: e.target.value.replace(/\D/g, '') })} className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Año">
            <input value={datos.anio} disabled={!asignado} onChange={(e) => setDatos({ ...datos, anio: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Fecha">
            <input type="date" value={datos.fecha} disabled={!asignado} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className={controlClass({})} />
          </Campo>
        </div>
        <Observaciones valor={datos.observaciones} onChange={(v) => setDatos({ ...datos, observaciones: v })} />
        {resolucion.error && <Alert>{mensajeDeError(resolucion.error)}</Alert>}
        <div>
          <Button
            iconRight="send"
            disabled={!asignado || !datos.numero || datos.anio.length !== 4 || !datos.fecha}
            loading={resolucion.isPending}
            onClick={() => resolucion.mutate({ numero: datos.numero, anio: Number(datos.anio), fecha: datos.fecha, observaciones: datos.observaciones || undefined })}
          >
            Registrar resolución y pasar a Catastro
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catastro: cierre
// ---------------------------------------------------------------------------

function AccionCierre({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, (id, obs: string | undefined) => altaConcesionApi.verificacionFinal(id, obs))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Resolución {alta.concesion.resolucion?.numero}/{alta.concesion.resolucion?.anio} · Concesión N° {alta.concesion.numero}. Complete los datos que falten y haga la verificación final: después el trámite queda esperando el padrón de Rentas.
      </p>
      <div>
        <Button variant="secondary" iconLeft="edit" onClick={() => navigate(ROUTES.tramites.altaConcesion.datos(alta.id))}>
          Completar o revisar datos
        </Button>
      </div>
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="task_alt" loading={accion.isPending} onClick={() => accion.mutate(observaciones || undefined)}>
          Verificación final: esperar padrón
        </Button>
      </div>
    </div>
  )
}

function AccionPadron({ alta }: { alta: AltaBackend }) {
  const [padron, setPadron] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const accion = useAccionAlta(alta.id, altaConcesionApi.padron)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Cuando Rentas informe el número de padrón (suele demorar 30 a 60 días), cárguelo para finalizar el trámite. La concesión queda vigente.
      </p>
      <Campo etiqueta="Número de padrón de Rentas">
        <input value={padron} onChange={(e) => setPadron(e.target.value)} className={controlClass({ className: 'max-w-xs' })} />
      </Campo>
      <Observaciones valor={observaciones} onChange={setObservaciones} />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div>
        <Button iconRight="verified" disabled={!padron.trim()} loading={accion.isPending} onClick={() => accion.mutate({ padron: padron.trim(), observaciones: observaciones || undefined })}>
          Cargar padrón y finalizar
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Lo que puede hacer la oficina donde está el expediente:
 *   1. Si nadie lo tomó: «Tomar» (queda registrado quién y cuándo).
 *   2. Si lo tiene el usuario actual: el formulario de la etapa.
 *   3. Si lo tiene otra persona: quién.
 * El backend valida todo igual (oficina, etapa, tomado); acá solo se guía al usuario.
 */
export function AccionesOficina({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const actor = useActor()
  const usuarioId = actor.id
  const tomar = useTomar(alta.id)
  const { circuito } = alta

  if (circuito.estado === 'FINALIZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-500/10 dark:text-green-300">
        <Icon name="verified" filled className="text-[28px]!" />
        <div>
          <p className="font-bold">Trámite finalizado: concesión N° {alta.concesion.numero} vigente.</p>
          <p className="text-sm">
            Resolución {alta.concesion.resolucion?.numero}/{alta.concesion.resolucion?.anio} · Padrón {alta.inmueble?.catastral.padron}
          </p>
        </div>
      </div>
    )
  }
  if (circuito.estado === 'RECHAZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <Icon name="block" className="text-[28px]!" />
        <div>
          <p className="font-bold">Trámite rechazado: la concesión no se otorgó.</p>
          <p className="text-sm">El motivo está en el historial.</p>
        </div>
      </div>
    )
  }

  // Quien no es de la oficina donde está el expediente, lo consulta sin actuar.
  if (!actor.puedeActuarEn(circuito.oficinaActual)) return <AvisoSoloConsulta oficina={circuito.oficinaNombre} />

  // Paso 1: tomar el expediente.
  if (!circuito.tomadoPor) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          El expediente llegó a <strong>{circuito.oficinaNombre}</strong>. Para trabajarlo, alguien de la oficina tiene que tomarlo: queda registrado en el historial quién lo recibió y cuándo.
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
  if (circuito.tomadoPor.id !== usuarioId && !actor.esAdministrador) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Icon name="person" className="text-[18px]!" />
        Lo está trabajando <strong>{circuito.tomadoPor.nombre}</strong> ({circuito.oficinaNombre}).
      </p>
    )
  }

  switch (circuito.etapa) {
    case 'CARGA':
    case 'CORRECCION':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {circuito.etapa === 'CARGA' ? 'Catastro está cargando los datos del expediente.' : 'Distrito o Jurídico observaron el expediente: hay que corregirlo y reenviarlo.'}
          </p>
          <div>
            <Button iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.altaConcesion.datos(alta.id))}>
              {circuito.etapa === 'CARGA' ? 'Continuar la carga' : 'Corregir y reenviar'}
            </Button>
          </div>
        </div>
      )
    case 'RECAUDACION':
      return <AccionRecaudacion alta={alta} enEspera={circuito.estado === 'EN_ESPERA'} />
    case 'DISTRITO':
      return <AccionDictamen alta={alta} oficina="distrito" />
    case 'JURIDICO':
      return <AccionDictamen alta={alta} oficina="juridico" />
    case 'SECRETARIA_GENERAL':
      return <AccionSecretaria alta={alta} />
    case 'CIERRE':
      return <AccionCierre alta={alta} />
    case 'ESPERA_PADRON':
      return <AccionPadron alta={alta} />
  }
}
