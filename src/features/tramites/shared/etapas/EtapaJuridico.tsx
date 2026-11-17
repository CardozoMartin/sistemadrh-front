import { useState } from 'react'
import { FormProvider, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormAdjuntosField, FormTextareaField, Input, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useDominio } from '@/hooks/useDominio'
import type { Expediente } from '@/types/domain'
import { EtapaLayout } from './EtapaLayout'
import { ResultadoSelector } from './ResultadoSelector'
import { juridicoSchema, type JuridicoForm } from './schemas'
import { useAccionEtapa } from './useAccionEtapa'

/** Checkboxes de documentos faltantes: catálogo de la API + los que se agreguen a mano. */
function DocumentosFaltantes() {
  const { documentosJuridicos } = useDominio()
  const { field } = useController<JuridicoForm, 'documentosFaltantes'>({ name: 'documentosFaltantes' })
  const error = useFieldError('documentosFaltantes')
  const [extras, setExtras] = useState<string[]>(() => field.value.filter((f) => !documentosJuridicos.some((d) => d.nombre === f)))
  const [nuevo, setNuevo] = useState('')
  const opciones = [...documentosJuridicos.map((d) => d.nombre), ...extras]

  const alternar = (doc: string) =>
    field.onChange(field.value.includes(doc) ? field.value.filter((d) => d !== doc) : [...field.value, doc])

  function agregar() {
    const doc = nuevo.trim()
    if (!doc) return
    if (!opciones.includes(doc)) setExtras([...extras, doc])
    if (!field.value.includes(doc)) field.onChange([...field.value, doc])
    setNuevo('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <Icon name="folder_off" /> Documentación faltante
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {opciones.map((doc) => (
          <label key={doc} className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-800">
            <input type="checkbox" checked={field.value.includes(doc)} onChange={() => alternar(doc)} className="size-4 accent-amber-500" />
            {doc}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregar()
            }
          }}
          placeholder="Otro documento faltante…"
          aria-label="Otro documento faltante"
        />
        <Button size="sm" variant="secondary" iconLeft="add" onClick={agregar} className="h-auto">
          Agregar
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** Jurídico: dictamen (Apto / No apto con documentación faltante). */
export function EtapaJuridico({ expediente }: { expediente: Expediente }) {
  const d = useDominio()
  const { paso, pedir, dialogos } = useAccionEtapa(expediente)
  const form = useForm<JuridicoForm>({
    resolver: zodResolver(juridicoSchema),
    defaultValues: { resultado: 'apto', documentosFaltantes: [], adjuntosRespaldo: [], informe: [], dictamen: '' },
    mode: 'onTouched',
  })
  const [resultado, dictamen] = useWatch({ control: form.control, name: ['resultado', 'dictamen'] })
  const noApto = resultado === 'no_apto'
  const destino = paso?.destino ? d.nombreOficina(paso.destino) : ''

  const onSubmit = form.handleSubmit((v) =>
    pedir(
      noApto
        ? {
            titulo: '¿Guardar dictamen como pendiente?',
            mensaje: `El expediente quedará observado en Jurídico por falta de documentación (${v.documentosFaltantes.length}).`,
            tono: 'danger',
            confirmar: 'Guardar pendiente',
            exito: { titulo: 'Dictamen registrado', mensaje: `El expediente ${expediente.numero} quedó observado en Jurídico.` },
            revision: { resultado: 'observado', observaciones: `Falta documentación: ${v.documentosFaltantes.join(', ')}.`, detalle: v },
          }
        : {
            titulo: `¿Enviar a ${destino}?`,
            mensaje: 'El dictamen es APTO. Esta acción no se puede deshacer.',
            confirmar: 'Sí, enviar',
            exito: { titulo: 'Expediente enviado', mensaje: `El expediente ${expediente.numero} fue enviado a ${destino}.` },
            revision: { resultado: 'aprobado', observaciones: v.dictamen.slice(0, 200), detalle: v },
          },
    ),
  )

  return (
    <FormProvider {...form}>
      <EtapaLayout
        expediente={expediente}
        titulo="Dictamen jurídico"
        icono="gavel"
        descripcion="Complete la revisión legal para avanzar."
        accion={
          <Button size="sm" variant={noApto ? 'danger' : 'primary'} iconRight={noApto ? 'pending' : 'send'} onClick={() => void onSubmit()}>
            {noApto ? 'Guardar dictamen como pendiente' : `Enviar a ${destino}`}
          </Button>
        }
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
          <ResultadoSelector
            name="resultado"
            label="Resolución del caso"
            opciones={[
              { value: 'apto', label: 'Apto', descripcion: 'En condiciones.', icono: 'check_circle', tono: 'positivo' },
              { value: 'no_apto', label: 'No apto', descripcion: 'Requiere corrección.', icono: 'error', tono: 'negativo' },
            ]}
          />

          {noApto && (
            <>
              <DocumentosFaltantes />
              <FormAdjuntosField
                name="adjuntosRespaldo"
                label="Documentación de respaldo"
                extensiones={['.pdf', '.jpg', '.jpeg', '.png', '.docx']}
                maxMB={10}
                multiple
              />
            </>
          )}

          <FormAdjuntosField name="informe" label="Informe de Jurídico" extensiones={['.pdf']} maxMB={5} />

          <FormTextareaField
            name="dictamen"
            label="Texto del dictamen"
            required
            rows={6}
            placeholder="Detalle legal de la resolución, citando la normativa aplicable…"
            hint={`${dictamen.length} / 2000 caracteres`}
          />
        </form>
      </EtapaLayout>
      {dialogos}
    </FormProvider>
  )
}
