import { useEffect, useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormNumericField, FormSelectField, FormTextField } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { claveDeDocumento } from '@/lib/validaciones'
import { buscarPersona, nombreDePersona, personaAFormulario, type ResultadoPersona } from '../personas'
import {
  documentoConFormato,
  getReglaDocumento,
  TIPOS_DOCUMENTO,
  TIPOS_PERSONA,
  validarDocumento,
  type TipoDocumento,
  type TipoPersona,
  type TitularForm,
} from '../schemas/titular'

/** Campos que se completan desde el padrón (el tipo de persona y el documento ya los eligió el usuario). */
const CAMPOS_PADRON = ['apellido', 'nombre', 'fechaNacimiento', 'razonSocial', 'fechaConstitucion', 'correo', 'telefono'] as const
/** Los que identifican a la persona: si vinieron del padrón quedan bloqueados, para no escribirla distinto. */
type CampoIdentidad = 'apellido' | 'nombre' | 'fechaNacimiento' | 'razonSocial' | 'fechaConstitucion'

interface Props {
  /** Path del titular dentro del formulario (ej: 'titulares.0'). */
  prefix: string
}

/** Documento de la persona encontrada, con formato («CUIL: 20-12345678-6»). */
function documentoDe({ persona: p }: ResultadoPersona) {
  if (!p.documento) return 'Sin documento cargado'
  const juridica = p.tipoPersona === 'JURIDICA'
  return documentoConFormato({ tipoPersona: juridica ? 'juridica' : 'fisica', tipoDocumento: (p.tipoDocumento ?? 'DNI').toLowerCase() as TipoDocumento, documento: p.documento })
}

/**
 * Campos de un titular. Cambian según sea persona física o jurídica.
 *
 * Al escribir un documento válido (DNI, CUIL o CUIT) se lo busca en el padrón de personas. Una
 * persona física se encuentra también por el documento equivalente (su DNI si está con CUIL y
 * al revés):
 *   - Si ya está cargada, se muestran solo sus datos (sin concesiones ni deudas: eso lo revisa
 *     Recaudación) y se pregunta si se cargan. Mientras no se responda, los datos que la identifican quedan bloqueados: no se
 *     puede cargar un documento existente con otro nombre.
 *   - Si no está, se avisa que se va a cargar como persona nueva.
 *   - Si ya figura como otro titular de este mismo trámite, se avisa enseguida.
 */
export function TitularFields({ prefix }: Props) {
  const { control, getValues, setValue, getFieldState, trigger, setFocus } = useFormContext()
  const n = (campo: string) => `${prefix}.${campo}`

  const [tipoPersona, tipoDocumento, documento] = useWatch({ control, name: [n('tipoPersona'), n('tipoDocumento'), n('documento')] }) as [
    TipoPersona,
    TipoDocumento,
    string | undefined,
  ]
  const regla = getReglaDocumento(tipoPersona, tipoDocumento)
  const esJuridica = tipoPersona === 'juridica'
  const doc = documento ?? ''
  const docValido = !validarDocumento(doc, regla)

  // --- Misma persona en otro titular de este trámite -------------------------------------
  const [lista, indice] = prefix.split('.')
  const otros = (useWatch({ control, name: lista }) as TitularForm[] | undefined) ?? []
  const repetidoEn = docValido ? otros.findIndex((t, i) => i !== Number(indice) && !!t?.documento && claveDeDocumento(t.documento) === claveDeDocumento(doc)) : -1

  // --- Búsqueda en el padrón de personas ---------------------------------------------
  /** Persona cargada con este documento, a la espera de que el usuario diga si usa sus datos. */
  const [propuesta, setPropuesta] = useState<{ resultado: ResultadoPersona; doc: string } | null>(null)
  /** Persona cuyos datos se cargaron (aceptada). */
  const [encontrada, setEncontrada] = useState<ResultadoPersona | null>(null)
  /** Documento con el que se encontró (puede ser el DNI de alguien cargado con CUIL, o al revés). */
  const [buscadoCon, setBuscadoCon] = useState('')
  /** Documento que se buscó y no está en el padrón. */
  const [nueva, setNueva] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(false)
  // Lo que ya estaba al montar (un borrador que se retoma) no se vuelve a buscar.
  const ultimaBusqueda = useRef(`${regla.label}:${doc}`)

  useEffect(() => {
    const clave = `${regla.label}:${doc}`
    if (clave === ultimaBusqueda.current) return
    ultimaBusqueda.current = clave

    //1.- Cambió el documento: lo que se había encontrado (o propuesto) ya no corresponde.
    setPropuesta(null)
    setNueva('')
    if (encontrada && buscadoCon !== doc) {
      for (const campo of CAMPOS_PADRON) setValue(n(campo), '')
      setEncontrada(null)
      setCorrigiendo(false)
    }
    if (!docValido || (encontrada && buscadoCon === doc)) return

    //2.- Documento válido: si la persona ya está cargada se propone usar sus datos; si no, es nueva.
    let vigente = true
    setBuscando(true)
    void buscarPersona(doc).then((resultado) => {
      if (!vigente) return
      setBuscando(false)
      if (resultado) setPropuesta({ resultado, doc })
      else setNueva(doc)
    })
    return () => {
      vigente = false
      setBuscando(false)
    }
    // Se busca solo cuando cambia el documento o su tipo (no al cambiar los demás datos).
  }, [doc, regla.label])

  /** «Sí, cargar sus datos»: se completa el formulario con la ficha de la persona. */
  function usarDatos() {
    if (!propuesta) return
    const datos = personaAFormulario(propuesta.resultado.persona)
    for (const [campo, valor] of Object.entries(datos)) setValue(n(campo), valor, { shouldDirty: true })
    void trigger(CAMPOS_PADRON.map(n))
    setEncontrada(propuesta.resultado)
    setBuscadoCon(propuesta.doc)
    setPropuesta(null)
    setCorrigiendo(false)
  }

  /** «No, revisar el documento»: se borra el documento para escribirlo de nuevo. */
  function revisarDocumento() {
    setPropuesta(null)
    setValue(n('documento'), '', { shouldValidate: false })
    setFocus(n('documento'))
  }

  /** Dato bloqueado: esperando la respuesta, o porque vino del padrón (salvo que se elija corregirlo). */
  const bloqueado = (campo: CampoIdentidad) =>
    !!propuesta || (!!encontrada && !corrigiendo && !!(personaAFormulario(encontrada.persona) as Partial<TitularForm>)[campo])

  /** Al cambiar el tipo, el documento se recorta al nuevo largo máximo y se revalida si ya tenía error. */
  function ajustarDocumento(persona: TipoPersona, tipoDoc: TipoDocumento) {
    const { max } = getReglaDocumento(persona, tipoDoc)
    const actual: string = getValues(n('documento')) ?? ''
    if (actual.length > max) setValue(n('documento'), actual.slice(0, max))
    if (getFieldState(n('documento')).isTouched) void trigger(n('documento'))
  }

  let ayudaDocumento: string | undefined = regla.label === 'DNI' ? undefined : 'Sin guiones.'
  if (buscando) ayudaDocumento = 'Buscando en el padrón de personas…'
  else if (nueva && nueva === doc && repetidoEn < 0) ayudaDocumento = 'No está en el padrón de personas: se cargará como persona nueva.'

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {repetidoEn >= 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 md:col-span-2 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <Icon name="group_off" />
          <p>
            <span className="font-semibold">Esta persona ya está cargada en este trámite</span> ({repetidoEn === 0 ? 'primer titular' : `titular adicional ${repetidoEn}`}). Un DNI y el
            CUIL / CUIT que lo contiene son la misma persona: revise el documento o quite uno de los titulares.
          </p>
        </div>
      )}

      {propuesta && repetidoEn < 0 && (
        <div role="alertdialog" aria-label="Persona ya cargada" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm md:col-span-2 dark:border-amber-500/40 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <Icon name="person_search" className="text-amber-700 dark:text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Ya hay una persona cargada con este documento.</p>
              <p className="mt-1 text-slate-700 dark:text-slate-200">
                <strong>{nombreDePersona(propuesta.resultado.persona)}</strong> · {documentoDe(propuesta.resultado)}
                {propuesta.resultado.persona.tipoPersona === 'JURIDICA' ? ' · persona jurídica' : ''}
              </p>
              <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">¿Desea cargar sus datos en este titular?</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:pl-9">
            <Button size="sm" iconLeft="how_to_reg" onClick={usarDatos}>
              Sí, cargar sus datos
            </Button>
            <Button size="sm" variant="secondary" iconLeft="edit" onClick={revisarDocumento}>
              No, revisar el documento
            </Button>
          </div>
        </div>
      )}

      {encontrada && (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm md:col-span-2 dark:border-sky-500/30 dark:bg-sky-500/10">
          <Icon name="how_to_reg" className="text-sky-700 dark:text-sky-300" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Se cargaron los datos de {nombreDePersona(encontrada.persona)}.</p>
            <p className="text-slate-600 dark:text-slate-300">
              {encontrada.persona.documento && encontrada.persona.documento !== buscadoCon && (
                <>
                  Figura con {documentoDe(encontrada)}
                  {encontrada.persona.documento.length === 11 ? ' (se mantiene ese dato).' : ' (se actualiza con el documento ingresado).'}{' '}
                </>
              )}
              {encontrada.persona.denominacion && !encontrada.persona.apellido && !encontrada.persona.razonSocial && (
                <>En el padrón anterior figura como «{encontrada.persona.denominacion}»: complete los datos que faltan. </>
              )}
              {corrigiendo && 'Los cambios actualizan la ficha de la persona en todos sus trámites.'}
            </p>
          </div>
          {!corrigiendo && (
            <Button size="sm" variant="secondary" iconLeft="edit" onClick={() => setCorrigiendo(true)}>
              Corregir datos
            </Button>
          )}
        </div>
      )}

      <FormSelectField
        name={n('tipoPersona')}
        label="Tipo de persona"
        options={TIPOS_PERSONA}
        onValueChange={(v) => ajustarDocumento(v as TipoPersona, tipoDocumento)}
      />
      {!esJuridica && (
        <FormSelectField
          name={n('tipoDocumento')}
          label="Tipo de documento"
          options={TIPOS_DOCUMENTO}
          onValueChange={(v) => ajustarDocumento(tipoPersona, v as TipoDocumento)}
        />
      )}
      <FormNumericField name={n('documento')} label={regla.label} required maxLength={regla.max} placeholder={regla.placeholder} hint={ayudaDocumento} />
      <FormTextField
        name={n('correo')}
        label="Correo electrónico"
        required
        type="email"
        placeholder="nombre@ejemplo.com"
        hint="Se enviarán notificaciones del trámite a esta dirección."
      />

      {esJuridica ? (
        <>
          <FormTextField name={n('razonSocial')} readOnly={bloqueado('razonSocial')} label="Razón social" required placeholder="Razón social" className="md:col-span-2" />
          <FormTextField name={n('fechaConstitucion')} readOnly={bloqueado('fechaConstitucion')} label="Fecha de constitución" required type="date" />
        </>
      ) : (
        <>
          <FormTextField name={n('apellido')} readOnly={bloqueado('apellido')} label="Apellido" required placeholder="Apellido" />
          <FormTextField name={n('nombre')} readOnly={bloqueado('nombre')} label="Nombre" required placeholder="Nombre" />
          <FormTextField name={n('fechaNacimiento')} readOnly={bloqueado('fechaNacimiento')} label="Fecha de nacimiento" required type="date" />
        </>
      )}

      <FormTextField name={n('telefono')} label="Teléfono de contacto" required type="tel" placeholder="(0381) 123-4567" />
    </div>
  )
}
