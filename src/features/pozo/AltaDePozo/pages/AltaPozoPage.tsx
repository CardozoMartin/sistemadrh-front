import { useState } from 'react'
import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { Field, FormTextareaField, Input } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { MODO_DEMO } from '@/services/demo/modo'
import { altaPozoADto, useRegistrarPozoDeOficio } from '../api'
import { PestanaConstruccion } from '../components/PestanaConstruccion'
import { PestanaGeneral } from '../components/PestanaGeneral'
import { PestanaHidraulicos } from '../components/PestanaHidraulicos'
import { PestanaLitologia } from '../components/PestanaLitologia'
import { PestanaOtras } from '../components/PestanaOtras'
import { PestanaQuimica } from '../components/PestanaQuimica'
import { PestanaUbicacion } from '../components/PestanaUbicacion'
import { PestanaUsos } from '../components/PestanaUsos'
import { altaPozoSchema, altaPozoVacia, type AltaPozoForm } from '../schemas'
import type { AltaPozoOficioRespuesta } from '../types'

/** Pestañas del prototipo; `seccion` es la parte del formulario que valida cada una. */
const PESTANAS = [
  { key: 'general', titulo: 'General', icono: 'description', Componente: PestanaGeneral },
  { key: 'ubicacion', titulo: 'Ubicación', icono: 'location_on', Componente: PestanaUbicacion },
  { key: 'otras', titulo: 'Otras características', icono: 'info', Componente: PestanaOtras },
  { key: 'litologia', titulo: 'Litología', icono: 'layers', Componente: PestanaLitologia },
  { key: 'construccion', titulo: 'Construcción', icono: 'construction', Componente: PestanaConstruccion },
  { key: 'hidraulico', titulo: 'Hidráulicos', icono: 'water', Componente: PestanaHidraulicos },
  { key: 'usos', titulo: 'Uso del agua', icono: 'water_drop', Componente: PestanaUsos },
  { key: 'quimico', titulo: 'Info. química', icono: 'science', Componente: PestanaQuimica },
] as const

type Via = 'elegir' | 'autorizacion' | 'oficio'

/** Paso previo: de dónde viene el pozo. Define qué datos se heredan y cuáles se cargan acá. */
function ElegirVia({ onElegir }: { onElegir: (via: Via) => void }) {
  const opciones = [
    { via: 'autorizacion' as const, icono: 'link', titulo: 'Con autorización de perforación', texto: 'El pozo se perforó con una autorización aprobada: los datos del solicitante y del pozo se heredan de ella.' },
    { via: 'oficio' as const, icono: 'gavel', titulo: 'De oficio', texto: 'Sin autorización previa (pozo preexistente, relevamiento de campo, regularización, denuncia…): todos los datos se cargan en la ficha.' },
  ]
  return (
    <Card className="p-6 md:p-8">
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">Indique de dónde proviene este pozo. La vía elegida define qué datos se heredan y cuáles hay que cargar acá.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {opciones.map((o) => (
          <button
            key={o.via}
            type="button"
            onClick={() => onElegir(o.via)}
            className="flex items-start gap-4 rounded-xl border-2 border-slate-200 p-5 text-left transition hover:border-primary hover:bg-primary/5 dark:border-slate-700"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name={o.icono} />
            </span>
            <span>
              <span className="block font-bold text-slate-900 dark:text-white">{o.titulo}</span>
              <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{o.texto}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

/** Vía con autorización: el trámite de Autorización de pozo todavía no está en el sistema. */
function ViaAutorizacion({ onVolver, onOficio }: { onVolver: () => void; onOficio: () => void }) {
  const [numero, setNumero] = useState('')
  const [buscado, setBuscado] = useState(false)
  return (
    <Card className="flex flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="via-autorizacion" label="N.° de autorización" className="w-60">
          <Input id="via-autorizacion" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Ej: 2000" />
        </Field>
        <Button iconLeft="link" disabled={!numero} onClick={() => setBuscado(true)}>
          Vincular autorización
        </Button>
      </div>
      {buscado && (
        <Alert tone="info">
          No se encontró la autorización {numero}. El trámite de Autorización de pozo todavía no está cargado en el sistema: mientras tanto, un pozo sin autorización vinculada se registra de oficio.
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" iconLeft="arrow_back" onClick={onVolver}>
          Cambiar vía
        </Button>
        {buscado && (
          <Button iconLeft="gavel" onClick={onOficio}>
            Registrar de oficio
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Barra de pestañas: la que tiene errores se marca en rojo. */
function Pestanas({ actual, onCambiar }: { actual: number; onCambiar: (i: number) => void }) {
  const { errors } = useFormState<AltaPozoForm>()
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 md:px-6 dark:border-slate-700">
      {PESTANAS.map((p, i) => {
        const conError = !!errors[p.key]
        return (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={i === actual}
            onClick={() => onCambiar(i)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors',
              i === actual ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
              conError && 'text-red-600 dark:text-red-400',
            )}
          >
            <Icon name={conError ? 'error' : p.icono} className="text-[18px]!" />
            {p.titulo}
          </button>
        )
      })}
    </div>
  )
}

type Dialogo = { tipo: 'confirmar'; valores: AltaPozoForm } | { tipo: 'registrado'; respuesta: AltaPozoOficioRespuesta } | { tipo: 'cancelar' } | null

/**
 * Alta de pozo (prototipo pozo/AltadePozo/FormularioAltaDePozo.html). Primero se elige la vía
 * (con autorización o de oficio); de oficio se carga la ficha completa en 8 pestañas. Al guardar,
 * el sistema numera el registro, el pozo queda en el padrón y en el visor, y el expediente
 * pasa a Catastro (circuito en CircuitoPozo).
 * PROTOTIPO: funciona con el backend emulado (npm run demo).
 */
export default function AltaPozoPage() {
  const navigate = useNavigate()
  const registrar = useRegistrarPozoDeOficio()
  const [via, setVia] = useState<Via>('elegir')
  const [pestana, setPestana] = useState(0)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const form = useForm<AltaPozoForm>({ resolver: zodResolver(altaPozoSchema), defaultValues: altaPozoVacia(), mode: 'onTouched' })

  const irA = (i: number) => {
    setPestana(i)
    window.scrollTo({ top: 0 })
  }

  const pedirConfirmacion = form.handleSubmit(
    (valores) => setDialogo({ tipo: 'confirmar', valores }),
    (errores) => {
      // Se abre la primera pestaña con errores.
      const i = PESTANAS.findIndex((p) => errores[p.key])
      if (i >= 0) irA(i)
    },
  )

  async function guardar(valores: AltaPozoForm) {
    try {
      const respuesta = await registrar.mutateAsync(altaPozoADto(valores))
      setDialogo({ tipo: 'registrado', respuesta })
    } catch {
      setDialogo(null)
    }
  }

  function limpiar() {
    setDialogo(null)
    registrar.reset()
    form.reset(altaPozoVacia())
    irA(0)
  }

  const { Componente } = PESTANAS[pestana]
  const registrado = dialogo?.tipo === 'registrado' ? dialogo.respuesta : null

  return (
    <>
      <PageHeader title="Alta de pozo" description="Registro de un pozo de agua subterránea en el padrón de la DRH." />
      {!MODO_DEMO && (
        <div className="mb-4">
          <Alert tone="info">Pantalla de prototipo: el registro de pozos todavía no está en el backend. Para probarla, use el modo demo (npm run demo).</Alert>
        </div>
      )}

      {via === 'elegir' && <ElegirVia onElegir={setVia} />}
      {via === 'autorizacion' && <ViaAutorizacion onVolver={() => setVia('elegir')} onOficio={() => setVia('oficio')} />}

      {via === 'oficio' && (
        <FormProvider {...form}>
          <form noValidate onSubmit={pedirConfirmacion}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-primary/5 px-6 py-5 md:px-8 dark:border-slate-700">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ficha de alta de pozo</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Registro de oficio: sin autorización previa, todos los datos se cargan en esta ficha.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">DE OFICIO</span>
                  <Button size="sm" variant="secondary" iconLeft="arrow_back" onClick={() => setVia('elegir')}>
                    Cambiar vía
                  </Button>
                </div>
              </div>

              <Pestanas actual={pestana} onCambiar={irA} />

              <div className="flex flex-col gap-8 p-6 md:p-8">
                <Componente />
                <FormTextareaField name="observaciones" label="Observaciones" rows={3} />
                {registrar.error && <Alert>{mensajeDeError(registrar.error)}</Alert>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Pestaña {pestana + 1} de {PESTANAS.length}. Obligatorio: motivo, causante, fecha de ingreso, ubicación y coordenadas.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" variant="secondary" iconLeft="close" className="text-red-600" disabled={registrar.isPending} onClick={() => setDialogo({ tipo: 'cancelar' })}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="secondary" iconLeft="arrow_back" disabled={pestana === 0} onClick={() => irA(pestana - 1)}>
                    Anterior
                  </Button>
                  {pestana < PESTANAS.length - 1 && (
                    <Button size="sm" variant="secondary" iconRight="arrow_forward" onClick={() => irA(pestana + 1)}>
                      Siguiente
                    </Button>
                  )}
                  <Button size="sm" iconLeft="save" type="submit" loading={registrar.isPending}>
                    Registrar pozo
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        </FormProvider>
      )}

      <ConfirmDialog
        open={dialogo?.tipo === 'confirmar'}
        title="¿Registrar el pozo de oficio?"
        message={
          dialogo?.tipo === 'confirmar'
            ? `Se registrará el pozo de ${dialogo.valores.general.causante} (${dialogo.valores.general.motivo.toLowerCase()}). El sistema le asigna el número de registro y el ID interno, y queda en el padrón de pozos y en el visor.`
            : ''
        }
        confirmLabel="Sí, registrar"
        cancelLabel="Revisar"
        loading={registrar.isPending}
        onCancel={() => setDialogo(null)}
        onConfirm={() => dialogo?.tipo === 'confirmar' && void guardar(dialogo.valores)}
      />
      <ConfirmDialog
        open={!!registrado}
        tone="success"
        title="Pozo registrado"
        message={registrado ? `Registro de oficio ${registrado.expediente} · ID interno ${registrado.pozo.idInterno}. El expediente pasó a Catastro, que registra la concesión. El pozo ya se ve en el visor.` : ''}
        confirmLabel="Ver el expediente"
        cancelLabel="Registrar otro"
        onConfirm={() => registrado && navigate(ROUTES.pozo.registroExpediente(registrado.expedienteId))}
        onCancel={limpiar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === 'cancelar'}
        tone="danger"
        title="¿Cancelar la carga?"
        message="Se perderán los datos ingresados."
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir cargando"
        onConfirm={() => navigate(ROUTES.pozo.root)}
        onCancel={() => setDialogo(null)}
      />
    </>
  )
}
