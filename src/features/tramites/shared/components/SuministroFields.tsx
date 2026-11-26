import { useEffect, type ReactNode } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormMaskedField, FormSelectField, FormTextareaField, toOptions, type Option } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { useCatalogoSuministro } from '@/hooks/useCatalogos'
import { decimalPositivo } from '@/lib/mascaras'
import { arbolDelDistrito, CAMPOS_CASCADA, pasosCascada, type CampoCascada, type UbicacionSeleccionada } from '../suministro'

interface Props {
  prefix: string
  /** Ubicación del inmueble: el distrito define qué árbol de suministro se ofrece. */
  ubicacion: UbicacionSeleccionada
  /** Sin el campo de caudal asignado (ej: la reubicación, donde la magnitud no cambia). */
  sinCaudal?: boolean
}

function Aviso({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Icon name={icon} className="shrink-0" />
      <p>{children}</p>
    </div>
  )
}

/** Las opciones de un nivel; un valor que no está en el árbol (concesión migrada) se muestra marcado. */
function conValorActual(opciones: string[], valor: string): Option[] {
  const lista = toOptions(opciones)
  return valor && !opciones.includes(valor) ? [{ value: valor, label: `${valor} (no está en el árbol)` }, ...lista] : lista
}

/**
 * Fuente de agua y el camino por el árbol de suministro del distrito: sistema de distribución,
 * canales y desagüe. Cada nivel ofrece lo que cuelga del último tramo elegido; los niveles que
 * la rama no tiene no aparecen.
 */
export function SuministroFields({ prefix, ubicacion, sinCaudal = false }: Props) {
  const n = (campo: string) => `${prefix}.${campo}`
  const { control, setValue, getValues } = useFormContext()
  const { catalogo, cargando, error } = useCatalogoSuministro()
  const fuentes = useFieldArray({ control, name: n('fuentes') })

  const [listaFuentes, ...valoresCascada] = useWatch({ control, name: [n('fuentes'), ...CAMPOS_CASCADA.map(n)] }) as [{ valor: string }[] | undefined, ...string[]]
  const valores = Object.fromEntries(CAMPOS_CASCADA.map((c, i) => [c, valoresCascada[i] ?? ''])) as Record<CampoCascada, string>
  const fuentePrincipal = listaFuentes?.[0]?.valor ?? ''

  const arbol = arbolDelDistrito(catalogo, ubicacion.distrito)
  const nombresFuente = arbol?.map((f) => f.nombre) ?? []
  const opcionesFuente = toOptions(nombresFuente)
  const pasos = pasosCascada(arbol, fuentePrincipal, valores)

  // Con una sola opción se selecciona sola: la fuente (al cambiar de distrito) y el sistema (al cambiar de fuente).
  useEffect(() => {
    if (arbol?.length === 1 && !getValues(n('fuentes.0.valor'))) setValue(n('fuentes.0.valor'), arbol[0].nombre, { shouldDirty: true })
  }, [arbol]) // solo al cambiar el distrito / catálogo
  const sistemas = pasos.find((p) => p.campo === 'sistemaDistribucion')?.opciones
  useEffect(() => {
    if (sistemas?.length === 1 && !getValues(n('sistemaDistribucion'))) setValue(n('sistemaDistribucion'), sistemas[0], { shouldDirty: true })
  }, [fuentePrincipal, sistemas?.length])

  /** Cambiar un tramo invalida lo que venía después. */
  function limpiarDesde(campo: CampoCascada | null) {
    const desde = campo ? CAMPOS_CASCADA.indexOf(campo) + 1 : 0
    for (const c of CAMPOS_CASCADA.slice(desde)) if (getValues(n(c))) setValue(n(c), '', { shouldDirty: true })
  }

  const distritoCargado = !!ubicacion.distrito

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {error && <Aviso icon="error">No se pudo cargar el árbol de suministro de riego.</Aviso>}
      {!error && cargando && <p className="text-sm text-slate-500 md:col-span-2">Cargando árbol de suministro…</p>}
      {!error && !cargando && !distritoCargado && <Aviso icon="info">Complete la ubicación del inmueble (sección 2) para ver las fuentes y canales del distrito.</Aviso>}
      {!error && !cargando && distritoCargado && !arbol && (
        <Aviso icon="warning">
          El distrito {ubicacion.distrito} todavía no tiene árbol de suministro cargado. Puede completar la observación{sinCaudal ? '' : ' y el caudal asignado'}.
        </Aviso>
      )}

      {/* Fuentes: principal (de ella sale el camino) + adicionales */}
      <div className="flex flex-col gap-3 md:col-span-2">
        {fuentes.fields.map((field, i) => (
          <div key={field.id} className="flex items-end gap-2">
            <FormSelectField
              name={n(`fuentes.${i}.valor`)}
              label={i === 0 ? 'Fuente de agua' : `Fuente adicional ${i}`}
              hideLabel={i > 0}
              // Obligatoria cuando el distrito tiene árbol (sin opciones, solo se cargan observación y caudal).
              required={i === 0 && opcionesFuente.length > 0}
              placeholder="Seleccione una fuente"
              options={conValorActual(nombresFuente, listaFuentes?.[i]?.valor ?? '')}
              disabled={opcionesFuente.length === 0}
              onValueChange={i === 0 ? () => limpiarDesde(null) : undefined}
              className="flex-1"
            />
            {i > 0 && <IconButton icon="delete" label="Quitar fuente" tone="danger" className="mb-1" onClick={() => fuentes.remove(i)} />}
          </div>
        ))}
        {opcionesFuente.length > 1 && (
          <div>
            <Button size="sm" variant="ghost" iconLeft="add" onClick={() => fuentes.append({ valor: '' })}>
              Agregar otra fuente
            </Button>
          </div>
        )}
      </div>

      {/* El camino por el árbol: sistema → canales → desagüe (solo los niveles que tiene la rama) */}
      {pasos.map((p) => (
        <FormSelectField
          key={p.campo}
          name={n(p.campo)}
          label={p.etiqueta}
          placeholder={p.opciones.length ? `Seleccione ${p.etiqueta.toLowerCase()}` : 'Sin opciones en el árbol'}
          options={conValorActual(p.opciones, valores[p.campo])}
          onValueChange={() => limpiarDesde(p.campo)}
        />
      ))}
      {fuentePrincipal && arbol && pasos.length === 0 && (
        <p className="text-sm text-slate-500 md:col-span-2 dark:text-slate-400">De esta fuente no sale ningún sistema ni canal cargado en el árbol del distrito.</p>
      )}

      {!sinCaudal && (
        <FormMaskedField
          name={n('caudalAsignado')}
          label="Caudal asignado (l/s)"
          mask={decimalPositivo}
          inputMode="decimal"
          placeholder="Ej: 25.50"
          hint="Se calcula desde los usos cargados; puede ajustarse manualmente."
        />
      )}

      <FormTextareaField
        name={n('observacion')}
        label="Observación"
        placeholder="Observaciones adicionales sobre el suministro (aclaraciones, condiciones especiales, etc.)."
        className="md:col-span-2"
      />
    </div>
  )
}
