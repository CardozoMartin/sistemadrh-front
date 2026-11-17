import type { RefObject } from 'react'

interface Props {
  /** Donde el mapa escribe la posición del cursor. */
  refCursor: RefObject<HTMLSpanElement | null>
  zoom: number
  escala: number
}

/** Escala con dos cifras significativas (1:52.341 → 1:52.000). */
function redondearEscala(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const potencia = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1)
  return `1:${(Math.round(n / potencia) * potencia).toLocaleString('es-AR')}`
}

/** Barra de estado al pie del mapa: sistema de referencia, posición del cursor, escala y zoom. */
export function BarraEstado({ refCursor, zoom, escala }: Props) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-1000 flex h-7 items-center gap-3 border-t border-slate-200 bg-white/90 px-3 text-[11px] text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
      <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 sm:inline dark:bg-slate-800 dark:text-slate-200" title="Sistema de referencia de la base de datos">
        EPSG:5345 · POSGAR 2007 faja 3
      </span>
      <span ref={refCursor} className="min-w-0 flex-1 truncate font-mono">
        Mueva el cursor sobre el mapa
      </span>
      <span className="shrink-0 tabular-nums" title="Escala aproximada en el centro del mapa">
        Escala {redondearEscala(escala)}
      </span>
      <span className="hidden shrink-0 tabular-nums sm:inline">Zoom {zoom}</span>
    </div>
  )
}
