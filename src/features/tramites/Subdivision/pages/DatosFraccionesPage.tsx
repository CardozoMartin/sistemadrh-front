import { useEffect, useMemo, useRef, useState } from 'react'
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stepper } from '@/components/ui/Stepper'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { seccionDeCampo } from '../../AltaDeConcesion/components/secciones'
import { crearPreCargaSchema, type PreCargaForm } from '../../AltaDeConcesion/schemas'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { ConBorrador } from '../components/ConBorrador'
import { ResumenMadre } from '../components/ResumenMadre'
import { SECCIONES_FRACCION } from '../components/secciones'
import { cargaInicial, porcentaje } from '../fracciones'
import { useEnviarSubdivision, useGuardarFracciones } from '../hooks'
import { PASOS_SUBDIVISION } from '../pasos'
import type { BorradorSubdivision, FraccionSubdivision, MadreSubdivision } from '../types'

const TITULO = 'Subdivisión de Concesión — Datos por fracción'

type Schema = ReturnType<typeof crearPreCargaSchema>
type Dialogo = 'enviar' | 'enviado' | null

/**
 * Paso 3 (Catastro), prototipo subdivision/preCargaDeNuevaSubdivision.html: los datos de
 * cada nueva concesión (los mismos formularios del Alta), una pestaña por fracción. Con
 * todas completas se envía a Recaudación.
 */
export default function DatosFraccionesPage() {
  return <ConBorrador titulo={TITULO}>{(b) => <Datos key={b.id} borrador={b} />}</ConBorrador>
}

/** Primer path con error dentro de un objeto de errores de react-hook-form. */
function primerError(errors: FieldErrors, base = ''): string | null {
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue
    const path = base ? `${base}.${key}` : key
    if ('message' in value && typeof value.message === 'string') return path
    const hijo = primerError(value as FieldErrors, path)
    if (hijo) return hijo
  }
  return null
}

function Datos({ borrador }: { borrador: BorradorSubdivision }) {
  const navigate = useNavigate()
  const d = useDominio()
  const schema = useMemo(() => crearPreCargaSchema(d), [d])
  const guardar = useGuardarFracciones(borrador.id)
  const enviar = useEnviarSubdivision()
  // Las fracciones sin datos arrancan con los de la concesión madre.
  const [fracciones, setFracciones] = useState<FraccionSubdivision[]>(() =>
    borrador.fracciones.map((f) => (f.carga ? f : { ...f, carga: cargaInicial(borrador.base, f, borrador.madre, d.uso) })),
  )
  const completas = useMemo(() => new Set(fracciones.filter((f) => schema.safeParse(f.carga).success).map((f) => f.clave)), [fracciones, schema])
  const [activa, setActiva] = useState(() => (fracciones.find((f) => !completas.has(f.clave)) ?? fracciones[0]).clave)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [faltan, setFaltan] = useState(false)
  // Valores del formulario visible (para guardarlos al cambiar de fracción o enviar).
  const valoresActuales = useRef<(() => PreCargaForm) | null>(null)
  const oficinaDestino = d.nombreOficina(d.etapas[1]?.oficinaId ?? 'recaudacion')
  const fraccion = fracciones.find((f) => f.clave === activa)!
  const ocupado = guardar.isPending || enviar.isPending

  /** Guarda las fracciones con lo que tiene el formulario visible (sin validar). */
  async function guardarTodo(cambios: Partial<FraccionSubdivision> = {}): Promise<FraccionSubdivision[]> {
    const valores = valoresActuales.current?.()
    const nuevas = fracciones.map((f) => (f.clave === activa ? { ...f, ...(valores ? { carga: valores } : {}), ...cambios } : f))
    setFracciones(nuevas)
    await guardar.mutateAsync(nuevas)
    return nuevas
  }

  async function irAFraccion(clave: string) {
    if (clave === activa) return
    try {
      await guardarTodo()
      setActiva(clave)
      setFaltan(false)
      window.scrollTo({ top: 0 })
    } catch {
      /* se muestra con guardar.error */
    }
  }

  async function volverAlEditor() {
    try {
      await guardarTodo()
      navigate(ROUTES.tramites.subdivision.fracciones(borrador.id))
    } catch {
      /* se muestra con guardar.error */
    }
  }

  async function pedirEnvio() {
    try {
      const nuevas = await guardarTodo()
      const incompletas = nuevas.filter((f) => !schema.safeParse(f.carga).success)
      if (incompletas.length) {
        setFaltan(true)
        return
      }
      setDialogo('enviar')
    } catch {
      /* se muestra con guardar.error */
    }
  }

  function confirmarEnvio() {
    setDialogo(null)
    enviar.mutate({ ...borrador, fracciones }, { onSuccess: () => setDialogo('enviado') })
  }

  return (
    <>
      <PageHeader title={TITULO} description="Complete los datos de cada fracción. Superficie y caudal vienen del paso anterior; el resto parte de los datos de la concesión madre." />

      <div className="flex flex-col gap-6">
        <PasosTramite {...PASOS_SUBDIVISION} actual={2} titulo="Datos por fracción" />
        <ResumenMadre numeroConcesion={borrador.numeroConcesion} numeroExpediente={borrador.numeroExpediente} madre={borrador.madre} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fracciones">
            {fracciones.map((f) => {
              const completa = completas.has(f.clave)
              return (
                <button
                  key={f.clave}
                  type="button"
                  role="tab"
                  aria-selected={f.clave === activa}
                  disabled={ocupado}
                  onClick={() => void irAFraccion(f.clave)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                    f.clave === activa ? 'border-primary bg-primary/5 text-slate-900 dark:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span className="size-3 rounded-full" style={{ background: f.color }} />
                  {f.nombre}
                  <Icon name={completa ? 'check_circle' : 'pending'} filled={completa} className={cn('text-base!', completa ? 'text-green-600' : 'text-amber-500')} />
                </button>
              )
            })}
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            <strong className="text-slate-900 dark:text-white">{completas.size}</strong> / {fracciones.length} completas
          </span>
        </div>

        <FormularioFraccion
          key={fraccion.clave}
          fraccion={fraccion}
          madre={borrador.madre}
          schema={schema}
          registrar={(getter) => (valoresActuales.current = getter)}
          guardando={guardar.isPending}
          onGuardar={(carga, seccionAlcanzada) => guardarTodo({ carga, seccionAlcanzada })}
        />

        {faltan && (
          <Alert>
            Faltan datos en: {fracciones.filter((f) => !completas.has(f.clave)).map((f) => f.nombre).join(', ')}. Complete cada fracción (las pestañas con
            reloj) antes de enviar.
          </Alert>
        )}
        {(guardar.error || enviar.error) && <Alert>{mensajeDeError(guardar.error ?? enviar.error)}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="secondary" iconLeft="arrow_back" disabled={ocupado} onClick={() => void volverAlEditor()}>
            Volver al editor
          </Button>
          <Button size="sm" iconRight="send" loading={enviar.isPending} disabled={ocupado} onClick={() => void pedirEnvio()}>
            Enviar a {oficinaDestino}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={dialogo === 'enviar'}
        title={`¿Enviar a ${oficinaDestino}?`}
        message={`Se iniciarán ${fracciones.length} nuevas concesiones por subdivisión de la Concesión N° ${borrador.numeroConcesion} (expediente ${borrador.numeroExpediente}). La concesión madre quedará «Subdividida» recién al cierre, con la resolución.`}
        confirmLabel={`Sí, enviar a ${oficinaDestino}`}
        cancelLabel="Revisar antes"
        onConfirm={confirmarEnvio}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === 'enviado'}
        tone="success"
        title="Expediente iniciado"
        message={`Las ${fracciones.length} fracciones del expediente ${borrador.numeroExpediente} fueron enviadas a ${oficinaDestino}.`}
        confirmLabel="Ver seguimiento"
        onConfirm={() => navigate(ROUTES.catastro.pendientes)}
      />
    </>
  )
}

interface FormularioProps {
  fraccion: FraccionSubdivision
  madre: MadreSubdivision
  schema: Schema
  /** Le da a la página una forma de leer los valores actuales del formulario. */
  registrar: (getter: () => PreCargaForm) => void
  guardando: boolean
  onGuardar: (carga: PreCargaForm, seccionAlcanzada: number) => Promise<unknown>
}

/** Formulario de una fracción: las seis secciones del Alta con su barra de avance. */
function FormularioFraccion({ fraccion, madre, schema, registrar, guardando, onGuardar }: FormularioProps) {
  const ultima = SECCIONES_FRACCION.length - 1
  const inicial = Math.min(fraccion.seccionAlcanzada ?? 0, ultima)
  const [actual, setActual] = useState(inicial)
  const [alcanzada, setAlcanzada] = useState(inicial)
  const [guardada, setGuardada] = useState(false)
  const form = useForm<PreCargaForm>({
    resolver: zodResolver(schema),
    defaultValues: fraccion.carga ?? undefined,
    mode: 'onTouched',
  })
  const seccion = SECCIONES_FRACCION[actual]

  useEffect(() => {
    registrar(() => form.getValues())
  }, [registrar, form])

  function irA(i: number) {
    setActual(i)
    setGuardada(false)
  }

  async function siguiente() {
    if (!(await form.trigger(seccion.campos, { shouldFocus: true }))) return
    const proxima = actual + 1
    const nuevaAlcanzada = Math.max(alcanzada, proxima)
    try {
      await onGuardar(form.getValues(), nuevaAlcanzada)
      setAlcanzada(nuevaAlcanzada)
      irA(proxima)
    } catch {
      /* se muestra en la página */
    }
  }

  const guardarFraccion = form.handleSubmit(
    async (v) => {
      try {
        await onGuardar(v, ultima)
        setGuardada(true)
      } catch {
        /* se muestra en la página */
      }
    },
    (errors) => {
      const path = primerError(errors)
      const indice = path ? seccionDeCampo(path) : -1
      if (indice >= 0) {
        setAlcanzada((a) => Math.max(a, indice))
        irA(indice)
      }
    },
  )

  return (
    <FormProvider {...form}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700" style={{ background: `${fraccion.color}0d` }}>
          <div className="flex items-center gap-3">
            <span className="size-4 shrink-0 rounded-full" style={{ background: fraccion.color }} />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{fraccion.nombre}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Superficie: <strong>{fraccion.hectareas.toFixed(2)} ha</strong> ({porcentaje(fraccion, madre).toFixed(1)} %) · Caudal proporcional:{' '}
                <strong>{fraccion.caudal == null ? '—' : `${fraccion.caudal.toFixed(2)} l/s`}</strong>
              </p>
            </div>
          </div>
          {guardada && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
              <Icon name="check_circle" filled className="text-base!" /> Fracción completa
            </span>
          )}
        </div>

        <div className="px-6 pt-5 md:px-8">
          <Stepper steps={SECCIONES_FRACCION} current={actual} maxReached={alcanzada} onSelect={irA} />
        </div>

        <form noValidate onSubmit={guardarFraccion} className="p-6 md:p-8">
          <seccion.Component />
        </form>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
          <Button variant="secondary" size="sm" iconLeft="arrow_back" disabled={actual === 0 || guardando} onClick={() => irA(actual - 1)}>
            Anterior
          </Button>
          {actual === ultima ? (
            <Button size="sm" iconRight="task_alt" loading={guardando} onClick={() => void guardarFraccion()}>
              Guardar fracción
            </Button>
          ) : (
            <Button size="sm" iconRight="arrow_forward" loading={guardando} onClick={() => void siguiente()}>
              Siguiente
            </Button>
          )}
        </div>
      </Card>
    </FormProvider>
  )
}
