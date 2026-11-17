// Piezas chicas que comparten los paneles del visor.
import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export const claseSelect =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export const claseInput =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

/** Superficie flotante sobre el mapa (paneles, barras, tarjetas). */
export const claseFlotante = 'bg-white shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10'

/** Título de una parte de un panel, con acciones a la derecha. */
export function Subtitulo({ children, acciones }: { children: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{children}</p>
      {acciones && <div className="flex gap-2 text-xs font-semibold text-primary">{acciones}</div>}
    </div>
  )
}

/** Fila con casilla: un valor de la leyenda que se puede apagar (o, sin `tachar`, una capa de un catálogo). */
export function Casilla({
  marcada,
  onCambiar,
  muestra,
  texto,
  cantidad,
  tachar = true,
}: {
  marcada: boolean
  onCambiar: () => void
  muestra: ReactNode
  texto: string
  cantidad?: number
  tachar?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <input type="checkbox" checked={marcada} onChange={onCambiar} className="size-4 shrink-0 rounded border-slate-300 accent-primary" />
      {muestra}
      <span className={cn('min-w-0 flex-1 truncate', marcada ? 'text-slate-700 dark:text-slate-200' : tachar ? 'text-slate-400 line-through' : 'text-slate-500 dark:text-slate-400')}>{texto}</span>
      {cantidad !== undefined && <span className="text-xs text-slate-400 tabular-nums">{cantidad.toLocaleString('es-AR')}</span>}
    </label>
  )
}

/** Fila de leyenda que solo informa (no filtra). */
export function ItemLeyenda({ muestra, texto }: { muestra: ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2 px-1.5 py-1 text-sm text-slate-600 dark:text-slate-300">
      {muestra}
      <span className="truncate">{texto}</span>
    </div>
  )
}

/** Interruptor para prender y apagar una capa. */
export function Interruptor({ activo, onCambiar, etiqueta }: { activo: boolean; onCambiar: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={activo ? `Ocultar ${etiqueta.toLowerCase()}` : `Mostrar ${etiqueta.toLowerCase()}`}
      onClick={onCambiar}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', activo ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', activo && 'translate-x-4')} />
    </button>
  )
}

/** Botón cuadrado con ícono (barra lateral y barra de herramientas). */
export function BotonIcono({
  icono,
  titulo,
  activo,
  marca,
  onClick,
  disabled,
  className,
  children,
  solido = false,
}: {
  icono: string
  titulo: string
  activo?: boolean
  /** Número o punto sobre el botón (ej: cantidad de resultados). */
  marca?: number | boolean
  onClick: () => void
  disabled?: boolean
  className?: string
  children?: ReactNode
  /** Botón azul lleno (barra lateral del visor, como Argenmap); el activo, más oscuro y con borde celeste. */
  solido?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={cn(
        'relative grid size-10 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-50',
        solido
          ? cn('text-white shadow-sm', activo ? 'bg-primary-oscuro ring-2 ring-celeste ring-inset' : 'bg-institucional hover:bg-primary-oscuro')
          : activo
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
        className,
      )}
    >
      {children ?? <Icon name={icono} className="text-[22px]!" />}
      {typeof marca === 'number' && marca > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 font-bold text-white tabular-nums">{marca > 999 ? '999+' : marca}</span>
      )}
      {marca === true && <span className="absolute top-1 right-1 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-800" />}
    </button>
  )
}

/** Control deslizante de la opacidad de una capa (de 0 a 100 %). */
export function ControlOpacidad({ valor, onCambiar, etiqueta = 'Opacidad', nombre }: { valor: number; onCambiar: (valor: number) => void; etiqueta?: string; nombre: string }) {
  const porcentaje = Math.round(valor * 100)
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="shrink-0">{etiqueta}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={porcentaje}
        onChange={(e) => onCambiar(Number(e.target.value) / 100)}
        aria-label={`${etiqueta} de ${nombre}`}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <span className="w-10 shrink-0 text-right whitespace-nowrap tabular-nums">{porcentaje} %</span>
    </label>
  )
}
