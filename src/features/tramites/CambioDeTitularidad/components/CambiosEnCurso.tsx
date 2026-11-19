import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { formatearFecha } from '@/config/expedientes'
import { ErrorState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCambiosEnTramite } from '../hooks'

/** Etapas en las que el cambio todavía está en Catastro (carga o corrección). */
const EN_CATASTRO = ['CARGA', 'CORRECCION']

/**
 * Cambios de titularidad iniciados que siguen en Catastro (backend real). Si no hay ninguno,
 * no ocupa lugar: la pantalla queda solo con el motor de búsqueda.
 */
export function CambiosEnCurso() {
  const navigate = useNavigate()
  const cambios = useCambiosEnTramite()

  if (cambios.isPending) return null
  if (cambios.isError) {
    return <ErrorState error={cambios.error} onRetry={() => void cambios.refetch()} reintentando={cambios.isFetching} className="py-6" />
  }
  const enCarga = cambios.data.filter((c) => EN_CATASTRO.includes(c.etapa))
  if (enCarga.length === 0) return null

  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Cambios en carga ({enCarga.length})</h2>
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {enCarga.map((c) => (
          <li key={c.expedienteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                Expediente {c.expediente} · Concesión {c.concesion.numero ?? c.concesion.id}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {c.nuevoTitular ? `Nuevo titular: ${c.nuevoTitular}` : 'Falta cargar el nuevo titular'}
                {c.etapa === 'CORRECCION' && ' · En corrección'} · Iniciado {formatearFecha(c.creadoEn)}
              </p>
            </div>
            <Button size="sm" iconRight="arrow_forward" onClick={() => navigate(ROUTES.tramites.cambioTitularidad.datos(c.expedienteId))}>
              Continuar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
