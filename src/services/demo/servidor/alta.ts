// Alta de Concesión emulada (como backend/src/tramites/alta-concesion). Mismo recorrido:
//
//   CARGA (Catastro) → RECAUDACIÓN → DISTRITO → JURÍDICO → SECRETARÍA GENERAL → CIERRE (Catastro) → ESPERA DEL PADRÓN → FINALIZADO
//          ▲ observado (Distrito / Jurídico): CORRECCIÓN en Catastro y vuelve a la oficina que observó
//
// Las respuestas tienen la forma de AltaBackend (alta-concesion.respuesta.ts del backend).
import dominio from '../../../../mock-server/seed/dominio.json'
import type { AltaBackend, AntecedentesDeuda, DeudaBackend } from '@/features/tramites/AltaDeConcesion/backend.types'
import { LIMITES_TUCUMAN } from '@/lib/coordenadas'
import { claveDeDocumento, dniDeDocumento, esTelefonoValido } from '@/lib/validaciones'
import { RANGO_POSGAR_TUCUMAN } from '@/lib/validaciones'
import { aPosgar, dePosgar } from '@/lib/posgar'
import { ahora, hoy, nuevoId, type AltaDemo, type Db, type ExpedienteDemo, type PersonaDemo, type PuntoDemo, type UsuarioDemo } from './db'
import { actuar, circuitoDe, crearExpediente, exigirActuar, exigirExpediente, formatearNumero, pasar, terminar } from './expedientes'
import { analizarArchivo, distanciaAlPoligono, superposiciones, anilloDe, titularDeAlta } from './geo'
import { cuerpoDe, error400, error404, error409, exigirTexto, type Peticion, type Ruta } from './http'

const ALTA = '/tramites/alta-concesion'
const DISTANCIA_MAX_PUNTO_M = 1000
const grados = (n: number) => n.toLocaleString('es-AR')

/** Situaciones legales con su checklist (ids correlativos, como el catálogo del backend). */
let idDoc = 0
export const SITUACIONES = dominio.situacionesLegales.map((s) => ({
  codigo: s.id,
  nombre: s.nombre,
  titulo: s.titulo,
  documentos: s.documentacion.map((descripcion) => ({ id: ++idDoc, descripcion })),
}))
const DOCUMENTOS = SITUACIONES.flatMap((s) => s.documentos)

type Uso = { id: string; nombre: string; dotacion: number; unidad: string; requierePuntoEntrega: boolean }
const USOS = dominio.usos as Uso[]

// ---------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------

function exigirAlta(db: Db, id: string): { e: ExpedienteDemo; alta: AltaDemo } {
  const e = exigirExpediente(db, id, 'ALTA_CONCESION')
  return { e, alta: db.altas[e.id] }
}

function pasosDe(db: Db, a: AltaDemo): AltaBackend['pasos'] {
  return {
    inicio: true,
    titulares: a.titulares.length > 0 && a.domicilios.length > 0,
    ubicacion: !!a.ubicacion?.departamento,
    inmueble: !!a.inmueble?.catastral.matricula,
    usos: !!a.usos?.items.length && db.puntos.some((p) => p.concesionId === a.concesionId && p.tipo === 'DESAGUE'),
    suministro: a.suministro !== null,
  }
}

const coordenada = (p: PuntoDemo) => ({ sistema: p.sistema, x: p.x, y: p.y, latitud: p.latitud, longitud: p.longitud })

export function armarAlta(db: Db, id: string): AltaBackend {
  const { e, alta } = exigirAlta(db, id)
  const c = db.concesiones.find((x) => x.id === alta.concesionId)!
  const situacion = SITUACIONES.find((s) => s.codigo === alta.situacionLegal)
  const puntos = db.puntos.filter((p) => p.concesionId === c.id)
  const desague = puntos.find((p) => p.tipo === 'DESAGUE')
  const entrega = puntos.find((p) => p.tipo === 'ENTREGA')
  return {
    id: e.id,
    numeroExpediente: formatearNumero(e),
    expediente: { numero: e.numero, reparticion: e.reparticion, anio: e.anio },
    fechaIngreso: e.fechaIngreso,
    actualizado: e.actualizado,
    circuito: circuitoDe(db, e) as AltaBackend['circuito'],
    situacionLegal: situacion ? { codigo: situacion.codigo, nombre: situacion.nombre } : null,
    documentacionPresentada: alta.documentacion.map((d) => DOCUMENTOS.find((x) => x.id === d)).filter((d) => !!d),
    concesion: { id: c.id, numero: c.numero, estado: c.estado, caudalAsignado: alta.caudalAsignado, fechaOtorgamiento: c.fechaOtorgamiento, resolucion: c.resolucion },
    titulares: alta.titulares.map((pid) => {
      const { id: personaId, ...p } = db.personas.find((x) => x.id === pid)!
      return { personaId, ...p }
    }),
    domicilios: alta.domicilios,
    ubicacion:
      alta.ubicacion || alta.poligono
        ? {
            departamento: alta.ubicacion?.departamento ?? null,
            localidad: alta.ubicacion?.localidad ?? null,
            distrito: alta.ubicacion?.distrito ?? null,
            poligono: alta.poligono,
            // El emulador no tiene correcciones del polígono.
            poligonoPropuesto: null,
            superposiciones: alta.poligono ? superposiciones(db, anilloDe(alta.poligono.geojson), c.id) : [],
          }
        : null,
    inmueble: alta.inmueble,
    usos: alta.usos
      ? {
          ...alta.usos,
          desague: desague ? coordenada(desague) : null,
          puntoEntrega: entrega ? { ...coordenada(entrega), referencia: entrega.referencia } : null,
          caudalCalculado: +alta.usos.items.reduce((s, i) => s + i.caudal, 0).toFixed(2),
        }
      : null,
    suministro: alta.suministro,
    pasos: pasosDe(db, alta),
  }
}

// ---------------------------------------------------------------------------
// Validaciones comunes
// ---------------------------------------------------------------------------

/** La carga la hace Catastro, en carga, corrección o cierre, con el expediente tomado. */
function exigirEditable(db: Db, id: string, usuario: UsuarioDemo) {
  const r = exigirAlta(db, id)
  exigirActuar(r.e, usuario, ['CARGA', 'CORRECCION', 'CIERRE'])
  return r
}

function faltantes(db: Db, alta: AltaDemo): string[] {
  const nombres: Record<string, string> = { titulares: 'Titulares y domicilios', ubicacion: 'Ubicación de la concesión', inmueble: 'Datos catastrales', usos: 'Usos', suministro: 'Suministro' }
  return Object.entries(pasosDe(db, alta))
    .filter(([, completo]) => !completo)
    .map(([paso]) => nombres[paso] ?? paso)
}

/** Deudas pendientes de las personas. */
export const pendientesDe = (db: Db, personas: string[]) => db.deudas.filter((d) => personas.includes(d.personaId) && d.estado === 'PENDIENTE')

/** Titulares (personas) de un expediente: los del alta o los que cargó Catastro en el registro de pozo. */
export const titularesDe = (db: Db, e: ExpedienteDemo) =>
  db.altas[e.id]?.titulares ?? db.pozos.find((p) => p.registro?.expedienteId === e.id)?.registro?.catastro?.titulares.flatMap((t) => (t.personaId ? [t.personaId] : [])) ?? []

/** Coordenada del desagüe / entrega: X/Y POSGAR o latitud/longitud → las dos formas. */
export function leerPunto(c: Record<string, unknown> | undefined, nombre: string): Omit<PuntoDemo, 'id' | 'concesionId' | 'tipo' | 'referencia'> {
  if (!c) throw error400(`Ingrese las coordenadas ${nombre}.`)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const [x, y, lat, lon] = [n(c.x), n(c.y), n(c.latitud), n(c.longitud)]
  if (lat !== null || lon !== null) {
    if (x !== null || y !== null) throw error400('Cargue la coordenada en X/Y POSGAR o en latitud/longitud, no en las dos.')
    if (lat === null || lon === null) throw error400(`Falta una de las dos coordenadas ${nombre}.`)
    if (lat < LIMITES_TUCUMAN.sur || lat > LIMITES_TUCUMAN.norte) throw error400(`La latitud debe estar entre ${grados(LIMITES_TUCUMAN.sur)} y ${grados(LIMITES_TUCUMAN.norte)} (Tucumán).`)
    if (lon < LIMITES_TUCUMAN.oeste || lon > LIMITES_TUCUMAN.este) throw error400(`La longitud debe estar entre ${grados(LIMITES_TUCUMAN.oeste)} y ${grados(LIMITES_TUCUMAN.este)} (Tucumán).`)
    const p = aPosgar(lat, lon)
    return { sistema: 'WGS84', x: +p.x.toFixed(2), y: +p.y.toFixed(2), latitud: +lat.toFixed(6), longitud: +lon.toFixed(6) }
  }
  if (x === null || y === null) throw error400(`Ingrese la X y la Y POSGAR ${nombre}, o la latitud y longitud.`)
  const { x: rx, y: ry } = RANGO_POSGAR_TUCUMAN
  if (x < rx.min || x > rx.max || y < ry.min || y > ry.max) throw error400(`La coordenada POSGAR ${nombre} está fuera de Tucumán (X ${rx.min}–${rx.max}, Y ${ry.min}–${ry.max}).`)
  const p = dePosgar(x, y)
  return { sistema: 'POSGAR_FAJA3', x, y, latitud: +p.lat.toFixed(6), longitud: +p.lng.toFixed(6) }
}

/** Avisos si el desagüe o la entrega quedan a más de 1 km del polígono. */
function avisosPuntosLejanos(db: Db, alta: AltaDemo): string[] {
  if (!alta.poligono) return []
  return db.puntos
    .filter((p) => p.concesionId === alta.concesionId)
    .flatMap((p) => {
      const m = distanciaAlPoligono([p.latitud, p.longitud], alta.poligono!.geojson)
      if (m <= DISTANCIA_MAX_PUNTO_M) return []
      return [
        `El ${p.tipo === 'DESAGUE' ? 'punto de desagüe' : 'punto de entrega'} (X ${p.x.toLocaleString('es-AR')}, Y ${p.y.toLocaleString('es-AR')}) está a ${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km del polígono de la concesión: verifique las coordenadas.`,
      ]
    })
}

// ---------------------------------------------------------------------------
// Catastro: carga
// ---------------------------------------------------------------------------

function iniciar({ db, usuario, cuerpo }: Peticion) {
  const d = (cuerpo ?? {}) as { expediente?: { numero?: string; reparticion?: string; anio?: number }; situacionLegal?: string; documentacionPresentada?: number[] }
  //1.- Expediente del año en curso, único.
  const exp = d.expediente ?? {}
  if (!exp.numero || !exp.reparticion || !exp.anio) throw error400('Ingrese el número, la repartición y el año del expediente.')
  if (exp.anio !== new Date().getFullYear()) throw error400('El expediente tiene que ser del año en curso.')
  //2.- Situación legal del catálogo y su documentación.
  const situacion = SITUACIONES.find((s) => s.codigo === d.situacionLegal)
  if (!situacion) throw error400('Seleccione la situación legal.')
  const documentos = d.documentacionPresentada ?? []
  if (documentos.some((id) => !situacion.documentos.some((x) => x.id === id))) throw error400(`Hay documentos que no son de la situación «${situacion.nombre}».`)
  //3.- Expediente en Catastro (tomado por quien lo registra) y la concesión en trámite.
  if (!usuario.esAdministrador && usuario.oficina !== 'catastro') throw error409('El alta la inicia Catastro.')
  const e = crearExpediente(db, { numero: exp.numero, reparticion: exp.reparticion, anio: exp.anio, tipoTramite: 'ALTA_CONCESION', etapa: 'CARGA' }, usuario)
  const concesionId = nuevoId(db)
  db.concesiones.push({ id: concesionId, numero: null, estado: 'EN_TRAMITE', origen: 'SISTEMA', expedienteId: e.id, anio: exp.anio, fechaOtorgamiento: null, resolucion: null, migrada: null })
  db.altas[e.id] = {
    expedienteId: e.id,
    concesionId,
    situacionLegal: situacion.codigo,
    documentacion: documentos,
    titulares: [],
    domicilios: [],
    ubicacion: null,
    poligono: null,
    inmueble: null,
    usos: null,
    suministro: null,
    caudalAsignado: null,
    verificados: [],
  }
  return armarAlta(db, e.id)
}

function titulares({ db, usuario, ruta, cuerpo }: Peticion) {
  const { alta } = exigirEditable(db, ruta.id, usuario)
  const d = (cuerpo ?? {}) as { titulares?: Record<string, string | undefined>[]; domicilios?: Record<string, string | undefined>[] }
  if (!d.titulares?.length) throw error400('Cargue al menos un titular.')
  if (!d.domicilios?.length) throw error400('Cargue el domicilio legal.')
  // DNI y CUIL / CUIT de la misma persona cuentan como el mismo documento.
  const documentos = d.titulares.map((t) => claveDeDocumento(t.documento ?? ''))
  if (new Set(documentos).size !== documentos.length) throw error400('Hay titulares con el mismo documento (o el DNI y el CUIL de la misma persona).')
  //1.- Persona única por documento: si ya existe, se usa la misma y se actualizan sus datos.
  alta.titulares = d.titulares.map((t) => {
    const documento = exigirTexto(t.documento, 'Ingrese el documento de cada titular.')
    // Contacto obligatorio, como en el backend (TitularDto).
    const email = exigirTexto(t.email, 'Ingrese el correo electrónico del titular.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw error400('Ingrese un correo electrónico válido.')
    const telefono = exigirTexto(t.telefono, 'Ingrese el teléfono de contacto del titular.')
    if (!esTelefonoValido(telefono)) throw error400('Ingrese un teléfono válido (entre 7 y 15 números, con código de área).')
    const datos: Omit<PersonaDemo, 'id'> = {
      tipoPersona: t.tipoPersona === 'JURIDICA' ? 'JURIDICA' : 'FISICA',
      tipoDocumento: (t.tipoDocumento as PersonaDemo['tipoDocumento']) ?? 'DNI',
      documento,
      apellido: t.apellido ?? null,
      nombre: t.nombre ?? null,
      fechaNacimiento: t.fechaNacimiento || null,
      razonSocial: t.razonSocial ?? null,
      fechaConstitucion: t.fechaConstitucion || null,
      email,
      telefono,
    }
    const existente = personaEquivalente(db, documento, datos.tipoPersona)
    // Si estaba con CUIL / CUIT y llega el DNI, se queda con el CUIL / CUIT (no se pierde dato).
    if (existente?.documento?.length === 11 && documento.length < 11) {
      datos.documento = existente.documento
      datos.tipoDocumento = existente.tipoDocumento
    }
    if (existente && existente.tipoPersona !== datos.tipoPersona) {
      throw error409(`El documento ${documento} ya está cargado como persona ${existente.tipoPersona === 'FISICA' ? 'física' : 'jurídica'}.`)
    }
    if (existente) {
      Object.assign(existente, datos)
      return existente.id
    }
    const id = nuevoId(db)
    db.personas.push({ id, ...datos })
    return id
  })
  alta.domicilios = d.domicilios.map((x) => ({
    id: nuevoId(db),
    calle: exigirTexto(x.calle, 'Ingrese la calle del domicilio.'),
    numero: x.numero ?? null,
    departamento: exigirTexto(x.departamento, 'Seleccione el departamento del domicilio.'),
    localidad: exigirTexto(x.localidad, 'Seleccione la localidad del domicilio.'),
    distrito: exigirTexto(x.distrito, 'Seleccione el distrito del domicilio.'),
  }))
  return armarAlta(db, ruta.id)
}

async function ubicacion({ db, usuario, ruta, cuerpo }: Peticion) {
  const { e, alta } = exigirEditable(db, ruta.id, usuario)
  const datos = cuerpo instanceof FormData ? cuerpo : new FormData()
  const campo = (n: string) => {
    const v = datos.get(n)
    return typeof v === 'string' ? v : ''
  }
  //1.- Departamento / localidad / distrito, obligatorios. En el cierre, la misma ubicación.
  const nueva = { departamento: exigirTexto(campo('departamento'), 'Seleccione el departamento.'), localidad: exigirTexto(campo('localidad'), 'Seleccione la localidad.'), distrito: exigirTexto(campo('distrito'), 'Seleccione el distrito.') }
  if (e.etapa === 'CIERRE' && alta.ubicacion && JSON.stringify(alta.ubicacion) !== JSON.stringify(nueva)) {
    throw error409('En el cierre no se puede cambiar la ubicación: es la que aprobó la resolución.')
  }
  alta.ubicacion = nueva
  //2.- El archivo (optativo): se analiza como en PostGIS; duplicado si coincide ≥ 90 % con otra concesión.
  const archivo = datos.get('archivo')
  const avisos: string[] = []
  if (archivo instanceof Blob) {
    if (e.etapa === 'CIERRE' && alta.poligono) throw error409('En el cierre el polígono solo se puede cargar si faltaba.')
    const nombre = archivo instanceof File ? archivo.name : 'poligono.kml'
    const analisis = await analizarArchivo(db, await archivo.text(), nombre, archivo.size, alta.concesionId)
    const duplicada = analisis.superposiciones.find((s) => s.superficieHa >= 0.9 * analisis.superficieHa)
    if (duplicada) throw error409(`El polígono coincide en más del 90 % con la concesión ${duplicada.numero ?? `en trámite (expediente ${duplicada.expediente})`}: parece la misma parcela.`)
    alta.poligono = {
      id: nuevoId(db),
      geojson: analisis.geojson,
      superficieHa: analisis.superficieHa,
      perimetroM: analisis.perimetroM,
      puntoInterior: analisis.puntoInterior,
      origen: 'ALTA',
      archivo: { nombre, bytes: archivo.size },
      desde: hoy(),
    }
    avisos.push(...analisis.avisos, ...avisosPuntosLejanos(db, alta))
  }
  return { ...armarAlta(db, ruta.id), avisos }
}

function inmueble({ db, usuario, ruta, cuerpo }: Peticion) {
  const { alta } = exigirEditable(db, ruta.id, usuario)
  const d = (cuerpo ?? {}) as { catastral?: Record<string, string | undefined>; registral?: Record<string, string | number | undefined> }
  const matricula = exigirTexto(d.catastral?.matricula, 'Ingrese la matrícula catastral.')
  //1.- La matrícula no puede tener otra concesión activa.
  const otra = Object.values(db.altas).find((a) => a.expedienteId !== alta.expedienteId && a.inmueble?.catastral.matricula === matricula)
  const concesionOtra = otra && db.concesiones.find((c) => c.id === otra.concesionId && c.estado !== 'DENEGADA' && c.estado !== 'ANULADA')
  if (concesionOtra) throw error409(`La matrícula ${matricula} ya tiene otra concesión (${concesionOtra.numero ?? 'en trámite'}).`)
  const c = d.catastral ?? {}
  const r = d.registral ?? {}
  const anio = typeof r.anio === 'number' ? r.anio : null
  if (anio !== null && anio > new Date().getFullYear()) throw error400('El año de dominio no puede ser futuro.')
  alta.inmueble = {
    catastral: {
      padron: alta.inmueble?.catastral.padron ?? null,
      matricula,
      circunscripcion: c.circunscripcion ?? null,
      seccion: c.seccion ?? null,
      parcela: exigirTexto(c.parcela, 'Ingrese la parcela.'),
      lamina: c.lamina ?? null,
      orden: c.orden ?? null,
    },
    registral: { libro: (r.libro as string) ?? null, folio: (r.folio as string) ?? null, anio, matricula: (r.matricula as string) ?? null, serie: (r.serie as string) ?? null },
  }
  return armarAlta(db, ruta.id)
}

function usos({ db, usuario, ruta, cuerpo }: Peticion) {
  const { e, alta } = exigirEditable(db, ruta.id, usuario)
  if (e.etapa === 'CIERRE') throw error409('En el cierre no se pueden modificar los usos, el caudal ni los puntos de desagüe y entrega: quedaron aprobados en la resolución.')
  const d = (cuerpo ?? {}) as {
    caracter?: 'PERMANENTE' | 'EVENTUAL'
    codigoServicio?: number
    periodoInicio?: string
    periodoFin?: string
    desague?: Record<string, unknown>
    items?: { uso: string; magnitud: number }[]
    puntoEntrega?: Record<string, unknown> & { referencia?: string }
  }
  //1.- Período, usos del catálogo y sin repetir.
  if (d.periodoInicio && d.periodoFin && d.periodoFin < d.periodoInicio) throw error400('El fin del período no puede ser anterior al inicio.')
  if (!d.items?.length) throw error400('Seleccione al menos un uso.')
  const codigos = d.items.map((i) => i.uso)
  if (new Set(codigos).size !== codigos.length) throw error400('Hay usos repetidos.')
  const items = d.items.map((i) => {
    const tipo = USOS.find((u) => u.id === i.uso)
    if (!tipo) throw error400(`El uso «${i.uso}» no está en el catálogo.`)
    if (!(i.magnitud > 0)) throw error400('Ingrese una magnitud mayor a 0.')
    return { uso: tipo.id, nombre: tipo.nombre, unidad: tipo.unidad, magnitud: i.magnitud, dotacion: tipo.dotacion, caudal: +(i.magnitud * tipo.dotacion).toFixed(2) }
  })
  //2.- Punto de entrega si algún uso lo exige (ej: pecuario).
  const exigen = USOS.filter((u) => u.requierePuntoEntrega && codigos.includes(u.id))
  if (exigen.length && !d.puntoEntrega) throw error400(`El uso ${exigen.map((u) => u.nombre).join(', ')} requiere el punto de entrega del agua.`)
  //3.- Puntos: las dos formas de cada coordenada.
  const desague = leerPunto(d.desague, 'del desagüe')
  const entrega = exigen.length && d.puntoEntrega ? leerPunto(d.puntoEntrega, 'del punto de entrega') : null
  db.puntos = db.puntos.filter((p) => p.concesionId !== alta.concesionId)
  db.puntos.push({ id: nuevoId(db), concesionId: alta.concesionId, tipo: 'DESAGUE', referencia: null, ...desague })
  if (entrega) db.puntos.push({ id: nuevoId(db), concesionId: alta.concesionId, tipo: 'ENTREGA', referencia: d.puntoEntrega?.referencia ?? null, ...entrega })
  //4.- Condiciones y caudal asignado propuesto (la suma de los usos).
  alta.usos = { caracter: d.caracter ?? null, codigoServicio: d.codigoServicio ?? null, periodoInicio: d.periodoInicio ?? null, periodoFin: d.periodoFin ?? null, items }
  alta.caudalAsignado = +items.reduce((s, i) => s + i.caudal, 0).toFixed(2)
  return { ...armarAlta(db, ruta.id), avisos: avisosPuntosLejanos(db, alta) }
}

function suministro({ db, usuario, ruta, cuerpo }: Peticion) {
  const { alta } = exigirEditable(db, ruta.id, usuario)
  if (!alta.ubicacion) throw error400('Primero cargue la ubicación de la concesión (paso 3).')
  const d = (cuerpo ?? {}) as { fuentes?: string[]; sistemaDistribucion?: string; canalPrincipal?: string; canalSecundario?: string; canalTerciario?: string; canalCuarto?: string; canalQuinto?: string; desague?: string; observacion?: string; caudalAsignado?: number }
  alta.suministro = {
    fuentes: d.fuentes ?? [],
    sistemaDistribucion: d.sistemaDistribucion ?? null,
    canalPrincipal: d.canalPrincipal ?? null,
    canalSecundario: d.canalSecundario ?? null,
    canalTerciario: d.canalTerciario ?? null,
    canalCuarto: d.canalCuarto ?? null,
    canalQuinto: d.canalQuinto ?? null,
    desague: d.desague ?? null,
    observacion: d.observacion ?? null,
  }
  if (typeof d.caudalAsignado === 'number') alta.caudalAsignado = d.caudalAsignado
  return armarAlta(db, ruta.id)
}

// ---------------------------------------------------------------------------
// Circuito
// ---------------------------------------------------------------------------

const observaciones = (p: Peticion) => (cuerpoDe<{ observaciones?: string }>(p).observaciones || null) as string | null

function enviar(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['CARGA'])
  const faltan = faltantes(db, alta)
  if (faltan.length) throw error400(`Falta completar: ${faltan.join(', ')}.`)
  actuar(db, e, usuario, 'CARGA_COMPLETA', 'REGISTRADO', observaciones(p))
  pasar(db, e, 'RECAUDACION', usuario, { observaciones: observaciones(p) })
  return armarAlta(db, e.id)
}

function reenviar(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['CORRECCION'])
  const faltan = faltantes(db, alta)
  if (faltan.length) throw error400(`Falta completar: ${faltan.join(', ')}.`)
  actuar(db, e, usuario, 'CORRECCION', 'REGISTRADO', observaciones(p))
  //1.- Si al corregir se sumó un titular que Recaudación no verificó, pasa primero por Recaudación.
  const sinVerificar = alta.titulares.some((t) => !alta.verificados.includes(t))
  pasar(db, e, sinVerificar ? 'RECAUDACION' : (e.vuelveA ?? 'DISTRITO'), usuario, { observaciones: observaciones(p) })
  if (!sinVerificar) e.vuelveA = null
  return armarAlta(db, e.id)
}

/** Nombre de una persona del demo. */
const nombreDePersona = (p: PersonaDemo) => (p.tipoPersona === 'JURIDICA' ? (p.razonSocial ?? '') : `${p.apellido}, ${p.nombre}`)

/**
 * Concesiones otorgadas (VIGENTES) de estas personas, salvo la del expediente, con sus titulares
 * y si tienen deuda. Como RecaudacionService.concesionesDe del backend: las del sistema toman los
 * titulares de su alta; las migradas, de su documento.
 */
function concesionesDeTitulares(db: Db, personaIds: string[], expedienteId: string): AntecedentesDeuda['concesiones'] {
  const claves = new Map(db.personas.map((p) => [claveDeDocumento(p.documento ?? ''), p]))
  return db.concesiones
    .filter((c) => c.estado === 'VIGENTE' && c.expedienteId !== expedienteId)
    .map((c) => {
      const deAlta = c.expedienteId ? db.altas[c.expedienteId] : undefined
      const migrada = c.migrada?.documento ? claves.get(claveDeDocumento(c.migrada.documento)) : undefined
      const titulares = deAlta
        ? deAlta.titulares.flatMap((id) => {
            const p = db.personas.find((x) => x.id === id)
            return p ? [{ personaId: p.id, nombre: nombreDePersona(p) }] : []
          })
        : migrada
          ? [{ personaId: migrada.id, nombre: nombreDePersona(migrada) }]
          : []
      return {
        id: c.id,
        numero: c.numero,
        departamento: deAlta?.ubicacion?.departamento ?? c.migrada?.departamento ?? null,
        localidad: deAlta?.ubicacion?.localidad ?? c.migrada?.localidad ?? null,
        titulares,
        deTitulares: titulares.map((t) => t.personaId).filter((id) => personaIds.includes(id)),
        tieneDeuda: db.deudas.some((d) => d.concesionId === c.id && d.estado === 'PENDIENTE'),
      }
    })
    .filter((c) => c.deTitulares.length > 0)
}

function antecedentesDeuda({ db, ruta }: Peticion): AntecedentesDeuda {
  const { e, alta } = exigirAlta(db, ruta.id)
  return {
    titulares: alta.titulares.flatMap((id) => {
      const p = db.personas.find((x) => x.id === id)
      return p ? [{ personaId: p.id, nombre: nombreDePersona(p), documento: p.documento }] : []
    }),
    concesiones: concesionesDeTitulares(db, alta.titulares, e.id),
    otrasDeudas: pendientesDe(db, alta.titulares)
      .filter((d) => !d.concesionId)
      .map((d) => ({ id: d.id, personaId: d.personaId, detalle: d.detalle })),
  }
}

/**
 * Recaudación responde, por cada concesión otorgada de los titulares, si tiene deuda (como el
 * backend: la deuda queda en la concesión y en todos sus titulares). Ninguna con deuda: pasa a
 * Distrito. Alguna: queda en espera; en espera se puede volver a responder.
 */
function recaudacion(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['RECAUDACION'])
  const d = cuerpoDe<{ concesiones?: { concesionId: string; tieneDeuda: boolean }[] }>(p)
  if (!Array.isArray(d.concesiones)) throw error400('Indique, por cada concesión de los titulares, si tiene deuda.')
  const concesiones = concesionesDeTitulares(db, alta.titulares, e.id)
  const respuestas = new Map(d.concesiones.map((r) => [r.concesionId, r.tieneDeuda]))
  if (d.concesiones.some((r) => !concesiones.some((c) => c.id === r.concesionId))) throw error400('Hay concesiones que no son de los titulares de este expediente.')
  const faltan = concesiones.filter((c) => !respuestas.has(c.id))
  if (faltan.length) throw error400(`Indique si tienen deuda las concesiones ${faltan.map((c) => `N° ${c.numero ?? c.id}`).join(', ')}.`)

  //1.- Lo respondido: deuda nueva (una por titular) o deuda que se levanta.
  for (const c of concesiones) {
    const tiene = respuestas.get(c.id)
    if (tiene && !c.tieneDeuda) {
      for (const t of c.titulares) {
        db.deudas.push({ id: nuevoId(db), personaId: t.personaId, concesionId: c.id, detalle: `Deuda de la concesión N° ${c.numero ?? c.id}`, monto: null, estado: 'PENDIENTE', creadoEn: ahora(), canceladoEn: null, comprobantePago: null })
      }
    }
    if (!tiene && c.tieneDeuda) {
      for (const x of db.deudas.filter((x) => x.concesionId === c.id && x.estado === 'PENDIENTE')) Object.assign(x, { estado: 'CANCELADA', canceladoEn: ahora() })
    }
  }

  //2.- ¿Queda alguna deuda pendiente de los titulares?
  if (pendientesDe(db, alta.titulares).length) {
    actuar(db, e, usuario, 'VERIFICACION_DEUDA', 'CON_DEUDA', observaciones(p), { concesionesConDeuda: concesiones.filter((c) => respuestas.get(c.id)).map((c) => c.id) })
    e.estado = 'EN_ESPERA'
    return armarAlta(db, e.id)
  }
  e.estado = 'EN_TRAMITE'
  alta.verificados = [...alta.titulares]
  actuar(db, e, usuario, 'VERIFICACION_DEUDA', 'SIN_DEUDA', observaciones(p))
  const destino = e.vuelveA ?? 'DISTRITO'
  e.vuelveA = null
  pasar(db, e, destino, usuario, { dictamen: 'APROBADO', observaciones: observaciones(p) })
  return armarAlta(db, e.id)
}

function dictamen(oficina: 'distrito' | 'juridico') {
  return (p: Peticion) => {
    const { db, usuario, ruta } = p
    const etapa = oficina === 'distrito' ? 'DISTRITO' : 'JURIDICO'
    const { e, alta } = exigirAlta(db, ruta.id)
    exigirActuar(e, usuario, [etapa])
    const d = cuerpoDe<{ resultado?: string }>(p)
    const obs = observaciones(p)
    if ((d.resultado === 'OBSERVADO' || d.resultado === 'NO_APTO') && !obs) throw error400('Indique el motivo en las observaciones.')
    const actuacion = oficina === 'distrito' ? 'INFORME_TECNICO' : 'DICTAMEN_JURIDICO'
    if (d.resultado === 'APTO') {
      actuar(db, e, usuario, actuacion, 'APTO', obs)
      pasar(db, e, oficina === 'distrito' ? 'JURIDICO' : 'SECRETARIA_GENERAL', usuario, { dictamen: 'APROBADO', observaciones: obs })
    } else if (d.resultado === 'OBSERVADO') {
      //1.- Vuelve a Catastro para corregir y, al reenviarse, a esta oficina.
      actuar(db, e, usuario, actuacion, 'OBSERVADO', obs)
      e.vuelveA = etapa
      pasar(db, e, 'CORRECCION', usuario, { dictamen: 'OBSERVADO', esDevolucion: true, observaciones: obs, estado: 'OBSERVADO' })
    } else if (d.resultado === 'NO_APTO') {
      //2.- No apto: termina el trámite y la concesión no se otorga.
      actuar(db, e, usuario, actuacion, 'NO_APTO', obs)
      terminar(e, 'RECHAZADO')
      db.concesiones.find((c) => c.id === alta.concesionId)!.estado = 'DENEGADA'
    } else {
      throw error400('El resultado debe ser APTO, OBSERVADO o NO_APTO.')
    }
    return armarAlta(db, e.id)
  }
}

/** Número de concesión: el siguiente libre (en el backend lo carga Catastro de su libro). */
function numeroConcesion({ db, usuario, ruta }: Peticion) {
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['SECRETARIA_GENERAL'])
  const c = db.concesiones.find((x) => x.id === alta.concesionId)!
  if (!c.numero) {
    const usados = db.concesiones.map((x) => Number(x.numero)).filter((n) => Number.isInteger(n))
    c.numero = String(Math.max(4500, ...usados) + 1)
    actuar(db, e, usuario, 'NUMERO_CONCESION', 'REGISTRADO', null, { numero: c.numero }, 'catastro')
  }
  return armarAlta(db, e.id)
}

/** Resoluciones ya usadas (número/año único entre todos los trámites). */
export const resolucionUsada = (db: Db, numero: string, anio: number) =>
  db.concesiones.some((c) => c.resolucion && Number(c.resolucion.numero) === Number(numero) && c.resolucion.anio === anio) || db.bajas.some((b) => b.resolucion === `${Number(numero)}/${anio}`)

function resolucion(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['SECRETARIA_GENERAL'])
  const c = db.concesiones.find((x) => x.id === alta.concesionId)!
  if (!c.numero) throw error409('Primero tiene que estar asignado el número de concesión.')
  const d = cuerpoDe<{ numero?: string; anio?: number; fecha?: string }>(p)
  const numero = exigirTexto(d.numero, 'Ingrese el número de resolución.')
  if (!d.anio || !d.fecha) throw error400('Ingrese el año y la fecha de la resolución.')
  if (resolucionUsada(db, numero, d.anio)) throw error409(`La resolución ${numero}/${d.anio} ya está registrada.`)
  c.resolucion = { numero, anio: d.anio, fecha: d.fecha }
  c.fechaOtorgamiento = d.fecha
  actuar(db, e, usuario, 'RESOLUCION', 'REGISTRADO', observaciones(p), { resolucion: `${numero}/${d.anio}`, fecha: d.fecha })
  pasar(db, e, 'CIERRE', usuario, { dictamen: 'APROBADO', observaciones: `Concesión N° ${c.numero}.` })
  return armarAlta(db, e.id)
}

function verificacionFinal(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['CIERRE'])
  const faltan = faltantes(db, alta)
  if (faltan.length) throw error400(`Falta completar: ${faltan.join(', ')}.`)
  if (!alta.poligono) throw error400('Falta el polígono de la concesión (KML o GeoJSON): es obligatorio para la verificación final, así la concesión queda en el visor.')
  actuar(db, e, usuario, 'VERIFICACION_FINAL', 'REGISTRADO', observaciones(p))
  pasar(db, e, 'ESPERA_PADRON', usuario)
  return armarAlta(db, e.id)
}

function padron(p: Peticion) {
  const { db, usuario, ruta } = p
  const { e, alta } = exigirAlta(db, ruta.id)
  exigirActuar(e, usuario, ['ESPERA_PADRON'])
  const numero = exigirTexto(cuerpoDe<{ padron?: string }>(p).padron, 'Ingrese el número de padrón.')
  const otra = Object.values(db.altas).find((a) => a.expedienteId !== e.id && a.inmueble?.catastral.padron === numero)
  if (otra) throw error409(`El padrón ${numero} ya corresponde a otra concesión.`)
  alta.inmueble!.catastral.padron = numero
  db.concesiones.find((c) => c.id === alta.concesionId)!.estado = 'VIGENTE'
  actuar(db, e, usuario, 'PADRON', 'REGISTRADO', observaciones(p), { padron: numero })
  terminar(e, 'FINALIZADO')
  return armarAlta(db, e.id)
}

// ---------------------------------------------------------------------------
// Deudas (Recaudación)
// ---------------------------------------------------------------------------

function deudaRespuesta(db: Db, d: Db['deudas'][number]): DeudaBackend {
  const p = db.personas.find((x) => x.id === d.personaId)
  const nombre = p ? (p.tipoPersona === 'JURIDICA' ? (p.razonSocial ?? '') : `${p.apellido}, ${p.nombre}`) : ''
  return { id: d.id, persona: { id: d.personaId, nombre, documento: p?.documento ?? null }, detalle: d.detalle, monto: d.monto, estado: d.estado, creadoEn: d.creadoEn, canceladoEn: d.canceladoEn, comprobantePago: d.comprobantePago }
}

/** Pago: cancela la deuda y reanuda los expedientes en espera cuyos titulares ya no deben nada. */
function cancelarDeuda(p: Peticion) {
  const { db, usuario, ruta } = p
  const d = db.deudas.find((x) => x.id === ruta.id)
  if (!d) throw error404('No se encontró la deuda.')
  if (d.estado === 'CANCELADA') throw error409('La deuda ya estaba cancelada.')
  d.estado = 'CANCELADA'
  d.canceladoEn = ahora()
  d.comprobantePago = cuerpoDe<{ comprobante?: string }>(p).comprobante ?? null
  for (const e of db.expedientes.filter((x) => x.estado === 'EN_ESPERA' && x.etapa === 'RECAUDACION')) {
    const titulares = titularesDe(db, e)
    if (titulares.includes(d.personaId) && !pendientesDe(db, titulares).length) {
      e.estado = 'EN_TRAMITE'
      actuar(db, e, usuario, 'DEUDA_CANCELADA', 'REGISTRADO', d.comprobantePago ? `Comprobante ${d.comprobantePago}` : null)
    }
  }
  return deudaRespuesta(db, d)
}

export const rutasAlta: Ruta[] = [
  ['GET', '/catalogos/situaciones-legales', () => SITUACIONES],
  ['POST', ALTA, iniciar],
  ['GET', `${ALTA}/:id`, ({ db, ruta }) => armarAlta(db, ruta.id)],
  ['PUT', `${ALTA}/:id/titulares`, titulares],
  ['PUT', `${ALTA}/:id/ubicacion`, ubicacion],
  ['PUT', `${ALTA}/:id/inmueble`, inmueble],
  ['PUT', `${ALTA}/:id/usos`, usos],
  ['PUT', `${ALTA}/:id/suministro`, suministro],
  ['POST', `${ALTA}/:id/enviar`, enviar],
  ['POST', `${ALTA}/:id/reenviar`, reenviar],
  ['GET', `${ALTA}/:id/recaudacion`, antecedentesDeuda],
  ['POST', `${ALTA}/:id/recaudacion`, recaudacion],
  ['POST', `${ALTA}/:id/distrito`, dictamen('distrito')],
  ['POST', `${ALTA}/:id/juridico`, dictamen('juridico')],
  ['POST', `${ALTA}/:id/numero-concesion`, numeroConcesion],
  ['POST', `${ALTA}/:id/resolucion`, resolucion],
  ['POST', `${ALTA}/:id/verificacion-final`, verificacionFinal],
  ['POST', `${ALTA}/:id/padron`, padron],
  ['GET', '/personas', buscarPersona],
  ['GET', '/deudas', ({ db, query }) => db.deudas.filter((d) => d.personaId === query.personaId).map((d) => deudaRespuesta(db, d))],
  ['POST', '/deudas/:id/cancelar', cancelarDeuda],
]

/**
 * La persona con ese documento o, si es física, la cargada con el equivalente (DNI ↔ CUIL / CUIT).
 * Gana el documento exacto y después el CUIL / CUIT (como en el backend).
 */
function personaEquivalente(db: Db, documento: string, tipoPersona?: PersonaDemo['tipoPersona']): PersonaDemo | null {
  const dni = tipoPersona === 'JURIDICA' ? null : dniDeDocumento(documento)
  const prioridad = (p: PersonaDemo) => (p.documento === documento ? 0 : p.documento?.length === 11 ? 1 : 2)
  return (
    db.personas
      .filter((p) => p.documento === documento || (!!dni && p.tipoPersona === 'FISICA' && !!p.documento && dniDeDocumento(p.documento) === dni))
      .sort((a, b) => prioridad(a) - prioridad(b))[0] ?? null
  )
}

/** GET /personas?documento= — la persona (para autocompletar el titular) y sus deudas pendientes. 404 si no existe. */
function buscarPersona({ db, query }: Peticion) {
  const documento = (query.documento ?? '').replace(/\D/g, '')
  if (!/^\d{7,11}$/.test(documento)) throw error400('Indique el documento (DNI, CUIL o CUIT, solo números).')
  const persona = personaEquivalente(db, documento)
  if (!persona) throw error404('No hay ninguna persona cargada con ese documento.')
  return { persona, concesiones: [], deudasPendientes: pendientesDe(db, [persona.id]).map((d) => deudaRespuesta(db, d)) }
}

/** Titular para las bandejas. */
export const titularDeAltaExpediente = (db: Db, e: ExpedienteDemo) => (db.altas[e.id] ? titularDeAlta(db, db.altas[e.id].titulares) : null)
