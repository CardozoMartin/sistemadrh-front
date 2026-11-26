import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatearFecha } from '@/config/expedientes'
import { mensajeDeError } from '@/services/api/errors'
import { Campo } from '../../../shared/circuito/campos'
import type { CambioBackend } from '../../backend.types'
import { faltaEnCierre } from '../../cierre'
import { nombres, numeroConcesion } from '../../../shared/formato'
import { useVerificacionFinalCambio } from '../../hooks'
import { ResumenEnvio } from '../../../shared/circuito/ResumenEnvio'
import type { Terminado } from '../../../shared/circuito/terminado'

/**
 * Catastro, verificación final (paso 40 / «Trámites pendientes»): coteja la resolución con los datos
 * del nuevo titular y finaliza. Recién acá la concesión cambia de titular: los anteriores quedan en
 * el historial de la concesión, con la fecha de la resolución. No se puede deshacer.
 */
export function CierreCambio({ datos, onTerminado }: { datos: CambioBackend; onTerminado: (t: Terminado) => void }) {
  const finalizar = useVerificacionFinalCambio(datos.expediente.id)
  const [cotejado, setCotejado] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const { cambio, expediente } = datos
  const r = cambio.resolucion
  const falta = faltaEnCierre({ conResolucion: !!r, cotejado })
  const concesion = numeroConcesion(cambio.concesion)

  function enviar() {
    setConfirmar(false)
    if (falta) return
    finalizar.mutate(observaciones.trim() || undefined, {
      onSuccess: (res) =>
        onTerminado({
          titulo: 'Trámite finalizado',
          mensaje: `La concesión ${concesion} pasó a ${nombres(res.cambio.titularesActuales)}. ${nombres(res.cambio.titularesAnteriores) || 'El titular anterior'} queda en el historial de la concesión.`,
        }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Todas las oficinas dieron el visto bueno y Secretaría cargó la resolución. Cotéjela (el PDF está abajo, en «Verificación de datos») con los datos del nuevo titular y
        finalice: recién ahí la concesión cambia de titular.
      </p>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={cotejado} onChange={(e) => setCotejado(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        Cotejé la resolución con los datos del nuevo titular y la documentación del expediente.
      </label>

      <Campo etiqueta="Observaciones">
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Si hace falta aclarar algo" className={controlClass({ className: 'resize-y' })} />
      </Campo>

      {falta && (r ? <p className="text-xs text-slate-500 dark:text-slate-400">{falta}</p> : <Alert>{falta}</Alert>)}
      {finalizar.error && <Alert>{mensajeDeError(finalizar.error)}</Alert>}
      <div>
        <Button iconRight="task_alt" loading={finalizar.isPending} disabled={!!falta || finalizar.isPending} onClick={() => setConfirmar(true)}>
          Finalizar trámite
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone="info"
        title="¿Finalizar el cambio de titularidad?"
        message="La concesión pasa al nuevo titular desde la fecha de la resolución. No se puede deshacer."
        confirmLabel="Sí, finalizar"
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Concesión', concesion],
            ['Titular actual', nombres(cambio.titularesActuales) || null],
            ['Nuevo titular', nombres(cambio.nuevosTitulares) || null],
            ['Resolución', r ? `${r.numero} (firmada el ${formatearFecha(r.fecha)})` : null],
            ['Observaciones', observaciones.trim() || null],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
