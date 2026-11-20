import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { mensajeDeError } from '@/services/api/errors'
import { Observaciones } from '../../AltaDeConcesion/components/circuito/AccionesOficina'
import type { HooksRecaudacion } from './PanelRecaudacion'
import { SIGUIENTE_A_RECAUDACION as SIGUIENTE } from './recaudacion'
import type { Terminado } from './terminado'

/** Largo mínimo de la nota (igual que el backend). */
const MINIMO_NOTA = 10

/** En espera y no se pudo cobrar: pasa igual a Distrito con una nota de por qué (la deuda sigue registrada). */
export function CursoConDeudaPanel({ expedienteId, numero, hooks, onTerminado }: { expedienteId: string; numero: string; hooks: HooksRecaudacion; onTerminado: (t: Terminado) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const accion = hooks.useCursoConDeuda(expedienteId)
  const corta = nota.trim().length < MINIMO_NOTA

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">¿No se pudo cobrar?</span> Puede darle curso igual con una nota de por qué; la deuda sigue registrada.
        </p>
        <Button size="sm" variant="secondary" iconLeft="forward" onClick={() => setAbierto(true)}>
          Dar curso con deuda
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/5">
      <Observaciones valor={nota} onChange={setNota} obligatorio placeholder="Por qué se le da curso sin cobrar" />
      {nota && corta && <p className="text-xs font-medium text-red-600 dark:text-red-400">Explique el motivo (al menos {MINIMO_NOTA} caracteres).</p>}
      {accion.error && <Alert>{mensajeDeError(accion.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button iconRight="send" disabled={corta} loading={accion.isPending} onClick={() => setConfirmar(true)}>
          Pasar a {SIGUIENTE} con deuda
        </Button>
        <Button variant="secondary" disabled={accion.isPending} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        title="¿Dar curso con deuda?"
        message={`El expediente pasa a ${SIGUIENTE} con la deuda pendiente. Las demás oficinas van a ver el aviso y su nota.`}
        confirmLabel="Sí, pasar con deuda"
        cancelLabel="Volver"
        onConfirm={() => {
          setConfirmar(false)
          accion.mutate(nota.trim(), {
            onSuccess: () => onTerminado({ titulo: 'Trámite enviado con deuda', mensaje: `El expediente ${numero} fue enviado a ${SIGUIENTE} con la deuda pendiente y su nota.` }),
          })
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}
