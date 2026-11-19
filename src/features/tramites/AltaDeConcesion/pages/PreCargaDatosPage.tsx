import { useMemo, useState } from 'react'
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvisoObligatorios, EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stepper } from '@/components/ui/Stepper'
import { useDominio } from '@/hooks/useDominio'
import { useNotificaciones } from '@/features/notificaciones/context'
import { esNoEncontrado, mensajeDeError } from '@/services/api/errors'
import { altaAFormulario, inmuebleADto, seccionAlcanzada, suministroADto, titularesADto, ubicacionAFormData, usosADto } from '../adaptadores'
import { altaConcesionApi } from '../api'
import type { AltaBackend } from '../backend.types'
import { ResumenBorrador } from '../components/ResumenBorrador'
import { SECCIONES_CON_COMPONENTE as SECCIONES, seccionDeCampo } from '../components/secciones'
import type { InfoSeccion } from '../components/secciones/config'
import { useAccionAlta, useAlta, useDerivarCarga, useHistorial } from '../hooks'
import { crearPreCargaSchema, type PreCargaForm } from '../schemas'

type Dialogo = 'enviar' | null

const TITULO = 'Alta de Concesión — Carga de datos'
/** Etapas en las que Catastro puede editar (las mismas que valida el backend). */
const EDITABLES = ['CARGA', 'CORRECCION', 'CIERRE']
/**
 * Secciones que en el cierre no se modifican en absoluto (las aprobó la resolución): se muestran
 * solo para consultar y no se mandan al backend, que rechaza cualquier guardado de ellas.
 */
const FIJAS_EN_CIERRE: InfoSeccion['key'][] = ['usos']

export default function PreCargaDatosPage() {
  const navigate = useNavigate()
  const { borradorId: id } = useParams()
  const alta = useAlta(id)

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
          <EmptyState icon="search_off" titulo="No se encontró el alta" descripcion="Verifique el número de expediente.">
            <Button size="sm" onClick={() => navigate(ROUTES.tramites.altaConcesion.inicio)}>
              Ir al inicio del alta
            </Button>
          </EmptyState>
        ) : (
          <ErrorState error={alta.error} onRetry={() => void alta.refetch()} reintentando={alta.isFetching} />
        )}
      </>
    )
  }
  if (!EDITABLES.includes(alta.data.circuito.etapa)) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="lock"
          titulo={`El expediente está en ${alta.data.circuito.oficinaNombre}`}
          descripcion={`Etapa: ${alta.data.circuito.etapaNombre}. Catastro solo puede modificar los datos durante la carga, la corrección de observaciones o el cierre.`}
        >
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(alta.data.id))}>
            Ver el expediente
          </Button>
        </EmptyState>
      </>
    )
  }

  // Con los datos sensibles ocultos, guardar borraría lo cargado: no se edita.
  if (alta.data.datosSensiblesOcultos) {
    return (
      <>
        <PageHeader title={TITULO} />
        <EmptyState
          icon="visibility_off"
          titulo="Para editar el alta hace falta ver los datos sensibles"
          descripcion="Los documentos, domicilios y datos de contacto se le muestran ocultos. Pídale a Informática el permiso «Ver datos sensibles»."
        >
          <Button size="sm" onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(alta.data.id))}>
            Ver el expediente
          </Button>
        </EmptyState>
      </>
    )
  }

  // key: si cambia el expediente se crea un formulario nuevo con sus datos.
  return <CargaDatos key={alta.data.id} alta={alta.data} />
}

/** Primer path con error dentro de un objeto de errores de react-hook-form. */
function primerError(errors: FieldErrors, base = ''): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue
    const path = base ? `${base}.${key}` : key
    if ('message' in value && typeof value.message === 'string') return path
    const hijo = primerError(value as FieldErrors, path)
    if (hijo) return hijo
  }
  return null
}

/** Guarda en el backend la sección indicada, con el PUT que le corresponde. */
function guardarSeccion(id: string, clave: InfoSeccion['key'], v: PreCargaForm): Promise<AltaBackend & { avisos?: string[] }> {
  switch (clave) {
    case 'titular':
      return altaConcesionApi.guardarTitulares(id, titularesADto(v.titulares, v.domicilios))
    case 'ubicacion':
      return altaConcesionApi.guardarUbicacion(id, ubicacionAFormData(v.ubicacion))
    case 'catastral':
    case 'registral':
      return altaConcesionApi.guardarInmueble(id, inmuebleADto(v.catastral, v.registral))
    case 'usos':
      return altaConcesionApi.guardarUsos(id, usosADto(v.usos))
    case 'suministro':
      return altaConcesionApi.guardarSuministro(id, suministroADto(v.suministro))
  }
}

function CargaDatos({ alta }: { alta: AltaBackend }) {
  const navigate = useNavigate()
  const dominio = useDominio()
  const historial = useHistorial(alta.id)
  // Algunas reglas dependen de los catálogos (ej: qué usos exigen punto de entrega).
  const schema = useMemo(() => crearPreCargaSchema(dominio), [dominio])
  const guardar = useAccionAlta(alta.id, (id, { clave, valores }: { clave: InfoSeccion['key']; valores: PreCargaForm }) => guardarSeccion(id, clave, valores))
  const { mostrarAviso } = useNotificaciones()
  const etapa = alta.circuito.etapa
  // Al derivar, Catastro ya no puede actuar sobre el expediente (salvo que vuelva observado):
  // se avisa y se va al buscador de expedientes, sin pasar por la pantalla del expediente.
  const derivar = useDerivarCarga(alta.id, (derivada) => {
    mostrarAviso({
      tono: 'exito',
      icono: 'send',
      titulo: `Expediente ${alta.numeroExpediente} enviado a ${derivada.circuito.oficinaNombre}`,
      detalle: 'Queda registrado en su historial. Catastro vuelve a tenerlo si lo observan o para el cierre.',
    })
    navigate(ROUTES.busqueda, { replace: true })
  })

  const ultima = SECCIONES.length - 1
  const inicial = etapa === 'CARGA' ? seccionAlcanzada(alta) : 0
  const [actual, setActual] = useState(inicial)
  // En corrección y cierre todo ya se cargó una vez: se puede ir a cualquier sección.
  const [alcanzada, setAlcanzada] = useState(etapa === 'CARGA' ? inicial : ultima)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  const form = useForm<PreCargaForm>({ resolver: zodResolver(schema), defaultValues: altaAFormulario(alta), mode: 'onTouched' })

  const seccion = SECCIONES[actual]
  const esUltima = actual === ultima
  const seccionFija = etapa === 'CIERRE' && FIJAS_EN_CIERRE.includes(seccion.key)
  const ocupado = guardar.isPending || derivar.isPending
  const errorMutacion = guardar.error ?? derivar.error

  // Si volvió observado: lo que pidió corregir la oficina (la última devolución del historial; las
  // actuaciones de otras oficinas vienen reservadas, la devolución la ve Catastro porque la recibe).
  const devolucion = etapa === 'CORRECCION' ? historial.data?.filter((h) => h.tipo === 'PASE' && h.esDevolucion).at(-1) : undefined
  const observacion = devolucion?.tipo === 'PASE' ? devolucion : undefined

  function irA(indice: number) {
    setActual(indice)
    window.scrollTo({ top: 0 })
  }

  /** Valida y guarda la sección actual. Devuelve false si no se pudo. */
  async function guardarActual(): Promise<boolean> {
    // En el cierre, lo que aprobó la resolución no se guarda (no cambió: solo se consultó).
    if (seccionFija) {
      guardar.reset()
      return true
    }
    const valida = await form.trigger(seccion.campos, { shouldFocus: true })
    if (!valida) return false
    try {
      const respuesta = await guardar.mutateAsync({ clave: seccion.key, valores: form.getValues() })
      setAvisos(respuesta.avisos ?? [])
      // El polígono ya quedó guardado en PostGIS: se deja de mandar el archivo en cada guardado.
      if (seccion.key === 'ubicacion') form.setValue('ubicacion.poligono', altaAFormulario(respuesta).ubicacion.poligono)
      return true
    } catch {
      return false // el error se muestra con guardar.error
    }
  }

  async function siguiente() {
    if (!(await guardarActual())) return
    const proxima = actual + 1
    setAlcanzada((a) => Math.max(a, proxima))
    irA(proxima)
  }

  // Validación completa antes de terminar. Si falla, se lleva al usuario a la sección con el primer error.
  const terminar = form.handleSubmit(
    async () => {
      if (!(await guardarActual())) return
      if (etapa === 'CIERRE') navigate(ROUTES.tramites.altaConcesion.circuito(alta.id))
      else setDialogo('enviar')
    },
    (errors) => {
      const path = primerError(errors)
      const indice = path ? seccionDeCampo(path) : -1
      if (indice >= 0 && indice !== actual) irA(indice)
    },
  )

  function confirmarEnvio() {
    setDialogo(null)
    derivar.mutate({ corregido: etapa === 'CORRECCION' })
  }

  const textoTerminar = etapa === 'CARGA' ? 'Enviar a Recaudación' : etapa === 'CORRECCION' ? 'Reenviar' : 'Guardar y volver al expediente'
  const destino = etapa === 'CORRECCION' ? (observacion?.oficinaOrigen ?? 'la oficina que lo observó') : 'Recaudación'

  return (
    <FormProvider {...form}>
      <PageHeader title={etapa === 'CARGA' ? TITULO : etapa === 'CORRECCION' ? 'Alta de Concesión — Corrección de observaciones' : 'Alta de Concesión — Cierre: datos que faltan'} />

      <div className="flex flex-col gap-6">
        <ResumenBorrador alta={alta} />

        {observacion && (
          <Alert>
            <p className="font-semibold">
              {observacion.oficinaOrigen} observó el expediente ({observacion.enviadoPor}):
            </p>
            <p>{observacion.observaciones}</p>
          </Alert>
        )}

        <Stepper steps={SECCIONES} current={actual} maxReached={alcanzada} onSelect={irA} />

        <Card>
          <EncabezadoTarjeta
            antetitulo={`Paso ${actual + 1} de ${SECCIONES.length}`}
            titulo={seccion.titulo}
            descripcion={seccion.descripcion}
            icono={seccion.icono}
            extra={<AvisoObligatorios />}
          />
          <form noValidate onSubmit={(e) => void terminar(e)} className="p-6 md:p-8">
            {seccionFija ? (
              <>
                <Alert tone="info">
                  Los usos, el caudal y los puntos de desagüe y entrega quedaron aprobados en la resolución: en el cierre se muestran solo para consultar y no se modifican.
                </Alert>
                {/* fieldset disabled: todos los campos y botones de la sección quedan de solo lectura. */}
                <fieldset disabled className="mt-6 min-w-0">
                  <seccion.Component />
                </fieldset>
              </>
            ) : (
              <seccion.Component />
            )}
          </form>

          {avisos.map((a) => (
            <div key={a} className="px-6 pb-3 md:px-8">
              <Alert tone="info">{a}</Alert>
            </div>
          ))}
          {errorMutacion && (
            <div className="px-6 pb-4 md:px-8">
              <Alert>{mensajeDeError(errorMutacion)}</Alert>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
            <Button variant="ghost" size="sm" iconLeft="history" disabled={ocupado} onClick={() => navigate(ROUTES.tramites.altaConcesion.circuito(alta.id))}>
              Ver expediente
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={actual === 0 || ocupado} onClick={() => irA(actual - 1)}>
                Anterior
              </Button>
              {esUltima ? (
                <Button size="sm" iconRight={etapa === 'CIERRE' ? 'save' : 'send'} loading={ocupado} disabled={ocupado} onClick={() => void terminar()}>
                  {ocupado ? 'Guardando…' : textoTerminar}
                </Button>
              ) : (
                <Button size="sm" iconRight="arrow_forward" loading={guardar.isPending} disabled={ocupado} onClick={() => void siguiente()}>
                  {guardar.isPending ? 'Guardando…' : seccionFija ? 'Seguir' : 'Guardar y seguir'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialogo === 'enviar'}
        title={etapa === 'CORRECCION' ? '¿Reenviar el expediente?' : '¿Enviar a Recaudación?'}
        message={`El expediente ${alta.numeroExpediente} se derivará a ${destino}. Desde ese momento Catastro no podrá modificar los datos.`}
        confirmLabel={etapa === 'CORRECCION' ? 'Sí, reenviar' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
    </FormProvider>
  )
}
