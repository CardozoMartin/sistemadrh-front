import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Field } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { useActor } from '@/features/auth/useActor'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { HistorialExpediente } from '../../shared/circuito/HistorialExpediente'
import { TitularesDomiciliosFields } from '../../shared'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { ResumenEnvio } from '../../shared/circuito/ResumenEnvio'
import { tamanio } from '../../shared/circuito/resolucion'
import { hectareas, nombres, numeroConcesion } from '../../shared/formato'
import { estaEnCarga, NOMBRE_TIPO, type ModificacionBackend } from '../backend.types'
import { SuperficieResumen } from '../components/SuperficieResumen'
import { useCancelarModificacion, useEnviarModificacion, useGuardarTitulares, useModificacion, useQuitarTitulares, useSubirPlano, useTomarModificacion } from '../hooks'
import { faltaEnPlano, titularesAFormulario, titularesSchema, type TitularesForm } from '../schemas'

const TITULO = 'Plano de la nueva superficie'

/** Largo mínimo del motivo para cancelar (lo mismo exige el backend). */
const MIN_MOTIVO = 10

/**
 * Catastro, carga (caso de uso, pasos 9-12): sube el plano de la nueva superficie (KML o GeoJSON) y
 * el sistema lo verifica (sentido del trámite, superposiciones con otras concesiones, reducción
 * dentro del polígono actual, límite) y recalcula usos y caudal. Optativo: nuevos titulares.
 * También es la pantalla para corregir lo que observó Distrito o Jurídico y reenviarlo.
 * Todo es una PROPUESTA: la concesión no cambia hasta la verificación final.
 */
export default function CargaModificacionPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const consulta = useModificacion(expedienteId)

  if (consulta.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el trámite…" />
      </>
    )
  }
  if (consulta.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(consulta.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró la ampliación o reducción">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.inicio)}>
              Ir al inicio del trámite
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={consulta.error} onRetry={() => void consulta.refetch()} reintentando={consulta.isFetching} />
        )}
      </>
    )
  }

  const { expediente, modificacion } = consulta.data
  if (!estaEnCarga(modificacion.estado, expediente.etapa)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="lock"
          titulo="Este trámite ya no está en carga"
          descripcion={`Expediente ${expediente.numero}: ${modificacion.estado === 'EN_TRAMITE' ? `está en ${expediente.oficinaNombre} (${expediente.etapaNombre})` : `quedó ${modificacion.estado.toLowerCase()}`}.`}
        >
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.circuito(expediente.id))}>
            Ver el expediente
          </Button>
        </EmptyState>
      </>
    )
  }

  return <Carga key={expediente.id} datos={consulta.data} />
}

type Dialogo = 'cancelar' | 'enviar' | 'enviado' | null

function Carga({ datos }: { datos: ModificacionBackend }) {
  const navigate = useNavigate()
  const actor = useActor()
  const { expediente, modificacion: m } = datos
  const id = expediente.id
  const correccion = expediente.etapa === 'CORRECCION'
  const tomar = useTomarModificacion(id)
  const enviar = useEnviarModificacion(id)
  const cancelar = useCancelarModificacion(id)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [motivo, setMotivo] = useState('')
  const motivoValido = motivo.trim().length >= MIN_MOTIVO
  const loTengoYo = expediente.tomadoPor?.id === actor.id

  const resumen = [
    ['Expediente', expediente.numero],
    ['Concesión', numeroConcesion(m.concesion)],
    ['Trámite', NOMBRE_TIPO[m.tipo]],
    ['Titular actual', nombres(m.titularesActuales) || '—'],
  ]

  function confirmarEnvio() {
    setDialogo(null)
    enviar.mutate({ reenvio: correccion }, { onSuccess: () => setDialogo('enviado') })
  }

  return (
    <>
      <PageHeader
        title={TITULO}
        description="Suba el plano que presentó el solicitante (KML o GeoJSON). El sistema lo verifica y recalcula los usos y el caudal. La concesión no cambia hasta que el trámite finaliza con la resolución."
      />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={['Búsqueda']} actual={1} titulo={TITULO} />

        <Card className="flex flex-wrap gap-x-8 gap-y-2 p-4 text-sm">
          {resumen.map(([etiqueta, valor]) => (
            <span key={etiqueta}>
              <span className="text-slate-500 dark:text-slate-400">{etiqueta}: </span>
              <strong className="text-slate-900 dark:text-white">{valor}</strong>
            </span>
          ))}
        </Card>

        {correccion && <Alert tone="info">Distrito o Jurídico observó el trámite: corrija o complete lo que indica el historial (abajo) y reenvíelo. Vuelve a la oficina que lo observó.</Alert>}

        {!loTengoYo ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {expediente.tomadoPor ? `Lo tiene ${expediente.tomadoPor.nombre}. Para trabajarlo tiene que tomarlo usted.` : 'Tome el expediente para trabajarlo.'}
            </p>
            {tomar.error && <Alert>{mensajeDeError(tomar.error)}</Alert>}
            <Button iconLeft="pan_tool" loading={tomar.isPending} onClick={() => tomar.mutate()}>
              Tomar expediente
            </Button>
          </Card>
        ) : (
          <>
            <PlanoCard datos={datos} />
            <TitularesCard datos={datos} />

            {(enviar.error || cancelar.error) && <Alert>{mensajeDeError(enviar.error ?? cancelar.error)}</Alert>}
            <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              {correccion ? (
                <span />
              ) : (
                <Button variant="ghost" size="sm" disabled={enviar.isPending || cancelar.isPending} onClick={() => setDialogo('cancelar')}>
                  Cancelar trámite
                </Button>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" iconLeft="arrow_back" onClick={() => navigate(ROUTES.tramites.reduccionAmpliacion.inicio)}>
                  Volver
                </Button>
                <Button size="sm" iconRight="send" loading={enviar.isPending} disabled={!m.cargaCompleta || enviar.isPending} onClick={() => setDialogo('enviar')}>
                  {correccion ? 'Reenviar a la oficina que observó' : 'Enviar a Recaudación'}
                </Button>
              </div>
            </Card>
            {!m.cargaCompleta && (
              <p className="-mt-3 text-right text-xs text-slate-500 dark:text-slate-400">Para enviarlo falta el plano{m.cambiaTitular ? ' o el domicilio de los nuevos titulares' : ''}.</p>
            )}
          </>
        )}

        {correccion && (
          <Card className="p-6">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial del expediente</h2>
            <HistorialExpediente expedienteId={id} />
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={dialogo === 'cancelar'}
        tone="danger"
        title="¿Cancelar el trámite?"
        message="El trámite queda anulado (no se borra: queda en el historial con el motivo) y la concesión sigue igual."
        confirmLabel="Sí, cancelar trámite"
        cancelLabel="Volver"
        loading={cancelar.isPending}
        onConfirm={() => {
          if (motivoValido) cancelar.mutate(motivo.trim(), { onSuccess: () => navigate(ROUTES.tramites.reduccionAmpliacion.inicio) })
        }}
        onCancel={() => setDialogo(null)}
      >
        <Field
          id="motivo-cancelacion"
          label="Motivo"
          required
          hint={`Al menos ${MIN_MOTIVO} caracteres.`}
          error={motivo && !motivoValido ? `Explique el motivo (al menos ${MIN_MOTIVO} caracteres).` : undefined}
        >
          <textarea
            id="motivo-cancelacion"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviar'}
        title={correccion ? '¿Reenviar el trámite?' : '¿Enviar el trámite a Recaudación?'}
        message="Revise lo que se envía:"
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Concesión', numeroConcesion(m.concesion)],
            ['Superficie', `${hectareas(m.superficie.actualHa)} → ${m.superficie.nuevaHa === null ? '—' : hectareas(m.superficie.nuevaHa)}`],
            ['Nuevos titulares', m.cambiaTitular ? nombres(m.nuevosTitulares) : null],
            ['Destino', correccion ? 'La oficina que lo observó' : 'Recaudación'],
          ]}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === 'enviado'}
        tone="success"
        title="Trámite enviado"
        message={`El expediente ${expediente.numero} fue ${correccion ? 'reenviado a la oficina que lo observó' : 'derivado a Recaudación'}.`}
        confirmLabel="Volver al inicio"
        onConfirm={() => navigate(ROUTES.tramites.reduccionAmpliacion.inicio)}
      />
    </>
  )
}

/** El plano: elegir el archivo, subirlo (el backend lo verifica) y ver el resultado. */
function PlanoCard({ datos }: { datos: ModificacionBackend }) {
  const subir = useSubirPlano(datos.expediente.id)
  const [archivo, setArchivo] = useState<File | null>(null)
  const plano = datos.modificacion.poligonoPropuesto
  const falta = faltaEnPlano(archivo)
  // Los avisos del último plano subido (o los que quedaron guardados con el plano).
  const avisos = subir.data?.avisos ?? plano?.avisos ?? []

  return (
    <Card className="flex flex-col gap-5 p-6 md:p-8">
      <div className="flex items-start gap-3">
        <Icon name="map" className="mt-0.5 text-primary" />
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Plano de {NOMBRE_TIPO[datos.modificacion.tipo].toLowerCase()}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            La copia digital del plano que presentó el solicitante. El sistema controla que {datos.modificacion.tipo === 'AMPLIACION' ? 'aumente' : 'disminuya'} la superficie, que no se superponga con
            otra concesión{datos.modificacion.tipo === 'REDUCCION' && datos.modificacion.poligonoActual ? ', que quede dentro del polígono actual' : ''} y que esté dentro de Tucumán.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{plano ? 'Reemplazar el plano' : 'Archivo del plano'}</span>
          <input
            type="file"
            accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null)
              subir.reset()
            }}
            className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary dark:text-slate-200"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">KML o GeoJSON, hasta 5 MB. En cualquier sistema de coordenadas que use la DRH (POSGAR faja 3, WGS84).</span>
        </label>
        <Button iconLeft="upload" loading={subir.isPending} disabled={!!falta || subir.isPending} onClick={() => archivo && subir.mutate(archivo)}>
          {plano ? 'Subir y reemplazar' : 'Subir plano'}
        </Button>
      </div>
      {archivo && falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {archivo && !falta && !subir.isSuccess && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {archivo.name} · {tamanio(archivo.size)}
        </p>
      )}
      {subir.error && <Alert>{mensajeDeError(subir.error)}</Alert>}
      {subir.isSuccess && <Alert tone="info">Plano verificado y guardado: {subir.data.modificacion.poligonoPropuesto?.archivo.nombre}.</Alert>}
      {plano && avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          {avisos.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <Icon name="info" className="text-[16px]! text-sky-600" />
              {a}
            </li>
          ))}
        </ul>
      )}

      <SuperficieResumen datos={datos} />
    </Card>
  )
}

/** Optativo: si con la nueva superficie cambian los titulares (ej: se suma tierra de otro dueño). */
function TitularesCard({ datos }: { datos: ModificacionBackend }) {
  const id = datos.expediente.id
  const m = datos.modificacion
  const [abierto, setAbierto] = useState(m.cambiaTitular)
  const guardar = useGuardarTitulares(id)
  const quitar = useQuitarTitulares(id)
  const form = useForm<TitularesForm>({ resolver: zodResolver(titularesSchema), defaultValues: titularesAFormulario(datos), mode: 'onTouched' })

  return (
    <Card className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon name="group" className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Titulares</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {m.cambiaTitular ? `Con este trámite la concesión pasa a: ${nombres(m.nuevosTitulares)}.` : `La concesión conserva sus titulares: ${nombres(m.titularesActuales) || '—'}.`}
            </p>
          </div>
        </div>
        {!abierto && (
          <Button size="sm" variant="secondary" iconLeft="person_add" onClick={() => setAbierto(true)}>
            Cambian los titulares
          </Button>
        )}
      </div>

      {abierto && (
        <FormProvider {...form}>
          <form noValidate onSubmit={form.handleSubmit((v) => guardar.mutate(v))} className="flex flex-col gap-6">
            <TitularesDomiciliosFields tituloTitular="Nuevo titular" />
            {(guardar.error || quitar.error) && <Alert>{mensajeDeError(guardar.error ?? quitar.error)}</Alert>}
            {guardar.isSuccess && <Alert tone="info">Nuevos titulares guardados.</Alert>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                loading={quitar.isPending}
                onClick={() => {
                  if (m.cambiaTitular) quitar.mutate(undefined, { onSuccess: () => setAbierto(false) })
                  else setAbierto(false)
                }}
              >
                No cambian los titulares
              </Button>
              <Button type="submit" size="sm" iconLeft="save" loading={guardar.isPending}>
                Guardar nuevos titulares
              </Button>
            </div>
          </form>
        </FormProvider>
      )}
    </Card>
  )
}
