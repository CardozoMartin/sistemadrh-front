import { useState } from 'react'
import { FormProvider, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/feedback/States'
import { FormSection, useFieldError } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { mensajeDeError, toApiError } from '@/services/api/errors'
import { CircuitoEmpresa } from '../components/CircuitoEmpresa'
import { EmpresaFields } from '../components/EmpresaFields'
import { MaquinaFields } from '../components/MaquinaFields'
import { useCrearEmpresa } from '../hooks'
import { datosEmpresaVacios, maquinaVacia, nombreEmpresa, normalizarCodigo } from '../reglas'
import { altaEmpresaSchema, type AltaEmpresaCampos, type AltaEmpresaForm } from '../schemas'
import type { EmpresaPerforadora } from '../types'

type Dialogo = { tipo: 'confirmar'; valores: AltaEmpresaForm } | { tipo: 'enviada'; empresa: EmpresaPerforadora } | { tipo: 'cancelar' } | { tipo: 'nuevo' } | null

const vacio = (): AltaEmpresaCampos => ({ datos: datosEmpresaVacios(), maquinas: [maquinaVacia()] })

/** «Máquinas de la empresa» del prototipo: una tarjeta por máquina, al menos una con código y foto (RN-11). */
function MaquinasAlta() {
  const maquinas = useFieldArray<AltaEmpresaCampos, 'maquinas'>({ name: 'maquinas' })
  const error = useFieldError('maquinas')
  return (
    <FormSection
      title="Maquinas de la empresa"
      icon="precision_manufacturing"
      variant="boxed"
      description="Registra las maquinas excavadoras o perforadoras con su codigo alfanumerico de referencia."
      actions={
        <Button size="sm" iconLeft="add_photo_alternate" onClick={() => maquinas.append(maquinaVacia())}>
          Agregar maquina
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {maquinas.fields.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface-dark">
            <MaquinaFields prefix={`maquinas.${i}`} />
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" iconLeft="delete" className="text-red-600" disabled={maquinas.fields.length === 1} title={maquinas.fields.length === 1 ? 'Debe quedar al menos una máquina (RN-11)' : undefined} onClick={() => maquinas.remove(i)}>
                Quitar maquina
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </FormSection>
  )
}

/**
 * Alta de empresa perforadora con los campos y el orden del prototipo
 * pozo/AgregarEmpresa/AgregarEmpresa.html, en dos pasos (1. datos de la empresa,
 * 2. máquinas). Al guardar pasa a Jurídico y después a Secretaría General, que emite la
 * resolución que la habilita.
 */
export default function NuevaEmpresaPage() {
  const navigate = useNavigate()
  const crear = useCrearEmpresa()
  const [paso, setPaso] = useState(0)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const form = useForm<AltaEmpresaCampos, unknown, AltaEmpresaForm>({
    resolver: zodResolver(altaEmpresaSchema),
    defaultValues: vacio(),
    mode: 'onTouched',
  })

  function irA(i: number) {
    setPaso(i)
    window.scrollTo({ top: 0 })
  }

  function limpiar() {
    setDialogo(null)
    crear.reset()
    form.reset(vacio())
    irA(0)
  }

  // Paso 1 → 2: solo se validan los datos de la empresa (flujo 7.1: resalta los faltantes).
  async function siguiente() {
    if (await form.trigger('datos', { shouldFocus: true })) irA(1)
  }

  const pedirConfirmacion = form.handleSubmit(
    (valores) => setDialogo({ tipo: 'confirmar', valores }),
    (errores) => {
      if (errores.datos) irA(0)
    },
  )

  async function guardar(valores: AltaEmpresaForm) {
    try {
      const empresa = await crear.mutateAsync({ datos: valores.datos, maquinas: valores.maquinas })
      setDialogo({ tipo: 'enviada', empresa })
    } catch (e) {
      setDialogo(null)
      const { code, message } = toApiError(e)
      if (code === 'CUIT_EXISTENTE') {
        irA(0)
        form.setError('datos.cuit', { message }, { shouldFocus: true })
      }
      if (code === 'CODIGO_EXISTENTE') {
        // Se marca la máquina que tiene el código repetido.
        const i = valores.maquinas.findIndex((m) => message.includes(normalizarCodigo(m.codigo)))
        if (i >= 0) form.setError(`maquinas.${i}.codigo`, { message }, { shouldFocus: true })
      }
    }
  }

  const error = crear.error && !['CUIT_EXISTENTE', 'CODIGO_EXISTENTE'].includes(toApiError(crear.error).code ?? '') ? crear.error : null
  const confirmando = dialogo?.tipo === 'confirmar' ? dialogo.valores : null
  const enviada = dialogo?.tipo === 'enviada' ? dialogo.empresa : null

  return (
    <>
      <div className="flex flex-col gap-6">
        <CircuitoEmpresa pasoCarga={paso} />

        <FormProvider {...form}>
          <form noValidate onSubmit={pedirConfirmacion}>
            <Card className="overflow-hidden">
              {/* Encabezado del prototipo: título, estado y Buscar Resolución */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-primary/5 px-6 py-5 md:px-8 dark:border-slate-700">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alta de empresa perforadora</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Carga integral de datos comerciales, tecnicos y parque de maquinas de la empresa.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-3 rounded-lg border border-primary/20 bg-white px-4 py-2 dark:bg-surface-dark">
                    <Icon name="factory" className="text-primary" />
                    <span className="leading-tight">
                      <span className="block text-[11px] font-semibold tracking-wide text-primary uppercase">Estado</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Nueva empresa</span>
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" iconLeft="manage_search" disabled title="La resolución la emite y vincula Secretaría General al final del circuito">
                    Buscar Resolucion
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-8 p-6 md:p-8">
                {paso === 0 ? <EmpresaFields prefix="datos" /> : <MaquinasAlta />}
                {!!error && <Alert>{mensajeDeError(error)}</Alert>}
              </div>

              {/* Pie del prototipo: aviso + Nuevo / Cancelar / Guardar empresa */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-sm text-slate-500 dark:text-slate-400">Completa la informacion obligatoria antes de guardar la empresa.</p>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" variant="secondary" iconLeft="add_circle" disabled={crear.isPending} onClick={() => setDialogo({ tipo: 'nuevo' })}>
                    Nuevo
                  </Button>
                  <Button size="sm" variant="secondary" iconLeft="close" className="text-red-600" disabled={crear.isPending} onClick={() => setDialogo({ tipo: 'cancelar' })}>
                    Cancelar
                  </Button>
                  {paso === 1 && (
                    <Button size="sm" variant="secondary" iconLeft="arrow_back" disabled={crear.isPending} onClick={() => irA(0)}>
                      Anterior
                    </Button>
                  )}
                  {paso === 0 ? (
                    <Button size="sm" iconRight="arrow_forward" onClick={() => void siguiente()}>
                      Siguiente — Maquinas
                    </Button>
                  ) : (
                    <Button size="sm" iconLeft="save" type="submit" loading={crear.isPending}>
                      Guardar empresa
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </form>
        </FormProvider>
      </div>

      {/* Pasos 10-11 del CU: autorización previa de la carga. */}
      <ConfirmDialog
        open={!!confirmando}
        title="¿Guardar la empresa?"
        message={
          confirmando
            ? `Se registrará ${nombreEmpresa(confirmando.datos)} (CUIT ${confirmando.datos.cuit}) con ${confirmando.maquinas.length} máquina${confirmando.maquinas.length === 1 ? '' : 's'} y pasará a Jurídico para el dictamen. Queda pendiente la carga de la resolución (Secretaría General).`
            : ''
        }
        confirmLabel="Sí, guardar y enviar a Jurídico"
        cancelLabel="Revisar"
        loading={crear.isPending}
        onCancel={() => setDialogo(null)}
        onConfirm={() => confirmando && void guardar(confirmando)}
      />
      <ConfirmDialog
        open={!!enviada}
        tone="success"
        title="Empresa guardada"
        message={`${enviada ? nombreEmpresa(enviada) : ''} quedó registrada y en la bandeja de Jurídico. Queda pendiente la carga de la resolución: después del dictamen la emite Secretaría General.`}
        confirmLabel="Ver la ficha"
        cancelLabel="Cargar otra"
        onConfirm={() => enviada && navigate(ROUTES.pozo.empresa(enviada.id))}
        onCancel={limpiar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === 'nuevo'}
        title="¿Empezar una carga nueva?"
        message="Se limpiará el formulario y se perderán los datos ingresados."
        confirmLabel="Sí, limpiar"
        cancelLabel="Seguir cargando"
        onConfirm={limpiar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo?.tipo === 'cancelar'}
        tone="danger"
        title="¿Cancelar la carga?"
        message="Se perderán los datos ingresados."
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir cargando"
        onConfirm={() => navigate(ROUTES.pozo.empresas)}
        onCancel={() => setDialogo(null)}
      />
    </>
  )
}
