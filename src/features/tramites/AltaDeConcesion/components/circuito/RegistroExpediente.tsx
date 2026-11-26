import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { MODO_DEMO } from '@/services/demo/modo'
import { AuditoriaExpediente } from './AuditoriaExpediente'
import { HistorialExpediente } from '../../../shared/circuito/HistorialExpediente'

type Pestania = 'historial' | 'auditoria'

const PESTANIAS: { id: Pestania; label: string; icono: string; ayuda: string }[] = [
  { id: 'historial', label: 'Historial', icono: 'history', ayuda: 'Pases entre oficinas, lo que resolvió cada una y los cambios de estado.' },
  { id: 'auditoria', label: 'Auditoría', icono: 'policy', ayuda: 'Quién lo inició, quién lo tomó y lo pasó en cada oficina, y quién lo finalizó.' },
]

/**
 * Historial y auditoría del expediente, a pedido: arranca cerrado para no ocupar la pantalla.
 * Cada pestaña se carga recién al abrirla; tocar la pestaña abierta la cierra.
 */
export function RegistroExpediente({ expedienteId }: { expedienteId: string }) {
  const [abierta, setAbierta] = useState<Pestania | null>(null)
  // El backend emulado del modo demo no lleva auditoría.
  const pestanias = MODO_DEMO ? PESTANIAS.filter((p) => p.id !== 'auditoria') : PESTANIAS
  const actual = pestanias.find((p) => p.id === abierta)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Historial y auditoría</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{actual?.ayuda ?? 'Abra una pestaña para ver el recorrido del expediente.'}</p>
        </div>
        <div role="tablist" className="flex gap-2">
          {pestanias.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={abierta === p.id}
              onClick={() => setAbierta(abierta === p.id ? null : p.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                abierta === p.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
              )}
            >
              <Icon name={p.icono} className="text-[18px]!" />
              {abierta === p.id ? `Ocultar ${p.label.toLowerCase()}` : `Ver ${p.label.toLowerCase()}`}
            </button>
          ))}
        </div>
      </div>
      {abierta && (
        <div role="tabpanel" className="border-t border-slate-200 p-6 dark:border-slate-700">
          {abierta === 'historial' ? <HistorialExpediente expedienteId={expedienteId} /> : <AuditoriaExpediente expedienteId={expedienteId} />}
        </div>
      )}
    </Card>
  )
}
