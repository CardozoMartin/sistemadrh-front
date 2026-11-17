import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { haceCuanto } from '@/lib/fechas'
import { mensajeDeError } from '@/services/api/errors'
import { formatoFecha, NOMBRE_ORIGEN } from '../estilos'
import { useAvisosDistrito, useTomarConocimiento } from '../hooks'

/**
 * Bandeja de Distrito: bajas de pozos aprobadas para TOMAR CONOCIMIENTO. Distrito maneja agua
 * superficial: no dictamina sobre la baja, solo se le hace saber. Marcar «tomé conocimiento»
 * queda registrado (y en el historial del expediente, si tiene), pero no frena el trámite.
 */
export function AvisosDistrito() {
  const [todos, setTodos] = useState(false)
  const avisos = useAvisosDistrito(todos)
  const visto = useTomarConocimiento()

  function contenido() {
    if (avisos.isPending) return <LoadingState mensaje="Cargando avisos…" className="py-6" />
    if (avisos.isError) return <ErrorState error={avisos.error} onRetry={() => void avisos.refetch()} className="py-6" />
    if (!avisos.data.length) return <EmptyState icon="notifications_off" titulo="No hay bajas de pozo para tomar conocimiento" className="py-6" />
    return (
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {avisos.data.map((a) => (
          <li key={a.bajaId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">
                Pozo {a.pozo.idInterno} dado de baja
                {!a.visto && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Nuevo</span>}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {NOMBRE_ORIGEN[a.origen]}
                {a.fechaBaja && ` · ${formatoFecha(a.fechaBaja)}`}
                {a.resolucion && ` · Resolución ${a.resolucion}`}
                {a.concesion && ` · concesión ${a.concesion}${a.concesionAnulada ? ' (anulada)' : ''}`}
                {[a.ubicacion.localidad, a.ubicacion.departamento].some(Boolean) && ` · ${[a.ubicacion.localidad, a.ubicacion.departamento].filter(Boolean).join(', ')}`}
                {a.ubicacion.distrito && ` · Distrito ${a.ubicacion.distrito}`}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Motivo: {a.motivo}</p>
              {a.visto && (
                <p className="text-xs text-green-700 dark:text-green-300">
                  Tomó conocimiento {a.visto.por} {haceCuanto(a.visto.en)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {a.expedienteId && (
                <Link to={ROUTES.pozo.baja(a.expedienteId)} className="text-sm font-semibold text-primary hover:underline">
                  Ver expediente
                </Link>
              )}
              {!a.visto && (
                <Button size="sm" iconLeft="visibility" loading={visto.isPending && visto.variables === a.bajaId} onClick={() => visto.mutate(a.bajaId)}>
                  Tomé conocimiento
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card className="mb-6 p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Bajas de pozo para tomar conocimiento</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Distrito no dictamina sobre pozos: solo se le informa la baja.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="size-4 rounded border-slate-300" />
          Ver también las ya vistas
        </label>
      </div>
      {visto.error && <Alert className="mb-3">{mensajeDeError(visto.error)}</Alert>}
      {contenido()}
    </Card>
  )
}
