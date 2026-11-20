import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatearFecha } from '@/config/expedientes'
import { mensajeDeError } from '@/services/api/errors'
import { Campo } from '../../AltaDeConcesion/components/circuito/AccionesOficina'
import { nombres, numeroConcesion } from '../../CambioDeTitularidad/formato'
import { ResumenEnvio } from '../../shared/circuito/ResumenEnvio'
import type { Terminado } from '../../shared/circuito/terminado'
import type { AnulacionBackend } from '../backend.types'
import { faltaEnBaja, mensajeBaja } from '../formato'
import { useVerificacionFinalAnulacion } from '../hooks'

/**
 * Catastro, baja (visto bueno final): coteja la resolución con los datos de la concesión y el motivo
 * y finaliza. Recién acá la concesión queda ANULADA (no se borra nada: queda en el historial).
 * No se puede deshacer.
 */
export function CierreAnulacion({ datos, onTerminado }: { datos: AnulacionBackend; onTerminado: (t: Terminado) => void }) {
  const finalizar = useVerificacionFinalAnulacion(datos.expediente.id)
  const [cotejado, setCotejado] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const { anulacion, expediente } = datos
  const r = anulacion.resolucion
  const falta = faltaEnBaja({ conResolucion: !!r, cotejado })
  const concesion = numeroConcesion(anulacion.concesion)

  function enviar() {
    setConfirmar(false)
    if (falta) return
    finalizar.mutate(observaciones.trim() || undefined, {
      onSuccess: () =>
        onTerminado({
          titulo: 'Trámite finalizado',
          mensaje: mensajeBaja({ concesion, expediente: expediente.numero, fechaResolucion: r?.fecha ?? null }),
        }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Todas las oficinas dieron el visto bueno y Secretaría cargó la resolución. Cotéjela (el PDF está abajo, en «Verificación de datos») con los datos de la concesión y el
        motivo, y dé la baja: recién ahí la concesión queda anulada.
      </p>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={cotejado} onChange={(e) => setCotejado(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        Cotejé la resolución con los datos de la concesión, el motivo y la documentación del expediente.
      </label>

      <Campo etiqueta="Observaciones">
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Si hace falta aclarar algo" className={controlClass({ className: 'resize-y' })} />
      </Campo>

      {falta && (r ? <p className="text-xs text-slate-500 dark:text-slate-400">{falta}</p> : <Alert>{falta}</Alert>)}
      {finalizar.error && <Alert>{mensajeDeError(finalizar.error)}</Alert>}
      <div>
        <Button variant="danger" iconRight="block" loading={finalizar.isPending} disabled={!!falta || finalizar.isPending} onClick={() => setConfirmar(true)}>
          Dar de baja la concesión
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Anular la concesión?"
        message="La concesión queda anulada desde la fecha de la resolución y la anulación finaliza. No se puede deshacer."
        confirmLabel="Sí, anular"
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Concesión', concesion],
            ['Titular', nombres(anulacion.titulares) || null],
            ['Motivo', anulacion.motivo],
            ['Resolución', r ? `${r.numero} (firmada el ${formatearFecha(r.fecha)})` : null],
            ['Observaciones', observaciones.trim() || null],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
