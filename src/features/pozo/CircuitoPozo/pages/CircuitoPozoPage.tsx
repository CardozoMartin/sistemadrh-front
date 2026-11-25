import { Link, useParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { esNoEncontrado } from '@/services/api/errors'
import { HistorialExpediente } from '@/features/tramites/shared/circuito/HistorialExpediente'
import { useRegistroPozo } from '../api'
import { AccionesPozo } from '../components/AccionesPozo'
import { BarraEtapasPozo } from '../components/BarraEtapasPozo'
import { ResumenRegistro } from '../components/ResumenRegistro'

const TITULO = 'Registro de pozo'

/**
 * Un registro de pozo en el circuito: dónde está, qué hace la oficina que lo tiene, la ficha
 * del pozo y el historial de pases y actuaciones.
 * PROTOTIPO: funciona con el backend emulado (npm run demo).
 */
export default function CircuitoPozoPage() {
  const { expedienteId } = useParams()
  const registro = useRegistroPozo(expedienteId)

  if (registro.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (registro.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(registro.error) ? <EmptyState icon="search_off" titulo="No se encontró el registro" /> : <ErrorState error={registro.error} onRetry={() => void registro.refetch()} />}
      </>
    )
  }

  const r = registro.data
  const e = r.expediente
  return (
    <>
      <PageHeader title={`Registro de pozo ${e.numero}`} description={`De oficio · ${r.ficha.causante} · pozo ${r.pozo.idInterno}${r.catastro?.numeroConcesion ? ` · concesión N° ${r.catastro.numeroConcesion}` : ''}`} />
      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <BarraEtapasPozo expediente={e} />
        </Card>
        {/* Las acciones van a todo el ancho: el formulario de Catastro tiene muchos campos por fila. */}
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {e.oficinaNombre} · {e.etapaNombre}
            </h2>
            {e.tomadoPor && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Lo tiene {e.tomadoPor.nombre} desde {new Date(e.tomadoEn!).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </div>
          <AccionesPozo r={r} />
        </Card>
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-3">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Ficha del pozo</h2>
              <Link to={ROUTES.pozo.monitoreos(r.pozo.id)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <Icon name="monitoring" className="text-[18px]!" /> Historial de monitoreos
              </Link>
            </div>
            <ResumenRegistro r={r} />
          </Card>
          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial</h2>
            <HistorialExpediente expedienteId={e.id} />
          </Card>
        </div>
      </div>
    </>
  )
}
