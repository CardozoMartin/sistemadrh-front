// Metadatos de las secciones de la pre carga (sin componentes, para poder importarlos
// desde cualquier lado sin arrastrar el mapa u otros bloques pesados).
import type { FieldPath } from 'react-hook-form'
import type { PreCargaForm } from '../../schemas'

export interface InfoSeccion {
  key: 'titular' | 'ubicacion' | 'catastral' | 'registral' | 'usos' | 'suministro'
  /** Nombre corto (en los pasos). */
  label: string
  /** Título y explicación del encabezado de la sección. */
  titulo: string
  descripcion: string
  icono: string
  /** Campos del formulario que se validan antes de pasar a la siguiente sección. */
  campos: FieldPath<PreCargaForm>[]
}

export const SECCIONES_PRECARGA: InfoSeccion[] = [
  {
    key: 'titular',
    label: 'Titular',
    titulo: 'Titulares y domicilio legal',
    descripcion: 'Personas o empresas que solicitan la concesión y el domicilio donde se las notifica.',
    icono: 'group',
    campos: ['titulares', 'domicilios'],
  },
  {
    key: 'ubicacion',
    label: 'Ubicación',
    titulo: 'Ubicación de la concesión',
    descripcion: 'Departamento, localidad, distrito de riego y el polígono del inmueble (KML o GeoJSON).',
    icono: 'location_on',
    campos: ['ubicacion'],
  },
  {
    key: 'catastral',
    label: 'Catastral',
    titulo: 'Datos catastrales',
    descripcion: 'Identificación del inmueble según el catastro provincial.',
    icono: 'map',
    campos: ['catastral'],
  },
  {
    key: 'registral',
    label: 'Registral',
    titulo: 'Datos registrales',
    descripcion: 'Inscripción del dominio en el Registro Inmobiliario.',
    icono: 'menu_book',
    campos: ['registral'],
  },
  {
    key: 'usos',
    label: 'Usos',
    titulo: 'Usos del agua',
    descripcion: 'Destino del agua solicitada, superficie o cantidad, y puntos de desagüe y entrega.',
    icono: 'water_drop',
    campos: ['usos'],
  },
  {
    key: 'suministro',
    label: 'Suministro',
    titulo: 'Suministro de riego',
    descripcion: 'Fuente de agua, sistema de distribución y canales por los que llega el agua al inmueble.',
    icono: 'water',
    campos: ['suministro'],
  },
]

/** Índice de la sección a la que pertenece un campo (para llevar al usuario al primer error). */
export function seccionDeCampo(path: string): number {
  return SECCIONES_PRECARGA.findIndex((s) => s.campos.some((c) => path === c || path.startsWith(`${c}.`)))
}
