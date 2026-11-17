import { useMemo, useState } from 'react'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Field, Input, Select } from '@/components/form'
import { controlClass } from '@/components/form/styles'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { NIVELES_SUMINISTRO, nombreDeNivel, ordenDeNivel, type NivelSuministro } from '@/services/catalogos'
import { ramasDe, useAccionSuministro, useArbolDistrito, useDistritosSuministro, type AccionSuministro, type NodoFicha, type Rama } from '../catalogoSuministro'

/** Color de cada nivel (como en la carga de los jefes), para distinguir las columnas de un vistazo. */
const COLOR_NIVEL: Record<NivelSuministro, string> = {
  FUENTE: 'bg-sky-500',
  SISTEMA: 'bg-cyan-500',
  CANAL_PRINCIPAL: 'bg-teal-500',
  CANAL_SECUNDARIO: 'bg-emerald-500',
  CANAL_TERCIARIO: 'bg-lime-500',
  CANAL_CUARTO: 'bg-amber-500',
  CANAL_QUINTO: 'bg-orange-500',
  DESAGUE: 'bg-slate-400',
}

const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1)
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/** Lo que pide un diálogo: un tramo nuevo (con su nivel), un nombre corregido o el motivo de una baja. */
type Dialogo =
  | { modo: 'agregar'; distritoId: number; padre: NodoFicha | null; camino: string }
  | { modo: 'nombre'; nodo: NodoFicha }
  | { modo: 'baja'; nodo: NodoFicha }

function DialogoSuministro({ dialogo, onCerrar }: { dialogo: Dialogo | null; onCerrar: () => void }) {
  const accion = useAccionSuministro()
  const [texto, setTexto] = useState<string | null>(null)
  const [nivelElegido, setNivelElegido] = useState<NivelSuministro | null>(null)

  // Lo que puede colgar del padre: cualquier nivel posterior (la rama puede no tener alguno).
  const niveles = dialogo?.modo === 'agregar' ? NIVELES_SUMINISTRO.slice(dialogo.padre ? ordenDeNivel(dialogo.padre.nivel) + 1 : 0, dialogo.padre ? undefined : 1) : []
  const nivel = nivelElegido ?? niveles[0]?.nivel ?? 'FUENTE'
  const inicial = dialogo?.modo === 'nombre' ? dialogo.nodo.nombre : ''
  const valor = texto ?? inicial
  const baja = dialogo?.modo === 'baja'
  const valido = baja ? valor.trim().length >= 10 : valor.trim().length > 0 && valor.trim() !== inicial

  function cerrar() {
    setTexto(null)
    setNivelElegido(null)
    accion.reset()
    onCerrar()
  }

  function confirmar() {
    if (!dialogo || !valido) return
    const nombre = valor.trim()
    const pedido: AccionSuministro =
      dialogo.modo === 'agregar'
        ? { tipo: 'crear', distritoId: dialogo.distritoId, nivel, nombre, padreId: dialogo.padre?.id }
        : dialogo.modo === 'nombre'
          ? { tipo: 'editar', id: dialogo.nodo.id, nombre }
          : { tipo: 'baja', id: dialogo.nodo.id, motivo: nombre }
    accion.mutate(pedido, { onSuccess: cerrar })
  }

  const titulo = !dialogo
    ? ''
    : dialogo.modo === 'agregar'
      ? dialogo.padre
        ? `Agregar lo que sale de ${dialogo.padre.nombre}`
        : 'Nueva fuente de agua'
      : dialogo.modo === 'nombre'
        ? `Corregir ${minuscula(nombreDeNivel(dialogo.nodo.nivel))}`
        : `Dar de baja ${minuscula(nombreDeNivel(dialogo.nodo.nivel))}`
  const descripcion = !dialogo
    ? undefined
    : dialogo.modo === 'agregar'
      ? dialogo.camino || undefined
      : dialogo.modo === 'nombre'
        ? 'Las concesiones ya cargadas conservan el nombre anterior.'
        : `${dialogo.nodo.nombre}${dialogo.nodo.hijos.length ? ' y todo lo que sale de él' : ''}`

  return (
    <Modal
      open={!!dialogo}
      onClose={cerrar}
      bloqueado={accion.isPending}
      size="md"
      icon={baja ? 'block' : dialogo?.modo === 'agregar' ? 'add' : 'edit'}
      title={titulo}
      description={descripcion}
      footer={
        <>
          <Button variant="ghost" onClick={cerrar} disabled={accion.isPending}>
            Cancelar
          </Button>
          <Button variant={baja ? 'danger' : 'primary'} iconLeft={baja ? 'block' : 'check'} loading={accion.isPending} disabled={!valido} onClick={confirmar}>
            {baja ? 'Dar de baja' : dialogo?.modo === 'agregar' ? 'Agregar' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        {dialogo?.modo === 'agregar' && dialogo.padre && (
          <Field id="nivel-suministro" label="¿Qué es?" required hint="Si la rama no tiene algún nivel, elija directamente el siguiente (ej: un canal terciario que sale del principal).">
            <Select
              id="nivel-suministro"
              options={niveles.map((n) => ({ value: n.nivel, label: n.nombre }))}
              value={nivel}
              onChange={(e) => setNivelElegido(e.target.value as NivelSuministro)}
            />
          </Field>
        )}
        {baja ? (
          <Field id="motivo-baja" label="Motivo de la baja" required hint="Deja de ofrecerse en el alta. Las concesiones ya cargadas conservan lo que tienen.">
            <textarea id="motivo-baja" rows={3} maxLength={1000} value={valor} onChange={(e) => setTexto(e.target.value)} className={controlClass({})} autoFocus />
          </Field>
        ) : (
          <Field id="nombre-suministro" label="Nombre" required hint="Tal como lo conoce el distrito. Se guarda en mayúsculas.">
            <Input id="nombre-suministro" maxLength={120} value={valor} onChange={(e) => setTexto(e.target.value)} autoFocus />
          </Field>
        )}
        {accion.isError && <Alert>{mensajeDeError(accion.error)}</Alert>}
      </form>
    </Modal>
  )
}

/** El tramo elegido en la tabla: de dónde viene y qué se puede hacer con él. */
function BarraSeleccion({ camino, distritoId, abrir, onCerrar }: { camino: Rama; distritoId: number; abrir: (d: Dialogo) => void; onCerrar: () => void }) {
  const accion = useAccionSuministro()
  const nodo = camino.at(-1)!
  const padre = camino.at(-2)
  const textoCamino = camino.map((n) => n.nombre).join(' → ')
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-primary/5 px-4 py-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{nombreDeNivel(nodo.nivel)}</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {nodo.nombre}
            {!nodo.activo && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">De baja</span>}
          </p>
          {padre && <p className="text-xs text-slate-500 dark:text-slate-400">Viene de: {camino.slice(0, -1).map((n) => n.nombre).join(' → ')}</p>}
        </div>
        <button type="button" aria-label="Quitar la selección" onClick={onCerrar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
          <Icon name="close" />
        </button>
      </div>
      {nodo.baja && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Dado de baja el {new Date(nodo.baja.fecha).toLocaleDateString('es-AR')}: {nodo.baja.motivo}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {nodo.activo ? (
          <>
            {nodo.nivel !== 'DESAGUE' && (
              <Button size="sm" iconLeft="add" onClick={() => abrir({ modo: 'agregar', distritoId, padre: nodo, camino: textoCamino })}>
                Agregar lo que sale de acá
              </Button>
            )}
            <Button size="sm" variant="secondary" iconLeft="edit" onClick={() => abrir({ modo: 'nombre', nodo })}>
              Corregir nombre
            </Button>
            <Button size="sm" variant="secondary" iconLeft="block" onClick={() => abrir({ modo: 'baja', nodo })}>
              Dar de baja
            </Button>
          </>
        ) : (
          <Button size="sm" iconLeft="restart_alt" loading={accion.isPending} onClick={() => accion.mutate({ tipo: 'reactivar', id: nodo.id })}>
            Reactivar
          </Button>
        )}
      </div>
      {accion.isError && <Alert>{mensajeDeError(accion.error)}</Alert>}
    </div>
  )
}

/**
 * La tabla como el Excel de los jefes: una columna por nivel, una fila por rama. Lo que se repite
 * con la fila de arriba queda en blanco, así se ve de dónde sale cada tramo.
 */
function TablaArbol({ ramas, seleccion, onElegir }: { ramas: Rama[]; seleccion: number | null; onElegir: (id: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {NIVELES_SUMINISTRO.map((n) => (
              <th key={n.nivel} className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className={cn('size-2 shrink-0 rounded-full', COLOR_NIVEL[n.nivel])} aria-hidden="true" />
                  {n.nombre}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ramas.map((rama, r) => {
            const anterior = ramas[r - 1]
            const ultimaColumna = ordenDeNivel(rama.at(-1)!.nivel)
            // Fila que empieza otra fuente: línea de separación más marcada.
            const otraFuente = !anterior || anterior[0] !== rama[0]
            return (
              <tr key={rama.map((n) => n.id).join('-')} className={cn(otraFuente && r > 0 && 'border-t-2 border-slate-200 dark:border-slate-700')}>
                {NIVELES_SUMINISTRO.map((n, c) => {
                  const nodo = rama.find((x) => x.nivel === n.nivel)
                  if (!nodo) {
                    return (
                      <td key={n.nivel} className="px-3 py-1.5 text-slate-300 dark:text-slate-600">
                        {c < ultimaColumna ? '—' : ''}
                      </td>
                    )
                  }
                  const repetido = !!anterior?.includes(nodo)
                  return (
                    <td key={n.nivel} className="p-0 align-top">
                      {!repetido && (
                        <button
                          type="button"
                          onClick={() => onElegir(nodo.id)}
                          title={`${n.nombre}: ${nodo.nombre}`}
                          className={cn(
                            'w-full px-3 py-1.5 text-left transition-colors hover:bg-primary/10',
                            nodo.id === seleccion && 'bg-primary/15 font-semibold text-primary shadow-[inset_3px_0_0_var(--color-celeste)]',
                            !nodo.activo && 'text-slate-400 line-through dark:text-slate-500',
                            c === 0 && 'font-semibold',
                          )}
                        >
                          {nodo.nombre}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ArbolDeDistrito({ distritoId, verBajas, abrir }: { distritoId: number; verBajas: boolean; abrir: (d: Dialogo) => void }) {
  const arbol = useArbolDistrito(distritoId)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [texto, setTexto] = useState('')

  const ramas = useMemo(() => (arbol.data ? ramasDe(arbol.data.nodos, verBajas) : []), [arbol.data, verBajas])
  const visibles = useMemo(() => {
    const t = normalizar(texto.trim())
    return t ? ramas.filter((rama) => rama.some((n) => normalizar(n.nombre).includes(t))) : ramas
  }, [ramas, texto])
  // El camino hasta el tramo elegido (de cualquier rama que lo contenga).
  const camino = useMemo(() => {
    if (seleccion === null) return null
    for (const rama of ramas) {
      const i = rama.findIndex((n) => n.id === seleccion)
      if (i >= 0) return rama.slice(0, i + 1)
    }
    return null
  }, [ramas, seleccion])

  if (arbol.isPending) return <LoadingState mensaje="Cargando el árbol…" />
  if (arbol.isError) return <ErrorState error={arbol.error} onRetry={() => void arbol.refetch()} reintentando={arbol.isFetching} className="m-6" />

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3 dark:border-slate-700">
        <div className="min-w-56 flex-1">
          <Input icon="search" placeholder="Buscar fuente, sistema o canal…" aria-label="Buscar en el árbol" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        {arbol.isFetching && <Spinner className="size-4 text-primary" />}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visibles.length} rama{visibles.length === 1 ? '' : 's'}
        </span>
        <Button iconLeft="water" size="sm" onClick={() => abrir({ modo: 'agregar', distritoId, padre: null, camino: arbol.data.distrito.nombre })}>
          Nueva fuente
        </Button>
      </div>
      {camino && <BarraSeleccion camino={camino} distritoId={distritoId} abrir={abrir} onCerrar={() => setSeleccion(null)} />}
      {ramas.length === 0 ? (
        <EmptyState icon="account_tree" titulo="El distrito no tiene árbol cargado" descripcion="Empiece por una fuente de agua; después se agrega lo que sale de ella." className="m-6" />
      ) : visibles.length === 0 ? (
        <EmptyState icon="search_off" titulo="No hay tramos con ese nombre" className="m-6" />
      ) : (
        <TablaArbol ramas={visibles} seleccion={seleccion} onElegir={setSeleccion} />
      )}
    </>
  )
}

/**
 * Árbol de suministro de riego de cada distrito: lo que el alta ofrece en el paso 6. Es el que
 * cargaron los jefes de Distrito; si falta una fuente, un sistema, un canal o un desagüe, quien
 * tiene el permiso «Administrar catálogos» lo agrega acá y desde ese momento todos lo pueden elegir.
 */
export default function CatalogoSuministroPage() {
  const distritos = useDistritosSuministro()
  const [elegido, setElegido] = useState<number | null>(null)
  const [verBajas, setVerBajas] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const distritoId = elegido ?? distritos.data?.[0]?.id ?? null

  function contenido() {
    if (distritos.isPending) return <LoadingState mensaje="Cargando distritos…" />
    if (distritos.isError) return <ErrorState error={distritos.error} onRetry={() => void distritos.refetch()} reintentando={distritos.isFetching} className="m-6" />
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-2 dark:border-slate-700">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Distrito">
            {distritos.data.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={d.id === distritoId}
                onClick={() => setElegido(d.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold',
                  d.id === distritoId ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
                )}
              >
                {d.nombre}
                <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">{d.fuentes}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 px-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="size-4 accent-primary" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
            Mostrar lo dado de baja
          </label>
        </div>
        {distritoId !== null && <ArbolDeDistrito key={distritoId} distritoId={distritoId} verBajas={verBajas} abrir={setDialogo} />}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Catálogo de suministro"
        description="El árbol de cada distrito: de qué fuente sale el agua, por qué sistema y canales llega y dónde desagua. Es lo que se ofrece al cargar un alta: si falta algo, se agrega acá y queda disponible para todos. Toque un tramo para agregar lo que sale de él, corregirlo o darlo de baja."
      />
      <Card>{contenido()}</Card>
      <DialogoSuministro key={dialogo ? `${dialogo.modo}-${dialogo.modo === 'agregar' ? (dialogo.padre?.id ?? 'fuente') : dialogo.nodo.id}` : 'cerrado'} dialogo={dialogo} onCerrar={() => setDialogo(null)} />
    </>
  )
}
