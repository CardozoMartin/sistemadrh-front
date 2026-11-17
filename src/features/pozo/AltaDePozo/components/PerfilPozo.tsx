import { formatear, type Intervalo } from '../calculos'
import { TIPOS_LITOLOGIA } from '../catalogos'

interface Props {
  profundidad: number
  /** Capas de la litología (columna estratigráfica). */
  capas?: (Intervalo & { tipo: string })[]
  /** Tramos ciegos y filtros (esquema constructivo del entubado). */
  tramos?: Intervalo[]
  filtros?: Intervalo[]
}

const ALTO = 320

/**
 * Perfil del pozo a escala: columna estratigráfica (litología) y/o esquema constructivo
 * (caño ciego en gris, filtros rayados en azul). Lo que queda sin entubar se ve vacío.
 */
export function PerfilPozo({ profundidad, capas, tramos, filtros }: Props) {
  if (profundidad <= 0) {
    return <p className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 text-center text-xs text-slate-400 dark:border-slate-600">Cargue capas o tramos para ver el perfil.</p>
  }
  const y = (m: number) => (Math.min(m, profundidad) / profundidad) * ALTO
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * profundidad)
  const banda = (i: Intervalo, key: string | number, estilo: React.CSSProperties, titulo: string) => (
    <div key={key} title={titulo} className="absolute inset-x-0 border-y border-white/60 dark:border-slate-900/60" style={{ top: y(i.desde), height: Math.max(y(i.hasta) - y(i.desde), 1), ...estilo }} />
  )

  return (
    <div className="flex gap-2" aria-label="Perfil del pozo">
      {/* Escala en metros */}
      <div className="relative w-10 text-right text-[10px] text-slate-400" style={{ height: ALTO }}>
        {marcas.map((m) => (
          <span key={m} className="absolute right-0 -translate-y-1/2" style={{ top: y(m) }}>
            {formatear(m, 0)} m
          </span>
        ))}
      </div>
      {capas && (
        <div className="flex flex-col items-center gap-1">
          <div className="relative w-14 overflow-hidden rounded bg-slate-100 dark:bg-slate-800" style={{ height: ALTO }}>
            {capas.map((c, i) => banda(c, i, { backgroundColor: TIPOS_LITOLOGIA[c.tipo] ?? TIPOS_LITOLOGIA['SIN TIPO'] }, `${c.tipo || 'Sin tipo'}: ${formatear(c.desde)} a ${formatear(c.hasta)} m`))}
          </div>
          <span className="text-[10px] font-semibold text-slate-500">Litología</span>
        </div>
      )}
      {(tramos || filtros) && (
        <div className="flex flex-col items-center gap-1">
          <div className="relative w-10 rounded bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700" style={{ height: ALTO }}>
            {(tramos ?? []).map((t, i) => banda(t, `t${i}`, { backgroundColor: '#94a3b8' }, `Caño ciego: ${formatear(t.desde)} a ${formatear(t.hasta)} m`))}
            {(filtros ?? []).map((f, i) =>
              banda(f, `f${i}`, { backgroundImage: 'repeating-linear-gradient(0deg, #0284c7 0 2px, #e0f2fe 2px 5px)' }, `Filtro: ${formatear(f.desde)} a ${formatear(f.hasta)} m`),
            )}
          </div>
          <span className="text-[10px] font-semibold text-slate-500">Entubado</span>
        </div>
      )}
    </div>
  )
}
