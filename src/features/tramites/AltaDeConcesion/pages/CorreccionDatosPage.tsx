import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stepper } from '@/components/ui/Stepper'
import { controlClass } from '@/components/form/styles'
import { useSesion } from '@/features/auth/context'
import { useNotificaciones } from '@/features/notificaciones/context'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { altaAFormulario, inmuebleADto, suministroADto, titularesADto, ubicacionAFormData } from '../adaptadores'
import { altaConcesionApi } from '../api'
import type { AltaBackend } from '../backend.types'
import { ResumenBorrador } from '../components/ResumenBorrador'
import { SECCIONES_CON_COMPONENTE } from '../components/secciones'
import type { InfoSeccion } from '../components/secciones/config'
import { useAccionAlta, useAlta } from '../hooks'
import { crearPreCargaSchema, type PreCargaForm } from '../schemas'

const TITULO = 'Corrección de datos del alta'

/**
 * Lo que se corrige: errores materiales. Los usos, magnitudes y el caudal no (son lo otorgado por
 * la resolución: cambiarlos es una ampliación o reducción).
 */
const SECCIONES = SECCIONES_CON_COMPONENTE.filter((s) => s.key !== 'usos')

/** Mientras está en carga o en corrección se edita desde la carga de datos; anulado, rechazado o archivado no se corrige. */
const ETAPAS_SIN_CORRECCION = ['CARGA', 'CORRECCION']
const ESTADOS_SIN_CORRECCION = ['ANULADO', 'RECHAZADO', 'ARCHIVADO']

/** Si el alta admite corrección (lo mismo que valida el backend). */
export const admiteCorreccion = (a: AltaBackend) => !ETAPAS_SIN_CORRECCION.includes(a.circuito.etapa) && !ESTADOS_SIN_CORRECCION.includes(a.circuito.estado)

/** Guarda la corrección de una sección con el PUT que le corresponde. */
function corregirSeccion(id: string, clave: InfoSeccion['key'], v: PreCargaForm, motivo: string): Promise<AltaBackend & { avisos?: string[] }> {
  switch (clave) {
    case 'titular':
      return altaConcesionApi.corregirTitulares(id, titularesADto(v.titulares, v.domicilios), motivo)
    case 'ubicacion':
      return altaConcesionApi.corregirUbicacion(id, ubicacionAFormData(v.ubicacion), motivo)
    case 'catastral':
    case 'registral':
      return altaConcesionApi.corregirInmueble(id, inmuebleADto(v.catastral, v.registral), motivo)
    case 'suministro':
      return altaConcesionApi.corregirSuministro(id, suministroADto(v.suministro), motivo)
    case 'usos':
      throw new Error('Los usos no se corrigen.')
  }
}

export default function CorreccionDatosPage() {
  const navigate = useNavigate()
  const { expedienteId } = useParams()
  const alta = useAlta(expedienteId)

  if (alta.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el alta…" />
      </>
    )
  }
  if (alta.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(alta.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el alta" />
        ) : (
          <ErrorState error={alta.error} onRetry={() => void alta.refetch()} reintentando={alta.isFetching} />
        )}
      </>
    )
  }

  const volver = (
    <Button size="sm" onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(alta.data.id))}>
      Ver el expediente
    </Button>
  )
  if (!admiteCorreccion(alta.data)) {
    const enCarga = ETAPAS_SIN_CORRECCION.includes(alta.data.circuito.etapa)
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="lock"
          titulo={enCarga ? 'El alta todavía está en la carga de datos' : 'El expediente no admite correcciones'}
          descripcion={
            enCarga
              ? 'Mientras está en carga o en corrección de observaciones, Catastro modifica los datos desde la carga, sin este trámite.'
              : `El expediente está ${alta.data.circuito.estado.toLowerCase()}: la concesión no se otorgó.`
          }
        >
          {volver}
        </EmptyState>
      </>
    )
  }
  // Con los datos sensibles ocultos, guardar borraría lo cargado: no se corrige.
  if (alta.data.datosSensiblesOcultos) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState icon="visibility_off" titulo="Para corregir el alta hace falta ver los datos sensibles" descripcion="Solicite a Informática el permiso «Ver datos sensibles».">
          {volver}
        </EmptyState>
      </>
    )
  }

  // key: si cambia el expediente se crea un formulario nuevo con sus datos.
  return <Correccion key={alta.data.id} alta={alta.data} />
}

function Correccion({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const dominio = useDominio()
  const { puede } = useSesion()
  const { mostrarAviso } = useNotificaciones()
  const schema = useMemo(() => crearPreCargaSchema(dominio), [dominio])
  const form = useForm<PreCargaForm>({ resolver: zodResolver(schema), defaultValues: altaAFormulario(alta), mode: 'onTouched' })
  const corregir = useAccionAlta(alta.id, (id, { clave, valores, motivo }: { clave: InfoSeccion['key']; valores: PreCargaForm; motivo: string }) =>
    corregirSeccion(id, clave, valores, motivo),
  )

  const [actual, setActual] = useState(0)
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [avisos, setAvisos] = useState<string[]>([])
  const seccion = SECCIONES[actual]
  const propuesto = alta.ubicacion?.poligonoPropuesto

  function irA(indice: number) {
    setActual(indice)
    setAvisos([])
    corregir.reset()
    window.scrollTo({ top: 0 })
  }

  /** Valida la sección y pide el motivo antes de guardar. */
  async function pedirMotivo() {
    if (await form.trigger(seccion.campos, { shouldFocus: true })) setPidiendoMotivo(true)
  }

  function cerrarDialogo() {
    setPidiendoMotivo(false)
    setMotivo('')
  }

  function guardar() {
    if (motivo.trim().length < 10) return
    corregir.mutate(
      { clave: seccion.key, valores: form.getValues(), motivo: motivo.trim() },
      {
        onSuccess: (respuesta) => {
          const r = respuesta as AltaBackend & { avisos?: string[] }
          cerrarDialogo()
          setAvisos(r.avisos ?? [])
          // Lo guardado pasa a ser el punto de partida (el archivo ya no se vuelve a mandar).
          form.reset(altaAFormulario(r))
          mostrarAviso({ tono: 'exito', icono: 'edit_note', titulo: `Corrección registrada: ${seccion.titulo}`, detalle: 'Quedó en el historial y en la auditoría del expediente.' })
        },
        onError: () => setPidiendoMotivo(false),
      },
    )
  }

  return (
    <FormProvider {...form}>
      <PageHeader
        title={`${TITULO} · Expediente ${alta.numeroExpediente}`}
        description="Errores materiales: datos mal escritos o mal cargados y el polígono (KML). Cada corrección requiere un motivo y queda registrada en el historial y en la auditoría con el valor anterior y el nuevo."
      />

      <div className="flex flex-col gap-6">
        <ResumenBorrador alta={alta} />

        <Alert tone="info">
          Los usos, las magnitudes y el caudal asignado no se corrigen: corresponden a lo otorgado por la resolución. Para modificarlos corresponde un trámite de ampliación o reducción. Agregar o
          quitar titulares corresponde a un cambio de titularidad.
        </Alert>

        {propuesto && (
          <Alert tone={propuesto.publicacion === 'OBSERVADO' ? 'error' : 'info'}>
            <p className="font-semibold">
              Corrección del polígono {propuesto.publicacion === 'OBSERVADO' ? 'observada' : 'pendiente de aprobación'} ({propuesto.superficieHa.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha
              {propuesto.archivo ? ` · ${propuesto.archivo}` : ''})
            </p>
            <p>
              {propuesto.publicacion === 'OBSERVADO' && propuesto.nota
                ? `Observación: ${propuesto.nota}`
                : 'El polígono publicado se mantiene en el mapa público hasta que se apruebe en Publicación en el mapa.'}
            </p>
          </Alert>
        )}

        <Stepper steps={SECCIONES} current={actual} maxReached={SECCIONES.length - 1} onSelect={irA} />

        <Card>
          <EncabezadoTarjeta antetitulo="Corrección" titulo={seccion.titulo} descripcion={seccion.descripcion} icono={seccion.icono} />
          <form noValidate onSubmit={(e) => e.preventDefault()} className="p-6 md:p-8">
            {seccion.key === 'ubicacion' && !puede('KML_CARGAR') && (
              <Alert tone="info" className="mb-4">
                Para reemplazar el polígono hace falta además el permiso «Cargar o reemplazar el KML». Sin él puede corregir el departamento, la localidad y el distrito.
              </Alert>
            )}
            <seccion.Component />
          </form>

          {avisos.map((a) => (
            <div key={a} className="px-6 pb-3 md:px-8">
              <Alert tone="info">{a}</Alert>
            </div>
          ))}
          {corregir.isError && (
            <div className="px-6 pb-4 md:px-8">
              <Alert>{mensajeDeError(corregir.error)}</Alert>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" iconLeft="arrow_back" disabled={corregir.isPending} onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(alta.id))}>
              Volver al expediente
            </Button>
            <Button size="sm" iconLeft="save" loading={corregir.isPending} disabled={corregir.isPending} onClick={() => void pedirMotivo()}>
              Guardar corrección
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={pidiendoMotivo}
        title="Registrar corrección"
        message={`Se corregirá la sección «${seccion.titulo}» del expediente N° ${alta.numeroExpediente}. Queda registrado el valor anterior y el nuevo de cada dato modificado.`}
        confirmLabel="Registrar corrección"
        cancelLabel="Volver"
        loading={corregir.isPending}
        onCancel={cerrarDialogo}
        onConfirm={guardar}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Motivo de la corrección
          <textarea
            rows={3}
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            placeholder="Ej.: Apellido del titular mal escrito en la carga."
            className={controlClass({ className: 'resize-y' })}
          />
        </label>
        {motivo.trim().length > 0 && motivo.trim().length < 10 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mínimo 10 caracteres.</p>}
      </ConfirmDialog>
    </FormProvider>
  )
}
