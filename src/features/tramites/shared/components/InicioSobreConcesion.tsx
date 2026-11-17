import { useState, type ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { BuscadorConcesion } from '@/features/concesiones/components/BuscadorConcesion'
import { titularPrincipal, type Concesion } from '@/features/concesiones/datos'
import { toApiError } from '@/services/api/errors'
import { inicioSobreConcesionSchema, type InicioSobreConcesionCampos, type InicioSobreConcesionForm } from '../inicioSobreConcesion'
import { expedienteVacio } from '../schemas/expediente'
import { NumeroExpedienteFields } from './NumeroExpedienteFields'
import { PasosTramite } from './PasosTramite'

interface Props {
  titulo: string
  descripcion: string
  /** Completa la frase del diálogo: "Ingrese el número de expediente para comenzar {accion}." */
  accion: string
  /** Valida e inicia el trámite (y navega al paso siguiente). Si falla, lanza ApiError. */
  onComenzar: (values: InicioSobreConcesionForm) => Promise<unknown>
  comenzando: boolean
  error: unknown
  /** Limpia el error al cerrar el diálogo (ej: mutation.reset). */
  onCerrar: () => void
  /** Acción extra dentro del error (ej: «Continuar esa carga»). */
  accionDelError?: (error: unknown) => ReactNode
  /** Contenido debajo de la búsqueda (ej: cargas en curso). */
  children?: ReactNode
  /** Pasos de Catastro antes del circuito y nombre del paso de carga, para la barra de pasos (por defecto solo la búsqueda). */
  pasos?: { previos: string[]; carga?: string }
}

/**
 * Paso 1 de todo trámite sobre una concesión (prototipos inicioTramite.html de Cambio de
 * Titularidad y de Anulación): se busca la concesión y, con la concesión elegida,
 * «Iniciar trámite» le asigna el número de expediente.
 */
export function InicioSobreConcesion({ titulo, descripcion, accion, onComenzar, comenzando, error, onCerrar, accionDelError, children, pasos }: Props) {
  const navigate = useNavigate()
  const [seleccionada, setSeleccionada] = useState<Concesion | null>(null)
  const [asignando, setAsignando] = useState(false)
  const form = useForm<InicioSobreConcesionCampos, unknown, InicioSobreConcesionForm>({
    resolver: zodResolver(inicioSobreConcesionSchema),
    defaultValues: { concesionId: '', expediente: expedienteVacio() },
    mode: 'onTouched',
  })

  function seleccionar(c: Concesion) {
    setSeleccionada(c)
    form.setValue('concesionId', c.id)
  }

  function cerrarDialogo() {
    setAsignando(false)
    onCerrar()
    form.clearErrors()
  }

  const comenzar = form.handleSubmit(async (values) => {
    try {
      await onComenzar(values)
    } catch (e) {
      // Número de expediente ya usado: se muestra junto al campo.
      const { code, message } = toApiError(e)
      if (code === 'EXPEDIENTE_EXISTENTE') form.setError('expediente.numero', { message }, { shouldFocus: true })
    }
  })

  const errorGeneral = error && toApiError(error).code !== 'EXPEDIENTE_EXISTENTE' ? error : null

  return (
    <>
      <PageHeader title={titulo} description={descripcion} />

      <div className="flex flex-col gap-6">
        <PasosTramite previos={pasos?.previos ?? ['Búsqueda']} carga={pasos?.carga} actual={0} titulo="Búsqueda de expediente" />

        <BuscadorConcesion
          seleccionadaId={seleccionada?.id ?? null}
          onSeleccionar={seleccionar}
          pie={
            <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold">Nota:</span> Verifique que el titular coincida con la documentación física antes de iniciar.
              </p>
              <div className="flex gap-3">
                <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.catastro.tramites)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  iconLeft="play_arrow"
                  disabled={!seleccionada}
                  title={seleccionada ? undefined : 'Seleccione una concesión'}
                  onClick={() => setAsignando(true)}
                >
                  Iniciar trámite
                </Button>
              </div>
            </div>
          }
        />

        {children}
      </div>

      <FormProvider {...form}>
        <ConfirmDialog
          open={asignando && !!seleccionada}
          title="Asignar expediente"
          message={
            seleccionada
              ? `Concesión N° ${seleccionada.numeroConcesion} · ${titularPrincipal(seleccionada)} · ${seleccionada.ubicacion.localidad}, ${seleccionada.ubicacion.departamento}. Ingrese el número de expediente para comenzar ${accion}.`
              : ''
          }
          confirmLabel="Comenzar trámite"
          cancelLabel="Cancelar"
          loading={comenzando}
          onCancel={cerrarDialogo}
          onConfirm={() => void comenzar()}
        >
          <form noValidate onSubmit={(e) => void comenzar(e)} className="flex flex-col gap-3">
            <NumeroExpedienteFields autoFocus />
            {errorGeneral && (
              <Alert>
                <p>{toApiError(errorGeneral).message}</p>
                {accionDelError?.(errorGeneral)}
              </Alert>
            )}
          </form>
        </ConfirmDialog>
      </FormProvider>
    </>
  )
}
