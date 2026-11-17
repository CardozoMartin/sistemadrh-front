// Semilla del modo demo:
//   - Usuarios de prueba: los mismos del backend (1 Sistema, 2 Catastro … 7 Pozos).
//   - El padrón demo del backend (backend/datos/demo/padron-demo.json): concesiones migradas con
//     su polígono y sus pozos, y algunos desagües (uno lejos del polígono, para ver el aviso).
//   - Trámites de ejemplo en distintas etapas. Se arman RECORRIENDO el circuito con las mismas
//     rutas que usa la app, así el historial queda igual que si los hubiera cargado una persona.
import type { Polygon } from 'geojson'
import { calcularHectareas } from '@/lib/geo'
import { aPosgar } from '@/lib/posgar'
import { VERSION, type ConcesionDemo, type Db, type PozoDemo } from './db'
import { anilloDe } from './geo'
import { atender } from './index'

interface FilaPadron {
  anio: number | null
  otorgamiento: string
  titulares: string | null
  documento: string | null
  cuit: string | null
  caracter: string | null
  codigoServicio: number | null
  uso: string | null
  cantidad: number | null
  localidad: string | null
  departamento: string | null
  distrito: string | null
  cuenca: string | null
  fuente: string | null
  sistema: string | null
  canalPrincipal: string | null
  geometria: Polygon | null
  pozos?: { alias: string | null; latitud: number; longitud: number; tipo: string | null; estado: PozoDemo['estado']; profundidad: number | null; nivelEstatico: number | null; nivelDinamico: number | null; caudalM3h: number | null }[]
}

/** Módulo de riego (l/s por ha) para estimar el caudal de las migradas de riego. */
const DOTACION_RIEGO = 0.75

export async function crearSemilla(): Promise<Db> {
  const padron = (await import('../datos/padron-demo.json')).default as FilaPadron[]
  const db: Db = {
    version: VERSION,
    seq: 1000,
    usuarios: [
      { id: '1', apellido: 'Sistema', nombre: 'DRH', oficina: null, esAdministrador: true },
      { id: '2', apellido: 'Prueba', nombre: 'Catastro', oficina: 'catastro', esAdministrador: false },
      { id: '3', apellido: 'Prueba', nombre: 'Recaudación', oficina: 'recaudacion', esAdministrador: false },
      { id: '4', apellido: 'Prueba', nombre: 'Distrito', oficina: 'distrito', esAdministrador: false },
      { id: '5', apellido: 'Prueba', nombre: 'Jurídico', oficina: 'juridico', esAdministrador: false },
      { id: '6', apellido: 'Prueba', nombre: 'Secretaría', oficina: 'secretaria_general', esAdministrador: false },
      { id: '7', apellido: 'Prueba', nombre: 'Pozos', oficina: 'pozos', esAdministrador: false },
    ],
    expedientes: [],
    historial: [],
    personas: [],
    deudas: [],
    concesiones: [],
    altas: {},
    puntos: [],
    pozos: [],
    bajas: [],
    monitoreos: [],
  }
  const id = () => String(++db.seq)

  //0.- Persona ficticia para probar el autocompletado del titular (DNI 20000000).
  db.personas.push({
    id: id(),
    tipoPersona: 'FISICA',
    tipoDocumento: 'DNI',
    documento: '20000000',
    apellido: 'Fernández',
    nombre: 'Lucía Andrea',
    fechaNacimiento: '1988-03-14',
    razonSocial: null,
    fechaConstitucion: null,
    email: 'lucia.fernandez@ejemplo.com',
    telefono: '(0381) 456-7890',
  })

  //1.- Concesiones migradas del padrón demo, con sus pozos.
  for (const f of padron) {
    const geom = f.geometria ? { type: 'MultiPolygon' as const, coordinates: [f.geometria.coordinates] } : null
    const c: ConcesionDemo = {
      id: id(),
      numero: f.otorgamiento,
      estado: 'VIGENTE',
      origen: 'MIGRACION',
      expedienteId: null,
      anio: f.anio,
      fechaOtorgamiento: f.anio ? `${f.anio}-01-01` : null,
      resolucion: null,
      migrada: {
        titular: f.titulares,
        documento: f.documento ?? f.cuit,
        departamento: f.departamento,
        localidad: f.localidad,
        distrito: f.distrito,
        cuenca: f.cuenca,
        caudalLps: f.uso === 'RIEGO' && f.cantidad ? +(f.cantidad * DOTACION_RIEGO).toFixed(2) : null,
        caracter: f.caracter,
        codigoServicio: f.codigoServicio,
        usos: f.uso,
        fuente: f.fuente,
        sistema: f.sistema,
        canalPrincipal: f.canalPrincipal,
        geom,
        superficieHa: geom ? +calcularHectareas(anilloDe(geom)).toFixed(4) : null,
      },
    }
    db.concesiones.push(c)
    ;(f.pozos ?? []).forEach((p, i) => {
      const { x, y } = aPosgar(p.latitud, p.longitud)
      db.pozos.push({
        id: id(),
        idInterno: `P${f.otorgamiento}-${i + 1}`.slice(0, 20),
        alias: p.alias,
        estado: p.estado,
        origen: 'MIGRACION',
        tipoPozo: p.tipo,
        jurisdiccionDrh: true,
        profundidadM: p.profundidad,
        nivelEstaticoM: p.nivelEstatico,
        nivelDinamicoM: p.nivelDinamico,
        caudalM3h: p.caudalM3h,
        latitud: p.latitud,
        longitud: p.longitud,
        x: +x.toFixed(2),
        y: +y.toFixed(2),
        concesionId: c.id,
      })
    })
  }

  //2.- Desagües de una de cada cuatro concesiones (dentro del polígono, cerca de un borde).
  const conPoligono = db.concesiones.filter((c) => c.migrada?.geom)
  conPoligono.forEach((c, i) => {
    if (i % 4) return
    const anillo = anilloDe(c.migrada!.geom!)
    const centro = anillo.reduce(([a, b], [lat, lng]) => [a + lat / anillo.length, b + lng / anillo.length], [0, 0])
    // El sexto queda a ~1,5 km: así se ve en el visor el borde rojo de «coordenada a revisar».
    const lejos = i === 24
    const lat = lejos ? centro[0] + 0.0135 : centro[0] * 0.7 + anillo[0][0] * 0.3
    const lng = lejos ? centro[1] : centro[1] * 0.7 + anillo[0][1] * 0.3
    const p = aPosgar(lat, lng)
    const enGrados = i % 8 === 0
    db.puntos.push({ id: id(), concesionId: c.id, tipo: 'DESAGUE', sistema: enGrados ? 'WGS84' : 'POSGAR_FAJA3', x: +p.x.toFixed(2), y: +p.y.toFixed(2), latitud: +lat.toFixed(6), longitud: +lng.toFixed(6), referencia: null })
  })

  //3.- Trámites de ejemplo, recorriendo el circuito con los usuarios de cada oficina.
  await tramitesDeEjemplo(db)
  return db
}

const ANIO = new Date().getFullYear()

/** Cuadrado de ~300 m de lado como KML (la forma más simple de cargar un polígono). */
function kmlCuadrado(lat: number, lng: number): string {
  const d = 0.0015
  const v = [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ]
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>Parcela</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${v.map((p) => p.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`
}

interface Ejemplo {
  numero: string
  titular: { apellido: string; nombre: string; documento: string }
  lugar: { departamento: string; localidad: string; distrito: string; lat: number; lng: number }
  /** Hasta dónde avanza: 'carga' (a medio cargar), 'recaudacion', 'juridico' o 'secretaria'. */
  hasta: 'carga' | 'recaudacion' | 'juridico' | 'secretaria'
  desagueEnGrados: boolean
}

async function tramitesDeEjemplo(db: Db) {
  const llamar = (usuarioId: string, metodo: string, url: string, cuerpo?: unknown) => atender(db, { metodo, url, params: {}, cuerpo, usuarioId })

  const ejemplos: Ejemplo[] = [
    { numero: '101', titular: { apellido: 'Gómez', nombre: 'María Elena', documento: '23456789' }, lugar: { departamento: 'LULES', localidad: 'INGENIO SAN PABLO', distrito: 'IV', lat: -26.985, lng: -65.33 }, hasta: 'recaudacion', desagueEnGrados: true },
    { numero: '102', titular: { apellido: 'Herrera', nombre: 'Juan Carlos', documento: '20111222' }, lugar: { departamento: 'FAMAILLA', localidad: 'CAMPO DE HERRERA', distrito: 'IV', lat: -27.06, lng: -65.39 }, hasta: 'juridico', desagueEnGrados: false },
    { numero: '103', titular: { apellido: 'Paz', nombre: 'Rosa', documento: '27333444' }, lugar: { departamento: 'MONTEROS', localidad: 'Monteros', distrito: 'IV', lat: -27.175, lng: -65.49 }, hasta: 'secretaria', desagueEnGrados: true },
    { numero: '104', titular: { apellido: 'Díaz', nombre: 'Pedro', documento: '30555666' }, lugar: { departamento: 'CRUZ ALTA', localidad: 'BANDA DEL RIO SALI', distrito: 'III', lat: -26.85, lng: -65.15 }, hasta: 'carga', desagueEnGrados: false },
  ]

  for (const ej of ejemplos) {
    const situacion = 'titular'
    const alta = (await llamar('2', 'POST', '/tramites/alta-concesion', { expediente: { numero: ej.numero, reparticion: '325', anio: ANIO }, situacionLegal: situacion, documentacionPresentada: [1] })) as { id: string }
    const url = `/tramites/alta-concesion/${alta.id}`
    const { departamento, localidad, distrito } = ej.lugar
    await llamar('2', 'PUT', `${url}/titulares`, {
      titulares: [{ tipoPersona: 'FISICA', tipoDocumento: 'DNI', ...ej.titular, fechaNacimiento: '1975-05-10', email: `${ej.titular.apellido.toLowerCase()}@ejemplo.com`, telefono: '(0381) 452-6393' }],
      domicilios: [{ calle: 'Av. San Martín', numero: String(100 + Number(ej.numero)), departamento, localidad, distrito }],
    })
    const ubicacion = new FormData()
    ubicacion.append('departamento', departamento)
    ubicacion.append('localidad', localidad)
    ubicacion.append('distrito', distrito)
    ubicacion.append('archivo', new File([kmlCuadrado(ej.lugar.lat, ej.lugar.lng)], `parcela-${ej.numero}.kml`, { type: 'application/vnd.google-earth.kml+xml' }))
    await llamar('2', 'PUT', `${url}/ubicacion`, ubicacion)
    if (ej.hasta === 'carga') continue

    await llamar('2', 'PUT', `${url}/inmueble`, { catastral: { matricula: `${ej.numero}-${20000 + Number(ej.numero)}`, circunscripcion: 'II', seccion: 'B', parcela: `${ej.numero}A` }, registral: { libro: '120', folio: '45', anio: 1998 } })
    const desague = ej.desagueEnGrados
      ? { latitud: ej.lugar.lat - 0.001, longitud: ej.lugar.lng + 0.001 }
      : (({ x, y }) => ({ x: +x.toFixed(2), y: +y.toFixed(2) }))(aPosgar(ej.lugar.lat - 0.001, ej.lugar.lng + 0.001))
    await llamar('2', 'PUT', `${url}/usos`, { caracter: 'PERMANENTE', codigoServicio: 1, periodoInicio: `${ANIO}-01-01`, periodoFin: `${ANIO + 4}-12-31`, desague, items: [{ uso: 'agricola-riego', magnitud: 9 }] })
    await llamar('2', 'PUT', `${url}/suministro`, { fuentes: ['RIO LULES'], observacion: 'Cargado para la demo.' })
    await llamar('2', 'POST', `${url}/enviar`, {})
    if (ej.hasta === 'recaudacion') continue

    await llamar('3', 'POST', `/expedientes/${alta.id}/tomar`)
    await llamar('3', 'POST', `${url}/recaudacion`, { concesiones: [] })
    await llamar('4', 'POST', `/expedientes/${alta.id}/tomar`)
    await llamar('4', 'POST', `${url}/distrito`, { resultado: 'APTO', observaciones: 'Hay disponibilidad en el canal.' })
    if (ej.hasta === 'juridico') continue

    await llamar('5', 'POST', `/expedientes/${alta.id}/tomar`)
    await llamar('5', 'POST', `${url}/juridico`, { resultado: 'APTO' })
  }

  //4.- Bajas de pozo: una en la mesa de entrada, una en Jurídico y una de oficio (aviso a Distrito).
  const enUso = db.pozos.filter((p) => p.estado === 'EN_USO')
  const [p1, p2, p3] = [enUso[0], enUso[3], enUso[6]]
  if (p1) {
    await llamar('7', 'POST', '/tramites/baja-pozo', {
      pozoId: p1.id,
      expediente: { numero: '201', reparticion: '325', anio: ANIO },
      motivo: 'El pozo se secó y el titular ya no lo usa.',
      solicitanteNombre: 'Luna, Rosa',
      solicitanteDocumento: '14222333',
      documentacionPresentada: ['NOTA_SOLICITUD', 'DOCUMENTO_TITULAR'],
    })
  }
  if (p2) {
    const b = (await llamar('7', 'POST', '/tramites/baja-pozo', {
      pozoId: p2.id,
      expediente: { numero: '202', reparticion: '325', anio: ANIO },
      motivo: 'Cambio de fuente: la finca pasa a regar con agua del canal.',
      solicitanteNombre: 'Agropecuaria El Ceibo S.A.',
      solicitanteDocumento: '30712345678',
      documentacionPresentada: ['NOTA_SOLICITUD', 'DOCUMENTO_TITULAR', 'TITULO_INMUEBLE', 'CROQUIS'],
    })) as { expediente: { id: string } }
    const url = `/tramites/baja-pozo/${b.expediente.id}`
    await llamar('7', 'POST', `${url}/documentacion`, { resultado: 'COMPLETA' })
    await llamar('7', 'POST', `${url}/antecedentes`, {})
    await llamar('7', 'POST', `${url}/evaluacion-tecnica`, { resultado: 'FAVORABLE', inspeccionRealizada: true, fechaInspeccion: `${ANIO}-09-15`, informeTecnico: 'Pozo sin equipo de bombeo. Corresponde cegarlo.', requiereClausura: true })
  }
  if (p3) {
    await llamar('7', 'POST', `/tramites/baja-pozo/de-oficio/${p3.id}`, { motivo: 'En la inspección se constató que la perforación no existe.', fechaInspeccion: `${ANIO}-08-20` })
  }

  //5.- Pozos registrados de oficio (alta de pozo sin autorización previa), con su primer monitoreo.
  const oficio = [
    { motivo: 'RELEVAMIENTO DE CAMPO', causante: 'Ruiz, Miguel Ángel', documento: '20187654323', departamento: 'LEALES', localidad: 'SANTA ROSA DE LEALES', distrito: 'III', coordenada: { latitud: -27.14, longitud: -65.26 }, profundidad: 120, caudal: 72 },
    { motivo: 'POZO PREEXISTENTE', causante: 'Citrícola San Javier S.R.L.', documento: '30715553339', departamento: 'TAFI VIEJO', localidad: 'TAFI VIEJO', distrito: 'VII', coordenada: (({ x, y }) => ({ x: +x.toFixed(2), y: +y.toFixed(2) }))(aPosgar(-26.73, -65.26)), profundidad: 210, caudal: 150 },
    { motivo: 'DENUNCIA DE TERCEROS', causante: 'Sosa, Ana', documento: '27298765437', departamento: 'MONTEROS', localidad: 'Monteros', distrito: 'IV', coordenada: { latitud: -27.16, longitud: -65.46 }, profundidad: null, caudal: null },
  ]
  const registros: string[] = []
  for (const o of oficio) {
    const { expedienteId } = (await llamar('7', 'POST', '/pozos/oficio', {
      motivo: o.motivo,
      causante: o.causante,
      domicilio: null,
      documento: o.documento,
      telefono: null,
      empresa: null,
      fechaIngreso: `${ANIO}-09-${10 + oficio.indexOf(o) * 7}`,
      asunto: o.motivo === 'DENUNCIA DE TERCEROS' ? 'Vecinos denuncian una perforación sin registrar.' : null,
      jurisdiccionDrh: true,
      estado: o.caudal ? 'EN_USO' : 'PARADO',
      alias: null,
      telefonoServicio: null,
      ubicacion: { cuencaSuperficial: null, cuencaSubterranea: 'CUENCA RIO SALI (SEMI-SURGENTE)', paraje: null, comuna: null, zona: null, departamento: o.departamento, localidad: o.localidad, distrito: o.distrito, cota: null },
      coordenada: o.coordenada,
      nombrePozo: null,
      caracteristicas: null,
      litologia: [],
      construccion: { profundidad: o.profundidad, tramos: [], filtros: [] },
      equipo: { profundidadBomba: null, nivelCementacion: null, tipoBomba: null, regimenM3h: o.caudal },
      hidraulico: o.caudal ? { fecha: `${ANIO}-09-05`, nivelEstatico: -42, nivelDinamico: -58.5, caudalM3h: o.caudal } : null,
      usos: o.caudal ? [{ uso: 'AGRICOLA', cantidad: o.caudal, unidad: 'M3/H' }] : [],
      quimico: null,
      observaciones: null,
    })) as { expedienteId: string }
    registros.push(expedienteId)
  }

  //6.- El segundo registro ya pasó por Catastro, Distrito y Recaudación: queda en Jurídico.
  const url = `/tramites/registro-pozo/${registros[1]}`
  await llamar('2', 'POST', `/expedientes/${registros[1]}/tomar`)
  await llamar('2', 'PUT', `${url}/catastro`, {
    tipoConcesion: 'DEFINITIVO',
    numeroConcesion: '4600',
    rigeDesde: `${ANIO}-10-01`,
    rigeHasta: null,
    titulares: [{ documento: '30715553339', nombre: 'Citrícola San Javier S.R.L.', domicilio: 'Ruta 9 km 1300, Tafí Viejo', caracter: 'TITULAR' }],
    catastral: { padron: null, circunscripcion: 'I', seccion: 'C', lamina: '12', parcela: '45B', matricula: 'T-30455', orden: null },
    dominio: { matricula: null, libro: '88', folio: '120', serie: null, anio: 2004 },
    estadoPozo: 'EN_USO',
    uso: 'INDUSTRIAL A',
  })
  await llamar('2', 'POST', `${url}/catastro`, { resultado: 'APTO', observaciones: 'Concesión de agua subterránea para riego del empaque.' })
  await llamar('4', 'POST', `/expedientes/${registros[1]}/tomar`)
  await llamar('4', 'POST', `${url}/distrito`, {})
  await llamar('3', 'POST', `/expedientes/${registros[1]}/tomar`)
  await llamar('3', 'POST', `${url}/recaudacion`, { resultado: 'SIN_DEUDA' })

  //7.- Historial de monitoreos del mismo pozo: dos hidráulicos viejos (cargados hoy, con su fecha) y un químico.
  const pozoCitricola = db.pozos.find((p) => p.registro?.expedienteId === registros[1])!.id
  const mon = (tipo: string, fecha: string, datos: Record<string, unknown>) => llamar('7', 'POST', `/pozos/${pozoCitricola}/monitoreos`, { tipo, fecha, datos })
  await mon('hidraulico', '2019-06-12', { nivelEstatico: -35.2, nivelDinamico: -49, caudalM3h: 165, regimenM3h: 165, profundidadBomba: 90, nivelCementacion: null, tipoBomba: 'Sumergible' })
  await mon('hidraulico', '2023-04-03', { nivelEstatico: -39.8, nivelDinamico: -55.1, caudalM3h: 158, regimenM3h: 150, profundidadBomba: 90, nivelCementacion: null, tipoBomba: 'Sumergible' })
  await mon('quimico', `${ANIO}-08-28`, {
    parametros: [
      { parametro: 'PH', tipoResultado: 'VALOR', simbolo: 'pH', resultado: '7.4', unidad: null, observacion: null },
      { parametro: 'CONDUCTIVIDAD ELECT. (25C)', tipoResultado: 'VALOR', simbolo: 'CE', resultado: '640', unidad: 'uS/cm', observacion: null },
      { parametro: 'NITRATOS', tipoResultado: 'VALOR', simbolo: 'NO3', resultado: '12.5', unidad: 'mg/l', observacion: null },
      { parametro: 'ARSENICO', tipoResultado: 'MENOR', simbolo: 'As', resultado: '0.01', unidad: 'mg/l', observacion: 'Debajo del límite de detección' },
    ],
  })
}
