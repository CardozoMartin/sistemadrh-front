import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Alert } from '@/components/feedback/States'
import { Input } from '@/components/form'
import type { ModoSubdivisionMap } from '@/components/map/SubdivisionMap'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useDominio } from '@/hooks/useDominio'
import { cn } from '@/lib/cn'
import type { LatLng } from '@/lib/geo'
import { mensajeDeError } from '@/services/api/errors'
import { PasosTramite } from '../../shared/components/PasosTramite'
import { redondear2 } from '../../shared/dotacion'
import { ConBorrador } from '../components/ConBorrador'
import { ResumenMadre } from '../components/ResumenMadre'
import {
  ajustarCarga,
  cambiarCantidad,
  conSuperficie,
  dividirAutomaticamente,
  evaluarSubdivision,
  MAX_FRACCIONES,
  MIN_FRACCIONES,
  superficiesIguales,
} from '../fracciones'
import { useEliminarBorradorSubdivision, useGuardarFracciones } from '../hooks'
import { PASOS_SUBDIVISION } from '../pasos'
import type { BorradorSubdivision, FraccionSubdivision } from '../types'

// El mapa (Leaflet) se carga aparte.
const SubdivisionMap = lazy(() => import('@/components/map/SubdivisionMap').then((m) => ({ default: m.SubdivisionMap })))

const TITULO = 'Subdivisión de Concesión — Definir fracciones'

/** Paso 2 (Catastro), prototipo subdivision/comienzoTramite.html: editor de fracciones sobre el mapa. */
export default function DefinicionFraccionesPage() {
  return <ConBorrador titulo={TITULO}>{(b) => <Definicion key={b.id} borrador={b} />}</ConBorrador>
}

const MODOS: { modo: ModoSubdivisionMap; label: string; icono: string }[] = [
  { modo: 'ver', label: 'Navegar', icono: 'pan_tool' },
  { modo: 'dibujar', label: 'Dibujar', icono: 'draw' },
  { modo: 'editar', label: 'Editar vértices', icono: 'edit_location_alt' },
]

function Definicion({ borrador }: { borrador: BorradorSubdivision }) {
  const navigate = useNavigate()
  const d = useDominio()
  const { madre } = borrador
  const guardar = useGuardarFracciones(borrador.id)
  const eliminar = useEliminarBorradorSubdivision()
  const [fracciones, setFracciones] = useState<FraccionSubdivision[]>(borrador.fracciones)
  const [activa, setActiva] = useState<string | null>(borrador.fracciones[0]?.clave ?? null)
  const [modo, setModo] = useState<ModoSubdivisionMap>('ver')
  const [sinGuardar, setSinGuardar] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const evaluacion = useMemo(() => evaluarSubdivision(fracciones, madre), [fracciones, madre])
  const diferenciaObjetivo = redondear2(evaluacion.totalObjetivo - madre.hectareas)
  const objetivoOk = Math.abs(diferenciaObjetivo) <= 0.01
  const fraccionActiva = fracciones.find((f) => f.clave === activa)
  const conDatos = fracciones.some((f) => f.carga)

  function cambiar(nuevas: FraccionSubdivision[]) {
    setFracciones(nuevas)
    setSinGuardar(true)
    setAviso(null)
  }

  function editar(clave: string, cambios: Partial<FraccionSubdivision>) {
    cambiar(fracciones.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  }

  function cambiarPoligono(clave: string, coordenadas: LatLng[]) {
    cambiar(fracciones.map((f) => (f.clave === clave ? conSuperficie({ ...f, coordenadas }, madre) : f)))
  }

  function setCantidad(n: number) {
    const nuevas = cambiarCantidad(fracciones, n, madre)
    cambiar(nuevas)
    if (!nuevas.some((f) => f.clave === activa)) setActiva(nuevas[0]?.clave ?? null)
    setModo('ver')
  }

  function distribuir() {
    const partes = superficiesIguales(madre.hectareas, fracciones.length)
    cambiar(fracciones.map((f, i) => ({ ...f, objetivo: partes[i] })))
  }

  function dividir() {
    cambiar(dividirAutomaticamente(fracciones, madre))
    setModo('ver')
    setAviso('Se dividió la concesión en franjas con las superficies indicadas. Puede ajustar los vértices con «Editar vértices».')
  }

  function elegirModo(m: ModoSubdivisionMap, clave = activa) {
    if (clave) setActiva(clave)
    setModo(m)
  }

  /** Guarda las fracciones; si ya había datos cargados, se ajustan al nuevo polígono. */
  async function persistir() {
    const ajustadas = fracciones.map((f) => ajustarCarga(f, madre, d.uso))
    await guardar.mutateAsync(ajustadas)
    setFracciones(ajustadas)
    setSinGuardar(false)
  }

  async function siguiente() {
    if (!evaluacion.valido) return
    try {
      await persistir()
      navigate(ROUTES.tramites.subdivision.datos(borrador.id))
    } catch {
      /* el error se muestra con guardar.error */
    }
  }

  return (
    <>
      <PageHeader title={TITULO} description="Defina cuántas fracciones tendrá la concesión y dibuje cada una sobre el polígono de la concesión madre." />

      <div className="flex flex-col gap-6">
        <PasosTramite {...PASOS_SUBDIVISION} actual={1} titulo="Definir fracciones" />
        <ResumenMadre numeroConcesion={borrador.numeroConcesion} numeroExpediente={borrador.numeroExpediente} madre={madre} />

        <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
          {/* Configuración de lotes */}
          <Card className="flex flex-col">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Icon name="grid_view" className="text-primary" /> Fracciones
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Indique la superficie de cada lote (tienen que sumar {madre.hectareas.toFixed(2)} ha) y divida automáticamente, o dibuje cada uno en el mapa.
              </p>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad de fracciones</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" className="px-3" aria-label="Quitar fracción" disabled={fracciones.length <= MIN_FRACCIONES} onClick={() => setCantidad(fracciones.length - 1)}>
                    <Icon name="remove" className="text-base!" />
                  </Button>
                  <span className="w-10 text-center text-lg font-bold text-slate-900 tabular-nums dark:text-white">{fracciones.length}</span>
                  <Button size="sm" variant="secondary" className="px-3" aria-label="Agregar fracción" disabled={fracciones.length >= MAX_FRACCIONES} onClick={() => setCantidad(fracciones.length + 1)}>
                    <Icon name="add" className="text-base!" />
                  </Button>
                </div>
              </div>

              {/* Barra de superficie objetivo */}
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {fracciones.map((f) => (
                    <div key={f.clave} style={{ width: `${Math.max(0, Math.min(100, (f.objetivo / (madre.hectareas || 1)) * 100))}%`, background: f.color }} />
                  ))}
                </div>
                <p className="mt-1.5 flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Suma: <strong className="text-slate-800 tabular-nums dark:text-slate-200">{evaluacion.totalObjetivo.toFixed(2)} ha</strong>
                  </span>
                  <span className={cn('font-semibold', objetivoOk ? 'text-green-600' : 'text-red-600')}>
                    {objetivoOk ? '✓ Correcto' : diferenciaObjetivo > 0 ? `+${diferenciaObjetivo.toFixed(2)} ha de más` : `Faltan ${(-diferenciaObjetivo).toFixed(2)} ha`}
                  </span>
                </p>
              </div>

              <ul className="flex flex-col gap-2">
                {fracciones.map((f, i) => {
                  const esActiva = f.clave === activa
                  const dibujada = f.coordenadas.length >= 3
                  return (
                    <li
                      key={f.clave}
                      className={cn('rounded-lg border p-3 transition-colors', esActiva ? 'border-primary/50 bg-primary/5' : 'border-slate-200 dark:border-slate-700')}
                      onClick={() => setActiva(f.clave)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: f.color }}>
                          {i + 1}
                        </span>
                        <Input value={f.nombre} onChange={(e) => editar(f.clave, { nombre: e.target.value })} aria-label={`Nombre de la fracción ${i + 1}`} className="h-9 py-1 text-sm" />
                        <div className="relative w-28 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={Number.isFinite(f.objetivo) ? f.objetivo : ''}
                            onChange={(e) => editar(f.clave, { objetivo: Number(e.target.value) || 0 })}
                            aria-label={`Superficie objetivo de ${f.nombre}`}
                            className="h-9 py-1 pr-8 text-right text-sm tabular-nums"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400">ha</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-8">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            dibujada ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                          )}
                        >
                          {dibujada ? `Dibujada · ${f.hectareas.toFixed(2)} ha` : 'Pendiente de dibujar'}
                        </span>
                        <span className="flex gap-1">
                          <button type="button" title="Dibujar" onClick={(e) => (e.stopPropagation(), elegirModo('dibujar', f.clave))} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700">
                            <Icon name="draw" className="text-lg!" />
                          </button>
                          <button
                            type="button"
                            title="Editar vértices"
                            disabled={!dibujada}
                            onClick={(e) => (e.stopPropagation(), elegirModo('editar', f.clave))}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-primary disabled:opacity-30 dark:hover:bg-slate-700"
                          >
                            <Icon name="edit_location_alt" className="text-lg!" />
                          </button>
                          <button
                            type="button"
                            title="Borrar polígono"
                            disabled={!dibujada}
                            onClick={(e) => (e.stopPropagation(), cambiarPoligono(f.clave, []))}
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10"
                          >
                            <Icon name="delete" className="text-lg!" />
                          </button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Button size="sm" variant="secondary" iconLeft="balance" onClick={distribuir}>
                  Distribuir equitativamente
                </Button>
                <Button size="sm" iconLeft="call_split" disabled={!objetivoOk} title={objetivoOk ? undefined : 'Las superficies tienen que sumar el total de la concesión'} onClick={dividir}>
                  Dividir automáticamente
                </Button>
              </div>
            </div>
          </Card>

          {/* Mapa */}
          <Card className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Herramienta del mapa">
                {MODOS.map((m) => (
                  <button
                    key={m.modo}
                    type="button"
                    disabled={m.modo !== 'ver' && !activa}
                    onClick={() => elegirModo(m.modo)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
                      modo === m.modo ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                  >
                    <Icon name={m.icono} className="text-base!" /> {m.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Fracción activa: <strong style={{ color: fraccionActiva?.color }}>{fraccionActiva?.nombre ?? '—'}</strong>
                {modo === 'dibujar' && ' · clic para agregar puntos, doble clic para cerrar'}
              </span>
            </div>
            <div className="p-4">
              <Suspense fallback={<div className="flex h-[30rem] items-center justify-center"><Spinner className="size-6 text-primary" /></div>}>
                <SubdivisionMap
                  madre={madre.coordenadas}
                  fracciones={fracciones}
                  activa={activa}
                  modo={modo}
                  onSeleccionar={setActiva}
                  onCambiar={cambiarPoligono}
                  onTerminarDibujo={() => setModo('ver')}
                />
              </Suspense>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 px-5 py-3 text-xs sm:grid-cols-4 dark:border-slate-700">
              <Metrica label="Dibujado" valor={`${evaluacion.totalDibujado.toFixed(2)} / ${madre.hectareas.toFixed(2)} ha`} />
              <Metrica label="Sin asignar" valor={`${evaluacion.sinAsignar.toFixed(2)} ha`} alerta={evaluacion.sinAsignar > madre.hectareas * 0.01} />
              <Metrica label="Superpuesto" valor={`${evaluacion.superpuesta.toFixed(2)} ha`} alerta={evaluacion.superpuesta > madre.hectareas * 0.01} />
              <Metrica label="Fuera de la madre" valor={`${evaluacion.fuera.toFixed(2)} ha`} alerta={evaluacion.fuera > madre.hectareas * 0.01} />
            </div>
          </Card>
        </div>

        {aviso && <Alert tone="info">{aviso}</Alert>}
        {evaluacion.valido ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
            <Icon name="check_circle" filled className="text-green-600" />
            Subdivisión válida: {fracciones.length} fracciones que cubren toda la concesión sin superponerse.
          </div>
        ) : (
          <Alert>
            <div>
              <p className="font-semibold">Para continuar, corrija lo siguiente:</p>
              <ul className="mt-1 list-disc pl-5">
                {evaluacion.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
        {conDatos && sinGuardar && (
          <Alert tone="info">Hay fracciones con datos ya cargados: al guardar se actualizan su polígono y, si cambió la superficie, sus usos y caudal.</Alert>
        )}
        {(guardar.error || eliminar.error) && <Alert>{mensajeDeError(guardar.error ?? eliminar.error)}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={guardar.isPending} loading={eliminar.isPending} onClick={() => setDescartar(true)}>
            Cancelar trámite
          </Button>
          <div className="flex gap-3">
            <Button size="sm" variant="secondary" iconLeft="save" disabled={!sinGuardar} loading={guardar.isPending} onClick={() => void persistir().catch(() => undefined)}>
              Guardar
            </Button>
            <Button size="sm" iconRight="arrow_forward" disabled={!evaluacion.valido || guardar.isPending} onClick={() => void siguiente()}>
              Siguiente — Datos por fracción
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={descartar}
        tone="danger"
        title="¿Cancelar la subdivisión?"
        message={`Se descartará la carga del expediente ${borrador.numeroExpediente} con sus fracciones y datos.`}
        confirmLabel="Sí, descartar"
        cancelLabel="Volver"
        onCancel={() => setDescartar(false)}
        onConfirm={() => {
          setDescartar(false)
          eliminar.mutate(borrador.id, { onSuccess: () => navigate(ROUTES.tramites.subdivision.inicio) })
        }}
      />
    </>
  )
}

function Metrica({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('font-semibold tabular-nums', alerta ? 'text-red-600' : 'text-slate-800 dark:text-slate-200')}>{valor}</p>
    </div>
  )
}
