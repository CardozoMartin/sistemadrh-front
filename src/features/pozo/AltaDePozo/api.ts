// Registro de pozo de oficio. PROTOTIPO: lo responde el backend emulado (npm run demo); el
// backend real todavía no tiene esta ruta.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { coordenadaADto } from '@/lib/coordenadas'
import { backend } from '@/services/api/backend'
import { aNumero } from './calculos'
import type { AltaPozoForm } from './schemas'
import type { AltaPozoOficioDto, AltaPozoOficioRespuesta } from './types'

const nulo = (v: string) => (v.trim() ? v.trim() : null)
const filas = <T extends { desde: string; hasta: string }>(lista: T[]) => lista.filter((f) => f.desde !== '' || f.hasta !== '')

/** Formulario → lo que recibe la API (números como número, vacíos como null). */
export function altaPozoADto(f: AltaPozoForm): AltaPozoOficioDto {
  const h = f.hidraulico
  const hayEnsayo = !!(h.nivelEstatico || h.nivelDinamico || h.caudalM3h)
  return {
    motivo: f.general.motivo,
    causante: f.general.causante,
    domicilio: nulo(f.general.domicilio),
    documento: nulo(f.general.documento.replace(/\D/g, '')),
    telefono: nulo(f.general.telefono),
    empresa: nulo(f.general.empresa),
    fechaIngreso: f.general.fechaIngreso,
    asunto: nulo(f.general.asunto),
    jurisdiccionDrh: f.general.jurisdiccionDrh === 'si',
    estado: f.general.estado,
    alias: nulo(f.general.alias),
    telefonoServicio: nulo(f.general.telefonoServicio),
    ubicacion: {
      cuencaSuperficial: nulo(f.ubicacion.cuencaSuperficial),
      cuencaSubterranea: nulo(f.ubicacion.cuencaSubterranea),
      paraje: nulo(f.ubicacion.paraje),
      comuna: nulo(f.ubicacion.comuna),
      zona: nulo(f.ubicacion.zona),
      departamento: f.ubicacion.departamento,
      localidad: f.ubicacion.localidad,
      distrito: f.ubicacion.distrito,
      cota: aNumero(f.ubicacion.cota),
    },
    coordenada: coordenadaADto(f.ubicacion.coordenada)!,
    nombrePozo: nulo(f.otras.nombrePozo),
    caracteristicas: nulo(f.otras.caracteristicas),
    litologia: f.litologia.map((c) => ({ desde: aNumero(c.desde)!, hasta: aNumero(c.hasta)!, tipo: c.tipo, observacion: nulo(c.observacion) })),
    construccion: {
      profundidad: aNumero(f.construccion.profundidad),
      tramos: filas(f.construccion.tramos).map((t) => ({ desde: aNumero(t.desde)!, hasta: aNumero(t.hasta)!, material: nulo(t.material), diametro: aNumero(t.diametro) })),
      filtros: filas(f.construccion.filtros).map((t) => ({ desde: aNumero(t.desde)!, hasta: aNumero(t.hasta)!, diametro: aNumero(t.diametro), aberturas: aNumero(t.aberturas) })),
    },
    equipo: {
      profundidadBomba: aNumero(h.profundidadBomba),
      nivelCementacion: aNumero(h.nivelCementacion),
      tipoBomba: nulo(h.tipoBomba),
      regimenM3h: aNumero(h.regimenEditado ? h.regimenM3h : h.caudalM3h),
    },
    hidraulico: hayEnsayo ? { fecha: h.fecha, nivelEstatico: aNumero(h.nivelEstatico), nivelDinamico: aNumero(h.nivelDinamico), caudalM3h: aNumero(h.caudalM3h) } : null,
    usos: f.usos.map((u) => ({ uso: u.uso, cantidad: aNumero(u.cantidad)!, unidad: u.unidad })),
    quimico: f.quimico.parametros.length
      ? {
          fecha: f.quimico.fecha,
          parametros: f.quimico.parametros.map((p) => ({ parametro: p.parametro, tipoResultado: p.tipoResultado, simbolo: nulo(p.simbolo), resultado: p.resultado, unidad: nulo(p.unidad), observacion: nulo(p.observacion) })),
        }
      : null,
    observaciones: nulo(f.observaciones),
  }
}

export const altaPozoApi = {
  registrarDeOficio: async (dto: AltaPozoOficioDto) => (await backend.post<AltaPozoOficioRespuesta>('/pozos/oficio', dto)).data,
}

/** Registrar el pozo: después se refrescan la búsqueda de pozos y las capas del visor. */
export function useRegistrarPozoDeOficio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: altaPozoApi.registrarDeOficio,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['backend', 'pozos'] })
      void qc.invalidateQueries({ queryKey: ['sig'] })
    },
  })
}
