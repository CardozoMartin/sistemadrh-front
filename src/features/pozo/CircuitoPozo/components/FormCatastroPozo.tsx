import { useState } from 'react'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { FormMaskedField, FormSection, FormSelectField, FormTextField, toOptions } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { soloDigitos } from '@/lib/mascaras'
import { mensajeDeError } from '@/services/api/errors'
import { Observaciones } from '@/features/tramites/shared/circuito/campos'
import { registroPozoApi, useAccionRegistro, type Resultado } from '../api'
import { USOS_CONCESION } from '../caudales'
import { CARACTERES_TITULAR, type DatosCatastroPozo, type RegistroPozoBackend } from '../types'
import { PanelCaudales } from './ResumenRegistro'

interface Form {
  tipoConcesion: string
  numeroConcesion: string
  rigeDesde: string
  rigeHasta: string
  titulares: { documento: string; nombre: string; domicilio: string; caracter: string }[]
  catastral: { padron: string; circunscripcion: string; seccion: string; lamina: string; parcela: string; matricula: string; orden: string }
  dominio: { matricula: string; libro: string; folio: string; serie: string; anio: string }
  estadoPozo: string
  uso: string
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const nulo = (v: string) => (v.trim() ? v.trim() : null)

function aForm(r: RegistroPozoBackend): Form {
  const c = r.catastro
  const f = r.ficha
  return {
    tipoConcesion: t(c?.tipoConcesion),
    numeroConcesion: t(c?.numeroConcesion),
    rigeDesde: t(c?.rigeDesde),
    rigeHasta: t(c?.rigeHasta),
    // Sin datos de Catastro, se propone al causante del alta como titular.
    titulares: c?.titulares.map((x) => ({ documento: x.documento, nombre: x.nombre, domicilio: t(x.domicilio), caracter: x.caracter })) ?? [
      { documento: t(f.documento), nombre: f.causante, domicilio: t(f.domicilio), caracter: 'TITULAR' },
    ],
    catastral: { padron: t(c?.catastral.padron), circunscripcion: t(c?.catastral.circunscripcion), seccion: t(c?.catastral.seccion), lamina: t(c?.catastral.lamina), parcela: t(c?.catastral.parcela), matricula: t(c?.catastral.matricula), orden: t(c?.catastral.orden) },
    dominio: { matricula: t(c?.dominio.matricula), libro: t(c?.dominio.libro), folio: t(c?.dominio.folio), serie: t(c?.dominio.serie), anio: t(c?.dominio.anio) },
    estadoPozo: c?.estadoPozo ?? f.estado,
    uso: t(c?.uso),
  }
}

function aDto(v: Form): DatosCatastroPozo {
  const n = <T extends Record<string, string>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, nulo(x)])) as { [K in keyof T]: string | null }
  return {
    tipoConcesion: (nulo(v.tipoConcesion) as DatosCatastroPozo['tipoConcesion']) ?? null,
    numeroConcesion: nulo(v.numeroConcesion),
    rigeDesde: nulo(v.rigeDesde),
    rigeHasta: nulo(v.rigeHasta),
    titulares: v.titulares.filter((x) => x.documento || x.nombre).map((x) => ({ documento: x.documento, nombre: x.nombre, domicilio: nulo(x.domicilio), caracter: x.caracter as DatosCatastroPozo['titulares'][number]['caracter'] })),
    catastral: n(v.catastral),
    dominio: { ...n({ matricula: v.dominio.matricula, libro: v.dominio.libro, folio: v.dominio.folio, serie: v.dominio.serie }), anio: v.dominio.anio ? Number(v.dominio.anio) : null },
    estadoPozo: v.estadoPozo as DatosCatastroPozo['estadoPozo'],
    uso: (nulo(v.uso) as DatosCatastroPozo['uso']) ?? null,
  }
}

/**
 * Catastro registra la concesión del pozo (prototipo pozo/Circuito/catastroPozo.html): tipo,
 * número (de su libro de concesiones), vigencia, titulares, nomenclatura catastral, dominio, uso
 * de la concesión y caudales. Lo que viene del alta es de solo lectura (ver la ficha abajo).
 */
export function FormCatastroPozo({ r }: { r: RegistroPozoBackend }) {
  const form = useForm<Form>({ defaultValues: aForm(r) })
  const titulares = useFieldArray({ control: form.control, name: 'titulares' })
  const uso = useWatch({ control: form.control, name: 'uso' })
  const jurisdiccion = r.ficha.jurisdiccionDrh
  const [observaciones, setObservaciones] = useState('')
  const [confirmarRechazo, setConfirmarRechazo] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const guardar = useAccionRegistro(r.expediente.id, registroPozoApi.guardarCatastro)
  const resolver = useAccionRegistro(r.expediente.id, async (id, dto: { resultado: Resultado; observaciones?: string }) => {
    // Al aprobar se guarda primero lo cargado (el servidor controla que esté completo).
    if (dto.resultado === 'APTO') await registroPozoApi.guardarCatastro(id, aDto(form.getValues()))
    return registroPozoApi.catastro(id, dto)
  })
  const error = guardar.error ?? resolver.error

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-8">
        {!jurisdiccion && <Alert tone="info">El pozo no es de jurisdicción DRH: se registra pero no genera concesión. Alcanza con el uso y los titulares.</Alert>}

        <FormSection title="Concesión" icon="map">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <FormSelectField name="tipoConcesion" label="Tipo de concesión" placeholder="Sin definir" options={toOptions(['DEFINITIVO', 'PROVISORIA'])} />
            <FormMaskedField name="numeroConcesion" label="N.° de concesión" mask={soloDigitos} inputMode="numeric" hint={`Siguiente libre: ${r.numeroSugerido}. Solo Catastro lo asigna.`} />
            <FormTextField name="rigeDesde" label="Rige desde" type="date" />
            <FormTextField name="rigeHasta" label="Hasta" type="date" hint="Vacío: sin vencimiento." />
          </div>
        </FormSection>

        <FormSection
          title="Titulares"
          icon="group"
          description="Se propone al causante del alta; corrija o agregue los que figuren en la documentación."
          actions={
            <Button size="sm" variant="secondary" iconLeft="person_add" onClick={() => titulares.append({ documento: '', nombre: '', domicilio: '', caracter: 'TITULAR' })}>
              Agregar a la lista
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {titulares.fields.map((x, i) => (
              <div key={x.id} className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_1.5fr_1.5fr_1fr_auto]">
                <FormMaskedField name={`titulares.${i}.documento`} label="Doc. o CUIT" mask={soloDigitos} maxLength={11} inputMode="numeric" />
                <FormTextField name={`titulares.${i}.nombre`} label="Nombre o razón social" />
                <FormTextField name={`titulares.${i}.domicilio`} label="Domicilio" />
                <FormSelectField name={`titulares.${i}.caracter`} label="Carácter" options={toOptions(CARACTERES_TITULAR)} />
                <IconButton icon="delete" label="Quitar titular" tone="danger" className="md:mt-7" onClick={() => titulares.remove(i)} />
              </div>
            ))}
            {!titulares.fields.length && <p className="text-sm text-slate-500">Sin titulares cargados.</p>}
          </div>
        </FormSection>

        <FormSection title="Nomenclatura catastral y dominio" icon="description">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
            {(['padron', 'circunscripcion', 'seccion', 'lamina', 'parcela', 'matricula', 'orden'] as const).map((k) => (
              <FormTextField key={k} name={`catastral.${k}`} label={{ padron: 'Padrón', circunscripcion: 'Circunscripción', seccion: 'Sección', lamina: 'Lámina / manzana', parcela: 'Parcela', matricula: 'Matrícula', orden: 'Orden' }[k]} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
            <FormTextField name="dominio.matricula" label="Matrícula reg. inmobiliario" />
            <FormTextField name="dominio.libro" label="Libro" />
            <FormTextField name="dominio.folio" label="Folio" />
            <FormTextField name="dominio.serie" label="Serie" />
            <FormMaskedField name="dominio.anio" label="Año" mask={soloDigitos} maxLength={4} inputMode="numeric" />
          </div>
        </FormSection>

        <FormSection title="Uso y caudales" icon="water">
          <div className="mb-4 grid grid-cols-1 gap-6 md:grid-cols-3">
            <FormSelectField
              name="estadoPozo"
              label="Estado del pozo"
              options={[
                { value: 'EN_USO', label: 'En uso' },
                { value: 'PARADO', label: 'Parado' },
                { value: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio (sin cobro)' },
              ]}
              hint="Define si el pozo genera cobro."
            />
            <FormSelectField name="uso" label="Uso de la concesión" placeholder="Sin definir" options={toOptions(USOS_CONCESION)} hint="Común (consumo humano), riego y otros, industrial A o B." />
          </div>
          <PanelCaudales caudalM3h={r.caudalM3h} regimenM3h={r.regimenM3h} uso={uso || null} />
        </FormSection>

        <Observaciones valor={observaciones} onChange={setObservaciones} placeholder="Obligatorio para observar o rechazar" />
        {error && <Alert>{mensajeDeError(error)}</Alert>}
        {guardado && !guardar.isPending && !error && <Alert tone="info">Borrador guardado.</Alert>}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" iconLeft="cancel" className="text-red-600" disabled={!observaciones.trim()} title={!observaciones.trim() ? 'Escriba el motivo en las observaciones' : undefined} onClick={() => setConfirmarRechazo(true)}>
            Rechazar
          </Button>
          <Button variant="secondary" iconLeft="save" loading={guardar.isPending} onClick={() => guardar.mutate(aDto(form.getValues()), { onSuccess: () => setGuardado(true) })}>
            Guardar borrador
          </Button>
          <Button variant="secondary" iconLeft="error" disabled={!observaciones.trim()} loading={resolver.isPending && resolver.variables?.resultado === 'OBSERVADO'} onClick={() => resolver.mutate({ resultado: 'OBSERVADO', observaciones })}>
            Observar (vuelve a Pozos)
          </Button>
          <Button iconRight="arrow_forward" loading={resolver.isPending && resolver.variables?.resultado === 'APTO'} onClick={() => resolver.mutate({ resultado: 'APTO', observaciones: observaciones || undefined })}>
            Aprobar y enviar a Distrito
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmarRechazo}
        tone="danger"
        title="¿Rechazar el registro?"
        message="El trámite termina: el pozo queda registrado pero no se otorga la concesión. No se puede deshacer."
        confirmLabel="Sí, rechazar"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmarRechazo(false)
          resolver.mutate({ resultado: 'NO_APTO', observaciones })
        }}
        onCancel={() => setConfirmarRechazo(false)}
      />
    </FormProvider>
  )
}
