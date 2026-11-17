// Hooks de datos de empresas perforadoras: las pantallas usan solo estos hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDominio } from '@/hooks/useDominio'
import { empresasApi, type DictamenInput, type ResolucionInput } from './api'
import type { DatosEmpresa, DatosMaquina, EmpresaPerforadora, OficinaEmpresa } from './types'

export const empresaKeys = {
  all: ['empresasPerforadoras'] as const,
  lista: () => [...empresaKeys.all, 'lista'] as const,
  detalle: (id: string) => [...empresaKeys.all, 'detalle', id] as const,
}

/** TODO(login): usuario autenticado (Planificación Hidrológica). Mientras tanto, el usuario demo. */
export const USUARIO_ACTUAL = 'Usuario demo'

/** TODO(login): usuario autenticado de la oficina. Mientras tanto, el primero de /usuarios. */
export function useUsuarioOficina(oficina: OficinaEmpresa): string {
  const { usuarios } = useDominio()
  return usuarios.find((u) => u.oficinaId === oficina)?.nombre ?? USUARIO_ACTUAL
}

export function useEmpresas() {
  return useQuery({ queryKey: empresaKeys.lista(), queryFn: empresasApi.listar })
}

/** Empresas que esperan la revisión de una oficina (su bandeja), filtradas en el servidor. */
export function useEmpresasEnOficina(oficina: OficinaEmpresa) {
  return useQuery({ queryKey: [...empresaKeys.lista(), 'oficina', oficina], queryFn: () => empresasApi.enOficina(oficina) })
}

export function useEmpresa(id: string | undefined) {
  return useQuery({ queryKey: empresaKeys.detalle(id ?? ''), queryFn: () => empresasApi.obtener(id!), enabled: !!id })
}

/** Toda acción sobre una empresa devuelve la empresa actualizada: se guarda en la caché y se refresca el padrón. */
function useAccionEmpresa<V>(fn: (v: V) => Promise<EmpresaPerforadora>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (empresa) => {
      qc.setQueryData(empresaKeys.detalle(empresa.id), empresa)
      void qc.invalidateQueries({ queryKey: empresaKeys.lista() })
    },
  })
}

export const useCrearEmpresa = () =>
  useAccionEmpresa(({ datos, maquinas }: { datos: DatosEmpresa; maquinas: DatosMaquina[] }) => empresasApi.crear(datos, maquinas, USUARIO_ACTUAL))

export const useModificarEmpresa = () =>
  useAccionEmpresa(({ empresa, datos, observacion }: { empresa: EmpresaPerforadora; datos: DatosEmpresa; observacion: string }) =>
    empresasApi.modificar(empresa, datos, observacion, USUARIO_ACTUAL),
  )

export const useBajaEmpresa = () =>
  useAccionEmpresa(({ empresa, motivo }: { empresa: EmpresaPerforadora; motivo: string }) => empresasApi.darDeBaja(empresa, motivo, USUARIO_ACTUAL))

export const useReactivarEmpresa = () =>
  useAccionEmpresa(({ empresa, observacion }: { empresa: EmpresaPerforadora; observacion: string }) => empresasApi.reactivar(empresa, USUARIO_ACTUAL, observacion))

export const useAgregarMaquina = () =>
  useAccionEmpresa(({ empresa, datos }: { empresa: EmpresaPerforadora; datos: DatosMaquina }) => empresasApi.agregarMaquina(empresa, datos, USUARIO_ACTUAL))

export const useModificarMaquina = () =>
  useAccionEmpresa(({ empresa, maquinaId, datos, observacion }: { empresa: EmpresaPerforadora; maquinaId: string; datos: DatosMaquina; observacion: string }) =>
    empresasApi.modificarMaquina(empresa, maquinaId, datos, observacion, USUARIO_ACTUAL),
  )

export const useBajaMaquina = () =>
  useAccionEmpresa(({ empresa, maquinaId, motivo }: { empresa: EmpresaPerforadora; maquinaId: string; motivo: string }) =>
    empresasApi.bajaMaquina(empresa, maquinaId, motivo, USUARIO_ACTUAL),
  )

// --- Circuito: Jurídico → Secretaría General ---------------------------------------------

export function useDictaminar() {
  const usuario = useUsuarioOficina('juridico')
  return useAccionEmpresa(({ empresa, input }: { empresa: EmpresaPerforadora; input: DictamenInput }) => empresasApi.dictaminar(empresa, input, usuario))
}

export function useRegistrarResolucion() {
  const usuario = useUsuarioOficina('secretaria_general')
  return useAccionEmpresa(({ empresa, input }: { empresa: EmpresaPerforadora; input: ResolucionInput }) => empresasApi.registrarResolucion(empresa, input, usuario))
}

/** Observar o rechazar desde la oficina donde está la empresa. */
export function useDevolverEmpresa(oficina: OficinaEmpresa) {
  const usuario = useUsuarioOficina(oficina)
  return useAccionEmpresa(({ empresa, accion, motivo }: { empresa: EmpresaPerforadora; accion: 'observar' | 'rechazar'; motivo: string }) =>
    accion === 'observar' ? empresasApi.observar(empresa, oficina, motivo, usuario) : empresasApi.rechazar(empresa, oficina, motivo, usuario),
  )
}

export const useReenviarEmpresa = () =>
  useAccionEmpresa(({ empresa, observacion }: { empresa: EmpresaPerforadora; observacion: string }) => empresasApi.reenviar(empresa, observacion, USUARIO_ACTUAL))

export const useReactivarMaquina = () =>
  useAccionEmpresa(({ empresa, maquinaId, observacion }: { empresa: EmpresaPerforadora; maquinaId: string; observacion: string }) =>
    empresasApi.reactivarMaquina(empresa, maquinaId, USUARIO_ACTUAL, observacion),
  )
