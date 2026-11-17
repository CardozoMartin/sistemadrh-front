import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { esFechaFutura } from '@/lib/validaciones'
import { mensajeDeError } from '@/services/api/errors'
import { aNumero } from '../../AltaDePozo/calculos'
import { PestanaHidraulicos } from '../../AltaDePozo/components/PestanaHidraulicos'
import { PestanaQuimica } from '../../AltaDePozo/components/PestanaQuimica'
import { altaPozoVacia, type AltaPozoForm } from '../../AltaDePozo/schemas'
import { NOMBRE_TIPO, useRegistrarMonitoreo, type DatosHidraulicos, type Monitoreo, type TipoMonitoreo } from '../monitoreos'

const hoy = () => new Date().toISOString().slice(0, 10)

/** El recién registrado: el de ese tipo cargado último (puede tener una fecha vieja). */
const nuevoDe = (lista: Monitoreo[], tipo: TipoMonitoreo) => lista.filter((m) => m.tipo === tipo).sort((a, b) => b.registrado.localeCompare(a.registrado))[0]

/** Arranca con el equipo y el régimen del último hidráulico (suelen repetirse); los niveles y el caudal se miden de nuevo. */
function inicial(ultimo: Monitoreo | undefined): AltaPozoForm {
  const f = altaPozoVacia()
  const d = (ultimo?.datos ?? {}) as unknown as DatosHidraulicos
  const t = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
  f.hidraulico = { ...f.hidraulico, fecha: hoy(), profundidadBomba: t(d.profundidadBomba), nivelCementacion: t(d.nivelCementacion), tipoBomba: d.tipoBomba ?? '' }
  f.quimico.fecha = hoy()
  return f
}

/**
 * Registrar un monitoreo nuevo del pozo (botón «Registrar monitoreo» del prototipo). Usa las
 * mismas pestañas que el alta: el ensayo de bombeo con sus derivados, o el informe químico.
 * La fecha es la de la medición: puede ser anterior a hoy.
 */
export function RegistrarMonitoreo({ pozoId, tipo, ultimoHidraulico, onCerrar }: { pozoId: string; tipo: TipoMonitoreo; ultimoHidraulico?: Monitoreo; onCerrar: (registrado?: Monitoreo, lista?: Monitoreo[]) => void }) {
  const form = useForm<AltaPozoForm>({ defaultValues: inicial(ultimoHidraulico) })
  const registrar = useRegistrarMonitoreo(pozoId)
  const [error, setError] = useState<string | null>(null)

  function guardar() {
    const v = form.getValues()
    setError(null)
    if (tipo === 'hidraulico') {
      const h = v.hidraulico
      if (!h.fecha) return setError('Ingrese la fecha del monitoreo (la de la medición).')
      if (esFechaFutura(h.fecha)) return setError('La fecha no puede ser futura.')
      const datos = {
        nivelEstatico: aNumero(h.nivelEstatico),
        nivelDinamico: aNumero(h.nivelDinamico),
        caudalM3h: aNumero(h.caudalM3h),
        regimenM3h: aNumero(h.regimenEditado ? h.regimenM3h : h.caudalM3h),
        profundidadBomba: aNumero(h.profundidadBomba),
        nivelCementacion: aNumero(h.nivelCementacion),
        tipoBomba: h.tipoBomba.trim() || null,
      }
      if (datos.nivelEstatico === null && datos.nivelDinamico === null && datos.caudalM3h === null) return setError('Cargue al menos un dato hidráulico (niveles o caudal).')
      registrar.mutate({ tipo, fecha: h.fecha, datos }, { onSuccess: (r) => onCerrar(nuevoDe(r.monitoreos, tipo), r.monitoreos) })
    } else {
      const q = v.quimico
      if (!q.fecha) return setError('Ingrese la fecha del informe del laboratorio.')
      if (esFechaFutura(q.fecha)) return setError('La fecha no puede ser futura.')
      if (!q.parametros.length) return setError('Agregue al menos un parámetro al informe.')
      registrar.mutate({ tipo, fecha: q.fecha, datos: { parametros: q.parametros } }, { onSuccess: (r) => onCerrar(nuevoDe(r.monitoreos, tipo), r.monitoreos) })
    }
  }

  return (
    <Modal
      open
      size="xl"
      icon={NOMBRE_TIPO[tipo].icono}
      title={tipo === 'hidraulico' ? 'Registrar monitoreo hidráulico' : 'Registrar informe químico'}
      description="Queda en el historial con la fecha de la medición. No reemplaza a los anteriores: se compara contra el último."
      onClose={() => onCerrar()}
      bloqueado={registrar.isPending}
      footer={
        <>
          <Button variant="secondary" disabled={registrar.isPending} onClick={() => onCerrar()}>
            Cancelar
          </Button>
          <Button iconLeft="bookmark_add" loading={registrar.isPending} onClick={guardar}>
            Registrar monitoreo
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <div className="flex flex-col gap-6">
          {tipo === 'hidraulico' ? <PestanaHidraulicos /> : <PestanaQuimica />}
          {(error || registrar.error) && <Alert>{error ?? mensajeDeError(registrar.error)}</Alert>}
        </div>
      </FormProvider>
    </Modal>
  )
}
