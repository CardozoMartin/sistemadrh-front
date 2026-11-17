import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormAdjuntosField, FormTextareaField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { EtapaLayout } from './EtapaLayout'
import { ResultadoSelector } from './ResultadoSelector'
import { distritoSchema, type DistritoForm } from './schemas'
import { useAccionEtapa } from './useAccionEtapa'

/** Distrito: informe técnico (APTO / NO APTO para proporcionar agua). */
export function EtapaDistrito({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const { paso, pedir, dialogos } = useAccionEtapa(expediente)
  const form = useForm<DistritoForm>({
    resolver: zodResolver(distritoSchema),
    defaultValues: { resultado: 'apto', motivoNoApto: '', informes: [], observaciones: '' },
    mode: 'onTouched',
  })
  const [resultado, observaciones] = useWatch({ control: form.control, name: ['resultado', 'observaciones'] })
  const noApto = resultado === 'no_apto'
  const destino = paso?.destino ? d.nombreOficina(paso.destino) : ''

  const onSubmit = form.handleSubmit((v) =>
    pedir(
      noApto
        ? {
            titulo: '¿Guardar como pendiente?',
            mensaje: `El expediente quedará observado en Distrito. Motivo: ${v.motivoNoApto}`,
            tono: 'danger',
            confirmar: 'Guardar pendiente',
            exito: { titulo: 'Informe registrado', mensaje: `El expediente ${expediente.numero} quedó observado en Distrito.` },
            revision: { resultado: 'observado', observaciones: `${v.motivoNoApto} — ${v.observaciones}`, detalle: v },
          }
        : {
            titulo: `¿Enviar a ${destino}?`,
            mensaje: 'El informe técnico es APTO. Esta acción no se puede deshacer.',
            confirmar: 'Sí, enviar',
            exito: { titulo: 'Expediente enviado', mensaje: `El expediente ${expediente.numero} fue enviado a ${destino}.` },
            revision: { resultado: 'aprobado', observaciones: v.observaciones, detalle: v },
          },
    ),
  )

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Informe técnico"
        icono="engineering"
        descripcion="Seleccione el resultado de la verificación técnica del distrito."
        accion={
          <Button size="sm" variant={noApto ? 'danger' : 'primary'} iconRight={noApto ? 'pending' : 'send'} onClick={() => void onSubmit()}>
            {noApto ? 'Guardar pendiente' : `Enviar a ${destino}`}
          </Button>
        }
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <ResultadoSelector
            name="resultado"
            label="Resultado de la verificación"
            opciones={[
              { value: 'apto', label: 'APTO', descripcion: 'Es posible proporcionar el agua solicitada.', icono: 'check_circle', tono: 'positivo' },
              { value: 'no_apto', label: 'NO APTO', descripcion: 'No es posible proporcionar el agua.', icono: 'cancel', tono: 'negativo' },
            ]}
          />

          {noApto && (
            <FormTextareaField
              name="motivoNoApto"
              label="Motivo de NO APTO"
              required
              rows={3}
              placeholder="Ej: caudal insuficiente, fuente agotada, conflicto de derechos…"
            />
          )}

          <FormAdjuntosField name="informes" label="Informes de distrito" extensiones={['.pdf']} maxMB={5} multiple />

          <FormTextareaField
            name="observaciones"
            label="Observaciones"
            required
            rows={4}
            placeholder="Detalle técnico de la verificación, discrepancias de medidas o confirmación de linderos…"
            hint={`${observaciones.length} / 500 caracteres`}
          />
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
