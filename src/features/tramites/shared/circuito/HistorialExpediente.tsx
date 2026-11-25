import { ErrorState, LoadingState } from '@/components/feedback/States'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { ActuacionHistorial, EntradaHistorial } from '../../backend.types'
import { useHistorial } from '../../hooks'

const formatear = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Nombre de cada actuación para leer el historial sin códigos. */
const ACTUACION: Record<string, string> = {
  CARGA_COMPLETA: 'Carga completa',
  CORRECCION: 'Corrigió las observaciones',
  VERIFICACION_DEUDA: 'Verificó la deuda',
  DEUDA_CANCELADA: 'Se canceló la deuda',
  INFORME_TECNICO: 'Informe técnico',
  DICTAMEN_JURIDICO: 'Dictamen jurídico',
  NUMERO_CONCESION: 'Asignó el número de concesión',
  RESOLUCION: 'Cargó la resolución',
  VERIFICACION_FINAL: 'Verificación final',
  PADRON: 'Cargó el padrón de Rentas',
  PUBLICACION_MAPA: 'Publicación en el mapa (Argenmap)',
  CANCELACION: 'Canceló el trámite (iniciado por error)',
  REASIGNACION: 'Reasignó el expediente a otro usuario',
  CORRECCION_DATOS: 'Corrección de datos',
  // Baja de pozo (el historial es el mismo para cualquier expediente)
  DOCUMENTACION: 'Control de documentación',
  ANTECEDENTES: 'Verificó los antecedentes',
  EVALUACION_TECNICA: 'Evaluación técnica',
  CLAUSURA: 'Registró la clausura física',
  TOMA_CONOCIMIENTO: 'Tomó conocimiento',
  // Registro de pozo
  REGISTRO_POZO: 'Registró el pozo',
  REGISTRO_CONCESION: 'Registró la concesión del pozo',
  CIERRE: 'Cerró el expediente',
}

const RESULTADO: Record<string, { texto: string; color: string }> = {
  APTO: { texto: 'Apto', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  NO_APTO: { texto: 'No apto', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  OBSERVADO: { texto: 'Observado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  SIN_DEUDA: { texto: 'Sin deuda', color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  CON_DEUDA: { texto: 'Con deuda', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  REGISTRADO: { texto: 'Registrado', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
}

/** Dato extra de una actuación que conviene ver (número de concesión, resolución, padrón). */
function datoDestacado(e: ActuacionHistorial): string | null {
  if (e.reservado) return null
  const d = e.datos ?? {}
  if (e.actuacion === 'NUMERO_CONCESION' || ((e.actuacion === 'REGISTRO_CONCESION' || e.actuacion === 'CIERRE') && d.numero)) return `Concesión N° ${String(d.numero)}`
  if (e.actuacion === 'RESOLUCION') return `Resolución ${String(d.resolucion)} del ${String(d.fecha)}${d.decision === 'RECHAZAR' ? ' (rechaza)' : ''}`
  if (e.actuacion === 'CLAUSURA') return `Acta ${String(d.acta)} del ${String(d.fecha)}`
  if (e.actuacion === 'PADRON') return `Padrón ${String(d.padron)}`
  if (e.actuacion === 'CORRECCION_DATOS') return `Sección: ${String(d.seccion)}`
  if (e.actuacion === 'VERIFICACION_DEUDA' && Array.isArray(d.deudas) && d.deudas.length) {
    return (d.deudas as { detalle: string }[]).map((x) => x.detalle).join(' · ')
  }
  return null
}

interface CambioCorregido {
  campo: string
  antes: string | null
  despues: string | null
  /** Dato sensible: sin el permiso «Ver datos sensibles» llega sin valores. */
  sensible?: boolean
}

/** Los datos corregidos: cómo estaban y cómo quedaron. */
function Cambios({ cambios }: { cambios: CambioCorregido[] }) {
  const valor = (v: string | null, c: CambioCorregido) => (v ?? (c.sensible ? 'Dato reservado' : 'Sin dato'))
  return (
    <div className="mt-1.5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-3 py-1.5">Dato</th>
            <th className="px-3 py-1.5">Anterior</th>
            <th className="px-3 py-1.5">Corregido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {cambios.map((c) => (
            <tr key={c.campo}>
              <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">{c.campo}</td>
              <td className="px-3 py-1.5 text-slate-500 line-through decoration-slate-300 dark:text-slate-400">{valor(c.antes, c)}</td>
              <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">{valor(c.despues, c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Ícono y color del punto de cada entrada. */
function marca(e: EntradaHistorial): { icono: string; clase: string } {
  if (e.tipo === 'PASE') return e.esDevolucion ? { icono: 'undo', clase: 'bg-amber-100 text-amber-600' } : { icono: 'arrow_forward', clase: 'bg-primary/10 text-primary' }
  if (e.tipo === 'ESTADO') return { icono: 'swap_horiz', clase: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' }
  if (e.actuacion === 'CORRECCION_DATOS') return { icono: 'edit_note', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' }
  return { icono: 'gavel', clase: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
}

/**
 * Historial del expediente: cada pase (de qué oficina a cuál, quién lo envió, quién lo tomó
 * y cuándo), cada actuación (qué resolvió cada oficina) y cada cambio de estado, en orden.
 */
export function HistorialAlta({ expedienteId }: { expedienteId: string }) {
  const historial = useHistorial(expedienteId)
  if (historial.isPending) return <LoadingState mensaje="Cargando historial…" className="py-6" />
  if (historial.isError) return <ErrorState error={historial.error} onRetry={() => void historial.refetch()} className="py-6" />

  return (
    <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
      {historial.data.map((e, i) => (
        <li key={i} className="mb-4 ml-5">
          <span className={cn('absolute -left-3 grid size-6 place-items-center rounded-full ring-4 ring-white dark:ring-slate-900', marca(e).clase)}>
            <Icon name={marca(e).icono} className="text-[14px]!" />
          </span>
          {e.tipo === 'ESTADO' ? (
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.oficina}: {e.estadoAnteriorNombre ? `${e.estadoAnteriorNombre} → ${e.estadoNombre}` : e.estadoNombre}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatear(e.fecha)} · {e.usuario}
              </p>
            </div>
          ) : e.tipo === 'PASE' ? (
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.oficinaOrigen ? `${e.oficinaOrigen} → ${e.oficinaDestino}` : `Ingreso en ${e.oficinaDestino}`}
                {e.esDevolucion && <span className="ml-2 text-xs font-semibold text-amber-600">devolución</span>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatear(e.fecha)} · lo envió {e.enviadoPor}
                {e.recibidoPor ? ` · lo tomó ${e.recibidoPor} (${formatear(e.recibidoEn!)})` : ' · todavía nadie lo tomó'}
              </p>
            </div>
          ) : (
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.reservado ? (
                  <>
                    {e.oficina}: actuó en «{e.etapa}»
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400" title="El detalle solo lo ve esa oficina">
                      <Icon name="lock" className="text-[12px]!" />
                      Reservado a la oficina
                    </span>
                  </>
                ) : (
                  <>
                    {e.oficina}: {ACTUACION[e.actuacion] ?? e.actuacion}
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', RESULTADO[e.resultado]?.color)}>{RESULTADO[e.resultado]?.texto ?? e.resultado}</span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatear(e.fecha)} · {e.usuario}
              </p>
              {datoDestacado(e) && <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{datoDestacado(e)}</p>}
              {e.observaciones && (
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {e.actuacion === 'CORRECCION_DATOS' && <span className="font-semibold">Motivo: </span>}
                  {e.observaciones}
                </p>
              )}
              {e.actuacion === 'CORRECCION_DATOS' && Array.isArray(e.datos?.cambios) && <Cambios cambios={e.datos.cambios as CambioCorregido[]} />}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
