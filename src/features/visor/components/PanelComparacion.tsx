import { Icon } from '@/components/ui/Icon'
import { formatearPosgar } from '@/lib/posgar'
import type { AnalisisGeometria } from '@/services/sig'
import { COLOR_COMPARACION, formatoHa } from '../estilos'

interface Props {
  analisis: AnalisisGeometria
  onSeleccionar: (concesionId: number) => void
  onCerrar: () => void
}

/**
 * Resultado de comparar un KML contra las concesiones cargadas: superficie oficial
 * (PostGIS), punto interior en POSGAR y con qué concesiones se superpone. Sirve para
 * revisar un pedido ANTES de iniciar el trámite. No guarda nada.
 */
export function PanelComparacion({ analisis, onSeleccionar, onCerrar }: Props) {
  const { superposiciones } = analisis
  return (
    <div className="w-full rounded-lg border-2 bg-white dark:bg-slate-800" style={{ borderColor: COLOR_COMPARACION }}>
      <div className="flex items-start gap-2 border-b border-slate-100 p-3 dark:border-slate-700">
        <Icon name="compare" className="text-[20px]!" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{analisis.nombres[0] ?? analisis.archivo.nombre}</p>
          <p className="text-xs text-slate-500">Comparación · no se guarda</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Quitar comparación" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
          <Icon name="close" className="text-[18px]!" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3 text-sm">
        <p className="text-slate-700 dark:text-slate-200">
          <strong>{formatoHa(analisis.superficieHa)}</strong> · {Math.round(analisis.perimetroM).toLocaleString('es-AR')} m de perímetro
        </p>
        <p className="font-mono text-xs text-slate-500">POSGAR {formatearPosgar(analisis.puntoInteriorPosgar)}</p>
        {analisis.sistemaOrigenNombre && <p className="text-xs text-slate-500">Coordenadas del archivo: {analisis.sistemaOrigenNombre}</p>}
        {analisis.cauceCercano && (
          <p className="text-xs text-slate-500">
            Cauce más cercano: {analisis.cauceCercano.nombre ?? 'sin nombre'} a {analisis.cauceCercano.distanciaM.toLocaleString('es-AR')} m
          </p>
        )}
        {analisis.avisos.map((a) => (
          <p key={a} className="text-xs text-amber-700 dark:text-amber-300">
            {a}
          </p>
        ))}

        {superposiciones.length ? (
          <div className="mt-1">
            <p className="font-semibold text-red-700 dark:text-red-300">
              Se superpone con {superposiciones.length === 1 ? '1 concesión' : `${superposiciones.length} concesiones`}:
            </p>
            <ul className="mt-1 flex max-h-40 flex-col overflow-y-auto">
              {superposiciones.map((s) => (
                <li key={s.concesionId}>
                  <button
                    type="button"
                    onClick={() => onSeleccionar(Number(s.concesionId))}
                    className="flex w-full justify-between gap-2 rounded px-1 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <span className="min-w-0 truncate">
                      {s.numero ? `Concesión ${s.numero}` : `Exp. ${s.expediente ?? '—'}`} · {s.titular ?? '—'}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatoHa(s.superficieHa)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400">
            <Icon name="check_circle" filled className="text-[18px]!" />
            No se superpone con ninguna concesión cargada.
          </p>
        )}
      </div>
    </div>
  )
}
