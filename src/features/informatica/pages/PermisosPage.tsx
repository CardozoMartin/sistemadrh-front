import { useMemo, useState } from 'react'
import { Alert, ErrorState, LoadingState } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { permisosDeOficina, useGuardarPermisosRol, useMatrizPermisos, type MatrizPermisos } from '../api'

type Borrador = Record<string, string[]>

const deLaOficina = (m: MatrizPermisos, oficina: string): Borrador =>
  Object.fromEntries(m.roles.map((r) => [r.codigo, m.otorgados.filter((o) => o.oficina === oficina && o.rol === r.codigo).map((o) => o.permiso)]))

const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Qué puede hacer cada rol en cada oficina (seg_rol_permiso). Consultar no requiere permisos:
 * acá están solo las acciones que modifican datos. El administrador puede todo siempre.
 */
export default function PermisosPage() {
  const matriz = useMatrizPermisos()
  const guardar = useGuardarPermisosRol()
  const [oficina, setOficina] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardado, setGuardado] = useState(false)

  const m = matriz.data
  const oficinaActual = oficina ?? m?.oficinas[0]?.codigo ?? null
  const original = useMemo(() => (m && oficinaActual ? deLaOficina(m, oficinaActual) : null), [m, oficinaActual])
  const valores = borrador ?? original
  const cambiados = m && original && valores ? m.roles.filter((r) => !iguales(valores[r.codigo] ?? [], original[r.codigo] ?? [])).map((r) => r.codigo) : []
  // Solo los permisos que se pueden asignar en la oficina elegida (los suyos y los generales).
  const disponibles = useMemo(() => (m && oficinaActual ? permisosDeOficina(m, oficinaActual) : []), [m, oficinaActual])
  const grupos = useMemo(() => [...new Set(disponibles.map((p) => p.grupo))], [disponibles])

  function elegirOficina(codigo: string) {
    if (cambiados.length && !window.confirm('Hay cambios sin guardar en esta oficina. ¿Descartarlos?')) return
    setOficina(codigo)
    setBorrador(null)
    setGuardado(false)
  }

  function alternar(rol: string, permiso: string) {
    if (!valores) return
    const actuales = valores[rol] ?? []
    setBorrador({ ...valores, [rol]: actuales.includes(permiso) ? actuales.filter((p) => p !== permiso) : [...actuales, permiso] })
    setGuardado(false)
  }

  async function guardarCambios() {
    if (!oficinaActual || !valores) return
    for (const rol of cambiados) await guardar.mutateAsync({ oficina: oficinaActual, rol, permisos: valores[rol] ?? [] })
    setBorrador(null)
    setGuardado(true)
  }

  if (matriz.isPending) return <LoadingState mensaje="Cargando permisos…" />
  if (matriz.isError) return <ErrorState error={matriz.error} onRetry={() => void matriz.refetch()} reintentando={matriz.isFetching} />
  if (!m || !oficinaActual || !valores) return null
  const nombreOficina = m.oficinas.find((o) => o.codigo === oficinaActual)?.nombre

  return (
    <>
      <PageHeader
        title="Plantillas por rol"
        description="Los permisos que se precargan al crear un usuario con ese rol en esa oficina. Cambiar una plantilla no cambia a los usuarios que ya existen: sus permisos se editan en Usuarios."
      />

      <div className="flex flex-col gap-6">
        <div role="tablist" aria-label="Oficina" className="flex flex-wrap gap-2">
          {m.oficinas.map((o) => (
            <button
              key={o.codigo}
              type="button"
              role="tab"
              aria-selected={o.codigo === oficinaActual}
              onClick={() => elegirOficina(o.codigo)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-semibold',
                o.codigo === oficinaActual
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-primary/50 dark:border-slate-600 dark:bg-surface-dark dark:text-slate-300',
              )}
            >
              {o.nombre}
            </button>
          ))}
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Permiso en {nombreOficina}</th>
                  {m.roles.map((r) => (
                    <th key={r.codigo} className="w-32 px-4 py-3 text-center" title={r.descripcion ?? undefined}>
                      {r.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              {grupos.map((grupo) => (
                <tbody key={grupo} className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <th colSpan={m.roles.length + 1} className="bg-slate-50/60 px-4 pt-4 pb-1 text-xs font-bold text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                      {grupo}
                    </th>
                  </tr>
                  {disponibles
                    .filter((p) => p.grupo === grupo)
                    .map((p) => (
                      <tr key={p.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{p.nombre}</span>
                          {p.descripcion && <span className="block text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</span>}
                        </td>
                        {m.roles.map((r) => (
                          <td key={r.codigo} className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              aria-label={`${p.nombre}: ${r.nombre} de ${nombreOficina}`}
                              checked={(valores[r.codigo] ?? []).includes(p.codigo)}
                              onChange={() => alternar(r.codigo, p.codigo)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              ))}
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {cambiados.length ? `Cambios sin guardar en: ${cambiados.map((c) => m.roles.find((r) => r.codigo === c)?.nombre).join(', ')}.` : guardado ? 'Cambios guardados.' : 'Sin cambios.'}
            </span>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" disabled={!cambiados.length || guardar.isPending} onClick={() => setBorrador(null)}>
                Descartar
              </Button>
              <Button size="sm" iconLeft="save" loading={guardar.isPending} disabled={!cambiados.length || guardar.isPending} onClick={() => void guardarCambios()}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </Card>
        {guardar.error && <Alert>{mensajeDeError(guardar.error)}</Alert>}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Además de tener el permiso, para actuar sobre un expediente tiene que estar en la oficina del usuario.
        </p>
      </div>
    </>
  )
}
