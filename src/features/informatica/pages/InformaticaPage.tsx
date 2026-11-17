import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { ActionCard } from '@/components/ui/ActionCard'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { useMatrizPermisos, useUsuarios, type UsuarioListado } from '../api'

function Indicador({ icono, valor, titulo, tono = 'neutro' }: { icono: string; valor: number; titulo: string; tono?: 'neutro' | 'aviso' | 'alerta' }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-surface-dark">
      <div
        className={cn(
          'flex size-11 items-center justify-center rounded-lg',
          tono === 'neutro' && 'bg-primary/10 text-primary',
          tono === 'aviso' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
          tono === 'alerta' && 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
        )}
      >
        <Icon name={icono} className="text-2xl!" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tabular-nums dark:text-white">{valor}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{titulo}</p>
      </div>
    </div>
  )
}

/**
 * Informática: el panel para administrar el acceso al sistema (solo administradores).
 * Resumen de los usuarios y accesos a su ABM y a los permisos de cada rol por oficina.
 */
export default function InformaticaPage() {
  const usuarios = useUsuarios({ estado: 'todos' })
  const matriz = useMatrizPermisos()

  const todos = (usuarios.data ?? []).filter((u) => !u.esSistema)
  const activos = todos.filter((u) => u.activo)
  const porOficina = (matriz.data?.oficinas ?? []).map((o) => {
    const de = activos.filter((u) => u.oficina?.codigo === o.codigo)
    return { ...o, total: de.length, porRol: (matriz.data?.roles ?? []).map((r) => de.filter((u) => u.rol?.codigo === r.codigo).length) }
  })
  const atencion: { u: UsuarioListado; motivo: string }[] = [
    ...activos.filter((u) => u.bloqueadoHasta).map((u) => ({ u, motivo: 'Bloqueado por intentos fallidos' })),
    ...activos.filter((u) => !u.bloqueadoHasta && u.debeCambiarClave).map((u) => ({ u, motivo: u.ultimoAcceso ? 'Contraseña temporal sin cambiar' : 'Todavía no entró' })),
  ]

  return (
    <>
      <PageHeader title="Informática" description="Acceso al sistema: usuarios, oficinas, roles y lo que puede hacer cada uno." />

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard to={ROUTES.informatica.usuarios} icon="group" title="Usuarios" description="Altas, oficina y rol, los permisos de cada uno, bajas y contraseñas temporales." cta="Administrar" />
          <ActionCard
            to={ROUTES.informatica.permisos}
            icon="admin_panel_settings"
            title="Plantillas por rol"
            description="Los permisos que se precargan al crear un usuario según su rol (Jefe, Operador, Solo consulta) y su oficina."
            cta="Administrar"
          />
        </div>

        {usuarios.isPending || matriz.isPending ? (
          <LoadingState mensaje="Cargando el resumen…" />
        ) : usuarios.isError || matriz.isError ? (
          <ErrorState
            error={usuarios.error ?? matriz.error}
            onRetry={() => void Promise.all([usuarios.refetch(), matriz.refetch()])}
            reintentando={usuarios.isFetching || matriz.isFetching}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Indicador icono="how_to_reg" valor={activos.length} titulo="Usuarios activos" />
              <Indicador icono="admin_panel_settings" valor={activos.filter((u) => u.esAdministrador).length} titulo="Administradores" />
              <Indicador icono="key" valor={activos.filter((u) => u.debeCambiarClave).length} titulo="Con contraseña temporal" tono="aviso" />
              <Indicador icono="lock" valor={activos.filter((u) => u.bloqueadoHasta).length} titulo="Bloqueados ahora" tono="alerta" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                  <h3 className="font-bold text-slate-900 dark:text-white">Usuarios activos por oficina</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Oficina</th>
                        {matriz.data.roles.map((r) => (
                          <th key={r.codigo} className="px-4 py-3 text-center">
                            {r.nombre}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {porOficina.map((o) => (
                        <tr key={o.codigo}>
                          <td className="px-4 py-2.5 font-medium">{o.nombre}</td>
                          {o.porRol.map((n, i) => (
                            <td key={i} className={cn('px-4 py-2.5 text-center tabular-nums', !n && 'text-slate-300 dark:text-slate-600')}>
                              {n}
                            </td>
                          ))}
                          <td className={cn('px-4 py-2.5 text-center font-semibold tabular-nums', !o.total && 'text-red-600 dark:text-red-400')} title={o.total ? undefined : 'Nadie puede trabajar en esta oficina'}>
                            {o.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                  <h3 className="font-bold text-slate-900 dark:text-white">Requieren atención</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bloqueados o con la contraseña temporal sin cambiar.</p>
                </div>
                {atencion.length ? (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {atencion.map(({ u, motivo }) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                        <span>
                          <span className="font-medium">
                            {u.apellido}, {u.nombre}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {u.legajo} · {u.oficina?.nombre ?? 'Sin oficina'}
                          </span>
                        </span>
                        <span className="text-right text-xs text-amber-700 dark:text-amber-300">{motivo}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">Nada pendiente.</p>
                )}
                <div className="border-t border-slate-200 px-6 py-3 text-right dark:border-slate-700">
                  <Link to={ROUTES.informatica.usuarios} className="text-sm font-semibold text-primary hover:underline">
                    Ir a usuarios
                  </Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
