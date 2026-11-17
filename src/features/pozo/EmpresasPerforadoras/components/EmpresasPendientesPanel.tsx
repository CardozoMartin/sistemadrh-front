import { useNavigate } from 'react-router'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatearFecha } from '@/config/expedientes'
import { ROUTES } from '@/config/routes'
import { useEmpresasEnOficina } from '../hooks'
import { cuitConFormato, nombreEmpresa } from '../reglas'
import type { OficinaEmpresa } from '../types'

const TITULOS: Record<OficinaEmpresa, string> = {
  juridico: 'Empresas perforadoras — alta pendiente de dictamen',
  secretaria_general: 'Empresas perforadoras — pendientes de resolución',
}

/** Empresas que esperan la revisión de la oficina (va en su bandeja, junto a los expedientes). */
export function EmpresasPendientesPanel({ oficina }: { oficina: OficinaEmpresa }) {
  const navigate = useNavigate()
  const empresas = useEmpresasEnOficina(oficina)
  const lista = empresas.data ?? []

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Icon name="factory" className="text-primary" /> {TITULOS[oficina]}
        </h3>
        {empresas.data && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{lista.length}</span>}
      </div>
      {empresas.isPending ? (
        <LoadingState mensaje="Cargando empresas…" className="py-8" />
      ) : empresas.isError ? (
        <ErrorState error={empresas.error} onRetry={() => void empresas.refetch()} reintentando={empresas.isFetching} className="m-4" />
      ) : lista.length === 0 ? (
        <p className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">No hay empresas pendientes.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {lista.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{nombreEmpresa(e)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  CUIT {cuitConFormato(e.cuit)} · {e.maquinas.filter((m) => m.activa).length} máquina(s) · en la oficina desde el {formatearFecha(e.tramite?.desde ?? e.creado)}
                </p>
              </div>
              <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.pozo.empresaRevision(e.id))}>
                Revisar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
