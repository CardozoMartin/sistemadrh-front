import { useState } from 'react'
import { FormProvider, useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { FormRadioCardGroup } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AvisoObligatorios, EncabezadoTarjeta } from '@/components/ui/EncabezadoTarjeta'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { toApiError } from '@/services/api/errors'
import type { SituacionLegalInfo } from '@/types/domain'
import type { DisponibilidadExpediente } from '../backend.types'
import { DocumentacionRequerida } from '../components/DocumentacionRequerida'
import { NumeroExpedienteFields } from '../../shared/components/NumeroExpedienteFields'
import { expedienteVacio, formatearExpediente } from '../../shared/schemas/expediente'
import { useIniciarAlta, useSituacionesLegales, useVerificarExpediente } from '../hooks'
import { inicioAltaSchema, type InicioAltaCampos, type InicioAltaForm } from '../schemas'

/** Página del expediente que ya usa el número, según su trámite (los del backend real). */
function rutaDelExpediente(e: NonNullable<DisponibilidadExpediente['expediente']>): string | null {
  if (e.tipoTramite === 'ALTA_CONCESION') return ROUTES.tramites.altaConcesion.circuito(e.id)
  if (e.tipoTramite === 'REGISTRO_POZO') return ROUTES.pozo.registroExpediente(e.id)
  if (e.tipoTramite === 'BAJA_POZO') return ROUTES.pozo.baja(e.id)
  return null
}

/**
 * Paso 1 del alta (Catastro), en dos tiempos:
 *   1. Número del expediente en papel: se verifica que no esté registrado antes de seguir
 *      (si ya existe, se muestra de qué trámite es y dónde está).
 *   2. Con el número libre: situación legal y papeles presentados, e «Iniciar Alta».
 * Si se cambia el número después de verificarlo, hay que volver a verificarlo. El backend
 * igual controla el número al iniciar (409), por si otro usuario lo registró en el medio.
 */
export default function InicioAltaPage() {
  const navigate = useNavigate()
  const situaciones = useSituacionesLegales()
  const iniciar = useIniciarAlta()
  const verificar = useVerificarExpediente()
  const form = useForm<InicioAltaCampos, unknown, InicioAltaForm>({
    resolver: zodResolver(inicioAltaSchema),
    defaultValues: { expediente: expedienteVacio(), situacionLegalId: '', documentacionPresentada: [] },
    mode: 'onTouched',
  })
  const documentacion = useController({ control: form.control, name: 'documentacionPresentada' })
  /** Resultado de la última verificación: vale mientras el número del formulario sea el mismo. */
  const [verificacion, setVerificacion] = useState<DisponibilidadExpediente | null>(null)

  const numeroActual = formatearExpediente(form.watch('expediente'))
  const vigente = verificacion?.numero === numeroActual ? verificacion : null
  const libre = vigente?.disponible === true
  const ocupado = vigente && !vigente.disponible ? vigente.expediente : null
  const rutaOcupado = ocupado && rutaDelExpediente(ocupado)

  // El checklist muestra las descripciones; al enviar se pasan a los ids del catálogo.
  const elegida = situaciones.data?.find((s) => s.codigo === form.watch('situacionLegalId'))
  const situacion: SituacionLegalInfo | undefined = elegida && {
    id: elegida.codigo,
    nombre: elegida.nombre,
    titulo: elegida.titulo,
    documentacion: elegida.documentos.map((d) => d.descripcion),
  }

  async function verificarNumero() {
    if (!(await form.trigger('expediente'))) return
    const { numero, reparticion, anio } = form.getValues('expediente')
    try {
      const r = await verificar.mutateAsync({ numero, reparticion, anio: Number(anio) })
      // Si está ocupado lo explica el aviso de abajo (no un error del campo: el campo se revalida
      // al salir de él, el mensaje desaparecería y movería el aviso justo cuando se lo quiere tocar).
      setVerificacion(r)
    } catch {
      setVerificacion(null)
    }
  }

  async function onSubmit(values: InicioAltaForm) {
    const { numero, reparticion, anio } = form.getValues('expediente')
    const ids = elegida?.documentos.filter((d) => values.documentacionPresentada.includes(d.descripcion)).map((d) => d.id) ?? []
    try {
      const alta = await iniciar.mutateAsync({
        expediente: { numero, reparticion, anio: Number(anio) },
        situacionLegal: values.situacionLegalId,
        documentacionPresentada: ids,
      })
      navigate(ROUTES.tramites.altaConcesion.datos(alta.id))
    } catch (e) {
      // Otro usuario registró el número entre la verificación y el inicio: se vuelve a verificar.
      if (toApiError(e).status === 409) {
        setVerificacion(null)
        form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
      }
    }
  }

  function togglePapel(papel: string) {
    const actuales = documentacion.field.value
    documentacion.field.onChange(actuales.includes(papel) ? actuales.filter((p) => p !== papel) : [...actuales, papel])
  }

  const errorGeneral = iniciar.error && toApiError(iniciar.error).status !== 409 ? iniciar.error : null

  return (
    <>
      <PageHeader
        title="Alta de Concesión"
        description="Inicie el proceso de registro para una nueva concesión. Necesitará el número de expediente físico para validar la solicitud."
      />

      <Card>
        <EncabezadoTarjeta
          antetitulo="Catastro · Inicio del trámite"
          titulo="Registro del expediente"
          descripcion="Primero se verifica que el número del expediente en papel no esté registrado; después, la situación legal de quien solicita la concesión."
          icono="post_add"
          extra={<AvisoObligatorios />}
        />
        {situaciones.isPending ? (
          <LoadingState mensaje="Cargando situaciones legales…" />
        ) : situaciones.isError ? (
          <ErrorState error={situaciones.error} onRetry={() => void situaciones.refetch()} reintentando={situaciones.isFetching} className="m-6" />
        ) : (
          <FormProvider {...form}>
            {/* Con el número sin verificar, Enter verifica en vez de enviar. */}
            <form
              onSubmit={
                libre
                  ? form.handleSubmit(onSubmit)
                  : (e) => {
                      e.preventDefault()
                      void verificarNumero()
                    }
              }
              noValidate
              className="flex flex-col gap-7 p-6 md:p-10"
            >
              <div className="flex flex-col gap-3">
                <NumeroExpedienteFields autoFocus />

                {libre ? (
                  <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Icon name="check_circle" filled className="shrink-0" />
                    <span>
                      El expediente <strong>{vigente?.numero}</strong> no está registrado: puede iniciar el alta.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="secondary" iconLeft="fact_check" loading={verificar.isPending}>
                      {verificar.isPending ? 'Verificando…' : 'Verificar número'}
                    </Button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Se controla que el expediente no esté ya registrado en el sistema.</p>
                  </div>
                )}

                {ocupado && (
                  <Alert>
                    <p className="font-semibold">El expediente {vigente?.numero} ya está registrado.</p>
                    <p className="mt-1">
                      {ocupado.tipoTramiteNombre} · hoy en {ocupado.oficinaNombre} ({ocupado.etapaNombre}) · ingresó el {formatearFecha(ocupado.fechaIngreso)}.
                    </p>
                    <p className="mt-1">
                      Revise el número de la carátula.{' '}
                      {rutaOcupado && (
                        <Link to={rutaOcupado} className="font-semibold underline">
                          Ver el expediente
                        </Link>
                      )}
                    </p>
                  </Alert>
                )}
                {verificar.error && <Alert>No se pudo verificar el número: {toApiError(verificar.error).message}</Alert>}
              </div>

              {libre ? (
                <>
                  <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-slate-700">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Situación legal del solicitante <span className="text-red-600">*</span>
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Seleccione una opción para ver los papeles requeridos antes de continuar el expediente.</p>
                    </div>

                    <FormRadioCardGroup
                      name="situacionLegalId"
                      options={situaciones.data.map((s) => ({ value: s.codigo, label: s.nombre }))}
                      // Por defecto todos los papeles se marcan como presentados; el operador desmarca los faltantes.
                      onValueChange={(v) => form.setValue('documentacionPresentada', situaciones.data.find((s) => s.codigo === v)?.documentos.map((d) => d.descripcion) ?? [])}
                    />

                    {situacion && <DocumentacionRequerida situacion={situacion} presentados={documentacion.field.value} onToggle={togglePapel} />}
                  </div>

                  {errorGeneral && <Alert>{toApiError(errorGeneral).message}</Alert>}

                  <div className="pt-2">
                    <Button type="submit" iconRight="arrow_forward" loading={iniciar.isPending} className="w-full md:w-auto">
                      {iniciar.isPending ? 'Validando…' : 'Iniciar Alta'}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-2 border-t border-slate-100 pt-6 text-sm text-slate-400 dark:border-slate-700">
                  <Icon name="lock" className="text-[18px]!" />
                  La situación legal y los papeles presentados se cargan después de verificar el número.
                </p>
              )}
            </form>
          </FormProvider>
        )}
      </Card>
    </>
  )
}
