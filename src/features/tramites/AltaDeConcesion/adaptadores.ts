// Traducción entre el formulario de pre carga (PreCargaForm, el mismo que usan Subdivisión y
// los demás trámites) y el backend real.
//
//   formulario → backend: una función por sección (cada sección se guarda con su PUT).
//   backend → formulario: para volver a abrir un alta y seguir cargándola o corregirla.
//
// Las diferencias son de forma: enumerados en mayúsculas (fisica → FISICA), números como
// número (no como texto), listas planas (fuentes: string[] en vez de { valor }[]).
import { coordenadaADto, coordenadaDesdeApi } from '@/lib/coordenadas'
import type { DomicilioForm } from '../shared/schemas/domicilio'
import type { TitularForm } from '../shared/schemas/titular'
import type { AltaBackend } from './backend.types'
import { preCargaVacia, type PreCargaForm } from './schemas'

const textoONulo = (v: string | null | undefined) => (v ? v : undefined)
const numeroONulo = (v: string) => (v.trim() === '' ? undefined : Number(v))

// ---------------------------------------------------------------------------
// Formulario → backend
// ---------------------------------------------------------------------------

export function titularesADto(titulares: TitularForm[], domicilios: DomicilioForm[]) {
  return {
    titulares: titulares.map((t) => {
      const fisica = t.tipoPersona === 'fisica'
      return {
        tipoPersona: fisica ? 'FISICA' : 'JURIDICA',
        // Una persona jurídica siempre se identifica con CUIT.
        tipoDocumento: fisica ? t.tipoDocumento.toUpperCase() : 'CUIT',
        documento: t.documento,
        ...(fisica
          ? { apellido: t.apellido, nombre: t.nombre, fechaNacimiento: t.fechaNacimiento }
          : { razonSocial: t.razonSocial, fechaConstitucion: t.fechaConstitucion }),
        email: textoONulo(t.correo),
        telefono: textoONulo(t.telefono),
      }
    }),
    domicilios: domicilios.map((d) => ({ calle: d.calle, numero: textoONulo(d.numero), departamento: d.departamento, localidad: d.localidad, distrito: d.distrito })),
  }
}

/**
 * Ubicación: multipart con los datos administrativos y, si el usuario cargó un archivo nuevo,
 * el KML/GeoJSON ORIGINAL (se guarda como respaldo en el servidor). Si no hay archivo nuevo,
 * el backend conserva el polígono que ya tenía.
 */
export function ubicacionAFormData(ubicacion: PreCargaForm['ubicacion']): FormData {
  const datos = new FormData()
  datos.append('departamento', ubicacion.departamento)
  datos.append('localidad', ubicacion.localidad)
  datos.append('distrito', ubicacion.distrito)
  const p = ubicacion.poligono
  if (p?.contenido) {
    const tipo = /\.(geo)?json$/i.test(p.nombreArchivo) ? 'application/geo+json' : 'application/vnd.google-earth.kml+xml'
    datos.append('archivo', new Blob([p.contenido], { type: tipo }), p.nombreArchivo)
  }
  return datos
}

export function inmuebleADto(catastral: PreCargaForm['catastral'], registral: PreCargaForm['registral']) {
  return {
    catastral: {
      matricula: catastral.matricula,
      circunscripcion: textoONulo(catastral.circunscripcion),
      seccion: textoONulo(catastral.seccion),
      parcela: catastral.parcela,
      lamina: textoONulo(catastral.lamina),
      orden: textoONulo(catastral.orden),
    },
    registral: {
      libro: textoONulo(registral.libro),
      folio: textoONulo(registral.folio),
      anio: numeroONulo(registral.anio),
      matricula: textoONulo(registral.matricula),
      serie: textoONulo(registral.serie),
    },
  }
}

export function usosADto(u: PreCargaForm['usos']) {
  const puntoEntrega = coordenadaADto(u.pecuario)
  return {
    caracter: u.caracter ? u.caracter.toUpperCase() : undefined,
    codigoServicio: u.codigoServicio === '' ? undefined : Number(u.codigoServicio),
    periodoInicio: textoONulo(u.periodoInicio),
    periodoFin: textoONulo(u.periodoFin),
    // X/Y POSGAR o latitud/longitud, según lo que se cargó: el backend calcula la otra forma.
    desague: coordenadaADto({ ...u.desague, sistema: 'posgar' }),
    items: u.items.filter((i) => i.uso).map((i) => ({ uso: i.uso, magnitud: Number(i.magnitud) })),
    // El backend lo pide solo si algún uso lo exige (pecuario); si viene sin necesidad, lo ignora.
    puntoEntrega: puntoEntrega ? { ...puntoEntrega, referencia: textoONulo(u.pecuario.referencia) } : undefined,
  }
}

export function suministroADto(s: PreCargaForm['suministro']) {
  return {
    fuentes: s.fuentes.map((f) => f.valor).filter(Boolean),
    sistemaDistribucion: textoONulo(s.sistemaDistribucion),
    canalPrincipal: textoONulo(s.canalPrincipal),
    canalSecundario: textoONulo(s.canalSecundario),
    canalTerciario: textoONulo(s.canalTerciario),
    canalCuarto: textoONulo(s.canalCuarto),
    canalQuinto: textoONulo(s.canalQuinto),
    desague: textoONulo(s.desague),
    observacion: textoONulo(s.observacion),
    caudalAsignado: s.caudalAsignado.trim() === '' ? undefined : Number(s.caudalAsignado),
  }
}

// ---------------------------------------------------------------------------
// Backend → formulario
// ---------------------------------------------------------------------------

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

/** Arma el formulario con lo que ya está guardado en el backend (secciones vacías si faltan). */
export function altaAFormulario(a: AltaBackend): PreCargaForm {
  const vacio = preCargaVacia()
  const anillo = a.ubicacion?.poligono?.geojson.coordinates[0]?.[0] ?? []
  const vertices = anillo.map(([lng, lat]) => [lat, lng] as [number, number])
  if (vertices.length > 1 && vertices[0][0] === vertices.at(-1)![0] && vertices[0][1] === vertices.at(-1)![1]) vertices.pop()

  return {
    titulares: a.titulares.length
      ? a.titulares.map((p) => ({
          tipoPersona: p.tipoPersona === 'JURIDICA' ? 'juridica' : 'fisica',
          tipoDocumento: (p.tipoDocumento?.toLowerCase() ?? 'dni') as TitularForm['tipoDocumento'],
          documento: t(p.documento),
          correo: t(p.email),
          telefono: t(p.telefono),
          apellido: t(p.apellido),
          nombre: t(p.nombre),
          fechaNacimiento: t(p.fechaNacimiento),
          razonSocial: t(p.razonSocial),
          fechaConstitucion: t(p.fechaConstitucion),
        }))
      : vacio.titulares,
    domicilios: a.domicilios.length
      ? a.domicilios.map((d) => ({ calle: d.calle, numero: t(d.numero), departamento: d.departamento, localidad: d.localidad, distrito: d.distrito }))
      : vacio.domicilios,
    ubicacion: {
      departamento: t(a.ubicacion?.departamento),
      localidad: t(a.ubicacion?.localidad),
      distrito: t(a.ubicacion?.distrito),
      poligono: a.ubicacion?.poligono
        ? {
            nombreArchivo: a.ubicacion.poligono.archivo?.nombre ?? 'poligono',
            tamanioBytes: a.ubicacion.poligono.archivo?.bytes ?? 0,
            coordenadas: vertices,
            hectareas: a.ubicacion.poligono.superficieHa,
            validadoPostgis: true,
            partes: a.ubicacion.poligono.geojson.coordinates.length,
            superposiciones: a.ubicacion.superposiciones,
          }
        : null,
    },
    catastral: a.inmueble
      ? {
          padron: t(a.inmueble.catastral.padron),
          matricula: a.inmueble.catastral.matricula,
          circunscripcion: t(a.inmueble.catastral.circunscripcion),
          seccion: t(a.inmueble.catastral.seccion),
          parcela: a.inmueble.catastral.parcela,
          lamina: t(a.inmueble.catastral.lamina),
          orden: t(a.inmueble.catastral.orden),
        }
      : vacio.catastral,
    registral: a.inmueble
      ? {
          libro: t(a.inmueble.registral.libro),
          folio: t(a.inmueble.registral.folio),
          anio: t(a.inmueble.registral.anio),
          matricula: t(a.inmueble.registral.matricula),
          serie: t(a.inmueble.registral.serie),
        }
      : vacio.registral,
    usos: a.usos
      ? {
          caracter: a.usos.caracter ?? '',
          codigoServicio: t(a.usos.codigoServicio),
          periodoInicio: t(a.usos.periodoInicio),
          periodoFin: t(a.usos.periodoFin),
          // Solo X/Y POSGAR: el backend siempre devuelve la X/Y calculada.
          desague: { ...coordenadaDesdeApi(a.usos.desague), sistema: 'posgar' },
          items: a.usos.items.length ? a.usos.items.map((i) => ({ uso: i.uso, magnitud: String(i.magnitud) })) : vacio.usos.items,
          pecuario: { ...coordenadaDesdeApi(a.usos.puntoEntrega), referencia: t(a.usos.puntoEntrega?.referencia) },
        }
      : vacio.usos,
    suministro: a.suministro
      ? {
          fuentes: a.suministro.fuentes.map((valor) => ({ valor })),
          sistemaDistribucion: t(a.suministro.sistemaDistribucion),
          canalPrincipal: t(a.suministro.canalPrincipal),
          canalSecundario: t(a.suministro.canalSecundario),
          canalTerciario: t(a.suministro.canalTerciario),
          canalCuarto: t(a.suministro.canalCuarto),
          canalQuinto: t(a.suministro.canalQuinto),
          desague: t(a.suministro.desague),
          observacion: t(a.suministro.observacion),
          caudalAsignado: t(a.concesion.caudalAsignado),
        }
      : vacio.suministro,
  }
}

/** Primera sección sin completar (para retomar la carga donde quedó). */
export function seccionAlcanzada(a: AltaBackend): number {
  const orden = [a.pasos.titulares, a.pasos.ubicacion, a.pasos.inmueble, a.pasos.inmueble, a.pasos.usos, a.pasos.suministro]
  const primera = orden.findIndex((completo) => !completo)
  return primera === -1 ? orden.length - 1 : primera
}
