// Pozos y Baja de Pozo emulados (como backend/src/pozos y backend/src/tramites/baja-pozo).
//
//   De oficio: en el acto, sin expediente. Distrito recibe el aviso.
//   A solicitud: POZOS (documentación → antecedentes → evaluación técnica) → JURÍDICO → SECRETARÍA GENERAL → POZOS (clausura, si corresponde)
import type { AvisoDistrito, BajaBackend, BajaEnLista, EtapaBaja, OficinaBaja, PozoBackend } from '@/features/pozo/BajaDePozo/types'
import { ahora, hoy, nuevoId, type BajaDemo, type Db, type ExpedienteDemo, type PozoDemo } from './db'
import { actuar, crearExpediente, exigirActuar, exigirExpediente, formatearNumero, NOMBRE_ETAPA, NOMBRE_OFICINA, nombreUsuario, pasar, terminar, usuarioDe, circuitoDe } from './expedientes'
import { titularDeAlta } from './geo'
import { resolucionUsada } from './alta'
import { cuerpoDe, error400, error403, error404, error409, exigirTexto, type Peticion, type Ruta } from './http'

const BAJA = '/tramites/baja-pozo'

/** Checklist PROVISORIO de la mesa de entrada (DOCUMENTOS_BAJA del backend). */
export const DOCUMENTOS_BAJA = [
  { codigo: 'NOTA_SOLICITUD', descripcion: 'Nota de solicitud de baja firmada por el titular', obligatorio: true },
  { codigo: 'DOCUMENTO_TITULAR', descripcion: 'Copia del DNI / constancia de CUIT del titular', obligatorio: true },
  { codigo: 'TITULO_INMUEBLE', descripcion: 'Título o informe de dominio del inmueble', obligatorio: true },
  { codigo: 'LIBRE_DEUDA', descripcion: 'Libre deuda de la tasa de uso del agua', obligatorio: false },
  { codigo: 'CROQUIS', descripcion: 'Croquis de ubicación de la perforación', obligatorio: false },
  { codigo: 'PODER', descripcion: 'Poder o autorización (si se presenta un tercero)', obligatorio: false },
]

const ABIERTAS = ['EN_TRAMITE', 'EN_ESPERA', 'OBSERVADA']

// ---------------------------------------------------------------------------
// Pozos
// ---------------------------------------------------------------------------

/** Datos de la concesión que se muestran con el pozo (migrada o cargada en el sistema). */
export function datosConcesion(db: Db, id: string | null) {
  const c = id ? db.concesiones.find((x) => x.id === id) : undefined
  if (!c) return null
  const alta = c.expedienteId ? db.altas[c.expedienteId] : undefined
  return {
    c,
    titular: c.migrada?.titular ?? (alta ? titularDeAlta(db, alta.titulares) : null),
    titulares: alta?.titulares ?? [],
    departamento: c.migrada?.departamento ?? alta?.ubicacion?.departamento ?? null,
    localidad: c.migrada?.localidad ?? alta?.ubicacion?.localidad ?? null,
    distrito: c.migrada?.distrito ?? alta?.ubicacion?.distrito ?? null,
  }
}

export function fichaPozo(db: Db, p: PozoDemo): PozoBackend {
  const conc = datosConcesion(db, p.concesionId)
  const bajas = db.bajas.filter((b) => b.pozoId === p.id)
  const abierta = bajas.find((b) => ABIERTAS.includes(b.estado) && b.expedienteId)
  const expAbierta = abierta?.expedienteId ? db.expedientes.find((e) => e.id === abierta.expedienteId) : undefined
  const aprobada = p.estado === 'BAJA' ? [...bajas].reverse().find((b) => b.estado === 'CONFIRMADA' || b.estado === 'CLAUSURA_PENDIENTE') : undefined
  const expAprobada = aprobada?.expedienteId ? db.expedientes.find((e) => e.id === aprobada.expedienteId) : undefined
  const anterior = aprobada ? datosConcesion(db, aprobada.concesionAnteriorId) : null
  const expedientes = [
    ...bajas.flatMap((b) => (b.expedienteId ? [db.expedientes.find((e) => e.id === b.expedienteId)!] : [])),
    ...(conc?.c.expedienteId ? [db.expedientes.find((e) => e.id === conc.c.expedienteId)!] : []),
  ]
    .filter(Boolean)
    .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso))
    .map((e) => ({ id: e.id, numero: formatearNumero(e), tipoTramite: e.tipoTramite, estado: e.estado }))
  return {
    id: p.id,
    idInterno: p.idInterno,
    alias: p.alias,
    estado: p.estado,
    origen: p.origen,
    tipoPozo: p.tipoPozo,
    jurisdiccionDrh: p.jurisdiccionDrh,
    profundidadM: p.profundidadM,
    caudalM3h: p.caudalM3h,
    caudalLps: p.caudalM3h === null ? null : +(p.caudalM3h / 3.6).toFixed(3),
    coordX: p.x,
    coordY: p.y,
    latitud: p.latitud,
    longitud: p.longitud,
    concesion: conc ? { id: conc.c.id, numero: conc.c.numero, estado: conc.c.estado, titular: conc.titular, departamento: conc.departamento, localidad: conc.localidad } : null,
    bajaAbierta: abierta && expAbierta ? { expedienteId: expAbierta.id, expediente: formatearNumero(expAbierta), etapa: expAbierta.etapa as EtapaBaja, oficina: expAbierta.oficina as OficinaBaja } : null,
    bajaConfirmada: aprobada
      ? {
          origen: aprobada.origen,
          fechaBaja: aprobada.fechaBaja,
          motivo: aprobada.motivo,
          expedienteId: aprobada.expedienteId,
          expediente: expAprobada ? formatearNumero(expAprobada) : null,
          resolucion: aprobada.resolucion,
          concesionAnterior: anterior?.c.numero ?? null,
          concesionAnulada: !!aprobada.anularConcesion,
          clausura: aprobada.requiereClausura ? { fecha: aprobada.clausura?.fecha ?? null, acta: aprobada.clausura?.acta ?? null } : null,
          usuario: aprobada.usuario,
        }
      : null,
    expedientes,
  }
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Búsqueda por concesión, expediente, titular, documento, ID interno, alias o ubicación (todas las palabras). */
function buscarPozos({ db, query }: Peticion): PozoBackend[] {
  const palabras = sinAcentos(query.q?.trim() ?? '').split(/\s+/).filter(Boolean)
  return db.pozos
    .filter((p) => p.estado !== 'ANULADO')
    .filter((p) => {
      if (!palabras.length) return true
      const conc = datosConcesion(db, p.concesionId)
      const documentos = conc?.titulares.map((id) => db.personas.find((x) => x.id === id)?.documento ?? '') ?? []
      const exp = conc?.c.expedienteId ? db.expedientes.find((e) => e.id === conc.c.expedienteId) : undefined
      const texto = sinAcentos([p.idInterno, p.alias, conc?.c.numero, conc?.titular, conc?.departamento, conc?.localidad, conc?.distrito, exp && formatearNumero(exp), ...documentos].filter(Boolean).join(' '))
      return palabras.every((w) => texto.includes(w))
    })
    .slice(0, 50)
    .map((p) => fichaPozo(db, p))
}

function exigirPozo(db: Db, id: string): PozoDemo {
  const p = db.pozos.find((x) => x.id === id)
  if (!p) throw error404('No se encontró el pozo.')
  return p
}

// ---------------------------------------------------------------------------
// Baja
// ---------------------------------------------------------------------------

function exigirBaja(db: Db, expedienteId: string): { e: ExpedienteDemo; b: BajaDemo } {
  const e = exigirExpediente(db, expedienteId, 'BAJA_POZO')
  return { e, b: db.bajas.find((x) => x.expedienteId === e.id)! }
}

function armarBaja(db: Db, expedienteId: string): BajaBackend {
  const { e, b } = exigirBaja(db, expedienteId)
  const pozo = exigirPozo(db, b.pozoId)
  const anterior = datosConcesion(db, b.concesionAnteriorId)
  const deudas = db.deudas.filter((d) => anterior?.titulares.includes(d.personaId) && d.estado === 'PENDIENTE')
  return {
    expediente: { id: e.id, numero: formatearNumero(e), tipoTramite: e.tipoTramite, ...circuitoDe(db, e), etapa: e.etapa as EtapaBaja, oficinaActual: e.oficina as OficinaBaja },
    baja: {
      id: b.id,
      origen: b.origen,
      estado: b.estado,
      motivo: b.motivo,
      solicitanteNombre: b.solicitanteNombre,
      solicitanteDocumento: b.solicitanteDocumento,
      documentacion: DOCUMENTOS_BAJA.map((d) => ({ ...d, presentado: b.documentacion.includes(d.codigo) })),
      inspeccionRealizada: b.inspeccionRealizada,
      fechaInspeccion: b.fechaInspeccion,
      observacionesInspeccion: b.observacionesInspeccion,
      informeTecnico: b.informeTecnico,
      requiereClausura: b.requiereClausura,
      anularConcesion: b.anularConcesion,
      estadoPozoAnterior: b.estadoPozoAnterior,
      concesionAnterior: anterior?.c.numero ?? null,
      resolucion: b.resolucion,
      fechaBaja: b.fechaBaja,
      clausura: b.clausura,
      avisoDistrito: b.avisoDistrito ? { enviado: b.avisoDistrito.enviado, visto: b.avisoDistrito.visto?.en ?? null } : null,
      creadoEn: b.creadoEn,
    },
    pozo: fichaPozo(db, pozo),
    deudasTasa: deudas.map((d) => {
      const p = db.personas.find((x) => x.id === d.personaId)
      return { persona: p ? `${p.apellido ?? p.razonSocial}, ${p.nombre ?? ''}`.replace(/, $/, '') : '', detalle: d.detalle, monto: d.monto }
    }),
  }
}

/** Un pozo dado de baja o anulado no admite otra; tampoco si ya tiene una sin resolver. */
function exigirPozoParaBaja(db: Db, pozo: PozoDemo) {
  if (pozo.estado === 'BAJA' || pozo.estado === 'ANULADO') throw error409(`El pozo ${pozo.idInterno} ya está ${pozo.estado === 'BAJA' ? 'dado de baja' : 'anulado'}.`)
  if (db.bajas.some((b) => b.pozoId === pozo.id && ABIERTAS.includes(b.estado))) throw error409(`El pozo ${pozo.idInterno} ya tiene una baja en trámite.`)
}

/** Al aprobarse: pozo en BAJA y desvinculado; concesión anulada si se decidió; aviso a Distrito. */
function aplicarBaja(db: Db, b: BajaDemo, fecha: string) {
  const pozo = exigirPozo(db, b.pozoId)
  pozo.estado = 'BAJA'
  pozo.concesionId = null
  b.fechaBaja = fecha
  if (b.anularConcesion && b.concesionAnteriorId) {
    const c = db.concesiones.find((x) => x.id === b.concesionAnteriorId)
    if (c) c.estado = 'ANULADA'
  }
  b.avisoDistrito = { enviado: ahora(), visto: null }
}

function exigirOficinaPozos(p: Peticion) {
  if (!p.usuario.esAdministrador && p.usuario.oficina !== 'pozos') throw error403('Esta acción la hace la oficina de Pozos.')
}

function deOficio(p: Peticion) {
  const { db, usuario, ruta } = p
  exigirOficinaPozos(p)
  const pozo = exigirPozo(db, ruta.pozoId)
  exigirPozoParaBaja(db, pozo)
  const d = cuerpoDe<{ motivo?: string; fechaInspeccion?: string; observacionesInspeccion?: string }>(p)
  const b: BajaDemo = {
    ...bajaVacia(db, pozo, usuario.id),
    origen: 'DE_OFICIO',
    estado: 'CONFIRMADA',
    motivo: exigirTexto(d.motivo, 'Ingrese el motivo de la baja.'),
    inspeccionRealizada: !!d.fechaInspeccion,
    fechaInspeccion: d.fechaInspeccion ?? null,
    observacionesInspeccion: d.observacionesInspeccion ?? null,
  }
  db.bajas.push(b)
  aplicarBaja(db, b, hoy())
  return fichaPozo(db, pozo)
}

function bajaVacia(db: Db, pozo: PozoDemo, usuarioId: string): BajaDemo {
  return {
    id: nuevoId(db),
    expedienteId: null,
    pozoId: pozo.id,
    origen: 'A_SOLICITUD',
    estado: 'EN_TRAMITE',
    motivo: '',
    solicitanteNombre: null,
    solicitanteDocumento: null,
    documentacion: [],
    inspeccionRealizada: null,
    fechaInspeccion: null,
    observacionesInspeccion: null,
    informeTecnico: null,
    requiereClausura: null,
    anularConcesion: null,
    estadoPozoAnterior: pozo.estado,
    concesionAnteriorId: pozo.concesionId,
    resolucion: null,
    fechaBaja: null,
    clausura: null,
    avisoDistrito: null,
    creadoEn: ahora(),
    usuario: usuarioId,
  }
}

function datosSolicitud(d: { motivo?: string; solicitanteNombre?: string; solicitanteDocumento?: string; documentacionPresentada?: string[] }) {
  const codigos = d.documentacionPresentada ?? []
  if (codigos.some((c) => !DOCUMENTOS_BAJA.some((x) => x.codigo === c))) throw error400('Hay documentos que no son del checklist.')
  return {
    motivo: exigirTexto(d.motivo, 'Ingrese el motivo de la baja.'),
    solicitanteNombre: exigirTexto(d.solicitanteNombre, 'Ingrese quién solicita la baja.'),
    solicitanteDocumento: d.solicitanteDocumento ?? null,
    documentacion: codigos,
  }
}

function iniciar(p: Peticion) {
  const { db, usuario } = p
  exigirOficinaPozos(p)
  const d = cuerpoDe<{ pozoId?: string; expediente?: { numero: string; reparticion: string; anio: number } }>(p)
  const pozo = exigirPozo(db, d.pozoId ?? '')
  exigirPozoParaBaja(db, pozo)
  const exp = d.expediente
  if (!exp?.numero || !exp.reparticion || !exp.anio) throw error400('Ingrese el número, la repartición y el año del expediente.')
  if (exp.anio !== new Date().getFullYear()) throw error400('El expediente tiene que ser del año en curso.')
  const solicitud = datosSolicitud(p.cuerpo as Parameters<typeof datosSolicitud>[0])
  const e = crearExpediente(db, { ...exp, tipoTramite: 'BAJA_POZO', etapa: 'INICIO_POZOS' }, usuario)
  db.bajas.push({ ...bajaVacia(db, pozo, usuario.id), expedienteId: e.id, ...solicitud })
  return armarBaja(db, e.id)
}

function actualizar(p: Peticion) {
  const { e, b } = exigirBaja(p.db, p.ruta.id)
  exigirActuar(e, p.usuario, ['INICIO_POZOS', 'CORRECCION_POZOS'])
  Object.assign(b, datosSolicitud(p.cuerpo as Parameters<typeof datosSolicitud>[0]))
  e.actualizado = ahora()
  return armarBaja(p.db, e.id)
}

const obs = (p: Peticion) => (cuerpoDe<{ observaciones?: string }>(p).observaciones || null) as string | null

function documentacion(p: Peticion) {
  const { db, usuario } = p
  const { e, b } = exigirBaja(db, p.ruta.id)
  exigirActuar(e, usuario, ['INICIO_POZOS'])
  const resultado = cuerpoDe<{ resultado?: string }>(p).resultado
  if (resultado === 'COMPLETA') {
    const faltan = DOCUMENTOS_BAJA.filter((d) => d.obligatorio && !b.documentacion.includes(d.codigo))
    if (faltan.length) throw error400(`Falta documentación obligatoria: ${faltan.map((d) => d.descripcion).join('; ')}.`)
    actuar(db, e, usuario, 'DOCUMENTACION', 'COMPLETA', obs(p))
    pasar(db, e, 'ANTECEDENTES_POZOS', usuario)
    b.estado = 'EN_TRAMITE'
  } else if (resultado === 'PENDIENTE') {
    actuar(db, e, usuario, 'DOCUMENTACION', 'PENDIENTE', obs(p))
    e.estado = 'EN_ESPERA'
    b.estado = 'EN_ESPERA'
  } else {
    throw error400('El resultado debe ser COMPLETA o PENDIENTE.')
  }
  return armarBaja(db, e.id)
}

function antecedentes(p: Peticion) {
  const { e } = exigirBaja(p.db, p.ruta.id)
  exigirActuar(e, p.usuario, ['ANTECEDENTES_POZOS'])
  actuar(p.db, e, p.usuario, 'ANTECEDENTES', 'REGISTRADO', obs(p))
  pasar(p.db, e, 'EVALUACION_TECNICA_POZOS', p.usuario)
  return armarBaja(p.db, e.id)
}

function evaluacion(p: Peticion) {
  const { db, usuario } = p
  const { e, b } = exigirBaja(db, p.ruta.id)
  exigirActuar(e, usuario, ['EVALUACION_TECNICA_POZOS'])
  const d = cuerpoDe<{ resultado?: string; inspeccionRealizada?: boolean; fechaInspeccion?: string; observacionesInspeccion?: string; informeTecnico?: string; requiereClausura?: boolean }>(p)
  if (d.inspeccionRealizada && !d.fechaInspeccion) throw error400('Indique la fecha de la inspección.')
  Object.assign(b, {
    inspeccionRealizada: !!d.inspeccionRealizada,
    fechaInspeccion: d.fechaInspeccion ?? null,
    observacionesInspeccion: d.observacionesInspeccion ?? null,
    informeTecnico: exigirTexto(d.informeTecnico, 'Cargue el informe técnico.'),
    requiereClausura: !!d.requiereClausura,
  })
  if (d.resultado === 'FAVORABLE') {
    actuar(db, e, usuario, 'EVALUACION_TECNICA', 'FAVORABLE', d.informeTecnico)
    pasar(db, e, 'JURIDICO', usuario, { dictamen: 'APROBADO' })
    b.estado = 'EN_TRAMITE'
  } else if (d.resultado === 'REQUIERE_SUBSANACION') {
    actuar(db, e, usuario, 'EVALUACION_TECNICA', 'REQUIERE_SUBSANACION', d.informeTecnico)
    e.estado = 'EN_ESPERA'
    b.estado = 'EN_ESPERA'
  } else {
    throw error400('El resultado debe ser FAVORABLE o REQUIERE_SUBSANACION.')
  }
  return armarBaja(db, e.id)
}

function reenviar(p: Peticion) {
  const { e, b } = exigirBaja(p.db, p.ruta.id)
  exigirActuar(e, p.usuario, ['CORRECCION_POZOS'])
  actuar(p.db, e, p.usuario, 'CORRECCION', 'REGISTRADO', obs(p))
  pasar(p.db, e, 'JURIDICO', p.usuario, { observaciones: obs(p) })
  b.estado = 'EN_TRAMITE'
  return armarBaja(p.db, e.id)
}

function juridico(p: Peticion) {
  const { db, usuario } = p
  const { e, b } = exigirBaja(db, p.ruta.id)
  exigirActuar(e, usuario, ['JURIDICO'])
  const d = cuerpoDe<{ resultado?: string; anularConcesion?: boolean }>(p)
  if ((d.resultado === 'OBSERVADO' || d.resultado === 'NO_APTO') && !obs(p)) throw error400('Indique el motivo en las observaciones.')
  if (d.resultado === 'APTO') {
    b.anularConcesion = !!d.anularConcesion && !!b.concesionAnteriorId
    actuar(db, e, usuario, 'DICTAMEN_JURIDICO', 'APTO', obs(p), { anularConcesion: b.anularConcesion })
    pasar(db, e, 'SECRETARIA_GENERAL', usuario, { dictamen: 'APROBADO', observaciones: obs(p) })
  } else if (d.resultado === 'OBSERVADO') {
    actuar(db, e, usuario, 'DICTAMEN_JURIDICO', 'OBSERVADO', obs(p))
    pasar(db, e, 'CORRECCION_POZOS', usuario, { dictamen: 'OBSERVADO', esDevolucion: true, observaciones: obs(p), estado: 'OBSERVADO' })
    b.estado = 'OBSERVADA'
  } else if (d.resultado === 'NO_APTO') {
    actuar(db, e, usuario, 'DICTAMEN_JURIDICO', 'NO_APTO', obs(p))
    terminar(e, 'RECHAZADO')
    b.estado = 'RECHAZADA'
  } else {
    throw error400('El resultado debe ser APTO, OBSERVADO o NO_APTO.')
  }
  return armarBaja(db, e.id)
}

function resolucion(p: Peticion) {
  const { db, usuario } = p
  const { e, b } = exigirBaja(db, p.ruta.id)
  exigirActuar(e, usuario, ['SECRETARIA_GENERAL'])
  const d = cuerpoDe<{ decision?: string; numero?: string; anio?: number; fecha?: string }>(p)
  const numero = exigirTexto(d.numero, 'Ingrese el número de resolución.')
  if (!d.anio || !d.fecha) throw error400('Ingrese el año y la fecha de la resolución.')
  if (resolucionUsada(db, numero, d.anio)) throw error409(`La resolución ${numero}/${d.anio} ya está registrada.`)
  if (d.decision === 'RECHAZAR' && !obs(p)) throw error400('Indique el motivo del rechazo.')
  b.resolucion = `${Number(numero)}/${d.anio}`
  actuar(db, e, usuario, 'RESOLUCION', d.decision === 'RECHAZAR' ? 'NO_APTO' : 'APTO', obs(p), { resolucion: b.resolucion, fecha: d.fecha, decision: d.decision })
  if (d.decision === 'APROBAR') {
    aplicarBaja(db, b, d.fecha)
    if (b.requiereClausura) {
      pasar(db, e, 'CLAUSURA_POZOS', usuario, { dictamen: 'APROBADO' })
      b.estado = 'CLAUSURA_PENDIENTE'
    } else {
      terminar(e, 'FINALIZADO')
      b.estado = 'CONFIRMADA'
    }
  } else if (d.decision === 'RECHAZAR') {
    terminar(e, 'RECHAZADO')
    b.estado = 'RECHAZADA'
  } else {
    throw error400('La decisión debe ser APROBAR o RECHAZAR.')
  }
  return armarBaja(db, e.id)
}

function clausura(p: Peticion) {
  const { db, usuario } = p
  const { e, b } = exigirBaja(db, p.ruta.id)
  exigirActuar(e, usuario, ['CLAUSURA_POZOS'])
  const d = cuerpoDe<{ fecha?: string; acta?: string }>(p)
  b.clausura = { fecha: exigirTexto(d.fecha, 'Ingrese la fecha de la clausura.'), acta: exigirTexto(d.acta, 'Ingrese el número de acta.'), observaciones: obs(p) }
  actuar(db, e, usuario, 'CLAUSURA', 'REGISTRADO', obs(p), { fecha: b.clausura.fecha, acta: b.clausura.acta })
  terminar(e, 'FINALIZADO')
  b.estado = 'CONFIRMADA'
  return armarBaja(db, e.id)
}

function listar({ db, query }: Peticion): BajaEnLista[] {
  const todas = query.todas === 'true'
  return db.bajas
    .filter((b) => (todas ? true : b.expedienteId && [...ABIERTAS, 'CLAUSURA_PENDIENTE'].includes(b.estado)))
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .map((b) => {
      const e = b.expedienteId ? db.expedientes.find((x) => x.id === b.expedienteId) : undefined
      const pozo = exigirPozo(db, b.pozoId)
      const tomado = e ? usuarioDe(db, e.tomadoPor) : undefined
      const terminado = e && ['FINALIZADO', 'RECHAZADO'].includes(e.estado)
      return {
        expedienteId: e?.id ?? null,
        expediente: e ? formatearNumero(e) : null,
        pozo: { id: pozo.id, idInterno: pozo.idInterno, alias: pozo.alias },
        origen: b.origen,
        estado: b.estado,
        etapa: e && !terminado ? (e.etapa as EtapaBaja) : null,
        etapaNombre: e && !terminado ? NOMBRE_ETAPA[e.etapa] : null,
        oficina: e && !terminado ? (e.oficina as OficinaBaja) : null,
        oficinaNombre: e && !terminado ? NOMBRE_OFICINA[e.oficina] : null,
        tomadoPor: tomado ? nombreUsuario(tomado) : null,
        solicitante: b.solicitanteNombre,
        iniciada: b.creadoEn,
        fechaBaja: b.fechaBaja,
      }
    })
}

function avisos({ db, query }: Peticion): AvisoDistrito[] {
  const todos = query.todos === 'true'
  return db.bajas
    .filter((b) => b.avisoDistrito && (todos || !b.avisoDistrito.visto))
    .sort((a, b) => b.avisoDistrito!.enviado.localeCompare(a.avisoDistrito!.enviado))
    .map((b) => {
      const pozo = exigirPozo(db, b.pozoId)
      const conc = datosConcesion(db, b.concesionAnteriorId)
      const e = b.expedienteId ? db.expedientes.find((x) => x.id === b.expedienteId) : undefined
      return {
        bajaId: b.id,
        origen: b.origen,
        estado: b.estado,
        fechaBaja: b.fechaBaja,
        motivo: b.motivo,
        pozo: { id: pozo.id, idInterno: pozo.idInterno, alias: pozo.alias },
        concesion: conc?.c.numero ?? null,
        concesionAnulada: !!b.anularConcesion,
        requiereClausura: !!b.requiereClausura,
        ubicacion: { distrito: conc?.distrito ?? null, departamento: conc?.departamento ?? null, localidad: conc?.localidad ?? null },
        expedienteId: e?.id ?? null,
        expediente: e ? formatearNumero(e) : null,
        resolucion: b.resolucion,
        avisado: b.avisoDistrito!.enviado,
        visto: b.avisoDistrito!.visto,
      }
    })
}

function tomarConocimiento({ db, usuario, ruta }: Peticion) {
  if (!usuario.esAdministrador && usuario.oficina !== 'distrito') throw error403('La toma de conocimiento la hace Distrito.')
  const b = db.bajas.find((x) => x.id === ruta.bajaId)
  if (!b?.avisoDistrito) throw error404('No se encontró el aviso.')
  if (b.avisoDistrito.visto) throw error409('Distrito ya tomó conocimiento de esta baja.')
  b.avisoDistrito.visto = { en: ahora(), por: nombreUsuario(usuario) }
  const e = b.expedienteId ? db.expedientes.find((x) => x.id === b.expedienteId) : undefined
  if (e) actuar(db, e, usuario, 'TOMA_CONOCIMIENTO', 'REGISTRADO', null, null, 'distrito')
  return { ok: true }
}

export const rutasBaja: Ruta[] = [
  ['GET', '/pozos', buscarPozos],
  ['GET', '/pozos/:id', ({ db, ruta }) => fichaPozo(db, exigirPozo(db, ruta.id))],
  ['GET', BAJA, listar],
  ['GET', `${BAJA}/documentos`, () => DOCUMENTOS_BAJA],
  ['GET', `${BAJA}/avisos-distrito`, avisos],
  ['POST', `${BAJA}/avisos-distrito/:bajaId/visto`, tomarConocimiento],
  ['POST', `${BAJA}/de-oficio/:pozoId`, deOficio],
  ['POST', BAJA, iniciar],
  ['GET', `${BAJA}/:id`, ({ db, ruta }) => armarBaja(db, ruta.id)],
  ['PUT', `${BAJA}/:id`, actualizar],
  ['POST', `${BAJA}/:id/documentacion`, documentacion],
  ['POST', `${BAJA}/:id/antecedentes`, antecedentes],
  ['POST', `${BAJA}/:id/evaluacion-tecnica`, evaluacion],
  ['POST', `${BAJA}/:id/reenviar`, reenviar],
  ['POST', `${BAJA}/:id/juridico`, juridico],
  ['POST', `${BAJA}/:id/resolucion`, resolucion],
  ['POST', `${BAJA}/:id/clausura`, clausura],
]

/** Titular para las bandejas: el solicitante de la baja. */
export const titularDeBaja = (db: Db, e: ExpedienteDemo) => db.bajas.find((b) => b.expedienteId === e.id)?.solicitanteNombre ?? null
