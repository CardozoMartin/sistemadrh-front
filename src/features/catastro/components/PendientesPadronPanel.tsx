import { useState } from 'react'
import { Link } from 'react-router'
import { controlClass } from '@/components/form/styles'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { useBandeja } from '@/features/tramites/AltaDeConcesion/hooks'

/** Sin tildes ni mayúsculas, para buscar «perez» y encontrar «Pérez». */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Bandeja de Catastro: altas que pasaron la verificación final y esperan el padrón de Rentas
 * (30 a 60 días). No son un paso más del cierre: cuando llega el padrón, quien esté en Catastro
 * busca el expediente acá (por número o titular), lo abre y lo carga; con eso el alta finaliza.
 */
export function PendientesPadronPanel() {
  const bandeja = useBandeja('catastro')
  const [texto, setTexto] = useState('')
  const pendientes = (bandeja.data ?? []).filter((e) => e.etapa === 'ESPERA_PADRON')
  if (!pendientes.length) return null

  const busqueda = normalizar(texto.trim())
  const lista = busqueda ? pendientes.filter((e) => normalizar(`${e.numero} ${e.titular ?? ''}`).includes(busqueda)) : pendientes

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Icon name="pending_actions" />
          </span>
          <div>
            <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              Pendientes de padrón
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{pendientes.length}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Altas con la verificación final hecha. Cuando Rentas informe el padrón, búsquela y cárguelo: el trámite finaliza.</p>
          </div>
        </div>
        <label className="relative w-full sm:w-72">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px]! text-slate-400" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por expediente o titular" aria-label="Buscar alta pendiente de padrón" className={controlClass({ className: 'pl-9' })} />
        </label>
      </div>

      {lista.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Ninguna alta pendiente de padrón coincide con «{texto}».</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {lista.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Expediente {e.numero}
                  {e.titular && <span className="font-normal text-slate-600 dark:text-slate-300"> · {e.titular}</span>}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Icon name="hourglass_top" className="text-[14px]!" />
                  Falta el padrón de Rentas
                </span>
                {e.tomadoPor && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Lo tiene {e.tomadoPor}</span>}
              </div>
              <Link
                to={ROUTES.tramites.altaConcesion.circuito(e.id)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                <Icon name="edit_document" className="text-[18px]!" />
                Cargar padrón
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
