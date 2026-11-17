import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { mensajeDeError } from '@/services/api/errors'
import { AvisoSoloConsulta, useActor } from '@/features/auth/useActor'
import { altaConcesionApi } from '@/features/tramites/AltaDeConcesion/api'
import { Campo, Observaciones, Opciones } from '@/features/tramites/AltaDeConcesion/components/circuito/AccionesOficina'
import { formatoPesos } from '../../BajaDePozo/estilos'
import { registroPozoApi, useAccionRegistro, type Resultado } from '../api'
import type { RegistroPozoBackend } from '../types'
import { FormCatastroPozo } from './FormCatastroPozo'

const hoy = () => new Date().toISOString().slice(0, 10)

/** Botón de enviar con su error debajo. */
function Enviar({ texto, icono = 'send', deshabilitado, cargando, error, onClick }: { texto: string; icono?: string; deshabilitado?: boolean; cargando: boolean; error: unknown; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {!!error && <Alert>{mensajeDeError(error)}</Alert>}
      <div>
        <Button iconRight={icono} disabled={deshabilitado} loading={cargando} onClick={onClick}>
          {texto}
        </Button>
      </div>
    </div>
  )
}

function AccionDistrito({ r }: { r: RegistroPozoBackend }) {
  const [obs, setObs] = useState('')
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.distrito)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Distrito no dictamina sobre este expediente: deja constancia de que lo recibió y lo envía a Recaudación.</p>
      <Observaciones valor={obs} onChange={setObs} />
      <Enviar texto="Tomar conocimiento y enviar a Recaudación" icono="visibility" cargando={accion.isPending} error={accion.error} onClick={() => accion.mutate({ observaciones: obs || undefined })} />
    </div>
  )
}

function AccionRecaudacion({ r }: { r: RegistroPozoBackend }) {
  const titulares = r.catastro?.titulares ?? []
  const [resultado, setResultado] = useState<'SIN_DEUDA' | 'CON_DEUDA' | ''>('')
  const [deuda, setDeuda] = useState({ personaId: titulares[0]?.personaId ?? '', detalle: '', monto: '' })
  const [obs, setObs] = useState('')
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.recaudacion)
  const pagar = useAccionRegistro(r.expediente.id, (_id, d: { deudaId: string; comprobante?: string }) => altaConcesionApi.cancelarDeuda(d.deudaId, d.comprobante))
  const [comprobante, setComprobante] = useState<Record<string, string>>({})

  if (r.expediente.estado === 'EN_ESPERA') {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info">El expediente está en espera: se reanuda solo cuando ningún titular tiene deudas pendientes.</Alert>
        {r.deudasPendientes.map((d) => (
          <div key={d.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.persona}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {d.detalle}
                {d.monto !== null && ` · ${formatoPesos(d.monto)}`}
              </p>
            </div>
            <input placeholder="N° de recibo / comprobante" value={comprobante[d.id] ?? ''} onChange={(e) => setComprobante({ ...comprobante, [d.id]: e.target.value })} className={controlClass({ className: 'w-56 py-2' })} />
            <Button size="sm" iconLeft="paid" loading={pagar.isPending} onClick={() => pagar.mutate({ deudaId: d.id, comprobante: comprobante[d.id] || undefined })}>
              Registrar pago
            </Button>
          </div>
        ))}
        {pagar.error && <Alert>{mensajeDeError(pagar.error)}</Alert>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">¿Alguno de los titulares tiene deuda con la DRH?</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'SIN_DEUDA', texto: 'Sin deuda', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'CON_DEUDA', texto: 'Con deuda', icono: 'payments', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
        ]}
      />
      {resultado === 'CON_DEUDA' && (
        <div className="grid gap-3 rounded-lg bg-amber-50/60 p-3 sm:grid-cols-3 dark:bg-amber-500/5">
          <Campo etiqueta="Titular que debe">
            <select value={deuda.personaId} onChange={(e) => setDeuda({ ...deuda, personaId: e.target.value })} className={controlClass({})}>
              {titulares.map((t) => (
                <option key={t.personaId} value={t.personaId}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Qué debe">
            <input value={deuda.detalle} onChange={(e) => setDeuda({ ...deuda, detalle: e.target.value })} placeholder="Ej: canon 2025 impago" className={controlClass({})} />
          </Campo>
          <Campo etiqueta="Monto ($)">
            <input type="number" min={0} value={deuda.monto} onChange={(e) => setDeuda({ ...deuda, monto: e.target.value })} className={controlClass({})} />
          </Campo>
        </div>
      )}
      <Observaciones valor={obs} onChange={setObs} />
      <Enviar
        texto={resultado === 'CON_DEUDA' ? 'Registrar deuda y pausar' : 'Sin deuda: pasar a Jurídico'}
        deshabilitado={!resultado || (resultado === 'CON_DEUDA' && !deuda.detalle)}
        cargando={accion.isPending}
        error={accion.error}
        onClick={() =>
          accion.mutate({
            resultado: resultado as 'SIN_DEUDA' | 'CON_DEUDA',
            deudas: resultado === 'CON_DEUDA' ? [{ personaId: deuda.personaId, detalle: deuda.detalle, monto: deuda.monto ? Number(deuda.monto) : undefined }] : undefined,
            observaciones: obs || undefined,
          })
        }
      />
    </div>
  )
}

function AccionJuridico({ r }: { r: RegistroPozoBackend }) {
  const [resultado, setResultado] = useState<Resultado | ''>('')
  const [obs, setObs] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.juridico)
  const enviar = () => accion.mutate({ resultado: resultado as Resultado, observaciones: obs || undefined })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">¿La documentación y los aspectos legales del registro y de la concesión del pozo están en regla?</p>
      <Opciones
        valor={resultado}
        onChange={setResultado}
        opciones={[
          { valor: 'APTO', texto: 'Apto', icono: 'check_circle', color: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
          { valor: 'OBSERVADO', texto: 'Observado (corregir)', icono: 'edit_note', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
          { valor: 'NO_APTO', texto: 'No apto', icono: 'block', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
        ]}
      />
      <Observaciones valor={obs} onChange={setObs} obligatorio={resultado === 'OBSERVADO' || resultado === 'NO_APTO'} />
      <Enviar
        texto={resultado === 'APTO' ? 'Apto: pasar a Secretaría General' : resultado === 'OBSERVADO' ? 'Devolver a Pozos' : resultado === 'NO_APTO' ? 'Dictaminar no apto' : 'Registrar'}
        deshabilitado={!resultado || (resultado !== 'APTO' && !obs.trim())}
        cargando={accion.isPending}
        error={accion.error}
        onClick={() => (resultado === 'NO_APTO' ? setConfirmar(true) : enviar())}
      />
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Dictaminar no apto?"
        message="El trámite termina: el registro queda rechazado y no se otorga la concesión. No se puede deshacer."
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

function AccionSecretaria({ r }: { r: RegistroPozoBackend }) {
  const [datos, setDatos] = useState({ numero: '', anio: String(new Date().getFullYear()), fecha: hoy() })
  const [obs, setObs] = useState('')
  const [rechazar, setRechazar] = useState(false)
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.resolucion)
  const conConcesion = r.ficha.jurisdiccionDrh && r.catastro?.numeroConcesion
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {conConcesion ? `Resolución que otorga la concesión N° ${r.catastro!.numeroConcesion} sobre el pozo ${r.pozo.idInterno}.` : `Resolución que registra el pozo ${r.pozo.idInterno} (sin concesión: fuera de jurisdicción DRH).`} Al
        registrarla, el expediente vuelve a Pozos para el cierre.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Número">
          <input value={datos.numero} onChange={(e) => setDatos({ ...datos, numero: e.target.value.replace(/\D/g, '') })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Año">
          <input value={datos.anio} onChange={(e) => setDatos({ ...datos, anio: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} className={controlClass({})} />
        </Campo>
      </div>
      <Observaciones valor={obs} onChange={setObs} placeholder="Obligatorio para rechazar" />
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button
          iconRight="send"
          disabled={!datos.numero || datos.anio.length !== 4 || !datos.fecha}
          loading={accion.isPending && accion.variables?.decision === 'APROBAR'}
          onClick={() => accion.mutate({ decision: 'APROBAR', numero: datos.numero, anio: Number(datos.anio), fecha: datos.fecha, observaciones: obs || undefined })}
        >
          Registrar resolución y pasar a Pozos
        </Button>
        <Button variant="secondary" iconLeft="cancel" className="text-red-600" disabled={!obs.trim()} onClick={() => setRechazar(true)}>
          Rechazar
        </Button>
      </div>
      <ConfirmDialog
        open={rechazar}
        tone="danger"
        title="¿Rechazar el registro?"
        message="El trámite termina sin concesión. No se puede deshacer."
        confirmLabel="Sí, rechazar"
        cancelLabel="Volver"
        onConfirm={() => {
          setRechazar(false)
          accion.mutate({ decision: 'RECHAZAR', observaciones: obs })
        }}
        onCancel={() => setRechazar(false)}
      />
    </div>
  )
}

function AccionCorreccion({ r }: { r: RegistroPozoBackend }) {
  const [obs, setObs] = useState('')
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.reenviar)
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">El expediente fue observado: el motivo está en el historial. Corrija lo que corresponda y reenvíelo; vuelve a la oficina que lo observó.</Alert>
      <Observaciones valor={obs} onChange={setObs} obligatorio placeholder="Qué se corrigió (queda en el historial)" />
      <Enviar texto="Reenviar" deshabilitado={!obs.trim()} cargando={accion.isPending} error={accion.error} onClick={() => accion.mutate({ observaciones: obs })} />
    </div>
  )
}

function AccionCierre({ r }: { r: RegistroPozoBackend }) {
  const [obs, setObs] = useState('')
  const accion = useAccionRegistro(r.expediente.id, registroPozoApi.cierre)
  const conConcesion = r.ficha.jurisdiccionDrh && r.catastro?.numeroConcesion
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Último paso: con la resolución {r.resolucion?.numero}/{r.resolucion?.anio}, al cerrar el expediente queda FINALIZADO y el pozo queda registrado en forma definitiva
        {conConcesion ? `, con la concesión N° ${r.catastro!.numeroConcesion} vigente` : ''}. El recorrido completo queda asentado y no se puede modificar.
      </p>
      <Observaciones valor={obs} onChange={setObs} />
      <Enviar texto="Cerrar expediente" icono="task_alt" cargando={accion.isPending} error={accion.error} onClick={() => accion.mutate({ observaciones: obs || undefined })} />
    </div>
  )
}

/**
 * Lo que puede hacer la oficina donde está el registro: tomarlo y, si lo tiene el usuario,
 * el formulario de su etapa. El servidor valida todo igual (oficina, etapa, tomado).
 */
export function AccionesPozo({ r }: { r: RegistroPozoBackend }) {
  const actor = useActor()
  const usuarioId = actor.id
  const tomar = useAccionRegistro(r.expediente.id, (id, _: void) => registroPozoApi.tomar(id))
  const e = r.expediente

  if (e.estado === 'FINALIZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-500/10 dark:text-green-300">
        <Icon name="verified" filled className="text-[28px]!" />
        <div className="text-sm">
          <p className="text-base font-bold">Registro finalizado: el pozo {r.pozo.idInterno} quedó registrado en forma definitiva.</p>
          <p>
            Resolución {r.resolucion?.numero}/{r.resolucion?.anio}
            {r.concesion && ` · concesión N° ${r.concesion.numero} vigente`}.{' '}
            <Link to={ROUTES.visor} className="font-semibold underline">
              Ver en el visor
            </Link>
          </p>
        </div>
      </div>
    )
  }
  if (e.estado === 'RECHAZADO') {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
        <Icon name="block" className="text-[28px]!" />
        <p className="text-sm">
          <span className="block text-base font-bold">Registro rechazado: no se otorgó la concesión.</span>El motivo está en el historial.
        </p>
      </div>
    )
  }
  // Quien no es de la oficina donde está el expediente, lo consulta sin actuar.
  if (!actor.puedeActuarEn(e.oficinaActual)) return <AvisoSoloConsulta oficina={e.oficinaNombre} />

  if (!e.tomadoPor) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          El expediente llegó a <strong>{e.oficinaNombre}</strong>. Para trabajarlo, alguien de la oficina tiene que tomarlo: queda registrado quién lo recibió y cuándo.
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
  if (e.tomadoPor.id !== usuarioId && !actor.esAdministrador) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Icon name="person" className="text-[18px]!" />
        Lo está trabajando <strong>{e.tomadoPor.nombre}</strong> ({e.oficinaNombre}).
      </p>
    )
  }
  switch (e.etapa) {
    case 'CATASTRO_POZO':
      return <FormCatastroPozo key={r.expediente.id} r={r} />
    case 'TOMA_CONOCIMIENTO_DISTRITO':
      return <AccionDistrito r={r} />
    case 'RECAUDACION':
      return <AccionRecaudacion r={r} />
    case 'JURIDICO':
      return <AccionJuridico r={r} />
    case 'SECRETARIA_GENERAL':
      return <AccionSecretaria r={r} />
    case 'CORRECCION_POZOS':
      return <AccionCorreccion r={r} />
    case 'CIERRE_POZO':
      return <AccionCierre r={r} />
  }
}
