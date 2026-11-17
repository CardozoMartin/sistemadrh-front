import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { controlClass } from '@/components/form/styles'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { ESTADO_POZO } from '../estilos'
import { useBajasPozo, useBuscarPozos } from '../hooks'

/** Espera a que el usuario deje de escribir para buscar. */
function useDemorado<T>(valor: T, ms = 300) {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return demorado
}

const EJEMPLOS = ['Concesión (D-0042)', 'Expediente (123/332-2026)', 'Titular (Ramírez)', 'Documento', 'ID del pozo (PD-0042-1)', 'Departamento o localidad']

/**
 * Paso 1 de la baja: buscar el pozo. Se busca por número de concesión, número de expediente,
 * titular, documento, ID interno, alias, departamento o localidad; con varias palabras tienen
 * que coincidir todas («ramirez lules»). Al elegir un pozo se pasa a su vista.
 * El texto queda en la URL (?q=…): al volver atrás, la búsqueda sigue ahí.
 */
export default function BuscarPozoPage() {
  const navigate = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('q') ?? '')
  const q = useDemorado(texto.trim())
  const pozos = useBuscarPozos(q)
  const enTramite = useBajasPozo()

  useEffect(() => {
    setParametros(q ? { q } : {}, { replace: true })
  }, [q, setParametros])

  function resultados() {
    if (pozos.isPending) return <LoadingState mensaje="Buscando pozos…" className="py-10" />
    if (pozos.isError) return <ErrorState error={pozos.error} onRetry={() => void pozos.refetch()} className="py-10" />
    if (!pozos.data.length) {
      return (
        <EmptyState icon="search_off" titulo="No se encontró ningún pozo" descripcion="Pruebe con menos palabras. Si el pozo no está registrado, primero hay que darlo de alta (Registro de pozo)." className="py-10" />
      )
    }
    return (
      <div className={cn('overflow-x-auto', pozos.isFetching && 'opacity-60')}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Pozo</th>
              <th className="px-4 py-3">Concesión</th>
              <th className="px-4 py-3">Titular</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Expedientes</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pozos.data.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(ROUTES.pozo.bajaPozo(p.id))}
                className="cursor-pointer align-top text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{p.idInterno}</p>
                  {p.alias && <p className="text-xs text-slate-500">{p.alias}</p>}
                </td>
                <td className="px-4 py-3">{p.concesion?.numero ?? '—'}</td>
                <td className="max-w-64 px-4 py-3">{p.concesion?.titular ?? '—'}</td>
                <td className="px-4 py-3">{[p.concesion?.localidad, p.concesion?.departamento].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs">{p.expedientes.length ? p.expedientes.map((e) => <p key={e.id}>{e.numero}</p>) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', ESTADO_POZO[p.estado].color)}>{ESTADO_POZO[p.estado].texto}</span>
                  {p.bajaAbierta && <p className="mt-1 text-xs whitespace-nowrap text-amber-700 dark:text-amber-300">Baja en trámite</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Icon name="chevron_right" className="text-slate-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pozos.data.length === 50 && <p className="px-4 py-3 text-xs text-slate-500">Se muestran los primeros 50: agregue palabras para acotar la búsqueda.</p>}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Baja de pozo"
        description="Busque el pozo y selecciónelo. En su vista se elige si es una baja a solicitud del titular o de oficio, y empieza el trámite."
        actions={
          <Link to={ROUTES.pozo.bajasEnTramite} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <Icon name="pending_actions" className="text-[18px]!" />
            Bajas en trámite{enTramite.data ? ` (${enTramite.data.length})` : ''}
          </Link>
        }
      />
      <Card className="mb-6 p-6">
        <div className="relative">
          <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Concesión, expediente, titular, documento, ID del pozo…"
            className={controlClass({ iconLeft: true })}
            aria-label="Buscar pozo"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Se puede buscar por:</span>
          {EJEMPLOS.map((e) => (
            <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
              {e}
            </span>
          ))}
        </div>
      </Card>
      <Card className="p-0">{resultados()}</Card>
    </>
  )
}
