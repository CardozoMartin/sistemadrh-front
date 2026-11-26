import { useState, type ReactNode } from 'react'
import { Alert } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatearFecha } from '@/config/expedientes'
import { mensajeDeError } from '@/services/api/errors'
import { Campo } from '../../AltaDeConcesion/components/circuito/AccionesOficina'
import { ResumenEnvio } from '../../shared/circuitoBackend/componentes'
import { useVerificacionFinal } from '../../shared/circuitoBackend/contexto'
import { hectareas, litrosPorSegundo, nombres, numeroConcesion } from '../../shared/circuitoBackend/reglas'
import type { Terminado } from '../../shared/circuitoBackend/tipos'
import { NOMBRE_TIPO, type ModificacionBackend } from '../backend.types'

/** Qué falta para poder finalizar (null: se puede). */
export function faltaEnCierre({ conResolucion, cotejado }: { conResolucion: boolean; cotejado: boolean }): string | null {
  if (!conResolucion) return 'Falta la resolución de Secretaría General.'
  if (!cotejado) return 'Confirme que cotejó la resolución con el plano y los datos del trámite.'
  return null
}

/** «12,5» o «12.5» → 12.5. null si no es un número mayor que cero con hasta 3 decimales. */
export function leerCaudal(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(limpio)) return null
  const n = Number(limpio)
  return n > 0 ? n : null
}

/** Tarjeta «antes → después». */
function Tarjeta({ etiqueta, antes, children }: { etiqueta: string; antes: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{etiqueta}</p>
      <p className="text-sm text-slate-500 tabular-nums line-through dark:text-slate-400">{antes}</p>
      {children}
    </div>
  )
}

/**
 * Catastro, verificación final: coteja la resolución con el plano, los usos y el caudal y finaliza.
 * El caudal asignado es editable, como en el alta: viene con el calculado (nueva superficie y usos)
 * y se carga el que fijó la resolución (lo deciden los jefes). Recién acá la concesión queda con la
 * nueva superficie y ese caudal (lo anterior queda en su historial, con la fecha de la resolución).
 * El backend vuelve a controlar que el plano no pise otra concesión.
 */
export function CierreModificacion({ datos, onTerminado }: { datos: ModificacionBackend; onTerminado: (t: Terminado) => void }) {
  const finalizar = useVerificacionFinal(datos.expediente.id)
  const { modificacion: m, expediente } = datos
  const [cotejado, setCotejado] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [caudalTexto, setCaudalTexto] = useState(m.caudal.nuevoLps === null ? '' : String(m.caudal.nuevoLps))
  const [confirmar, setConfirmar] = useState(false)
  const r = m.resolucion
  const caudal = leerCaudal(caudalTexto)
  const falta = faltaEnCierre({ conResolucion: !!r, cotejado }) ?? (caudal === null ? 'Ingrese el caudal asignado que fija la resolución (en l/s, mayor que cero, hasta 3 decimales).' : null)
  const concesion = numeroConcesion(m.concesion)
  const nueva = m.superficie.nuevaHa === null ? '—' : hectareas(m.superficie.nuevaHa)
  const actual = m.caudal.actualLps === null ? 'No registrado' : litrosPorSegundo(m.caudal.actualLps)
  const calculado = m.caudal.nuevoLps === null ? 'sin calcular' : litrosPorSegundo(m.caudal.nuevoLps)

  function enviar() {
    setConfirmar(false)
    if (falta || caudal === null) return
    finalizar.mutate(
      { observaciones: observaciones.trim() || undefined, caudalAsignadoLps: caudal },
      {
        onSuccess: () =>
          onTerminado({
            titulo: 'Trámite finalizado',
            mensaje: `La concesión ${concesion} quedó con ${nueva} y un caudal asignado de ${litrosPorSegundo(caudal)}. La superficie anterior (${hectareas(m.superficie.actualHa)}) queda en su historial. El polígono queda pendiente de publicar en el mapa.`,
          }),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Todas las oficinas dieron el visto bueno y Secretaría cargó la resolución. Cotéjela (abajo, en «Verificación de datos») con el plano y los usos, cargue el caudal asignado que fija y finalice:
        recién ahí la concesión queda con la nueva superficie y el nuevo caudal.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tarjeta etiqueta="Superficie" antes={hectareas(m.superficie.actualHa)}>
          <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white">{nueva}</p>
        </Tarjeta>
        <Tarjeta etiqueta="Caudal asignado (l/s)" antes={actual}>
          <input
            value={caudalTexto}
            inputMode="decimal"
            placeholder="Ej: 25.50"
            aria-label="Caudal asignado (l/s)"
            onChange={(e) => setCaudalTexto(e.target.value.replace(/[^\d.,]/g, ''))}
            className={controlClass({ className: 'mt-1 max-w-48 text-lg font-bold tabular-nums' })}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Calculado con la nueva superficie y los usos: {calculado}. Cárguelo como lo fija la resolución.</p>
        </Tarjeta>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={cotejado} onChange={(e) => setCotejado(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        Cotejé la resolución con el plano, la superficie, los usos y el caudal
        {m.cambiaTitular ? ', y con los nuevos titulares' : ''}.
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
        title={`¿Finalizar la ${NOMBRE_TIPO[m.tipo].toLowerCase()}?`}
        message="La concesión queda con la nueva superficie, usos y caudal desde la fecha de la resolución. No se puede deshacer."
        confirmLabel="Sí, finalizar"
        cancelLabel="Cancelar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Concesión', concesion],
            ['Superficie', `${hectareas(m.superficie.actualHa)} → ${nueva}`],
            ['Caudal asignado', caudal === null ? null : `${actual} → ${litrosPorSegundo(caudal)}${caudal === m.caudal.nuevoLps ? ' (el calculado)' : ''}`],
            ['Nuevos titulares', m.cambiaTitular ? nombres(m.nuevosTitulares) : null],
            ['Resolución', r ? `${r.numero} (firmada el ${formatearFecha(r.fecha)})` : null],
            ['Observaciones', observaciones.trim() || null],
          ]}
        />
      </ConfirmDialog>
    </div>
  )
}
