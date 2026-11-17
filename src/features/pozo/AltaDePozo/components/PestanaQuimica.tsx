import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { Field, FormSection, FormTextField, Input, Select, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { CATALOGO_QUIMICO, TIPOS_RESULTADO, UNIDADES_QUIMICAS } from '../catalogos'
import type { AltaPozoForm } from '../schemas'

type Parametro = AltaPozoForm['quimico']['parametros'][number]
const vacio = (): Parametro => ({ parametro: '', tipoResultado: 'VALOR', simbolo: '', resultado: '', unidad: '', observacion: '' })

/**
 * Pestaña «Info. química»: el informe del laboratorio, con la fecha del monitoreo (queda en el
 * historial del pozo). Se elige UN parámetro, se completa y recién ahí se suma a la tabla:
 * solo se cargan los que figuran en el informe.
 */
export function PestanaQuimica() {
  const { control } = useFormContext<AltaPozoForm>()
  const { fields, append, remove } = useFieldArray({ control, name: 'quimico.parametros' })
  const [nuevo, setNuevo] = useState<Parametro>(vacio())
  const [error, setError] = useState<string | null>(null)
  const usados = new Set(fields.map((f) => f.parametro))

  function elegir(nombre: string) {
    const p = CATALOGO_QUIMICO.find((x) => x.nombre === nombre)
    setNuevo({ ...nuevo, parametro: nombre, simbolo: p?.simbolo ?? '', unidad: p?.unidad ?? '' })
    setError(null)
  }

  function agregar() {
    if (!nuevo.parametro) return setError('Elija el parámetro.')
    if (!nuevo.resultado.trim()) return setError('Ingrese el resultado que informa el laboratorio.')
    append({ ...nuevo, resultado: nuevo.resultado.trim().replace(',', '.') })
    setNuevo(vacio())
    setError(null)
  }

  return (
    <div className="flex flex-col gap-8">
      <FormSection title="Monitoreo químico" icon="science" description="La fecha del informe del laboratorio. Cada informe queda en el historial del pozo con su fecha.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FormTextField name="quimico.fecha" label="Fecha del monitoreo" type="date" />
        </div>
      </FormSection>

      <FormSection title="Agregar parámetro al informe" icon="add_circle" variant="boxed">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Field id="quim-parametro" label="Parámetro" className="md:col-span-2">
            <Select id="quim-parametro" value={nuevo.parametro} onChange={(e) => elegir(e.target.value)} placeholder="Seleccione un parámetro" options={toOptions(CATALOGO_QUIMICO.map((p) => p.nombre).filter((n) => !usados.has(n)))} />
          </Field>
          <Field id="quim-tipo" label="Tipo de resultado">
            <Select id="quim-tipo" value={nuevo.tipoResultado} onChange={(e) => setNuevo({ ...nuevo, tipoResultado: e.target.value as Parametro['tipoResultado'] })} options={[...TIPOS_RESULTADO]} />
          </Field>
          <Field id="quim-simbolo" label="Símbolo">
            <Input id="quim-simbolo" value={nuevo.simbolo} onChange={(e) => setNuevo({ ...nuevo, simbolo: e.target.value })} placeholder="Ej: Ca" />
          </Field>
          <Field id="quim-resultado" label="Resultado">
            <Input id="quim-resultado" value={nuevo.resultado} onChange={(e) => setNuevo({ ...nuevo, resultado: e.target.value })} inputMode="decimal" placeholder="0,00" />
          </Field>
          <Field id="quim-unidad" label="Unidad">
            <Select id="quim-unidad" value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })} placeholder="—" options={toOptions(UNIDADES_QUIMICAS)} />
          </Field>
          <Field id="quim-obs" label="Observaciones del parámetro" className="md:col-span-4">
            <Input id="quim-obs" value={nuevo.observacion} onChange={(e) => setNuevo({ ...nuevo, observacion: e.target.value })} placeholder="Opcional" />
          </Field>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button size="sm" variant="secondary" iconLeft="backspace" onClick={() => setNuevo(vacio())}>
              Limpiar
            </Button>
            <Button size="sm" iconLeft="add" onClick={agregar}>
              Agregar parámetro
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </FormSection>

      <FormSection title="Informe químico del pozo" icon="lab_profile" description={fields.length === 1 ? '1 parámetro cargado' : `${fields.length} parámetros cargados`}>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Parámetro</th>
                <th className="px-3 py-2">Símbolo</th>
                <th className="px-3 py-2 text-right">Resultado</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Observaciones</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {fields.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium">{p.parametro}</td>
                  <td className="px-3 py-2">{p.simbolo || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.tipoResultado === 'MENOR' ? '< ' : ''}
                    {p.resultado}
                  </td>
                  <td className="px-3 py-2">{p.unidad || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{p.observacion || '—'}</td>
                  <td className="p-1">
                    <IconButton icon="delete" label={`Quitar ${p.parametro}`} tone="danger" onClick={() => remove(i)} />
                  </td>
                </tr>
              ))}
              {!fields.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    Sin parámetros. Elija uno arriba, complete el resultado y agréguelo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FormSection>
    </div>
  )
}
