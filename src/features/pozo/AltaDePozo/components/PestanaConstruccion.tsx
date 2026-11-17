import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { FormMaskedField, FormSection, FormTextField, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { decimalPositivo } from '@/lib/mascaras'
import { aNumero, formatear, huecos, leerIntervalos, profundidadDe, solapes } from '../calculos'
import type { AltaPozoForm } from '../schemas'
import { PerfilPozo } from './PerfilPozo'

type Tabla = 'tramos' | 'filtros'

const COLUMNAS: Record<Tabla, { campo: string; titulo: string }[]> = {
  tramos: [
    { campo: 'desde', titulo: 'Ciego desde [m]' },
    { campo: 'hasta', titulo: 'Ciego hasta [m]' },
    { campo: 'material', titulo: 'Material' },
    { campo: 'diametro', titulo: 'Diámetro [pulg.]' },
  ],
  filtros: [
    { campo: 'desde', titulo: 'Filtro desde [m]' },
    { campo: 'hasta', titulo: 'Filtro hasta [m]' },
    { campo: 'diametro', titulo: 'Diámetro [pulg.]' },
    { campo: 'aberturas', titulo: 'Aberturas [mm]' },
  ],
}

interface TablaProps {
  tabla: Tabla
  titulo: string
  filas: { id: string }[]
  onAgregar: () => void
  onQuitar: (i: number) => void
}

function TablaIntervalos({ tabla, titulo, filas, onAgregar, onQuitar }: TablaProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</h4>
        <Button size="sm" variant="secondary" iconLeft="add" onClick={onAgregar}>
          Agregar {tabla === 'tramos' ? 'tramo' : 'filtro'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              {COLUMNAS[tabla].map((c) => (
                <th key={c.campo} className="px-2 py-2">
                  {c.titulo}
                </th>
              ))}
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filas.map((f, i) => (
              <tr key={f.id} className="align-top">
                {COLUMNAS[tabla].map((c) => (
                  <td key={c.campo} className="p-2">
                    {c.campo === 'material' ? (
                      <FormTextField name={`construccion.${tabla}.${i}.${c.campo}`} label={`${c.titulo}, fila ${i + 1}`} hideLabel placeholder="Ej: PVC, acero" />
                    ) : (
                      <FormMaskedField name={`construccion.${tabla}.${i}.${c.campo}`} label={`${c.titulo}, fila ${i + 1}`} hideLabel mask={decimalPositivo} inputMode="decimal" />
                    )}
                  </td>
                ))}
                <td className="p-2 pt-3">
                  <IconButton icon="delete" label="Quitar fila" tone="danger" onClick={() => onQuitar(i)} />
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                  Sin {tabla === 'tramos' ? 'tramos ciegos' : 'filtros'} cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Pestaña «Construcción»: profundidad, tramos ciegos y filtros (FRC), con el esquema del
 * entubado. «Calcular los filtros» propone un filtro en cada intervalo que los tramos ciegos
 * dejan libre hasta la profundidad (con el diámetro del caño vecino).
 */
export function PestanaConstruccion() {
  const { control, setValue, getValues } = useFormContext<AltaPozoForm>()
  const tramos = useFieldArray({ control, name: 'construccion.tramos' })
  const filtros = useFieldArray({ control, name: 'construccion.filtros' })
  const c = useWatch({ control, name: 'construccion' }) as AltaPozoForm['construccion']
  const errorProfundidad = useFieldError('construccion.profundidad')
  const [aviso, setAviso] = useState<string | null>(null)

  const prof = aNumero(c.profundidad)
  const t = leerIntervalos(c.tramos)
  const f = leerIntervalos(c.filtros)
  const cubierta = profundidadDe([...t, ...f])
  const choques = solapes([...t, ...f])

  function calcularProfundidad() {
    if (!cubierta) return setAviso('Cargue tramos ciegos o filtros: la profundidad sale del más profundo.')
    setValue('construccion.profundidad', String(cubierta), { shouldValidate: true, shouldDirty: true })
    setAviso(`Profundidad: ${formatear(cubierta)} m (el tramo más profundo).`)
  }

  function calcularFiltros() {
    const profundidad = prof ?? cubierta
    if (!profundidad) return setAviso('Ingrese la profundidad del pozo para calcular los filtros.')
    const libres = huecos(t, profundidad)
    if (!libres.length) return setAviso(`Los tramos ciegos cubren los ${formatear(profundidad)} m: no quedan intervalos para filtros.`)
    const cargados = new Set(getValues('construccion.filtros').map((x) => `${aNumero(x.desde)}|${aNumero(x.hasta)}`))
    const nuevos = libres.filter((h) => !cargados.has(`${h.desde}|${h.hasta}`))
    nuevos.forEach((h) => filtros.append({ desde: String(h.desde), hasta: String(h.hasta), diametro: h.diametro ? String(h.diametro) : '', aberturas: '' }))
    if (prof === null) setValue('construccion.profundidad', String(profundidad), { shouldDirty: true })
    setAviso(
      nuevos.length
        ? `Se agregaron ${nuevos.length} filtro${nuevos.length === 1 ? '' : 's'}: ${nuevos.map((h) => `${formatear(h.desde)} a ${formatear(h.hasta)} m`).join(' · ')}. Complete las aberturas.`
        : 'Los filtros de los intervalos libres ya estaban cargados.',
    )
  }

  return (
    <FormSection title="Construcción" icon="construction" description="Profundidad real, tramos ciegos y filtros del entubado.">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-3">
            <FormMaskedField name="construccion.profundidad" label="Profundidad real [m]" mask={decimalPositivo} inputMode="decimal" className="w-48" />
            <Button size="sm" variant="secondary" iconLeft="calculate" onClick={calcularProfundidad}>
              Calcular la profundidad
            </Button>
            <Button size="sm" variant="secondary" iconLeft="filter_alt" onClick={calcularFiltros}>
              Calcular los filtros
            </Button>
          </div>
          {aviso && <Alert tone="info">{aviso}</Alert>}
          {!errorProfundidad && choques.length > 0 && (
            <Alert>
              Hay intervalos que se pisan: {choques.map(([a, b]) => `${formatear(a.desde)}–${formatear(a.hasta)} m con ${formatear(b.desde)}–${formatear(b.hasta)} m`).join(' · ')}.
            </Alert>
          )}
          <TablaIntervalos
            tabla="tramos"
            titulo="Tramos ciegos"
            filas={tramos.fields}
            onAgregar={() => tramos.append({ desde: String(profundidadDe(t) || ''), hasta: '', material: '', diametro: '' })}
            onQuitar={tramos.remove}
          />
          <TablaIntervalos tabla="filtros" titulo="Filtros" filas={filtros.fields} onAgregar={() => filtros.append({ desde: '', hasta: '', diametro: '', aberturas: '' })} onQuitar={filtros.remove} />
        </div>
        <PerfilPozo profundidad={Math.max(prof ?? 0, cubierta)} tramos={t} filtros={f} />
      </div>
    </FormSection>
  )
}
