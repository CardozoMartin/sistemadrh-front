// Ayudas específicas de json-server (la API simulada). Al pasar al backend real, solo
// cambian estas funciones; las peticiones de cada módulo mantienen su firma.

type Valor = string | number | boolean | null
type Condicion = Valor | { in: Valor[] } | undefined

/**
 * Arma el parámetro `_where` de json-server. Se usa en lugar de `?campo=valor` porque
 * json-server convierte esos valores a número y los strings numéricos (ej: número de
 * expediente) dejan de coincidir.
 *
 *   filtro({ numero: '240100', estado: { in: ['en_tramite', 'observado'] } })
 */
export function filtro(condiciones: Record<string, Condicion>) {
  const where = Object.fromEntries(
    Object.entries(condiciones)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { eq: v }]),
  )
  return Object.keys(where).length ? { _where: JSON.stringify(where) } : {}
}

/** Una página de resultados de una búsqueda hecha en el servidor. */
export interface Pagina<T> {
  items: T[]
  /** Total de coincidencias (de todas las páginas). */
  total: number
  pagina: number
  paginas: number
}

/** Parámetros de paginación de json-server (`_page` empieza en 1). */
export const paginacion = (pagina: number, porPagina: number) => ({ _page: pagina, _per_page: porPagina })

/** Respuesta de json-server cuando se pide con `_page`. */
export interface RespuestaPaginada<T> {
  data: T[]
  items: number
  pages: number
}

export function leerPagina<T>({ data, items, pages }: RespuestaPaginada<T>, pagina: number): Pagina<T> {
  return { items: data, total: items, pagina: Math.min(pagina, pages), paginas: pages }
}
