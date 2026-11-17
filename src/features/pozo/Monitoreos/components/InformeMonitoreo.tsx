import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { PozoBackend } from '../../BajaDePozo/types'
import { cambiosDe, camposDe, fechaCorta, NOMBRE_TIPO, type Monitoreo, type ParametroQuimico } from '../monitoreos'

/**
 * Informe de UNA fecha («ver informe por fecha»): todo lo medido ese día, con lo que cambió
 * contra el monitoreo anterior del mismo tipo. Se puede imprimir o guardar como PDF.
 */
export function InformeMonitoreo({ pozo, m, lista, onCerrar }: { pozo: PozoBackend; m: Monitoreo; lista: Monitoreo[]; onCerrar: () => void }) {
  const cambios = cambiosDe(m, lista)
  const cambiados = new Map((cambios ?? []).map((c) => [c.etiqueta, c.antes]))
  const parametros = m.tipo === 'quimico' ? ((m.datos.parametros as ParametroQuimico[]) ?? []) : []
  return (
    <Modal
      open
      size="lg"
      icon={NOMBRE_TIPO[m.tipo].icono}
      title={`Informe ${NOMBRE_TIPO[m.tipo].texto.toLowerCase()} del ${fechaCorta(m.fecha)}`}
      description={`Pozo ${pozo.idInterno}${pozo.alias ? ` · ${pozo.alias}` : ''} · cargado por ${m.usuario} el ${new Date(m.registrado).toLocaleDateString('es-AR')}`}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="secondary" iconLeft="print" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
          <Button onClick={onCerrar}>Cerrar</Button>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700">
          <tr>
            <th className="py-2 pr-3">{m.tipo === 'quimico' ? 'Parámetro' : 'Dato'}</th>
            {m.tipo === 'quimico' && <th className="py-2 pr-3">Símbolo</th>}
            <th className="py-2 pr-3 text-right">Valor</th>
            <th className="py-2">Antes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {camposDe(m).map((c) => {
            const p = parametros.find((x) => x.parametro === c.etiqueta)
            const cambio = cambiados.has(c.etiqueta)
            return (
              <tr key={c.etiqueta} className={cambio ? 'bg-amber-50/60 dark:bg-amber-500/5' : undefined}>
                <td className="py-2 pr-3 font-medium">{c.etiqueta}</td>
                {m.tipo === 'quimico' && <td className="py-2 pr-3 text-slate-500">{p?.simbolo || '—'}</td>}
                <td className="py-2 pr-3 text-right tabular-nums">{c.valor}</td>
                <td className="py-2 text-xs text-slate-500">{cambios === null ? '—' : cambio ? (cambiados.get(c.etiqueta) ?? 'no se medía') : 'igual'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        {cambios === null ? 'Es el primer monitoreo de este tipo: no hay contra qué comparar.' : cambios.length ? `${cambios.length} dato${cambios.length === 1 ? '' : 's'} cambiaron respecto del monitoreo anterior (resaltados).` : 'Sin cambios respecto del monitoreo anterior.'}
      </p>
    </Modal>
  )
}
