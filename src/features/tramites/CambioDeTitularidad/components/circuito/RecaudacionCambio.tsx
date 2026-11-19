import { useEffect, useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { Observaciones, Opciones } from '../../../AltaDeConcesion/components/circuito/AccionesOficina'
import type { CambioBackend } from '../../backend.types'
import { ResumenEnvio } from './ResumenEnvio'
import type { Terminado } from './terminado'
import { estadoDeudaPorTitular, faltaEnDecision, type DecisionDeuda, type EstadoDeudaTitular } from '../../recaudacion'
import { useAntecedentesDeudaCambio, useBorradorAvisoCambio, useCursoConDeudaCambio, useNotificarDeudaCambio, useVerificarDeudaCambio } from '../../hooks'


const SIGUIENTE = 'Distrito'
const MINIMO_NOTA = 10

/**
 * Recaudación en el Cambio de Titularidad (caso de uso, pasos 11-17). El sistema trae las
 * concesiones otorgadas del titular actual y del nuevo (incluida la que se transfiere) y si tienen
 * deuda. Recaudación decide:
 *   - Apto (sin deuda): con confirmación, pasa a Distrito («trámite enviado»).
 *   - No apto (tiene deuda): se marca en qué concesión y el motivo; queda en espera en Recaudación.
 *     En espera se puede avisar al titular por correo o, si no se pudo cobrar, darle curso con una nota.
 */
export function RecaudacionCambio({ datos, enEspera, onTerminado }: { datos: CambioBackend; enEspera: boolean; onTerminado: (t: Terminado) => void }) {
  const id = datos.expediente.id
  const antecedentes = useAntecedentesDeudaCambio(id)
  const verificar = useVerificarDeudaCambio(id)
  const [decision, setDecision] = useState<DecisionDeuda | ''>(enEspera ? 'NO_APTO' : '')
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  if (antecedentes.isPending) return <p className="text-sm text-slate-500">Buscando las concesiones de los titulares…</p>
  if (antecedentes.isError) return <Alert>No se pudieron consultar las concesiones de los titulares: {mensajeDeError(antecedentes.error)}</Alert>

  const { titulares, concesiones, otrasDeudas } = antecedentes.data
  const tieneDeuda = (c: (typeof concesiones)[number]) => decision === 'NO_APTO' && (marcadas[c.id] ?? c.tieneDeuda)
  const conDeuda = concesiones.filter(tieneDeuda)
  const nombreDe = (personaId: string) => titulares.find((t) => t.personaId === personaId)?.nombre ?? personaId
  const concesionDelCambio = datos.cambio.concesion.id

  const falta = faltaEnDecision({ decision, conDeuda: conDeuda.length, otrasDeudas: otrasDeudas.length, observaciones })

  function guardar() {
    setConfirmar(false)
    if (!decision || falta) return
    const numero = datos.expediente.numero
    verificar.mutate(
      {
        resultado: decision,
        concesiones: concesiones.map((c) => ({ concesionId: c.id, tieneDeuda: tieneDeuda(c) })),
        observaciones: observaciones.trim() || undefined,
      },
      {
        onSuccess: () =>
          onTerminado(
            decision === 'APTO'
              ? { titulo: 'Trámite enviado', mensaje: `El expediente ${numero} no posee deuda y fue enviado a ${SIGUIENTE}.` }
              : { titulo: 'Quedó en espera por deuda', mensaje: `El expediente ${numero} queda en Recaudación hasta que se pague. Puede avisar al titular por correo.` },
          ),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {enEspera && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <Icon name="pause_circle" className="mt-0.5 text-red-600 dark:text-red-300" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">En espera · pendiente de pago</p>
            <p>Cuando paguen, marque «Apto»: se levanta la deuda y pasa a {SIGUIENTE}. Mientras tanto puede avisar por correo o, si no se puede cobrar, darle curso con deuda.</p>
          </div>
        </div>
      )}

      {/* Se revisa la deuda de los dos: el dueño anterior y el nuevo titular. */}
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Estado de deuda de cada titular</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">El cambio no avanza si el titular actual o el nuevo tienen deuda.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {estadoDeudaPorTitular(
          antecedentes.data,
          datos.cambio.titularesActuales.map((t) => t.personaId),
          datos.cambio.nuevosTitulares.map((t) => t.personaId),
        ).map((t) => (
          <TarjetaDeuda key={t.personaId} titular={t} />
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Concesiones de los titulares</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Del titular actual y del nuevo: {titulares.map((t) => t.nombre).join(' · ')}. Tener otras concesiones solo se informa; lo que frena el cambio es la deuda.
        </p>
      </div>

      {concesiones.length === 0 ? (
        <p className="text-sm text-slate-500">Los titulares no tienen concesiones otorgadas en el sistema.</p>
      ) : (
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
                  {c.id === concesionDelCambio && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">La que se transfiere</span>}
                  {c.tieneDeuda && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Deuda registrada</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[c.localidad, c.departamento].filter(Boolean).join(', ') || 'Sin ubicación'} · de {c.deTitulares.map(nombreDe).join(' y ')}
                </p>
              </div>
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
      )}

      {otrasDeudas.length > 0 && (
        <Alert tone="info">
          Deudas registradas antes, sin concesión: {otrasDeudas.map((d) => `${nombreDe(d.personaId)} · ${d.detalle}`).join(' — ')}.
        </Alert>
      )}

      {/* Paso 12: ¿posee deuda? */}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Posee deuda?</p>
      <Opciones
        valor={decision}
        onChange={(d) => {
          if (d !== decision) setObservaciones('')
          setDecision(d)
        }}
        opciones={[
          { valor: 'APTO', texto: 'No posee deuda (apto)', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'NO_APTO', texto: 'Posee deuda (no apto)', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />

      {/* Paso 13: observaciones (obligatorias si posee deuda). */}
      {decision && (
        <Observaciones
          valor={observaciones}
          onChange={setObservaciones}
          obligatorio={decision === 'NO_APTO'}
          placeholder={decision === 'NO_APTO' ? 'Qué se adeuda (ej: canon de riego 2025 de la concesión 906)' : 'Si hace falta aclarar algo'}
        />
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {verificar.error && <Alert>{mensajeDeError(verificar.error)}</Alert>}

      {/* Paso 14-16: guardar y continuar → confirmación → enviar. */}
      <div>
        <Button
          iconRight={decision === 'NO_APTO' ? 'pause_circle' : 'send'}
          variant={decision === 'NO_APTO' ? 'secondary' : 'primary'}
          loading={verificar.isPending}
          disabled={!decision || !!falta || verificar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {decision === 'NO_APTO' ? (enEspera ? 'Guardar: sigue en espera' : 'Guardar: queda en espera por deuda') : `Guardar y continuar a ${SIGUIENTE}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={decision === 'NO_APTO' ? 'danger' : 'info'}
        title={decision === 'NO_APTO' ? '¿Dejar el trámite en espera por deuda?' : `¿Enviar el trámite a ${SIGUIENTE}?`}
        message={
          decision === 'NO_APTO'
            ? 'El expediente queda en espera en Recaudación hasta que se pague. La deuda queda registrada en las concesiones marcadas.'
            : 'Revise lo que se envía:'
        }
        confirmLabel={decision === 'NO_APTO' ? 'Sí, dejar en espera' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={guardar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', datos.expediente.numero],
            ['Titulares', titulares.map((t) => t.nombre).join(' · ')],
            ['¿Posee deuda?', decision === 'NO_APTO' ? `Sí: ${conDeuda.map((c) => `N° ${c.numero ?? c.id}`).join(', ') || 'deudas sin concesión'}` : 'No'],
            ['Observaciones', observaciones.trim() || null],
            ['Destino', decision === 'NO_APTO' ? 'Queda en espera en Recaudación' : SIGUIENTE],
          ]}
        />
      </ConfirmDialog>

      {enEspera && (
        <>
          <AvisoDeudaCambio expedienteId={id} />
          <CursoConDeudaCambio expedienteId={id} numero={datos.expediente.numero} onTerminado={onTerminado} />
        </>
      )}
    </div>
  )
}

const ROL: Record<EstadoDeudaTitular['rol'], string> = { actual: 'Titular actual', nuevo: 'Nuevo titular', ambos: 'Titular actual y nuevo' }

/** Una persona del cambio: sus concesiones y si tiene deuda registrada. */
function TarjetaDeuda({ titular }: { titular: EstadoDeudaTitular }) {
  const conDeuda = titular.deudas.length > 0
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        conDeuda ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/5' : 'border-green-200 bg-green-50/60 dark:border-green-500/30 dark:bg-green-500/5',
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{ROL[titular.rol]}</p>
      <p className="font-semibold text-slate-900 dark:text-white">{titular.nombre}</p>
      <p className={cn('mt-1 flex items-center gap-1.5 text-sm font-semibold', conDeuda ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300')}>
        <Icon name={conDeuda ? 'error' : 'check_circle'} filled className="text-[18px]!" />
        {conDeuda ? `Con deuda: ${titular.deudas.join(' · ')}` : 'Sin deuda registrada'}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {titular.concesiones.length ? `Concesiones: ${titular.concesiones.join(', ')}` : 'Sin concesiones otorgadas'}
      </p>
    </div>
  )
}

type Texto = { asunto: string; cuerpo: string }

/** Aviso de deuda por correo: el sistema arma el texto de cada titular con deuda y Recaudación lo puede editar. */
function AvisoDeudaCambio({ expedienteId }: { expedienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  const borrador = useBorradorAvisoCambio(expedienteId, abierto)
  const notificar = useNotificarDeudaCambio(expedienteId)
  const [textos, setTextos] = useState<Record<string, Texto>>({})
  const correos = borrador.data?.correos ?? []
  const conEmail = correos.filter((c) => c.email)

  useEffect(() => {
    if (borrador.data) setTextos(Object.fromEntries(borrador.data.correos.map((c) => [c.personaId, { asunto: c.asunto, cuerpo: c.cuerpo }])))
  }, [borrador.data])

  const editar = (personaId: string, campo: keyof Texto, valor: string) => setTextos((t) => ({ ...t, [personaId]: { ...t[personaId], [campo]: valor } }))
  const incompleto = conEmail.some((c) => (textos[c.personaId]?.asunto.trim().length ?? 0) < 3 || (textos[c.personaId]?.cuerpo.trim().length ?? 0) < 20)

  function enviar() {
    notificar.mutate(
      { textos: conEmail.map((c) => ({ personaId: c.personaId, asunto: textos[c.personaId].asunto.trim(), cuerpo: textos[c.personaId].cuerpo.trim() })) },
      { onSuccess: () => setAbierto(false) },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="mail" className="mt-0.5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Aviso de deuda al titular</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Un correo a cada titular con deuda, al email que tiene cargado. Puede editar el texto antes de enviarlo.</p>
          </div>
        </div>
        {!abierto && (
          <Button size="sm" variant="secondary" iconLeft="edit_note" onClick={() => setAbierto(true)}>
            Preparar aviso
          </Button>
        )}
      </div>

      {notificar.data && (
        <Alert tone="info">
          Enviado a {notificar.data.enviados.map((e) => `${e.titular} (${e.para.join(', ')})`).join(', ') || 'nadie'}.
          {notificar.data.sinCorreo.length > 0 && ` Sin correo cargado: ${notificar.data.sinCorreo.join(', ')}.`}
        </Alert>
      )}

      {abierto &&
        (borrador.isPending ? (
          <p className="text-sm text-slate-500">Armando el texto…</p>
        ) : borrador.isError ? (
          <Alert>{mensajeDeError(borrador.error)}</Alert>
        ) : (
          <>
            {correos.map((c) =>
              c.email ? (
                <div key={c.personaId} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para <strong>{c.titular}</strong> · {c.email}
                  </p>
                  <input value={textos[c.personaId]?.asunto ?? ''} onChange={(e) => editar(c.personaId, 'asunto', e.target.value)} className={controlClass({})} aria-label="Asunto" />
                  <textarea value={textos[c.personaId]?.cuerpo ?? ''} onChange={(e) => editar(c.personaId, 'cuerpo', e.target.value)} rows={8} className={controlClass({ className: 'resize-y' })} aria-label="Texto del correo" />
                </div>
              ) : (
                <p key={c.personaId} className="text-sm text-amber-700 dark:text-amber-300">
                  {c.titular} no tiene correo cargado: no se le puede avisar por este medio.
                </p>
              ),
            )}
            {notificar.error && <Alert>{mensajeDeError(notificar.error)}</Alert>}
            <div className="flex gap-2">
              <Button size="sm" iconRight="send" disabled={!conEmail.length || incompleto} loading={notificar.isPending} onClick={enviar}>
                Enviar aviso
              </Button>
              <Button size="sm" variant="ghost" disabled={notificar.isPending} onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ))}
    </div>
  )
}

/** En espera y no se pudo cobrar: pasa igual a Distrito con una nota de por qué (la deuda sigue registrada). */
function CursoConDeudaCambio({ expedienteId, numero, onTerminado }: { expedienteId: string; numero: string; onTerminado: (t: Terminado) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useCursoConDeudaCambio(expedienteId)
  const corta = nota.trim().length < MINIMO_NOTA

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
      <Observaciones valor={nota} onChange={setNota} obligatorio placeholder="Por qué se le da curso sin cobrar" />
      {nota && corta && <p className="text-xs font-medium text-red-600 dark:text-red-400">Explique el motivo (al menos {MINIMO_NOTA} caracteres).</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button iconRight="send" disabled={corta} loading={accion.isPending} onClick={() => setConfirmar(true)}>
          Pasar a {SIGUIENTE} con deuda
        </Button>
        <Button variant="secondary" disabled={accion.isPending} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        title="¿Dar curso con deuda?"
        message={`El expediente pasa a ${SIGUIENTE} con la deuda pendiente. Las demás oficinas van a ver el aviso y su nota.`}
        confirmLabel="Sí, pasar con deuda"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          accion.mutate(nota.trim(), {
            onSuccess: () => onTerminado({ titulo: 'Trámite enviado con deuda', mensaje: `El expediente ${numero} fue enviado a ${SIGUIENTE} con la deuda pendiente y su nota.` }),
          })
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}
