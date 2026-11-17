import { z } from 'zod'

// useFieldArray necesita objetos, por eso las listas son { valor }[].
const itemSchema = z.object({ valor: z.string() })

/**
 * Datos del suministro de agua: un camino del árbol del distrito (fuente → sistema → canales →
 * desagüe). Un nivel que la rama no tiene queda vacío.
 */
export const suministroSchema = z
  .object({
    /** La primera es la fuente principal (de ella sale el camino); el resto, adicionales. */
    fuentes: z.array(itemSchema).min(1),
    sistemaDistribucion: z.string(),
    canalPrincipal: z.string(),
    canalSecundario: z.string(),
    canalTerciario: z.string(),
    canalCuarto: z.string(),
    canalQuinto: z.string(),
    desague: z.string(),
    observacion: z.string().trim().max(1000, 'Máximo 1000 caracteres.'),
    caudalAsignado: z.string().refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Ingrese un caudal válido.'),
  })
  .superRefine((s, ctx) => {
    const vistas = new Set<string>()
    s.fuentes.forEach(({ valor }, i) => {
      if (!valor) return
      if (vistas.has(valor)) ctx.addIssue({ code: 'custom', path: ['fuentes', i, 'valor'], message: 'Esta fuente ya fue seleccionada.' })
      vistas.add(valor)
    })
  })

export type SuministroForm = z.infer<typeof suministroSchema>

export const suministroVacio = (caudalAsignado = ''): SuministroForm => ({
  fuentes: [{ valor: '' }],
  sistemaDistribucion: '',
  canalPrincipal: '',
  canalSecundario: '',
  canalTerciario: '',
  canalCuarto: '',
  canalQuinto: '',
  desague: '',
  observacion: '',
  caudalAsignado,
})
