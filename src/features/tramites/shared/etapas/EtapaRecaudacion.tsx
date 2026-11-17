import { useMemo } from 'react'
import { FormProvider, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@/components/feedback/States'
import { FormTextareaField, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useEnviarEmail } from '@/features/expedientes/hooks'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { useConfigTramite, type PersonaExpediente } from './config'
import { EtapaLayout } from './EtapaLayout'
import { ResultadoSelector } from './ResultadoSelector'
import { crearRecaudacionSchema, type RecaudacionForm } from './schemas'
import { useAccionEtapa } from './useAccionEtapa'

/** Tarjetas de las personas a verificar. Con deuda y varias personas, se marca quién debe. */
function PersonasAVerificar({ personas, conDeuda }: { personas: PersonaExpediente[]; conDeuda: boolean }) {
  const { field } = useController<RecaudacionForm, 'personasConDeuda'>({ name: 'personasConDeuda' })
  const error = useFieldError('personasConDeuda')
  const marcar = personas.length > 1 && conDeuda

  const alternar = (clave: string) =>
    field.onChange(field.value.includes(clave) ? field.value.filter((c) => c !== clave) : [...field.value, clave])

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('grid gap-3', personas.length > 1 && 'md:grid-cols-2')}>
        {personas.map((p) => {
          const debe = marcar && field.value.includes(p.clave)
          return (
            <div
              key={p.clave}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-4',
                debe ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{p.rol}</p>
              <p className="font-semibold text-slate-900 dark:text-white">{p.nombre}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {p.documento}
                {p.correo && <span className="block text-xs text-slate-500 dark:text-slate-400">{p.correo}</span>}
              </p>
              {marcar && (
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                  <input type="checkbox" checked={debe} onChange={() => alternar(p.clave)} className="size-4 accent-red-600" />
                  Registra deuda
                </label>
              )}
            </div>
          )
        })}
      </div>
      {marcar && error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      {personas.length > 1 && (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="info" className="text-base!" /> El trámite solo puede seguir si ninguno registra deuda exigible.
        </p>
      )}
    </div>
  )
}

/** Recaudación: verificación de deuda de las personas del expediente / inmueble. */
export function EtapaRecaudacion({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const config = useConfigTramite()
  const { paso, pedir, dialogos } = useAccionEtapa(expediente)
  const email = useEnviarEmail()
  const personas = useMemo(() => config.personas(expediente), [config, expediente])
  const schema = useMemo(() => crearRecaudacionSchema(personas.length > 1), [personas.length])
  const form = useForm<RecaudacionForm>({
    resolver: zodResolver(schema),
    defaultValues: { deuda: 'sin_deuda', personasConDeuda: [], observaciones: '', emailNotificado: false },
    mode: 'onTouched',
  })
  const [deuda, personasConDeuda, observaciones, emailNotificado] = useWatch({
    control: form.control,
    name: ['deuda', 'personasConDeuda', 'observaciones', 'emailNotificado'],
  })
  const conDeuda = deuda === 'con_deuda'
  const destino = paso?.destino ? d.nombreOficina(paso.destino) : ''
  // Con una sola persona, la deuda es suya; con varias, de las marcadas.
  const deudores = personas.length > 1 ? personas.filter((p) => personasConDeuda.includes(p.clave)) : personas
  const correos = deudores.map((p) => p.correo).filter(Boolean)

  function notificarDeuda() {
    email.mutate(
      {
        expedienteId: expediente.id,
        destinatarios: correos.length ? correos : ['titular sin correo registrado'],
        asunto: `Deuda pendiente — expediente ${expediente.numero}`,
        cuerpo: `Se registró deuda exigible que impide continuar el trámite. ${observaciones}`,
      },
      { onSuccess: () => form.setValue('emailNotificado', true) },
    )
  }

  const onSubmit = form.handleSubmit((v) => {
    const quienes = personas.length > 1 ? ` (${deudores.map((p) => `${p.rol.toLowerCase()}: ${p.nombre}`).join('; ')})` : ''
    pedir(
      conDeuda
        ? {
            titulo: '¿Registrar deuda?',
            mensaje: `El trámite quedará pausado en Recaudación hasta que se regularice la deuda${quienes}.`,
            tono: 'danger',
            confirmar: 'Registrar y pausar',
            exito: { titulo: 'Deuda registrada', mensaje: `El expediente ${expediente.numero} quedó observado en Recaudación.` },
            revision: { resultado: 'observado', observaciones: `${v.observaciones}${quienes}`, detalle: v },
          }
        : {
            titulo: '¿Enviar a la siguiente oficina?',
            mensaje: `El expediente no registra deuda y pasará a ${destino}. Esta acción no se puede deshacer.`,
            confirmar: 'Sí, enviar',
            exito: { titulo: 'Expediente enviado', mensaje: `El expediente ${expediente.numero} fue enviado a ${destino}.` },
            revision: { resultado: 'aprobado', observaciones: v.observaciones || undefined, detalle: { ...v, personasConDeuda: [] } },
          },
    )
  })

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Revisión de deuda"
        icono="payments"
        descripcion={
          personas.length > 1
            ? 'Verifique el estado de deuda de cada persona del trámite antes de continuar.'
            : 'Indique si la propiedad o el titular poseen deuda exigible que impida la continuación del trámite.'
        }
        accion={
          <Button size="sm" variant={conDeuda ? 'danger' : 'primary'} iconRight={conDeuda ? 'pause_circle' : 'send'} onClick={() => void onSubmit()}>
            {conDeuda ? 'Registrar deuda' : `Guardar y enviar a ${destino}`}
          </Button>
        }
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <PersonasAVerificar personas={personas} conDeuda={conDeuda} />

          <ResultadoSelector
            name="deuda"
            label="¿Existe deuda pendiente?"
            opciones={[
              { value: 'sin_deuda', label: 'No registra deuda', descripcion: 'El trámite puede avanzar al siguiente paso.', icono: 'check_circle', tono: 'positivo' },
              { value: 'con_deuda', label: 'Sí, registra deuda', descripcion: 'El trámite quedará pausado hasta la regularización.', icono: 'warning', tono: 'negativo' },
            ]}
          />

          {conDeuda && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
                {emailNotificado ? `Se notificó la deuda a ${correos.join(', ') || 'el titular'}.` : '¿Desea notificar la deuda por email?'}
              </p>
              <Button
                size="sm"
                variant="secondary"
                iconLeft="mail"
                loading={email.isPending}
                disabled={emailNotificado || deudores.length === 0}
                onClick={notificarDeuda}
              >
                {emailNotificado ? 'Email enviado' : 'Notificar por email'}
              </Button>
              {email.isError && <Alert className="w-full">{mensajeDeError(email.error)}</Alert>}
            </div>
          )}

          <FormTextareaField
            name="observaciones"
            label="Observaciones / detalle"
            required={conDeuda}
            rows={4}
            placeholder="Detalle de la deuda (monto, períodos) o comentarios para el expediente…"
            hint={`${observaciones.length} / 500 caracteres${conDeuda ? '' : ' · Opcional si no hay deuda'}`}
          />
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
