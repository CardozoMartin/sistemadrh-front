import { useState } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatearFecha } from '@/config/expedientes'
import { mensajeDeError } from '@/services/api/errors'
import { Campo } from '../../../shared/circuito/campos'
import { numeroConcesion } from '../../../shared/formato'
import { ResumenEnvio } from '../../../shared/circuito/ResumenEnvio'
import type { Terminado } from '../../../shared/circuito/terminado'
import type { ReubicacionBackend } from '../../backend.types'
import { caminoSuministro, faltaEnCierre, hectareas, mensajeCierre, textoPunto } from '../../formato'
import { useVerificacionFinalReubicacion } from '../../hooks'

/**
 * Catastro, cierre (visto bueno final): coteja la resolución con lo propuesto y finaliza. Recién acá
 * el nuevo lugar y la forma de servicio rigen en la concesión, desde la fecha de la resolución. Lo
 * anterior queda en el historial. No se puede deshacer.
 */
export function CierreReubicacion({ datos, onTerminado }: { datos: ReubicacionBackend; onTerminado: (t: Terminado) => void }) {
  const finalizar = useVerificacionFinalReubicacion(datos.expediente.id)
  const [cotejado, setCotejado] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const { reubicacion, expediente } = datos
  const r = reubicacion.resolucion
  const falta = faltaEnCierre({ conResolucion: !!r, cotejado })
  const concesion = numeroConcesion(reubicacion.concesion)
  const { propuesta } = reubicacion

  function enviar() {
    setConfirmar(false)
    if (falta) return
    finalizar.mutate(observaciones.trim() || undefined, {
      onSuccess: () => onTerminado({ titulo: 'Trámite finalizado', mensaje: mensajeCierre({ concesion, expediente: expediente.numero, fechaResolucion: r?.fecha ?? null }) }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Todas las oficinas dieron el visto bueno y Secretaría cargó la resolución. Cotéjela (el PDF está abajo, en «La reubicación») con el nuevo lugar y la forma de servicio,
        y cierre: recién ahí rigen en la concesión. El lugar y la forma de servicio actuales quedan en el historial.
      </p>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={cotejado} onChange={(e) => setCotejado(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        Cotejé la resolución con el nuevo lugar, la forma de servicio y la documentación del expediente.
      </label>

      <Campo etiqueta="Observaciones">
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Si hace falta aclarar algo" className={controlClass({ className: 'resize-y' })} />
      </Campo>

      {falta && (r ? <p className="text-xs text-slate-500 dark:text-slate-400">{falta}</p> : <Alert>{falta}</Alert>)}
      {finalizar.error && <Alert>{mensajeDeError(finalizar.error)}</Alert>}
      <div>
        <Button iconRight="task_alt" loading={finalizar.isPending} disabled={!!falta || finalizar.isPending} onClick={() => setConfirmar(true)}>
          Aplicar la reubicación
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        title="¿Aplicar la reubicación?"
        message="El nuevo lugar y la forma de servicio rigen en la concesión desde la fecha de la resolución, y la reubicación finaliza. No se puede deshacer."
        confirmLabel="Sí, aplicar"
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Concesión', concesion],
            ['Motivo', reubicacion.motivoTexto],
            ['Nueva superficie', propuesta.poligono ? hectareas(propuesta.poligono.superficieHa) : null],
            ['Suministro', propuesta.servicio ? caminoSuministro(propuesta.servicio.suministro) : null],
            ['Punto de entrega', propuesta.servicio?.puntoEntrega ? textoPunto(propuesta.servicio.puntoEntrega) : 'sin cambios'],
            ['Resolución', r ? `${r.numero} (firmada el ${formatearFecha(r.fecha)})` : null],
            ['Observaciones', observaciones.trim() || null],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
