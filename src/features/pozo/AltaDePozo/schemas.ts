// Formulario del alta de pozo de oficio: una sección por pestaña del prototipo.
// Todos los valores son texto (como los escribe el usuario); los números se leen con aNumero.
import { z } from 'zod'
import { coordenadaVacia, leerCoordenada } from '@/lib/coordenadas'
import { esCuitValido, esFechaFutura } from '@/lib/validaciones'
import { aNumero, leerIntervalos, problemaLitologia, profundidadDe, solapes } from './calculos'

const texto = z.string().trim()
const intervalo = { desde: texto, hasta: texto }

export const altaPozoSchema = z
  .object({
    general: z.object({
      motivo: texto,
      causante: texto,
      domicilio: texto,
      documento: texto,
      telefono: texto,
      empresa: texto,
      fechaIngreso: texto,
      asunto: texto,
      jurisdiccionDrh: z.enum(['si', 'no']),
      estado: z.enum(['EN_USO', 'PARADO', 'FUERA_DE_SERVICIO']),
      alias: texto,
      telefonoServicio: texto,
    }),
    ubicacion: z.object({
      cuencaSuperficial: texto,
      cuencaSubterranea: texto,
      paraje: texto,
      comuna: texto,
      zona: texto,
      departamento: texto,
      localidad: texto,
      distrito: texto,
      coordenada: z.object({ sistema: z.enum(['posgar', 'grados']), x: texto, y: texto, latitud: texto, longitud: texto }),
      cota: texto,
    }),
    otras: z.object({ nombrePozo: texto, caracteristicas: texto }),
    litologia: z.array(z.object({ ...intervalo, tipo: texto, observacion: texto })),
    construccion: z.object({
      profundidad: texto,
      tramos: z.array(z.object({ ...intervalo, material: texto, diametro: texto })),
      filtros: z.array(z.object({ ...intervalo, diametro: texto, aberturas: texto })),
    }),
    hidraulico: z.object({
      fecha: texto,
      nivelEstatico: texto,
      nivelDinamico: texto,
      caudalM3h: texto,
      /** Por defecto sigue al caudal de bombeo; «Modificar» lo libera (regimenEditado). */
      regimenM3h: texto,
      regimenEditado: z.boolean(),
      profundidadBomba: texto,
      nivelCementacion: texto,
      tipoBomba: texto,
    }),
    usos: z.array(z.object({ uso: texto, cantidad: texto, unidad: texto })),
    quimico: z.object({
      fecha: texto,
      parametros: z.array(z.object({ parametro: texto, tipoResultado: z.enum(['VALOR', 'MENOR']), simbolo: texto, resultado: texto, unidad: texto, observacion: texto })),
    }),
    observaciones: texto,
  })
  .superRefine((f, ctx) => {
    const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    //1.- General: motivo, causante y su documento (DNI o CUIT válido), fecha de ingreso.
    if (!f.general.motivo) error(['general', 'motivo'], 'Elija el motivo del registro de oficio.')
    if (!f.general.causante) error(['general', 'causante'], 'Ingrese quién es el causante (titular o responsable del pozo).')
    const doc = f.general.documento.replace(/\D/g, '')
    if (doc && !(doc.length === 7 || doc.length === 8 || (doc.length === 11 && esCuitValido(doc)))) {
      error(['general', 'documento'], doc.length === 11 ? 'El CUIT no es válido (dígito verificador).' : 'Ingrese un DNI (7 u 8 dígitos) o un CUIT (11 dígitos).')
    }
    if (!f.general.fechaIngreso) error(['general', 'fechaIngreso'], 'Ingrese la fecha de ingreso.')
    else if (esFechaFutura(f.general.fechaIngreso)) error(['general', 'fechaIngreso'], 'La fecha de ingreso no puede ser futura.')

    //2.- Ubicación: departamento / localidad / distrito y la coordenada (criterio único, POSGAR o lat/long).
    if (!f.ubicacion.departamento) error(['ubicacion', 'departamento'], 'Seleccione el departamento.')
    if (!f.ubicacion.localidad) error(['ubicacion', 'localidad'], 'Seleccione la localidad.')
    if (!f.ubicacion.distrito) error(['ubicacion', 'distrito'], 'Seleccione el distrito.')
    for (const [eje, msj] of Object.entries(leerCoordenada(f.ubicacion.coordenada, 'del pozo').errores)) if (msj) error(['ubicacion', 'coordenada', eje], msj)
    if (f.ubicacion.cota && aNumero(f.ubicacion.cota) === null) error(['ubicacion', 'cota'], 'La cota va en metros (número).')

    //3.- Litología: capas continuas desde la superficie.
    const capa = problemaLitologia(f.litologia)
    if (capa) error(['litologia', capa.fila, capa.campo], capa.mensaje)

    //4.- Construcción: tramos y filtros sin pisarse y dentro de la profundidad.
    const prof = aNumero(f.construccion.profundidad)
    if (f.construccion.profundidad && (prof === null || prof <= 0)) error(['construccion', 'profundidad'], 'Ingrese la profundidad en metros.')
    for (const tabla of ['tramos', 'filtros'] as const) {
      f.construccion[tabla].forEach((fila, i) => {
        const desde = aNumero(fila.desde)
        const hasta = aNumero(fila.hasta)
        if (desde === null) error(['construccion', tabla, i, 'desde'], 'Ingrese desde.')
        else if (hasta === null) error(['construccion', tabla, i, 'hasta'], 'Ingrese hasta.')
        else if (hasta <= desde) error(['construccion', tabla, i, 'hasta'], 'Tiene que ser mayor que «desde».')
        else if (prof !== null && hasta > prof) error(['construccion', tabla, i, 'hasta'], `Pasa la profundidad del pozo (${prof} m).`)
      })
    }
    const todos = [...leerIntervalos(f.construccion.tramos), ...leerIntervalos(f.construccion.filtros)]
    if (solapes(todos).length) error(['construccion', 'profundidad'], 'Hay tramos ciegos o filtros que se pisan: revise los intervalos.')
    if (prof === null && todos.length) error(['construccion', 'profundidad'], `Ingrese la profundidad (los tramos llegan a ${profundidadDe(todos)} m).`)

    //5.- Hidráulico: si se cargó algo del ensayo, va con la fecha del monitoreo.
    const h = f.hidraulico
    const numericos = ['nivelEstatico', 'nivelDinamico', 'caudalM3h', 'regimenM3h', 'profundidadBomba', 'nivelCementacion'] as const
    for (const campo of numericos) if (h[campo] && aNumero(h[campo]) === null) error(['hidraulico', campo], 'Ingrese un número.')
    const hayEnsayo = !!(h.nivelEstatico || h.nivelDinamico || h.caudalM3h)
    if (hayEnsayo && !h.fecha) error(['hidraulico', 'fecha'], 'Ingrese la fecha del monitoreo hidráulico: cada monitoreo queda en el historial con su fecha.')
    if (h.fecha && esFechaFutura(h.fecha)) error(['hidraulico', 'fecha'], 'La fecha no puede ser futura.')
    if (h.nivelEstatico && h.nivelDinamico && h.nivelEstatico === h.nivelDinamico) error(['hidraulico', 'nivelDinamico'], 'Con los dos niveles iguales no hay depresión: revise los valores.')

    //6.- Usos: cada uno con su cantidad.
    f.usos.forEach((u, i) => {
      if (!u.uso) error(['usos', i, 'uso'], 'Elija el uso.')
      else if (f.usos.findIndex((x) => x.uso === u.uso) < i) error(['usos', i, 'uso'], 'Este uso ya está cargado.')
      if (!(aNumero(u.cantidad)! > 0)) error(['usos', i, 'cantidad'], 'Ingrese una cantidad mayor a 0.')
    })

    //7.- Químico: si hay parámetros, va con la fecha del informe.
    if (f.quimico.parametros.length && !f.quimico.fecha) error(['quimico', 'fecha'], 'Ingrese la fecha del monitoreo químico (la del informe del laboratorio).')
    if (f.quimico.fecha && esFechaFutura(f.quimico.fecha)) error(['quimico', 'fecha'], 'La fecha no puede ser futura.')
  })

export type AltaPozoForm = z.infer<typeof altaPozoSchema>

const hoy = () => new Date().toISOString().slice(0, 10)

export const altaPozoVacia = (): AltaPozoForm => ({
  general: { motivo: '', causante: '', domicilio: '', documento: '', telefono: '', empresa: '', fechaIngreso: hoy(), asunto: '', jurisdiccionDrh: 'si', estado: 'EN_USO', alias: '', telefonoServicio: '' },
  ubicacion: { cuencaSuperficial: '', cuencaSubterranea: '', paraje: '', comuna: '', zona: '', departamento: '', localidad: '', distrito: '', coordenada: coordenadaVacia(), cota: '' },
  otras: { nombrePozo: '', caracteristicas: '' },
  litologia: [],
  construccion: { profundidad: '', tramos: [], filtros: [] },
  hidraulico: { fecha: '', nivelEstatico: '', nivelDinamico: '', caudalM3h: '', regimenM3h: '', regimenEditado: false, profundidadBomba: '', nivelCementacion: '', tipoBomba: '' },
  usos: [],
  quimico: { fecha: '', parametros: [] },
  observaciones: '',
})
