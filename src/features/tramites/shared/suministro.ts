import { NIVELES_SUMINISTRO, type CatalogoSuministro, type NivelSuministro, type NodoSuministro } from '@/services/catalogos'

export interface UbicacionSeleccionada {
  departamento: string
  localidad: string
  distrito: string
}

/** Los campos del formulario para cada nivel después de la fuente, en orden. */
export const CAMPOS_CASCADA = [
  'sistemaDistribucion',
  'canalPrincipal',
  'canalSecundario',
  'canalTerciario',
  'canalCuarto',
  'canalQuinto',
  'desague',
] as const

export type CampoCascada = (typeof CAMPOS_CASCADA)[number]

/** El árbol del distrito de la concesión (null si el distrito no tiene árbol cargado). */
export function arbolDelDistrito(catalogo: CatalogoSuministro | null, distrito: string): NodoSuministro[] | null {
  if (!catalogo || !distrito) return null
  const arbol = catalogo[distrito]
  return arbol?.length ? arbol : null
}

export interface PasoCascada {
  campo: CampoCascada
  nivel: NivelSuministro
  etiqueta: string
  /** Lo que cuelga del último tramo elegido con este nivel. */
  opciones: string[]
}

/**
 * Los niveles que se ofrecen, recorriendo el árbol desde la fuente principal: en cada nivel, lo
 * que cuelga del último tramo elegido. Un nivel que la rama no tiene no se muestra (se saltea),
 * y si el tramo tiene hijos de varios niveles se ofrecen todos (ej: un secundario y un terciario
 * directo del principal). Un valor que no está en el árbol (concesiones migradas) no corta el
 * camino pero tampoco lo sigue.
 */
export function pasosCascada(arbol: NodoSuministro[] | null, fuente: string, valores: Partial<Record<CampoCascada, string>>): PasoCascada[] {
  let actual = arbol?.find((n) => n.nombre === fuente)
  const pasos: PasoCascada[] = []
  CAMPOS_CASCADA.forEach((campo, i) => {
    if (!actual) return
    const { nivel, nombre } = NIVELES_SUMINISTRO[i + 1]
    const hijos = actual.hijos.filter((h) => h.nivel === nivel)
    const valor = valores[campo]
    if (hijos.length || valor) pasos.push({ campo, nivel, etiqueta: nombre, opciones: hijos.map((h) => h.nombre) })
    const elegido = hijos.find((h) => h.nombre === valor)
    if (elegido) actual = elegido
  })
  return pasos
}
