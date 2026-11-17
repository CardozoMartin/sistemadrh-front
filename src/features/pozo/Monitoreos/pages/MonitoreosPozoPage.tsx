import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { MODO_DEMO } from '@/services/demo/modo'
import { MarcaOrigen } from '../../Padron/components/MarcaOrigen'
import { caudalEspecifico, depresion, formatear, m3hALps } from '../../AltaDePozo/calculos'
import { InformeMonitoreo } from '../components/InformeMonitoreo'
import { RegistrarMonitoreo } from '../components/RegistrarMonitoreo'
import { antiguedad, cambiosDe, camposDe, fechaCorta, NOMBRE_TIPO, useMonitoreos, type DatosHidraulicos, type Monitoreo, type TipoMonitoreo } from '../monitoreos'

const FILTROS: { valor: TipoMonitoreo | null; texto: string }[] = [
  { valor: null, texto: 'Todos' },
  { valor: 'hidraulico', texto: 'Hidráulicos' },
  { valor: 'quimico', texto: 'Químicos' },
]

/** El último monitoreo de un tipo: es el vigente (las pestañas del pozo muestran ese). */
function Vigente({ tipo, m, onVer }: { tipo: TipoMonitoreo; m: Monitoreo | undefined; onVer: (m: Monitoreo) => void }) {
  const t = NOMBRE_TIPO[tipo]
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <Icon name={t.icono} className="text-[18px]! text-primary" />
          {tipo === 'hidraulico' ? 'Hidráulico vigente' : 'Químico vigente'}
        </h2>
        {m && (
          <span className="text-xs text-slate-500">
            {fechaCorta(m.fecha)} · {antiguedad(m.fecha)}
          </span>
        )}
      </div>
      {m ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {camposDe(m)
              .slice(0, 6)
              .map((c) => (
                <div key={c.etiqueta}>
                  <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{c.etiqueta}</dt>
                  <dd className="text-sm">{c.valor}</dd>
                </div>
              ))}
          </dl>
          <div>
            <Button size="sm" variant="secondary" iconLeft="description" onClick={() => onVer(m)}>
              Ver informe completo
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Sin monitoreos {tipo === 'hidraulico' ? 'hidráulicos' : 'químicos'} registrados.</p>
      )}
    </Card>
  )
}

/** Evolución del pozo: los hidráulicos en una tabla, del más viejo al más nuevo. */
function Evolucion({ lista }: { lista: Monitoreo[] }) {
  const h = lista.filter((m) => m.tipo === 'hidraulico').reverse()
  if (h.length < 2) return null
  return (
    <Card className="overflow-x-auto p-5">
      <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Evolución hidráulica</h2>
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700">
          <tr>
            <th className="py-2 pr-3">Fecha</th>
            <th className="py-2 pr-3 text-right">N. estático</th>
            <th className="py-2 pr-3 text-right">N. dinámico</th>
            <th className="py-2 pr-3 text-right">Depresión</th>
            <th className="py-2 pr-3 text-right">Caudal (l/s)</th>
            <th className="py-2 text-right">Q específico</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800">
          {h.map((m) => {
            const d = m.datos as unknown as DatosHidraulicos
            const s = depresion(d.nivelEstatico, d.nivelDinamico)
            return (
              <tr key={m.id}>
                <td className="py-2 pr-3">{fechaCorta(m.fecha)}</td>
                <td className="py-2 pr-3 text-right">{formatear(d.nivelEstatico) || '—'}</td>
                <td className="py-2 pr-3 text-right">{formatear(d.nivelDinamico) || '—'}</td>
                <td className="py-2 pr-3 text-right">{formatear(s) || '—'}</td>
                <td className="py-2 pr-3 text-right">{formatear(m3hALps(d.caudalM3h), 3) || '—'}</td>
                <td className="py-2 text-right">{formatear(caudalEspecifico(d.caudalM3h, s), 3) || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

/**
 * Historial de monitoreos del pozo (prototipo: «Historial de monitoreos»). Un pozo se mide
 * muchas veces: cada monitoreo hidráulico o químico queda con su fecha, no pisa al anterior y
 * muestra qué cambió. Se filtra por tipo y se abre el informe de cualquier fecha.
 * PROTOTIPO: funciona con el backend emulado (npm run demo).
 */
export default function MonitoreosPozoPage() {
  const { pozoId } = useParams()
  const [parametros, setParametros] = useSearchParams()
  const filtro = (parametros.get('tipo') as TipoMonitoreo | null) ?? null
  const datos = useMonitoreos(pozoId)
  const [registrar, setRegistrar] = useState<TipoMonitoreo | null>(null)
  const [informe, setInforme] = useState<Monitoreo | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (datos.isPending) return <LoadingState mensaje="Cargando los monitoreos…" />
  if (datos.isError) return <ErrorState error={datos.error} onRetry={() => void datos.refetch()} />

  const { pozo, monitoreos } = datos.data
  const visibles = monitoreos.filter((m) => !filtro || m.tipo === filtro)
  const ultimo = (t: TipoMonitoreo) => monitoreos.find((m) => m.tipo === t)
  const puedeRegistrar = pozo.estado !== 'BAJA' && pozo.estado !== 'ANULADO'

  function alRegistrar(m?: Monitoreo, lista?: Monitoreo[]) {
    setRegistrar(null)
    if (!m) return
    // Se compara contra la lista que devolvió el servidor (ya incluye el nuevo).
    const cambios = cambiosDe(m, lista ?? datos.data!.monitoreos)
    setAviso(
      `${NOMBRE_TIPO[m.tipo].texto} del ${fechaCorta(m.fecha)} registrado. ${cambios === null ? 'Es el primero de este tipo.' : cambios.length ? `${cambios.length} dato${cambios.length === 1 ? '' : 's'} cambiaron respecto del anterior.` : 'Sin cambios respecto del anterior.'}`,
    )
  }

  return (
    <>
      <PageHeader
        title={`Monitoreos del pozo ${pozo.idInterno}`}
        description={[pozo.alias, pozo.concesion?.numero && `Concesión ${pozo.concesion.numero}`, pozo.concesion?.titular].filter(Boolean).join(' · ') || 'Mediciones hidráulicas e informes químicos, del más reciente al más antiguo.'}
        actions={
          puedeRegistrar && (
            <>
              <Button variant="secondary" iconLeft="science" onClick={() => setRegistrar('quimico')}>
                Registrar informe químico
              </Button>
              <Button iconLeft="water" onClick={() => setRegistrar('hidraulico')}>
                Registrar monitoreo hidráulico
              </Button>
            </>
          )
        }
      />
      {!MODO_DEMO && (
        <div className="mb-4">
          <Alert tone="info">Pantalla de prototipo: los monitoreos todavía no están en el backend. Para probarla, use el modo demo (npm run demo).</Alert>
        </div>
      )}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <MarcaOrigen origen={pozo.origen} />
          <Link to={ROUTES.pozo.registrados} className="flex items-center gap-1 font-semibold text-primary hover:underline">
            <Icon name="arrow_back" className="text-[18px]!" /> Pozos registrados
          </Link>
        </div>
        {aviso && <Alert tone="info">{aviso}</Alert>}

        <div className="grid gap-6 md:grid-cols-2">
          <Vigente tipo="hidraulico" m={ultimo('hidraulico')} onVer={setInforme} />
          <Vigente tipo="quimico" m={ultimo('quimico')} onVer={setInforme} />
        </div>

        {(!filtro || filtro === 'hidraulico') && <Evolucion lista={monitoreos} />}

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Historial de monitoreos</h2>
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-900">
              {FILTROS.map((f) => (
                <button
                  key={f.texto}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.valor}
                  onClick={() => setParametros(f.valor ? { tipo: f.valor } : {}, { replace: true })}
                  className={cn('rounded-md px-3 py-1.5', filtro === f.valor ? 'bg-white text-primary shadow-sm dark:bg-slate-700' : 'text-slate-500')}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </div>
          {!visibles.length ? (
            <EmptyState icon="history" titulo="Sin monitoreos registrados" descripcion={puedeRegistrar ? 'Use «Registrar monitoreo» para cargar la primera medición.' : undefined} className="py-10" />
          ) : (
            <ol className="divide-y divide-slate-200 dark:divide-slate-700">
              {visibles.map((m) => {
                const t = NOMBRE_TIPO[m.tipo]
                const cambios = cambiosDe(m, monitoreos)
                return (
                  <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', t.color)}>
                          <Icon name={t.icono} className="text-[14px]!" />
                          {t.texto}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">{fechaCorta(m.fecha)}</span>
                        <span className="text-xs text-slate-500">
                          {antiguedad(m.fecha)} · cargado por {m.usuario}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {cambios === null ? (
                          <span className="text-slate-500">Primer monitoreo de este tipo · {camposDe(m).length} datos medidos.</span>
                        ) : cambios.length === 0 ? (
                          <span className="text-slate-500">Sin cambios respecto del anterior.</span>
                        ) : (
                          cambios.map((c) => (
                            <span key={c.etiqueta} className="rounded bg-amber-50 px-2 py-0.5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                              <strong>{c.etiqueta}:</strong> {c.antes ?? 'no se medía'} → {c.ahora}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" iconLeft="description" onClick={() => setInforme(m)}>
                      Ver informe
                    </Button>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>
      </div>

      {registrar && <RegistrarMonitoreo pozoId={pozo.id} tipo={registrar} ultimoHidraulico={ultimo('hidraulico')} onCerrar={alRegistrar} />}
      {informe && <InformeMonitoreo pozo={pozo} m={informe} lista={monitoreos} onCerrar={() => setInforme(null)} />}
    </>
  )
}
