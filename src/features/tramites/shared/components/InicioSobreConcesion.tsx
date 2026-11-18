import { useState, type ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ConcesionEncontrada } from '@/features/catastro/consultaConcesiones'
import { MotorBusquedaConcesion } from '@/features/concesiones/components/MotorBusquedaConcesion'
import { toApiError } from '@/services/api/errors'
import { inicioSobreConcesionSchema, type InicioSobreConcesionCampos, type InicioSobreConcesionForm } from '../inicioSobreConcesion'
import { expedienteVacio } from '../schemas/expediente'
import { NumeroExpedienteFields } from './NumeroExpedienteFields'

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
  /** Contenido debajo del motor de búsqueda (ej: cargas en curso). */
  children?: ReactNode
}

/** El N° de expediente ya está usado: el error se muestra junto al campo. */
function esExpedienteExistente(error: unknown): boolean {
  const { code, status, message } = toApiError(error)
  return code === 'EXPEDIENTE_EXISTENTE' || (status === 409 && /ya está registrado/i.test(message))
}

/**
 * Paso 1 de todo trámite de Catastro sobre una concesión vigente (cambio de titularidad,
 * anulación, reducción/ampliación, subdivisión…): el motor de búsqueda y, con la concesión
 * elegida, «Iniciar trámite» pide el número de expediente.
 */
export function InicioSobreConcesion({ titulo, descripcion, accion, onComenzar, comenzando, error, onCerrar, accionDelError, children }: Props) {
  const navigate = useNavigate()
  const [seleccionada, setSeleccionada] = useState<ConcesionEncontrada | null>(null)
  const [asignando, setAsignando] = useState(false)
  const form = useForm<InicioSobreConcesionCampos, unknown, InicioSobreConcesionForm>({
    resolver: zodResolver(inicioSobreConcesionSchema),
    defaultValues: { concesionId: '', expediente: expedienteVacio() },
    mode: 'onTouched',
  })

  function seleccionar(c: ConcesionEncontrada) {
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
      if (esExpedienteExistente(e)) form.setError('expediente.numero', { message: toApiError(e).message }, { shouldFocus: true })
    }
  })

  const errorGeneral = error && !esExpedienteExistente(error) ? error : null
  const ubicacion = seleccionada ? [seleccionada.localidad, seleccionada.departamento].filter(Boolean).join(', ') : ''

  return (
    <>
      <PageHeader title={titulo} description={descripcion} />

      <div className="flex flex-col gap-6">
        <MotorBusquedaConcesion
          seleccionadaId={seleccionada?.id ?? null}
          onSeleccionar={seleccionar}
          pie={
            <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {seleccionada ? (
                  <>
                    Seleccionada: <span className="font-semibold text-slate-700 dark:text-slate-200">Concesión N° {seleccionada.numero}</span> · {seleccionada.titular}. Verifique que
                    el titular coincida con la documentación física.
                  </>
                ) : (
                  'Seleccione una concesión de la lista para iniciar el trámite.'
                )}
              </p>
              <div className="flex shrink-0 gap-3">
                <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.catastro.tramites)}>
                  Cancelar
                </Button>
                <Button size="sm" iconLeft="play_arrow" disabled={!seleccionada} onClick={() => setAsignando(true)}>
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
              ? `Concesión N° ${seleccionada.numero} · ${seleccionada.titular ?? 'sin titular'}${ubicacion ? ` · ${ubicacion}` : ''}. Ingrese el número de expediente para comenzar ${accion}.`
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
