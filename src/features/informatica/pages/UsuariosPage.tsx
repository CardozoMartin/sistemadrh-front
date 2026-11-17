import { useEffect, useState } from 'react'
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Input, Select } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatearFecha } from '@/config/expedientes'
import { useSesion } from '@/features/auth/context'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import { useAccionUsuario, useMatrizPermisos, useUsuarios, usuariosApi, type ConClaveTemporal, type FiltrosUsuarios, type UsuarioListado } from '../api'
import { UsuarioDialog } from '../components/UsuarioDialog'

function Etiqueta({ tono, children }: { tono: 'verde' | 'gris' | 'ambar' | 'rojo' | 'azul'; children: string }) {
  const clases = {
    verde: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    gris: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    ambar: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    rojo: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    azul: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  }
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', clases[tono])}>{children}</span>
}

function Estado({ u }: { u: UsuarioListado }) {
  if (u.esSistema) return <Etiqueta tono="gris">No ingresa</Etiqueta>
  if (!u.activo) return <Etiqueta tono="gris">De baja</Etiqueta>
  if (u.bloqueadoHasta) return <Etiqueta tono="rojo">Bloqueado</Etiqueta>
  if (u.debeCambiarClave) return <Etiqueta tono="ambar">Clave temporal</Etiqueta>
  return <Etiqueta tono="verde">Activo</Etiqueta>
}

/** Muestra la contraseña temporal una sola vez (alta o restablecimiento). */
function ClaveTemporalDialog({ dato, onCerrar }: { dato: ConClaveTemporal; onCerrar: () => void }) {
  const [copiada, setCopiada] = useState(false)
  return (
    <Modal
      open
      size="md"
      icon="key"
      title="Contraseña temporal"
      description={`Désela a ${dato.usuario.nombre} ${dato.usuario.apellido}. No se vuelve a mostrar: al entrar la cambia por una propia.`}
      onClose={onCerrar}
      footer={<Button onClick={onCerrar}>Listo</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Usuario: <span className="font-semibold">{dato.usuario.legajo}</span> (o {dato.usuario.email})
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-800">
          <code className="font-mono text-xl font-bold tracking-wider select-all">{dato.claveTemporal}</code>
          <Button
            size="sm"
            variant="secondary"
            iconLeft={copiada ? 'check' : 'content_copy'}
            onClick={() => void navigator.clipboard?.writeText(dato.claveTemporal).then(() => setCopiada(true))}
          >
            {copiada ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** ABM de usuarios (solo administradores). */
export default function UsuariosPage() {
  const { usuario: yo } = useSesion()
  const [f, setF] = useState<FiltrosUsuarios>({ estado: 'activos' })
  const [texto, setTexto] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setF((x) => ({ ...x, texto: texto.trim() || undefined })), 300)
    return () => clearTimeout(t)
  }, [texto])

  const usuarios = useUsuarios(f)
  const matriz = useMatrizPermisos()
  const [editando, setEditando] = useState<UsuarioListado | 'nuevo' | null>(null)
  const [clave, setClave] = useState<ConClaveTemporal | null>(null)
  const [paraBaja, setParaBaja] = useState<UsuarioListado | null>(null)
  const [motivo, setMotivo] = useState('')
  const [paraRestablecer, setParaRestablecer] = useState<UsuarioListado | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const crear = useAccionUsuario(usuariosApi.crear)
  const actualizar = useAccionUsuario(usuariosApi.actualizar)
  const baja = useAccionUsuario(usuariosApi.baja)
  const reactivar = useAccionUsuario(usuariosApi.reactivar)
  const restablecer = useAccionUsuario(usuariosApi.restablecerClave)
  const errorAccion = baja.error ?? reactivar.error ?? restablecer.error

  function tabla() {
    if (usuarios.isPending) return <LoadingState mensaje="Cargando usuarios…" className="py-10" />
    if (usuarios.isError) return <ErrorState error={usuarios.error} onRetry={() => void usuarios.refetch()} reintentando={usuarios.isFetching} className="m-6" />
    if (!usuarios.data.length) return <EmptyState icon="person_search" titulo="No hay usuarios con esos filtros" className="m-6" />
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Legajo</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Oficina</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último acceso</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {usuarios.data.map((u) => (
              <tr key={u.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40', !u.activo && 'text-slate-400')}>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{u.legajo}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">
                    {u.apellido}, {u.nombre}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                  {!u.activo && u.bajaMotivo && <span className="block text-xs text-slate-400">Baja: {u.bajaMotivo}</span>}
                </td>
                <td className="px-4 py-3">
                  {u.oficina?.nombre ?? '—'}
                  {u.distrito && <span className="block text-xs text-slate-500 dark:text-slate-400">{u.distrito.nombre}</span>}
                </td>
                <td className="px-4 py-3">
                  {u.esAdministrador && <Etiqueta tono="azul">Administrador</Etiqueta>} {u.rol?.nombre ?? (u.esAdministrador ? '' : '—')}
                  {!u.esAdministrador && !u.esSistema && (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {u.permisos.length} permiso{u.permisos.length === 1 ? '' : 's'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Estado u={u} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{u.ultimoAcceso ? formatearFecha(u.ultimoAcceso) : 'Nunca'}</td>
                <td className="px-4 py-3">
                  {u.esSistema ? (
                    <span className="block text-right text-xs text-slate-400" title="Firma los procesos automáticos">
                      Usuario del sistema
                    </span>
                  ) : (
                    <div className="flex justify-end gap-1">
                      {u.activo && (
                        <>
                          <Button size="sm" variant="ghost" iconLeft="edit" onClick={() => setEditando(u)} title="Editar">
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" iconLeft="key" onClick={() => setParaRestablecer(u)} title="Restablecer contraseña">
                            Clave
                          </Button>
                          {u.id !== yo?.id && (
                            <Button size="sm" variant="ghost" iconLeft="person_off" onClick={() => (setMotivo(''), setParaBaja(u))} title="Dar de baja">
                              Baja
                            </Button>
                          )}
                        </>
                      )}
                      {!u.activo && (
                        <Button
                          size="sm"
                          variant="secondary"
                          iconLeft="restart_alt"
                          loading={reactivar.isPending && reactivar.variables === u.id}
                          onClick={() => reactivar.mutate(u.id, { onSuccess: () => setAviso(`${u.apellido}, ${u.nombre} fue reactivado.`) })}
                        >
                          Reactivar
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Usuarios" description="Cada usuario entra solo a su oficina y hace lo que tiene marcado en sus permisos (Editar). El rol precarga una plantilla." />

      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <div className="flex-1">
              <Input icon="search" placeholder="Legajo, apellido, nombre o email…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar usuario" />
            </div>
            <Select
              aria-label="Oficina"
              placeholder="Todas las oficinas"
              options={(matriz.data?.oficinas ?? []).map((o) => ({ value: o.codigo, label: o.nombre }))}
              value={f.oficina ?? ''}
              onChange={(e) => setF((x) => ({ ...x, oficina: e.target.value || undefined }))}
            />
            <Select
              aria-label="Estado"
              options={[
                { value: 'activos', label: 'Activos' },
                { value: 'baja', label: 'De baja' },
                { value: 'todos', label: 'Todos' },
              ]}
              value={f.estado ?? 'activos'}
              onChange={(e) => setF((x) => ({ ...x, estado: e.target.value as FiltrosUsuarios['estado'] }))}
            />
            <Button iconLeft="person_add" onClick={() => setEditando('nuevo')} disabled={!matriz.data}>
              Nuevo usuario
            </Button>
          </div>
        </Card>

        {aviso && (
          <Alert tone="info">
            <span className="flex items-center justify-between gap-3">
              {aviso}
              <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
                <Icon name="close" className="text-lg!" />
              </button>
            </span>
          </Alert>
        )}
        {errorAccion && <Alert>{mensajeDeError(errorAccion)}</Alert>}

        <Card>{tabla()}</Card>
      </div>

      {editando && matriz.data && (
        <UsuarioDialog
          usuario={editando === 'nuevo' ? null : editando}
          matriz={matriz.data}
          guardando={crear.isPending || actualizar.isPending}
          onCerrar={() => setEditando(null)}
          onGuardar={async (datos) => {
            if (editando === 'nuevo') {
              setClave(await crear.mutateAsync(datos))
            } else {
              const u = await actualizar.mutateAsync({ ...datos, id: editando.id })
              setAviso(`Se guardaron los cambios de ${u.apellido}, ${u.nombre}.`)
            }
            setEditando(null)
          }}
        />
      )}

      {clave && <ClaveTemporalDialog dato={clave} onCerrar={() => setClave(null)} />}

      <ConfirmDialog
        open={!!paraRestablecer}
        title="¿Restablecer la contraseña?"
        message={`Se genera una contraseña temporal para ${paraRestablecer?.apellido}, ${paraRestablecer?.nombre}. La actual deja de funcionar, se desbloquea si estaba bloqueado y se cierran sus sesiones abiertas.`}
        confirmLabel="Sí, restablecer"
        cancelLabel="Cancelar"
        loading={restablecer.isPending}
        onCancel={() => setParaRestablecer(null)}
        onConfirm={() =>
          paraRestablecer &&
          restablecer.mutate(paraRestablecer.id, {
            onSuccess: (r) => {
              setParaRestablecer(null)
              setClave(r)
            },
          })
        }
      />

      <ConfirmDialog
        open={!!paraBaja}
        tone="danger"
        title="¿Dar de baja al usuario?"
        message={`${paraBaja?.apellido}, ${paraBaja?.nombre} no va a poder entrar más y se cierran sus sesiones. No se borra: queda en el historial y se puede reactivar.`}
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        loading={baja.isPending}
        onCancel={() => setParaBaja(null)}
        onConfirm={() => {
          if (!paraBaja || motivo.trim().length < 3) return
          baja.mutate(
            { id: paraBaja.id, motivo: motivo.trim() },
            {
              onSuccess: (u) => {
                setParaBaja(null)
                setAviso(`${u.apellido}, ${u.nombre} fue dado de baja.`)
              },
            },
          )
        }}
      >
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          Motivo de la baja
          <textarea
            className="min-h-20 rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal dark:border-slate-600 dark:bg-slate-800"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: dejó de trabajar en la DRH"
          />
          {motivo.trim().length < 3 && <span className="text-xs font-normal text-slate-500">Obligatorio.</span>}
        </label>
      </ConfirmDialog>
    </>
  )
}
