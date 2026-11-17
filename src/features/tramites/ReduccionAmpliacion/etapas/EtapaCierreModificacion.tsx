import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { concesionesApi } from '@/features/concesiones/api'
import { concesionKeys, useConcesion } from '@/features/concesiones/hooks'
import { useDominio } from '@/hooks/useDominio'
import { mensajeDeError } from '@/services/api/errors'
import type { Expediente } from '@/types/domain'
import { ChecksCircuito, EtapaLayout, useAccionEtapa } from '../../shared/etapas'
import { bloqueoDeCierre } from '../../shared/etapas/cierre'
import { ComparacionSuperficie } from '../components/ComparacionSuperficie'
import { NOMBRE_TIPO } from '../superficie'
import { datosModificacion } from './config'

/**
 * Catastro (cierre): con la resolución y todas las oficinas de acuerdo, la concesión pasa
 * a la nueva superficie y caudal. La superficie anterior queda en su historial.
 * (El prototipo no tiene pantalla de cierre; infotecnica 6.5 indica «cierre en Catastro».)
 */
export function EtapaCierreModificacion({ expediente }: { expediente: Expediente }) {
  const qc = useQueryClient()
  const d = useDominio()
  const { pedir, dialogos } = useAccionEtapa(expediente)
  const datos = datosModificacion(expediente)
  const concesion = useConcesion(expediente.concesionOrigenId ?? undefined)
  const bloqueo = bloqueoDeCierre(expediente, d) ?? (datos ? null : 'El expediente no tiene la superficie propuesta.')
  const [confirmada, setConfirmada] = useState(false)

  function finalizar() {
    const c = concesion.data
    if (!c || !datos || bloqueo) return
    const { tipo, actual, propuesta } = datos
    const texto = `${NOMBRE_TIPO[tipo]} de la concesión N° ${c.numeroConcesion}: de ${actual.hectareas.toFixed(2)} ha a ${propuesta.hectareas.toFixed(2)} ha`
    pedir({
      titulo: '¿Finalizar el trámite?',
      mensaje: `${texto}${propuesta.caudal != null ? `, caudal ${propuesta.caudal.toFixed(2)} l/s` : ''}. La superficie anterior queda en el historial de la concesión.`,
      confirmar: 'Sí, finalizar',
      exito: { titulo: 'Modificación registrada', mensaje: `${texto}. Pendiente de actualización en el padrón de Rentas.` },
      // Primero se actualiza la concesión: si falla, el expediente no se cierra.
      antes: () => concesionesApi.modificarSuperficie({ concesion: c, tipo, nueva: propuesta, expediente }),
      revision: {
        resultado: 'aprobado',
        observaciones: `${texto}.`,
        // La tasa de Rentas depende de la superficie: queda pendiente actualizar el padrón.
        cambios: { padronRentasPendiente: true },
      },
      despues: () => qc.invalidateQueries({ queryKey: concesionKeys.all }),
    })
  }

  return (
    <>
      <EtapaLayout
        expediente={expediente}
        titulo={`Finalizar ${datos ? NOMBRE_TIPO[datos.tipo].toLowerCase() : 'modificación'}`}
        icono="polyline"
        descripcion="Revise la nueva superficie y el caudal recalculado. Al finalizar se actualiza la concesión."
        ancho
        accion={
          <Button size="sm" iconRight="task_alt" disabled={!!bloqueo || !concesion.data || !confirmada} onClick={finalizar}>
            Finalizar trámite
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <ChecksCircuito expediente={expediente} mensaje="El trámite pasó por todas las oficinas y está aprobado. Falta aplicar la nueva superficie a la concesión." />
          {bloqueo && <Alert>{bloqueo} No se puede finalizar.</Alert>}
          {concesion.isPending && expediente.concesionOrigenId && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="size-4" /> Cargando la concesión…
            </p>
          )}
          {concesion.isError && <Alert>{mensajeDeError(concesion.error)} No se puede finalizar sin la concesión.</Alert>}

          <ComparacionSuperficie expediente={expediente} />

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <input type="checkbox" checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span className="text-sm">
              <span className="block font-semibold text-slate-900 dark:text-white">Confirmar la nueva superficie de la concesión N° {expediente.numeroConcesion}</span>
              <span className="text-slate-500 dark:text-slate-400">
                Se actualizan el polígono, la superficie y el caudal asignado con la resolución {expediente.resolucion?.numero ?? '—'}.
              </span>
            </span>
          </label>
        </div>
      </EtapaLayout>
      {dialogos}
    </>
  )
}
