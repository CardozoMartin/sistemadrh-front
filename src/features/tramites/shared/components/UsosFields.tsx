import { useEffect, useRef } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormMaskedField, FormSelectField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { fechaCorta, finDePeriodo, hoyISO } from '@/lib/fechas'
import { decimalPositivo } from '@/lib/mascaras'
import { CoordenadaFields } from './CoordenadaFields'
import { caudalDeUso, caudalTotal, redondear2 } from '../dotacion'
import { opcionesDe } from '../opciones'
import { usoItemVacio } from '../schemas/usos'

interface Props {
  prefix: string
  /** Se llama cuando cambia el caudal total calculado (ej: para volcarlo al suministro). */
  onCaudalTotalChange?: (total: number) => void
}

type Item = { uso: string; magnitud: string }

/** Duraciones que se ofrecen para el fin del período (el mínimo es 1 año). */
const DURACIONES = [1, 2, 5, 10]

/**
 * Inicio y fin del período. El inicio arranca en la fecha del día (se puede cambiar) y el fin se
 * elige con un clic (1, 2, 5 o 10 años) o a mano; el período dura al menos 1 año.
 */
function PeriodoFields({ prefix }: { prefix: string }) {
  const n = (campo: string) => `${prefix}.${campo}`
  const { control, setValue } = useFormContext()
  const inicio = (useWatch({ control, name: n('periodoInicio') }) as string | undefined) ?? ''
  const fin = (useWatch({ control, name: n('periodoFin') }) as string | undefined) ?? ''
  const poner = (campo: string, valor: string) => setValue(n(campo), valor, { shouldDirty: true, shouldValidate: true })
  const hoy = hoyISO()

  return (
    <>
      <div className="flex flex-col gap-2">
        <FormTextField name={n('periodoInicio')} label="Inicio del período" type="date" />
        {inicio !== hoy && (
          <button type="button" onClick={() => poner('periodoInicio', hoy)} className="self-start text-xs font-medium text-primary hover:underline">
            Usar la fecha de hoy ({fechaCorta(hoy)})
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <FormTextField
          name={n('periodoFin')}
          label="Fin del período"
          type="date"
          min={inicio ? finDePeriodo(inicio, 1) : undefined}
          hint={inicio ? `Mínimo 1 año: desde el ${fechaCorta(finDePeriodo(inicio, 1))}.` : 'Cargue primero el inicio del período.'}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Duración del período">
          {DURACIONES.map((anios) => {
            const valor = inicio ? finDePeriodo(inicio, anios) : ''
            const elegido = !!valor && fin === valor
            return (
              <button
                key={anios}
                type="button"
                disabled={!inicio}
                onClick={() => poner('periodoFin', valor)}
                title={valor ? `Hasta el ${fechaCorta(valor)}` : undefined}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  elegido
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-300 text-slate-700 hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-300',
                )}
              >
                {anios} {anios === 1 ? 'año' : 'años'}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Carácter, período, desagüe, tabla de usos con cálculo de caudal y punto de entrega pecuario. */
export function UsosFields({ prefix, onCaudalTotalChange }: Props) {
  const n = (campo: string) => `${prefix}.${campo}`
  const { usos, uso: buscarUso, caracteres, codigosServicio } = useDominio()
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name: n('items') })
  const items = (useWatch({ control, name: n('items') }) as Item[] | undefined) ?? []

  const total = caudalTotal(items, buscarUso)
  // Qué usos piden punto de entrega lo define la API (/usos → requierePuntoEntrega).
  const hayPecuario = items.some((i) => buscarUso(i.uso)?.requierePuntoEntrega)

  // Avisar solo cuando el total cambia por una edición (no al montar), así no se
  // pisa un caudal ajustado a mano al volver a esta sección.
  const totalPrevio = useRef(total)
  useEffect(() => {
    if (total === totalPrevio.current) return
    totalPrevio.current = total
    onCaudalTotalChange?.(total)
  }, [total, onCaudalTotalChange])

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormSelectField name={n('caracter')} label="Carácter" placeholder="Seleccione…" options={opcionesDe(caracteres)} />
        <FormSelectField name={n('codigoServicio')} label="Código de servicio" placeholder="Seleccione…" options={opcionesDe(codigosServicio)} />
        <PeriodoFields prefix={prefix} />
        <CoordenadaFields name={n('desague')} titulo="Desagüe" required soloPosgar className="md:col-span-2" />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Usos y magnitudes</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Uso</th>
                <th className="px-3 py-2">Magnitud / cantidad</th>
                <th className="px-3 py-2">Módulo de dotación</th>
                <th className="px-3 py-2 text-right">Caudal (l/s)</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {fields.map((field, i) => {
                const item = items[i] ?? usoItemVacio()
                const modulo = buscarUso(item.uso)
                return (
                  <tr key={field.id} className="align-top">
                    <td className="p-2">
                      <FormSelectField
                        name={n(`items.${i}.uso`)}
                        label={`Uso ${i + 1}`}
                        hideLabel
                        placeholder="Seleccione un uso"
                        options={opcionesDe(usos)}
                      />
                    </td>
                    <td className="p-2">
                      <FormMaskedField
                        name={n(`items.${i}.magnitud`)}
                        label={`Magnitud del uso ${i + 1}`}
                        hideLabel
                        mask={decimalPositivo}
                        inputMode="decimal"
                        placeholder={modulo ? `Cantidad en ${modulo.unidad}` : 'Ej: 12.5'}
                      />
                    </td>
                    <td className="px-3 py-5 text-slate-600 dark:text-slate-300">
                      {modulo ? `${modulo.dotacion} l/s por ${modulo.unidad}` : '—'}
                    </td>
                    <td className="px-3 py-5 text-right font-medium tabular-nums">
                      {redondear2(caudalDeUso(modulo, item.magnitud)).toFixed(2)}
                    </td>
                    <td className="p-2 pt-3">
                      <IconButton icon="delete" label="Quitar uso" tone="danger" disabled={fields.length === 1} onClick={() => remove(i)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Caudal total
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="secondary" iconLeft="add" disabled={fields.length >= usos.length} onClick={() => append(usoItemVacio())}>
            Agregar uso
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          El caudal se calcula según el módulo de dotación de cada tipo de uso (Art. 32, Ley 7139/7140). El total se vuelca
          al campo «Caudal asignado» de Suministro y puede ajustarse manualmente.
        </p>
      </div>

      {hayPecuario && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-500/30 dark:bg-sky-500/5">
          <div className="mb-4 flex items-start gap-3">
            <Icon name="water_drop" className="text-sky-600" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Punto de entrega de agua (uso pecuario)</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Coordenadas del abrevadero, laguna o represa donde se entrega el agua para el consumo de los animales.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CoordenadaFields name={n('pecuario')} titulo="Punto de entrega" required className="md:col-span-2" />
            <FormTextField
              name={n('pecuario.referencia')}
              label="Referencia del punto de entrega"
              placeholder="Ej: Laguna El Bordo — potrero norte"
              hint="Descripción del reservorio (laguna, represa o abrevadero) donde toman los animales."
              className="md:col-span-2"
            />
          </div>
        </div>
      )}
    </div>
  )
}
