import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Campo } from '@/features/tramites/shared/circuito/campos'
import { cn } from '@/lib/cn'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { aDatosBajaDto, DatosSolicitudCampos, faltaEnSolicitud, solicitudVacia } from '../components/DatosBajaForm'
import { FichaPozo } from '../components/FichaPozo'
import { formatoFecha, NOMBRE_ORIGEN } from '../estilos'
import { useBajaDeOficio, useIniciarBaja, usePozo } from '../hooks'
import type { OrigenBaja, PozoBackend } from '../types'

const OFICINA: Record<string, string> = { pozos: 'Pozos', distrito: 'Distrito', juridico: 'Jurídico', secretaria_general: 'Secretaría General' }
const TRAMITE: Record<string, string> = { ALTA_CONCESION: 'Alta de concesión', BAJA_POZO: 'Baja de pozo' }
const ESTADO_EXPEDIENTE: Record<string, string> = { EN_TRAMITE: 'en trámite', OBSERVADO: 'observado', FINALIZADO: 'finalizado', RECHAZADO: 'rechazado', EN_ESPERA: 'en espera' }

/** Las dos formas de dar de baja, como tarjetas grandes. */
const OPCIONES: { valor: OrigenBaja; icono: string; titulo: string; detalle: string }[] = [
  {
    valor: 'A_SOLICITUD',
    icono: 'person',
    titulo: 'Baja de pozo',
    detalle: 'La pide el titular con un expediente: documentación, antecedentes, evaluación técnica, Jurídico y resolución de Secretaría General.',
  },
  {
    valor: 'DE_OFICIO',
    icono: 'account_balance',
    titulo: 'Baja de oficio',
    detalle: 'La DRH ya sabe que el pozo no existe o no funciona: se da de baja en el acto, sin trámite.',
  },
]

/** A solicitud: expediente en papel + datos de la baja → inicia el trámite y pasa al circuito. */
function FormularioSolicitud({ pozo }: { pozo: PozoBackend }) {
  const navigate = useNavigate()
  const iniciar = useIniciarBaja()
  const [expediente, setExpediente] = useState({ numero: '', reparticion: '332', anio: String(new Date().getFullYear()) })
  const [datos, setDatos] = useState(solicitudVacia)
  const solo = (max: number) => (v: string) => v.replace(/\D/g, '').slice(0, max)

  const falta = !expediente.numero || !expediente.reparticion || expediente.anio.length !== 4 ? 'Complete el número de expediente.' : faltaEnSolicitud(datos)

  function enviar() {
    if (falta) return
    iniciar.mutate(
      { pozoId: pozo.id, expediente: { ...expediente, anio: Number(expediente.anio) }, ...aDatosBajaDto(datos) },
      { onSuccess: (b) => navigate(ROUTES.pozo.baja(b.expediente.id)) },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid max-w-xl grid-cols-3 gap-3">
        <Campo etiqueta="N° de expediente">
          <input autoFocus value={expediente.numero} inputMode="numeric" onChange={(e) => setExpediente({ ...expediente, numero: solo(6)(e.target.value) })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Repartición">
          <input value={expediente.reparticion} inputMode="numeric" onChange={(e) => setExpediente({ ...expediente, reparticion: solo(4)(e.target.value) })} className={controlClass({})} />
        </Campo>
        <Campo etiqueta="Año">
          <input value={expediente.anio} inputMode="numeric" onChange={(e) => setExpediente({ ...expediente, anio: solo(4)(e.target.value) })} className={controlClass({})} />
        </Campo>
      </div>
      <DatosSolicitudCampos valor={datos} onChange={setDatos} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Se puede iniciar aunque falte documentación: en el paso siguiente se controla y, si falta algo obligatorio, el expediente queda en espera.
      </p>
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {iniciar.error && <Alert>{mensajeDeError(iniciar.error)}</Alert>}
      <div>
        <Button iconRight="arrow_forward" disabled={!!falta} loading={iniciar.isPending} onClick={enviar}>
          Iniciar el trámite
        </Button>
      </div>
    </div>
  )
}

/** De oficio: motivo e inspección → el pozo queda dado de baja en el acto (con confirmación). */
function FormularioDeOficio({ pozo }: { pozo: PozoBackend }) {
  const baja = useBajaDeOficio(pozo.id)
  const [datos, setDatos] = useState({ motivo: '', fechaInspeccion: '', observacionesInspeccion: '' })
  const [confirmar, setConfirmar] = useState(false)
  const falta = datos.motivo.trim().length < 10 ? 'Explique el motivo de la baja (al menos 10 caracteres).' : null
  const motivo = datos.motivo.trim()
  const fechaInspeccion = datos.fechaInspeccion || undefined
  const observacionesInspeccion = datos.observacionesInspeccion.trim() || undefined

  return (
    <div className="flex flex-col gap-5">
      <Campo etiqueta="Motivo de la baja" ayuda="Ej: pozo inexistente, cegado, sin funcionar desde hace años.">
        <textarea value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} rows={3} className={controlClass({ className: 'resize-y' })} />
      </Campo>
      <fieldset className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Inspección (si la hubo)</legend>
        <Campo etiqueta="Fecha">
          <input type="date" value={datos.fechaInspeccion} onChange={(e) => setDatos({ ...datos, fechaInspeccion: e.target.value })} className={controlClass({})} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta="Qué se constató">
            <textarea value={datos.observacionesInspeccion} onChange={(e) => setDatos({ ...datos, observacionesInspeccion: e.target.value })} rows={2} className={controlClass({ className: 'resize-y' })} />
          </Campo>
        </div>
      </fieldset>
      {falta && <p className="text-sm text-amber-700 dark:text-amber-300">{falta}</p>}
      {baja.error && <Alert>{mensajeDeError(baja.error)}</Alert>}
      <div>
        <Button variant="danger" iconLeft="do_not_disturb_on" disabled={!!falta} loading={baja.isPending} onClick={() => setConfirmar(true)}>
          Dar de baja el pozo
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title={`¿Dar de baja el pozo ${pozo.idInterno}?`}
        message={`Baja de oficio, en el acto y sin trámite. El pozo pasa a estado BAJA (se conserva todo su registro técnico)${pozo.concesion ? ` y se desvincula de la concesión ${pozo.concesion.numero ?? ''}` : ''}. Distrito recibe el aviso.`}
        confirmLabel="Sí, dar de baja"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          baja.mutate({ motivo, fechaInspeccion, observacionesInspeccion })
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}

/** El pozo ya está dado de baja: cómo, cuándo, por qué y quién. */
function BajaRegistrada({ pozo }: { pozo: PozoBackend }) {
  const b = pozo.bajaConfirmada
  if (!b) return <Alert tone="info">El pozo está {pozo.estado === 'BAJA' ? 'dado de baja' : 'anulado'}: no admite otra baja.</Alert>
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-100 p-4 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <Icon name="do_not_disturb_on" className="text-[28px]! text-slate-500" />
      <div className="text-sm">
        <p className="text-base font-bold text-slate-900 dark:text-white">
          Pozo dado de baja{b.fechaBaja && ` el ${formatoFecha(b.fechaBaja)}`}
        </p>
        <p>
          {NOMBRE_ORIGEN[b.origen]} · registró {b.usuario}
          {b.resolucion && ` · Resolución ${b.resolucion}`}
        </p>
        {b.concesionAnterior && <p>Abastecía la concesión {b.concesionAnterior}{b.concesionAnulada ? ', que quedó anulada' : ''}.</p>}
        {b.clausura &&
          (b.clausura.fecha ? (
            <p>
              Clausurado el {formatoFecha(b.clausura.fecha)} (acta {b.clausura.acta}).
            </p>
          ) : (
            <p className="font-semibold text-amber-700 dark:text-amber-300">Clausura física pendiente.</p>
          ))}
        <p className="mt-1">Motivo: {b.motivo}</p>
        {b.expedienteId && (
          <Link to={ROUTES.pozo.baja(b.expedienteId)} className="mt-1 inline-block font-semibold text-primary hover:underline">
            Ver el expediente {b.expediente}
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * Vista del pozo (paso 2 de la baja): el pozo, su concesión y sus expedientes, y las dos
 * formas de darlo de baja:
 *   - Baja de pozo (a solicitud): se carga el expediente y empieza el circuito por las oficinas.
 *   - Baja de oficio: la DRH ya sabe que el pozo no existe o no funciona; se da de baja en el acto.
 */
export default function PozoBajaPage() {
  const { pozoId } = useParams()
  const consulta = usePozo(pozoId)
  const [origen, setOrigen] = useState<OrigenBaja | null>(null)

  if (consulta.isPending) return <LoadingState mensaje="Cargando el pozo…" />
  if (consulta.isError) {
    return esNoEncontrado(consulta.error) ? (
      <EmptyState icon="search_off" titulo="No se encontró el pozo" />
    ) : (
      <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} reintentando={consulta.isFetching} />
    )
  }

  const pozo = consulta.data
  const dadoDeBaja = pozo.estado === 'BAJA' || pozo.estado === 'ANULADO'

  function opciones() {
    if (dadoDeBaja) return <BajaRegistrada pozo={pozo} />
    if (pozo.bajaAbierta) {
      return (
        <Alert tone="info">
          El pozo ya tiene una baja en trámite (en {OFICINA[pozo.bajaAbierta.oficina]}):{' '}
          <Link to={ROUTES.pozo.baja(pozo.bajaAbierta.expedienteId)} className="font-semibold underline">
            expediente {pozo.bajaAbierta.expediente}
          </Link>
          .
        </Alert>
      )
    }
    return (
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {OPCIONES.map((o) => (
            <button
              key={o.valor}
              type="button"
              aria-pressed={origen === o.valor}
              onClick={() => setOrigen(o.valor)}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors',
                origen === o.valor ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', origen === o.valor ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                <Icon name={o.icono} />
              </span>
              <span>
                <span className="block font-bold text-slate-900 dark:text-white">{o.titulo}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{o.detalle}</span>
              </span>
            </button>
          ))}
        </div>
        {origen === 'A_SOLICITUD' && (
          <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Expediente y datos de la baja</p>
            <FormularioSolicitud pozo={pozo} />
          </div>
        )}
        {origen === 'DE_OFICIO' && (
          <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Datos de la baja de oficio</p>
            <FormularioDeOficio pozo={pozo} />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={`Pozo ${pozo.idInterno}`}
        description={pozo.concesion ? `Concesión ${pozo.concesion.numero ?? 's/n'} · ${pozo.concesion.titular ?? 'sin titular'}` : 'Sin concesión'}
        actions={
          <Link to={ROUTES.pozo.bajas} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <Icon name="search" className="text-[18px]!" /> Buscar otro pozo
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">{dadoDeBaja ? 'Baja' : '¿Cómo se da de baja?'}</h2>
            {opciones()}
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Datos del pozo</h2>
            <FichaPozo pozo={pozo} />
          </Card>
        </div>

        <Card className="h-fit p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Expedientes del pozo</h2>
          {pozo.expedientes.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pozo.expedientes.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{e.numero}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {TRAMITE[e.tipoTramite] ?? e.tipoTramite} · {ESTADO_EXPEDIENTE[e.estado] ?? e.estado.toLowerCase()}
                    </p>
                  </div>
                  {e.tipoTramite === 'BAJA_POZO' && (
                    <Link to={ROUTES.pozo.baja(e.id)} className="text-sm font-semibold text-primary hover:underline">
                      Ver
                    </Link>
                  )}
                  {e.tipoTramite === 'ALTA_CONCESION' && (
                    <Link to={ROUTES.tramites.altaConcesion.circuito(e.id)} className="text-sm font-semibold text-primary hover:underline">
                      Ver
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">El pozo no tiene expedientes en el sistema (es del padrón anterior).</p>
          )}
        </Card>
      </div>
    </>
  )
}
