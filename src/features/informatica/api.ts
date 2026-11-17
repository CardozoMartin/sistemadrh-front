// ABM de usuarios y matriz de roles y permisos (backend real; solo administradores).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'

export interface UsuarioListado {
  id: string
  legajo: string
  apellido: string
  nombre: string
  email: string
  oficina: { codigo: string; nombre: string } | null
  rol: { codigo: string; nombre: string } | null
  /** Solo oficina Distrito: el distrito que atiende (null: todos). */
  distrito: { codigo: string; nombre: string } | null
  esAdministrador: boolean
  activo: boolean
  debeCambiarClave: boolean
  bloqueadoHasta: string | null
  ultimoAcceso: string | null
  bajaMotivo: string | null
  bajaEn: string | null
  /** El usuario «Sistema» firma los procesos automáticos: no se edita. */
  esSistema: boolean
  /** Permisos asignados (el administrador puede todo igual). */
  permisos: string[]
}

export interface UsuarioDatos {
  legajo: string
  apellido: string
  nombre: string
  email: string
  esAdministrador: boolean
  oficina?: string
  rol?: string
  /** Solo oficina Distrito: código del distrito («I»…«VII»); null o vacío: todos. */
  distrito?: string | null
  /** Los permisos marcados para este usuario. */
  permisos?: string[]
}

export interface FiltrosUsuarios {
  texto?: string
  oficina?: string
  estado?: 'activos' | 'baja' | 'todos'
}

/** Respuesta del alta y del restablecimiento: la contraseña temporal se muestra una sola vez. */
export interface ConClaveTemporal {
  usuario: UsuarioListado
  claveTemporal: string
}

export interface MatrizPermisos {
  oficinas: { codigo: string; nombre: string }[]
  roles: { codigo: string; nombre: string; descripcion: string | null }[]
  /** oficina null: permiso general (se puede asignar en cualquier oficina). */
  permisos: { codigo: string; nombre: string; descripcion: string | null; grupo: string; oficina: string | null }[]
  otorgados: { oficina: string; rol: string; permiso: string }[]
}

const claves = {
  usuarios: (f?: FiltrosUsuarios) => ['backend', 'configuracion', 'usuarios', f ?? {}] as const,
  todosLosUsuarios: ['backend', 'configuracion', 'usuarios'] as const,
  matriz: ['backend', 'configuracion', 'permisos'] as const,
}

const sinVacios = (f: object) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''))

export function useUsuarios(f: FiltrosUsuarios) {
  return useQuery({ queryKey: claves.usuarios(f), queryFn: async () => (await backend.get<UsuarioListado[]>('/usuarios', { params: sinVacios(f) })).data })
}

/** Acciones del ABM: al terminar se refresca el listado. */
export function useAccionUsuario<TInput, TOutput>(accion: (input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: accion, onSuccess: () => void qc.invalidateQueries({ queryKey: claves.todosLosUsuarios }) })
}

export const usuariosApi = {
  crear: async (d: UsuarioDatos) => (await backend.post<ConClaveTemporal>('/usuarios', d)).data,
  actualizar: async ({ id, ...d }: UsuarioDatos & { id: string }) => (await backend.put<UsuarioListado>(`/usuarios/${id}`, d)).data,
  baja: async ({ id, motivo }: { id: string; motivo: string }) => (await backend.post<UsuarioListado>(`/usuarios/${id}/baja`, { motivo })).data,
  reactivar: async (id: string) => (await backend.post<UsuarioListado>(`/usuarios/${id}/reactivar`)).data,
  restablecerClave: async (id: string) => (await backend.post<ConClaveTemporal>(`/usuarios/${id}/restablecer-clave`)).data,
}

/** Distritos activos (para asignar el distrito a un jefe de Distrito). */
export function useDistritos() {
  return useQuery({
    queryKey: ['catalogos', 'distritos', 'activos'],
    queryFn: async () => (await backend.get<{ codigo: string; nombre: string; activo: boolean }[]>('/catalogos/distritos')).data.filter((d) => d.activo),
    staleTime: Infinity,
  })
}

export function useMatrizPermisos() {
  return useQuery({ queryKey: claves.matriz, queryFn: async () => (await backend.get<MatrizPermisos>('/roles/permisos')).data })
}

export function useGuardarPermisosRol() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: { oficina: string; rol: string; permisos: string[] }) => (await backend.put<MatrizPermisos>('/roles/permisos', d)).data,
    onSuccess: (matriz) => qc.setQueryData(claves.matriz, matriz),
  })
}

/** Los permisos que se pueden asignar a un usuario de esa oficina (los suyos y los generales). */
export const permisosDeOficina = (m: MatrizPermisos, oficina: string | undefined) => m.permisos.filter((p) => p.oficina === null || p.oficina === oficina)

/** La plantilla de un rol en una oficina. */
export const plantillaDe = (m: MatrizPermisos, oficina: string | undefined, rol: string | undefined) =>
  oficina && rol ? m.otorgados.filter((o) => o.oficina === oficina && o.rol === rol).map((o) => o.permiso) : []
