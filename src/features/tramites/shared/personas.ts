// Padrón de personas (per_persona del backend): una sola por documento. Al cargar un titular
// se busca su documento; si ya está cargado, se muestran solo sus datos (las concesiones y
// deudas las revisa Recaudación, no se muestran en la carga) y se pregunta si se cargan sus datos: así no se carga dos veces a la misma persona (ni con
// el nombre escrito distinto).
import { backend } from '@/services/api/backend'
import { esNoEncontrado } from '@/services/api/errors'
import { queryClient } from '@/lib/queryClient'
import type { TitularBackend } from '../AltaDeConcesion/backend.types'
import type { TitularForm } from './schemas/titular'

/** `denominacion`: nombre del padrón anterior, solo en personas migradas (pueden no tener apellido y nombre). */
export type PersonaPadron = Omit<TitularBackend, 'personaId'> & { id: string; denominacion?: string | null }

/** Lo que devuelve el backend de una persona encontrada: sus datos, concesiones y deudas pendientes. */
export interface ResultadoPersona {
  persona: PersonaPadron
  concesiones: { id: string; numero: string | null; estado: string; departamento: string | null; localidad: string | null; expediente: string | null }[]
  deudasPendientes: { id: string; detalle: string | null; monto: number | null; creado_en: string }[]
}

/**
 * GET /personas?documento= — la persona o null si no está cargada (o si no se pudo consultar).
 * Una persona física se encuentra también por el documento equivalente: con su DNI aparece si
 * está cargada con CUIL / CUIT y al revés. Por eso su `documento` puede no ser el buscado.
 */
async function pedirPersona(documento: string): Promise<ResultadoPersona | null> {
  try {
    const { data } = await backend.get<ResultadoPersona>('/personas', { params: { documento } })
    return data
  } catch (e) {
    // Sin el backend (o con un error) se sigue con la carga normal: la búsqueda es una ayuda.
    if (!esNoEncontrado(e)) console.warn('No se pudo consultar el padrón de personas.', e)
    return null
  }
}

export const buscarPersona = (documento: string) =>
  queryClient.fetchQuery({ queryKey: ['personas', documento], queryFn: () => pedirPersona(documento), staleTime: 60_000 })

/**
 * Los datos de la persona tal como los usa el formulario del titular. El tipo y el número de
 * documento quedan como los escribió el usuario (el backend se queda con el más completo).
 */
export function personaAFormulario(p: PersonaPadron): Partial<TitularForm> {
  const juridica = p.tipoPersona === 'JURIDICA'
  return {
    tipoPersona: juridica ? 'juridica' : 'fisica',
    apellido: p.apellido ?? '',
    nombre: p.nombre ?? '',
    fechaNacimiento: p.fechaNacimiento ?? '',
    razonSocial: p.razonSocial ?? '',
    fechaConstitucion: p.fechaConstitucion ?? '',
    correo: p.email ?? '',
    telefono: p.telefono ?? '',
  }
}

/** Nombre para mostrar: apellido y nombre, razón social o, en migradas, la denominación del padrón anterior. */
export function nombreDePersona(p: PersonaPadron): string {
  if (p.tipoPersona === 'JURIDICA') return p.razonSocial || p.denominacion || 'Sin razón social cargada'
  const nombre = [p.apellido, p.nombre].filter(Boolean).join(', ')
  return nombre || p.denominacion || 'Sin nombre cargado'
}
