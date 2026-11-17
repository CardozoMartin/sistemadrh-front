// ABM del árbol de suministro de riego de cada distrito. Backend real: /api/catalogos/suministro/*.
// Es el árbol que cargaron los jefes de Distrito (fuente → sistema → canal principal … quinto →
// desagüe) y lo que el alta ofrece en el paso 6. Solo con el permiso «Administrar catálogos».
// Nada se borra: la baja es lógica, con motivo, se lleva lo que cuelga y se reactiva.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/hooks/useCatalogos'
import { backend } from '@/services/api/backend'
import type { NivelSuministro } from '@/services/catalogos'

export interface DistritoSuministro {
  id: number
  codigo: string
  nombre: string
  /** Fuentes y tramos activos. */
  fuentes: number
  tramos: number
}

export interface NodoFicha {
  id: number
  nombre: string
  nivel: NivelSuministro
  activo: boolean
  baja: { motivo: string; fecha: string } | null
  hijos: NodoFicha[]
}

export interface ArbolDistrito {
  distrito: { id: number; codigo: string; nombre: string }
  nodos: NodoFicha[]
}

const URL = '/catalogos/suministro'

/** Qué se hace: cada acción del ABM es una petición al backend. */
export type AccionSuministro =
  | { tipo: 'crear'; distritoId: number; nivel: NivelSuministro; nombre: string; padreId?: number }
  | { tipo: 'editar'; id: number; nombre: string }
  | { tipo: 'baja'; id: number; motivo: string }
  | { tipo: 'reactivar'; id: number }

async function ejecutar(a: AccionSuministro): Promise<void> {
  switch (a.tipo) {
    case 'crear':
      return void (await backend.post(`${URL}/nodos`, { distritoId: a.distritoId, nivel: a.nivel, nombre: a.nombre, padreId: a.padreId }))
    case 'editar':
      return void (await backend.put(`${URL}/nodos/${a.id}`, { nombre: a.nombre }))
    case 'baja':
      return void (await backend.delete(`${URL}/nodos/${a.id}`, { data: { motivo: a.motivo } }))
    case 'reactivar':
      return void (await backend.post(`${URL}/nodos/${a.id}/reactivar`))
  }
}

const CLAVE = ['backend', 'catalogos', 'suministro', 'abm'] as const

export function useDistritosSuministro() {
  return useQuery({
    queryKey: [...CLAVE, 'distritos'],
    queryFn: async () => (await backend.get<DistritoSuministro[]>(`${URL}/distritos`)).data,
  })
}

export function useArbolDistrito(distritoId: number | null) {
  return useQuery({
    queryKey: [...CLAVE, 'arbol', distritoId],
    queryFn: async () => (await backend.get<ArbolDistrito>(`${URL}/distritos/${distritoId}/arbol`)).data,
    enabled: distritoId !== null,
  })
}

/** Después de cada cambio se refrescan el ABM y el árbol que usa el formulario del alta. */
export function useAccionSuministro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ejecutar,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CLAVE })
      void qc.invalidateQueries({ queryKey: catalogoKeys.suministro() })
    },
  })
}

/** Una fila de la tabla: una rama, desde la fuente hasta su último tramo. */
export type Rama = NodoFicha[]

/** El árbol como tabla (como el Excel de los jefes): una fila por rama, de la fuente a la hoja. */
export function ramasDe(nodos: NodoFicha[], verBajas: boolean): Rama[] {
  const filas: Rama[] = []
  const recorrer = (nodo: NodoFicha, camino: Rama) => {
    const actual = [...camino, nodo]
    const hijos = verBajas ? nodo.hijos : nodo.hijos.filter((h) => h.activo)
    if (!hijos.length) filas.push(actual)
    hijos.forEach((h) => recorrer(h, actual))
  }
  ;(verBajas ? nodos : nodos.filter((n) => n.activo)).forEach((n) => recorrer(n, []))
  return filas
}
