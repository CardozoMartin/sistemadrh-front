import { z } from 'zod'

const superposicionSchema = z.object({
  concesionId: z.string(),
  numero: z.string().nullable(),
  estado: z.string(),
  expediente: z.string().nullable(),
  titular: z.string().nullable(),
  superficieHa: z.number(),
})

/** Polígono cargado desde un KML/GeoJSON. */
export const poligonoSchema = z.object({
  nombreArchivo: z.string(),
  tamanioBytes: z.number(),
  /** Anillo exterior de la primera parte, [lat, lng] (lo que usan los mapas del formulario). */
  coordenadas: z.array(z.tuple([z.number(), z.number()])).min(3),
  /** Superficie total. Si `validadoPostgis`, es la que calculó PostGIS en POSGAR 07. */
  hectareas: z.number(),
  /** true si lo validó el backend (geometría válida, dentro de Tucumán, superficie oficial). */
  validadoPostgis: z.boolean().optional(),
  /** Sistema de coordenadas en que vino el archivo (lo informa el backend al validarlo). */
  sistemaOrigen: z.string().optional(),
  /** Cantidad de polígonos del archivo (una concesión puede tener varias partes). */
  partes: z.number().optional(),
  /** Concesiones que se superponen con este polígono (no bloquea: lo revisa Catastro/Distrito). */
  superposiciones: z.array(superposicionSchema).optional(),
  /**
   * Texto del archivo original (KML/GeoJSON), mientras no se guardó en el backend: al guardar
   * la sección se manda tal cual, y el servidor conserva el original como respaldo.
   */
  contenido: z.string().optional(),
})

export type PoligonoForm = z.infer<typeof poligonoSchema>
