import { lazy, Suspense, useState, type ReactNode } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Field, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { nombres, numeroConcesion } from '../../CambioDeTitularidad/formato'
import { errorMotivoCancelacion, MIN_MOTIVO_CANCELACION, motivoCancelacionValido } from '../../shared/circuito/motivo'
import { CoordenadaFields } from '../../shared/components/CoordenadaFields'
import { KmlUploadField } from '../../shared/components/KmlUploadField'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { SuministroFields } from '../../shared/components/SuministroFields'
import type { PoligonoForm } from '../../shared/schemas/poligono'
import type { PuntoReubicacion, ReubicacionBackend } from '../backend.types'
import { anilloExterior, caminoSuministro, diferenciaSuperficie, dondeQuedo, estaEnCarga, servicioADto, servicioInicial } from '../formato'
import { useCancelarReubicacion, useEnviarReubicacion, useGuardarPoligonoReubicacion, useGuardarServicioReubicacion, useReubicacion } from '../hooks'
import { servicioReubicacionSchema, type ServicioReubicacionForm } from '../schemas'

// El mapa (Leaflet) se carga recién cuando hay algo para comparar.
const EditorPoligonoMap = lazy(() => import('@/components/map/EditorPoligonoMap').then((m) => ({ default: m.EditorPoligonoMap })))

type Dialogo = 'cancelar' | 'enviar' | 'enviada' | null

const TITULO = 'Propuesta de Reubicación'
const ha = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha`

/**
 * Paso 2 (Catastro), caso de uso pasos 10-14: el nuevo lugar al que llega el agua (KML) y la forma
 * de servicio, comparados con lo vigente. «Enviar a Recaudación» lo pone en circulación. Nada
 * cambia en la concesión hasta que la reubicación termine.
 */
export default function PropuestaReubicacionPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const reubicacion = useReubicacion(expedienteId)

  if (reubicacion.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el trámite…" />
      </>
    )
  }

  if (reubicacion.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(reubicacion.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la reubicación">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.reubicacion.inicio)}>
              Ir al inicio del trámite
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={reubicacion.error} onRetry={() => void reubicacion.refetch()} reintentando={reubicacion.isFetching} />
        )}
      </>
    )
  }

  const { expediente } = reubicacion.data
  const { estado } = reubicacion.data.reubicacion
  if (!estaEnCarga(estado, expediente.etapa)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState icon="lock" titulo="Esta reubicación ya no está en Catastro" descripcion={dondeQuedo(estado, expediente)}>
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.reubicacion.inicio)}>
            Ir al inicio del trámite
          </Button>
        </EmptyState>
      </>
    )
  }

  return <Propuesta datos={reubicacion.data} />
}

function Propuesta({ datos }: { datos: ReubicacionBackend }) {
  const navigate = useNavigate()
  const id = datos.expediente.id
  const { reubicacion, expediente } = datos
  const enviar = useEnviarReubicacion(id)
  const cancelar = useCancelarReubicacion(id)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const motivoValido = motivoCancelacionValido(motivoCancelacion)

  const ocupado = enviar.isPending || cancelar.isPending
  const errorMutacion = enviar.error ?? cancelar.error
  const concesion = numeroConcesion(reubicacion.concesion)
  const { ubicacion } = reubicacion.concesion

  function confirmarEnvio() {
    enviar.mutate(undefined, { onSuccess: () => setDialogo('enviada'), onError: () => setDialogo(null) })
  }

  function confirmarCancelacion() {
    cancelar.mutate(motivoCancelacion.trim(), {
      onSuccess: () => {
        setDialogo(null)
        navigate(ROUTES.tramites.reubicacion.inicio)
      },
    })
  }

  return (
    <>
      <PageHeader title={TITULO} description="Cargue el nuevo lugar al que llega el agua y la forma de servicio, y compárelos con lo vigente." />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo="Propuesta" carga="Propuesta" />

        {/* Datos del expediente y de la concesión */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="move_location" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Expediente N° {expediente.numero}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Reubicación en la concesión {concesion}</p>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">Concesión vigente</span>
          </div>
          <dl className="grid gap-x-6 gap-y-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Titular" valor={nombres(reubicacion.titulares)} />
            <Dato label="Ubicación" valor={[ubicacion.localidad, ubicacion.departamento, ubicacion.distrito && `Distrito ${ubicacion.distrito}`].filter(Boolean).join(' · ')} />
            <Dato label="Padrón" valor={reubicacion.concesion.padron} />
            <Dato label="Motivo" valor={reubicacion.motivoTexto} />
            <Dato label="Documentación presentada" valor={`${reubicacion.documentacionPresentada.length} papeles`} />
          </dl>
          <div className="mx-6 mb-6 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
            <Icon name="info" className="text-sky-600" />
            <p className="text-sky-700 dark:text-sky-300">
              La concesión {concesion} no se mueve: conserva su número, magnitud, titular y padrón. Lo vigente sigue rigiendo hasta que la reubicación termine con la resolución.
            </p>
          </div>
        </Card>

        <SeccionPoligono datos={datos} />
        <SeccionServicio datos={datos} />

        {/* Acciones */}
        <Card>
          <div className="flex flex-col gap-4 p-6">
            {!reubicacion.cargaCompleta && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Para enviarla a Recaudación cargue el nuevo polígono y guarde la forma de servicio.</p>
            )}
            {errorMutacion && <Alert>{mensajeDeError(errorMutacion)}</Alert>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setDialogo('cancelar')}>
              Cancelar trámite
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={ocupado} onClick={() => navigate(ROUTES.tramites.reubicacion.inicio)}>
                Volver
              </Button>
              <Button size="sm" iconRight="send" loading={enviar.isPending} disabled={ocupado || !reubicacion.cargaCompleta} onClick={() => setDialogo('enviar')}>
                Enviar a Recaudación
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'cancelar'}
        tone="danger"
        title="¿Cancelar el trámite?"
        message="La reubicación queda cancelada (no se borra: queda en el historial con el motivo) y la concesión sigue como estaba."
        confirmLabel="Sí, cancelar trámite"
        cancelLabel="Volver"
        loading={cancelar.isPending}
        onConfirm={() => {
          if (motivoValido) confirmarCancelacion()
        }}
        onCancel={() => setDialogo(null)}
      >
        <Field id="motivo-cancelacion" label="Motivo" required hint={`Al menos ${MIN_MOTIVO_CANCELACION} caracteres.`} error={errorMotivoCancelacion(motivoCancelacion)}>
          <textarea
            id="motivo-cancelacion"
            rows={3}
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviar'}
        title="¿Enviar la reubicación a Recaudación?"
        message={`El expediente ${expediente.numero} se derivará a Recaudación. La concesión ${concesion} sigue como está hasta que la reubicación termine.`}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        loading={enviar.isPending}
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviada'}
        tone="success"
        title="Reubicación enviada"
        message={`El expediente ${expediente.numero} fue derivado a Recaudación.`}
        confirmLabel="Volver al inicio"
        onConfirm={() => navigate(ROUTES.tramites.reubicacion.inicio)}
      />
    </>
  )
}

// --- Nuevo lugar (polígono) -----------------------------------------------------------

function SeccionPoligono({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion } = datos
  const guardar = useGuardarPoligonoReubicacion(datos.expediente.id)
  const [avisosArchivo, setAvisosArchivo] = useState<string[]>([])
  const form = useForm<{ poligono: PoligonoForm | null }>({ defaultValues: { poligono: null } })
  const elegido = useWatch({ control: form.control, name: 'poligono' })
  const { vigente, propuesta } = reubicacion

  function onGuardar() {
    if (!elegido?.contenido) return
    guardar.mutate(
      { nombre: elegido.nombreArchivo, contenido: elegido.contenido },
      {
        onSuccess: (r) => {
          setAvisosArchivo(r.avisosArchivo)
          form.reset({ poligono: null })
        },
      },
    )
  }

  return (
    <Card>
      <EncabezadoSeccion icono="polyline" titulo="Nuevo lugar al que llega el agua" descripcion="El KML / GeoJSON del plano de reubicación." />
      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Icon name="warning" className="shrink-0" />
          <p>
            El nuevo polígono tiene que quedar <strong>dentro de la propiedad del solicitante</strong>
            {reubicacion.concesion.padron ? ` (padrón ${reubicacion.concesion.padron})` : ''}: verifíquelo con el plano de reubicación. La magnitud no cambia, así que la superficie debería ser la misma.
          </p>
        </div>

        <FormProvider {...form}>
          <KmlUploadField name="poligono" titulo={propuesta.poligono ? 'Reemplazar el KML propuesto' : 'KML del nuevo lugar'} />
        </FormProvider>
        {elegido?.contenido && (
          <div className="flex justify-end">
            <Button size="sm" iconLeft="save" loading={guardar.isPending} onClick={onGuardar}>
              Guardar polígono
            </Button>
          </div>
        )}
        {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
        {avisosArchivo.length > 0 && <Avisos titulo="Lectura del archivo" avisos={avisosArchivo} tono="info" />}

        {propuesta.poligono && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th />
                  <th className="pb-1 font-medium">Vigente</th>
                  <th className="pb-1 font-medium">Propuesto</th>
                  <th className="pb-1 font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 pr-3 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">Superficie</td>
                  <td className="py-1.5 pr-3 tabular-nums">{vigente.poligono ? ha(vigente.poligono.superficieHa) : '—'}</td>
                  <td className="py-1.5 pr-3 font-semibold tabular-nums">{ha(propuesta.poligono.superficieHa)}</td>
                  <td className="py-1.5 text-xs font-semibold tabular-nums">{vigente.poligono ? diferenciaSuperficie(vigente.poligono.superficieHa, propuesta.poligono.superficieHa) : ''}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">Perímetro</td>
                  <td className="py-1.5 pr-3 tabular-nums">{vigente.poligono ? `${Math.round(vigente.poligono.perimetroM)} m` : '—'}</td>
                  <td className="py-1.5 pr-3 font-semibold tabular-nums">{Math.round(propuesta.poligono.perimetroM)} m</td>
                  <td />
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">Archivo</td>
                  <td className="py-1.5 pr-3">{vigente.poligono?.archivo?.nombre ?? '—'}</td>
                  <td className="py-1.5 pr-3">{propuesta.poligono.archivo?.nombre ?? '—'}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <Suspense fallback={<div className="flex h-72 items-center justify-center"><Spinner className="size-5 text-primary" /></div>}>
              <EditorPoligonoMap original={anilloExterior(vigente.poligono)} propuesta={anilloExterior(propuesta.poligono)} className="h-80" />
            </Suspense>
            <p className="text-xs text-slate-500 dark:text-slate-400">Punteado: el lugar vigente. Relleno: el propuesto.</p>
          </>
        )}
        {reubicacion.avisos.length > 0 && <Avisos titulo="Revise antes de enviar" avisos={reubicacion.avisos} tono="warning" />}
      </div>
    </Card>
  )
}

// --- Forma de servicio ----------------------------------------------------------------

function SeccionServicio({ datos }: { datos: ReubicacionBackend }) {
  const { reubicacion } = datos
  const guardar = useGuardarServicioReubicacion(datos.expediente.id)
  const [guardado, setGuardado] = useState(false)
  const form = useForm<ServicioReubicacionForm>({ resolver: zodResolver(servicioReubicacionSchema), defaultValues: servicioInicial(reubicacion), mode: 'onTouched' })
  const cambiaPunto = useWatch({ control: form.control, name: 'cambiaPuntoEntrega' })
  const { ubicacion } = reubicacion.concesion
  const { vigente } = reubicacion

  function onSubmit(values: ServicioReubicacionForm) {
    setGuardado(false)
    guardar.mutate(servicioADto(values), {
      onSuccess: () => {
        // Lo guardado pasa a ser el punto de partida del formulario (deja de estar «modificado»).
        form.reset(values)
        setGuardado(true)
      },
    })
  }

  return (
    <Card>
      <EncabezadoSeccion icono="water" titulo="Forma de servicio" descripcion="Por dónde llega el agua al nuevo lugar. Se precarga con lo vigente: cambie solo lo que cambia." />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 p-6">
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Vigente</p>
            <p className="text-slate-700 dark:text-slate-200">{caminoSuministro(vigente.suministro)}</p>
            <p className="text-slate-500 dark:text-slate-400">Punto de entrega: {textoPunto(vigente.puntoEntrega)}</p>
          </div>

          <SuministroFields prefix="suministro" ubicacion={{ departamento: ubicacion.departamento ?? '', localidad: ubicacion.localidad ?? '', distrito: ubicacion.distrito ?? '' }} sinCaudal />
          <p className="-mt-3 text-xs text-slate-500 dark:text-slate-400">Indique en la observación el sistema de riego (goteo, aspersión, gravedad…).</p>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" className="size-4" {...form.register('cambiaPuntoEntrega')} />
            Cambia el punto de entrega del agua (ej: la estación de bombeo)
          </label>
          {cambiaPunto && (
            <div className="grid gap-6 md:grid-cols-2">
              <CoordenadaFields name="puntoEntrega" titulo="Punto de entrega" required className="md:col-span-2" />
              <FormTextField name="puntoEntrega.referencia" label="Referencia del lugar" placeholder="Ej: estación de bombeo sobre el río Salí" className="md:col-span-2" />
            </div>
          )}

          {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
          <div className="flex items-center justify-end gap-3">
            {guardado && !form.formState.isDirty && (
              <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-300">
                <Icon name="check_circle" className="text-[18px]!" /> Guardada
              </span>
            )}
            <Button type="submit" size="sm" iconLeft="save" loading={guardar.isPending}>
              Guardar forma de servicio
            </Button>
          </div>
        </form>
      </FormProvider>
    </Card>
  )
}

// --- Piezas ---------------------------------------------------------------------------

const textoPunto = (p: PuntoReubicacion | null) =>
  p ? `${p.x !== null && p.y !== null ? `X ${p.x} · Y ${p.y}` : `${p.latitud}, ${p.longitud}`}${p.referencia ? ` (${p.referencia})` : ''}` : 'sin punto de entrega cargado'

function EncabezadoSeccion({ icono, titulo, descripcion }: { icono: string; titulo: string; descripcion: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
      <Icon name={icono} className="text-primary" />
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">{titulo}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
      </div>
    </div>
  )
}

function Avisos({ titulo, avisos, tono }: { titulo: string; avisos: string[]; tono: 'info' | 'warning' }) {
  const colores =
    tono === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
  return (
    <div className={`rounded-lg border p-4 text-sm ${colores}`}>
      <p className="mb-1 font-semibold">{titulo}</p>
      <ul className="list-disc pl-5">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-white">{valor || <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}
