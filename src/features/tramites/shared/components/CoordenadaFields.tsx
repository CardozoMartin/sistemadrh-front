import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormMaskedField, FormTextField } from '@/components/form'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { coordenadaVacia, leerCoordenada, textoConversion, type CoordenadaForm, type SistemaCoordenada } from '@/lib/coordenadas'
import { mascaraPosgar } from '@/lib/posgar-faja3'

const SISTEMAS: [SistemaCoordenada, string][] = [
  ['posgar', 'POSGAR 07 faja 3 (X/Y)'],
  ['grados', 'Latitud / longitud'],
]

interface Props {
  /** Ruta del objeto CoordenadaForm en el formulario (ej: "usos.desague"). */
  name: string
  /** Nombre del punto para las etiquetas (ej: "Desagüe"). */
  titulo: string
  required?: boolean
  /** Solo X/Y POSGAR 2007 faja 3, sin la opción de latitud/longitud (ej: el desagüe). */
  soloPosgar?: boolean
  className?: string
}

/**
 * Coordenada de un punto en X/Y POSGAR 2007 faja 3 o en latitud/longitud (a elección). Muestra
 * en vivo la conversión a la otra forma, para confirmar que el punto es el correcto. Al cambiar
 * de sistema, si el punto ya era válido se pasa al otro.
 */
export function CoordenadaFields({ name, titulo, required, soloPosgar, className }: Props) {
  const { control, setValue, clearErrors, trigger, getFieldState, formState } = useFormContext()
  // Un borrador guardado antes de este formato no trae el objeto: se toma vacío.
  const c = { ...coordenadaVacia(), ...(useWatch({ control, name }) as Partial<CoordenadaForm> | undefined) }
  const posgar = soloPosgar || c.sistema === 'posgar'
  const lectura = leerCoordenada(soloPosgar ? { ...c, sistema: 'posgar' } : c, '')

  // La X y la Y se validan juntas (invertidas, punto fuera de Tucumán): si una tiene error, al
  // cambiar cualquiera de las dos se revalidan ambas, para no dejar un mensaje viejo.
  const campos = posgar ? [`${name}.x`, `${name}.y`] : [`${name}.latitud`, `${name}.longitud`]
  const conError = campos.some((f) => getFieldState(f, formState).error)
  const [v1, v2] = posgar ? [c.x, c.y] : [c.latitud, c.longitud]
  useEffect(() => {
    if (conError) void trigger(campos)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia un valor
  }, [v1, v2])

  function cambiarSistema(sistema: SistemaCoordenada) {
    if (sistema === c.sistema) return
    const p = lectura.punto
    if (p && sistema === 'grados') {
      setValue(`${name}.latitud`, p.latitud.toFixed(8))
      setValue(`${name}.longitud`, p.longitud.toFixed(8))
    } else if (p) {
      setValue(`${name}.x`, p.x.toFixed(2))
      setValue(`${name}.y`, p.y.toFixed(2))
    }
    setValue(`${name}.sistema`, sistema, { shouldDirty: true })
    clearErrors(name)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {soloPosgar ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          X/Y POSGAR 2007 faja 3 (EPSG:5345), en metros: 7 cifras enteras y hasta 2 decimales, con punto decimal.
        </span>
      ) : (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Cargue la coordenada en el sistema que tenga a mano:</span>
        <div role="radiogroup" aria-label={`Sistema de coordenadas: ${titulo.toLowerCase()}`} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-900">
          {SISTEMAS.map(([valor, nombre]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={c.sistema === valor}
              onClick={() => cambiarSistema(valor)}
              className={cn('rounded-md px-3 py-1.5', c.sistema === valor ? 'bg-white text-primary shadow-sm dark:bg-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}
            >
              {nombre}
            </button>
          ))}
        </div>
      </div>
      )}

      {posgar ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormMaskedField
            name={`${name}.x`}
            label={`${titulo}: X (este)`}
            required={required}
            mask={mascaraPosgar}
            inputMode="decimal"
            placeholder="Ej: 3577293.45"
            hint="POSGAR 2007 faja 3 (EPSG:5345), en metros."
          />
          <FormMaskedField name={`${name}.y`} label={`${titulo}: Y (norte)`} required={required} mask={mascaraPosgar} inputMode="decimal" placeholder="Ej: 7035340.12" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormTextField
            name={`${name}.latitud`}
            label={`${titulo}: latitud`}
            required={required}
            placeholder="Ej: -27.05362983"
            hint={`Grados decimales o grados, minutos y segundos (27°03'13" S).`}
            autoComplete="off"
          />
          <FormTextField name={`${name}.longitud`} label={`${titulo}: longitud`} required={required} placeholder="Ej: -65.23122447" autoComplete="off" />
        </div>
      )}

      {lectura.punto && (
        <p className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <Icon name="sync_alt" className="text-[16px]! text-primary" />
          <span>
            Equivale a <span className="font-mono">{textoConversion(posgar ? 'posgar' : 'grados', lectura.punto)}</span>
            {lectura.aviso && <span className="block text-amber-700 dark:text-amber-400">{lectura.aviso}</span>}
          </span>
        </p>
      )}
    </div>
  )
}
