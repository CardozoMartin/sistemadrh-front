// Consulta de concesiones de Catastro (backend real): GET /concesiones/filtros, /concesiones/buscar
// y /concesiones/:id. Las opciones de los filtros salen de los catálogos de la base.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { backend } from '@/services/api/backend'

/** Filtros de la búsqueda (todos optativos, se combinan). Los ids son los del catálogo. */
export interface FiltrosConcesiones {
  texto?: string
  numeroConcesion?: string
  numeroDesde?: string
  numeroHasta?: string
  expediente?: string
  estado?: string
  situacionLegal?: string
  resolucion?: string
  otorgadaDesde?: string
  otorgadaHasta?: string
  titular?: string
  documento?: string
  departamento?: string
  localidad?: string
  distrito?: string
  cuenca?: string
  padron?: string
  matricula?: string
  circunscripcion?: string
  seccion?: string
  parcela?: string
  matriculaDominio?: string
  tipoUso?: string
  caracter?: string
  codigoServicio?: string
  caudalDesde?: string
  caudalHasta?: string
  fuente?: string
  sistemaDistribucion?: string
  canal?: string
  conPoligono?: string
  conDeuda?: string
  orden?: string
}

type Opcion = { codigo: string; nombre: string }

export interface OpcionesFiltros {
  estados: (Opcion & { color: string })[]
  departamentos: { id: number; nombre: string }[]
  localidades: { id: number; nombre: string; departamentoId: number; distritoId: number }[]
  distritos: { id: number; codigo: string; nombre: string }[]
  cuencas: { id: number; nombre: string }[]
  situacionesLegales: Opcion[]
  tiposUso: (Opcion & { unidad: string })[]
  caracteres: Opcion[]
  codigosServicio: Opcion[]
  circunscripciones: Opcion[]
  secciones: Opcion[]
  fuentes: string[]
  sistemas: string[]
}

export interface ConcesionEncontrada {
  id: string
  numero: string | null
  estado: string
  estadoNombre: string
  estadoColor: string
  origen: string
  fechaOtorgamiento: string | null
  situacionLegal: string | null
  expediente: { id: string; numero: string; tipoTramite: string } | null
  resolucion: string | null
  titular: string | null
  documento: string | null
  cantidadTitulares: number
  padron: string | null
  matricula: string | null
  circunscripcion: string | null
  seccion: string | null
  parcela: string | null
  departamento: string | null
  localidad: string | null
  distrito: string | null
  cuenca: string | null
  caudalAsignado: number | null
  caracter: string | null
  codigoServicio: number | null
  usos: string | null
  fuente: string | null
  sistemaDistribucion: string | null
  canalPrincipal: string | null
  superficieHa: number | null
  conDeuda: boolean
}

export interface ResultadoConcesiones {
  total: number
  pagina: number
  porPagina: number
  concesiones: ConcesionEncontrada[]
  datosSensiblesOcultos?: boolean
}

export interface FichaConcesion {
  id: string
  numero: string | null
  estado: string
  estadoNombre: string
  estadoColor: string
  origen: string
  tipoDerecho: string
  fechaOtorgamiento: string | null
  anioOtorgamiento: number | null
  observaciones: string | null
  situacionLegal: string | null
  resolucion: { numero: string; anio: number; fecha: string | null } | null
  expediente: { id: string; numero: string; tipoTramite: string; estado: string } | null
  titulares: { personaId: string; nombre: string; tipoPersona: string; tipoDocumento: string; documento: string; email: string | null; telefono: string | null }[]
  domicilios: { calle: string | null; numero: string | null; departamento: string; localidad: string; distrito: string }[]
  ubicacion: { departamento: string | null; localidad: string | null; distrito: string | null; cuenca: string | null }
  inmueble: {
    padron: string | null
    matricula: string | null
    circunscripcion: string | null
    seccion: string | null
    parcela: string | null
    lamina: string | null
    orden: string | null
    libro: string | null
    folio: string | null
    anioDominio: number | null
    matriculaDominio: string | null
    serie: string | null
  } | null
  condicion: { caracter: string | null; codigoServicio: number | null; periodoInicio: string | null; periodoFin: string | null; caudalAsignado: number | null } | null
  usos: { nombre: string; unidad: string; magnitud: number; dotacion: number; caudal: number }[]
  desague: { x: number | null; y: number | null; latitud: number; longitud: number } | null
  puntoEntrega: { x: number | null; y: number | null; latitud: number; longitud: number; referencia: string | null } | null
  suministro: { fuentes: string[]; sistemaDistribucion: string | null; canales: string[]; desague: string | null; observacion: string | null } | null
  poligono: { superficieHa: number; perimetroM: number; desde: string | null } | null
  deudas: { id: string; titular: string; detalle: string | null; monto: number | null; registradaEn: string }[]
  datosSensiblesOcultos?: boolean
}

export const CONCESIONES_POR_PAGINA = 25

const datos = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

/** Las opciones de los filtros casi no cambian: se piden una vez por sesión. */
export function useOpcionesFiltros() {
  return useQuery({
    queryKey: ['backend', 'concesiones', 'filtros'],
    queryFn: () => datos(backend.get<OpcionesFiltros>('/concesiones/filtros')),
    staleTime: Infinity,
  })
}

/**
 * Mientras se escribe se sigue mostrando el resultado anterior (sin parpadeo).
 * Con `f` en null no pide nada (el motor de búsqueda de los trámites espera a que se busque).
 */
export function useBuscarConcesiones(f: FiltrosConcesiones | null, pagina: number) {
  const params = Object.fromEntries(Object.entries({ ...f, pagina, porPagina: CONCESIONES_POR_PAGINA }).filter(([, v]) => v !== undefined && v !== ''))
  return useQuery({
    queryKey: ['backend', 'concesiones', 'buscar', params],
    queryFn: () => datos(backend.get<ResultadoConcesiones>('/concesiones/buscar', { params })),
    enabled: f !== null,
    placeholderData: keepPreviousData,
  })
}

/**
 * Descarga la planilla Excel con TODAS las concesiones que cumplen los filtros (no solo la página)
 * y todos sus detalles. Si el backend responde un error, se lanza con su mensaje.
 */
export async function exportarConcesiones(f: FiltrosConcesiones): Promise<void> {
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''))
  // La respuesta es un archivo: el error también llega como archivo y se lee acá (no en el interceptor).
  const r = await backend.get<Blob>('/concesiones/exportar', { params, responseType: 'blob', timeout: 120000, validateStatus: () => true })
  if (r.status !== 200) {
    const texto = await r.data.text()
    let mensaje = 'No se pudo exportar la planilla.'
    try {
      const m = (JSON.parse(texto) as { message?: string | string[] }).message
      if (m) mensaje = Array.isArray(m) ? m.join(' · ') : m
    } catch {
      // no era JSON: queda el mensaje general
    }
    throw new Error(mensaje)
  }
  const nombre = /filename="([^"]+)"/.exec(String(r.headers['content-disposition'] ?? ''))?.[1] ?? 'concesiones.xlsx'
  const url = URL.createObjectURL(r.data)
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre })
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export function useFichaConcesion(id: string | null) {
  return useQuery({
    queryKey: ['backend', 'concesiones', 'ficha', id],
    queryFn: () => datos(backend.get<FichaConcesion>(`/concesiones/${id}`)),
    enabled: id !== null,
  })
}
