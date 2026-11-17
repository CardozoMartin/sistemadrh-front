// Peticiones de empresas perforadoras. Solo hablan con la API; el cacheo lo hacen los hooks.
//
// Recursos (modelo de datos §5: emp_empresa, emp_maquina y la auditoría):
//   /empresas              la empresa (con autoría: creado/creadoPor/modificado/modificadoPor)
//   /maquinas              cada máquina, relacionada por empresaId
//   /movimientosEmpresas   el historial (alta, dictamen, resolución, bajas…), por empresaId y maquinaId
//
// Circuito del alta: Planificación carga (EN_TRAMITE en Jurídico) → Jurídico dictamina
// (pasa a Secretaría General) → Secretaría registra la resolución (ACTIVA). Cualquiera de
// las dos puede observar (vuelve a Planificación) o rechazar.
// json-server arma las relaciones con `_embed` (clave foránea `empresaId`).
//
// Con el backend real, cada operación es una transacción en el servidor (que además valida
// la unicidad del CUIT y del código de máquina y responde 409). Acá son varias peticiones.
import { api } from '@/services/api/client'
import { ApiError } from '@/services/api/errors'
import { filtro } from '@/services/api/jsonServer'
import type { Adjunto } from '@/types/domain'
import { compararEmpresa, compararMaquina, datosDe, datosMaquinaDe, esEditable, estadoDetallado, NOMBRE_OFICINA, nombreEmpresa, normalizarCodigo } from './reglas'
import type { DatosEmpresa, DatosMaquina, DictamenEmpresa, EmpresaPerforadora, EmpresaRegistro, EventoEmpresa, Maquina, OficinaEmpresa } from './types'

const EMPRESAS = '/empresas'
const MAQUINAS = '/maquinas'
const MOVIMIENTOS = '/movimientosEmpresas'

/** Empresa con sus recursos relacionados, como la devuelve json-server con `_embed`. */
type EmpresaConRelaciones = EmpresaRegistro & { maquinas?: Maquina[]; movimientosEmpresas?: EventoEmpresa[] }

/** `_embed` repetido (axios serializaría los arrays como `_embed[]=`). */
const embed = (...relaciones: string[]) => relaciones.map((r) => `_embed=${r}`).join('&')

function componer({ maquinas = [], movimientosEmpresas = [], ...empresa }: EmpresaConRelaciones): EmpresaPerforadora {
  return {
    ...empresa,
    maquinas: [...maquinas].sort((a, b) => a.alta.localeCompare(b.alta) || a.codigo.localeCompare(b.codigo)),
    historial: [...movimientosEmpresas].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }
}

const ahora = () => new Date().toISOString()

async function registrarMovimiento(movimiento: Omit<EventoEmpresa, 'id' | 'fecha'>): Promise<void> {
  await api.post(MOVIMIENTOS, { ...movimiento, fecha: ahora() })
}

/** Toda acción sobre la empresa o sus máquinas deja la autoría de la última modificación. */
async function tocarEmpresa(id: string, usuario: string, cambios: Partial<EmpresaRegistro> = {}): Promise<void> {
  await api.patch(`${EMPRESAS}/${id}`, { ...cambios, modificado: ahora(), modificadoPor: usuario })
}

/** Flujo 10.1 del CU: el CUIT es único. */
async function validarCuitLibre(cuit: string, excepto?: string) {
  const { data } = await api.get<EmpresaRegistro[]>(EMPRESAS, { params: filtro({ cuit }) })
  const otra = data.find((e) => e.id !== excepto)
  if (otra) throw new ApiError(`La empresa ya se encuentra registrada con esta CUIT (${nombreEmpresa(otra)}).`, 409, 'CUIT_EXISTENTE')
}

/** El código de máquina es único en todo el sistema y no se reutiliza (aunque la máquina esté de baja). */
async function validarCodigosLibres(codigos: string[], exceptoMaquinaId?: string) {
  const { data } = await api.get<(Maquina & { empresa?: EmpresaRegistro })[]>(MAQUINAS, {
    params: { ...filtro({ codigo: { in: codigos } }), _embed: 'empresa' },
  })
  const usada = data.find((m) => m.id !== exceptoMaquinaId)
  if (usada) throw new ApiError(`El código ${usada.codigo} ya está asignado a una máquina de ${usada.empresa ? nombreEmpresa(usada.empresa) : 'otra empresa'}.`, 409, 'CODIGO_EXISTENTE')
}

/** Mientras una oficina la revisa (o si fue rechazada) no se toca. */
function exigirEditable(empresa: EmpresaPerforadora) {
  if (!esEditable(empresa)) throw new ApiError(`No se puede modificar: ${estadoDetallado(empresa).toLowerCase()}.`, 409, 'EMPRESA_NO_EDITABLE')
}

function exigirEn(empresa: EmpresaPerforadora, oficina: OficinaEmpresa) {
  if (empresa.estado !== 'EN_TRAMITE' || empresa.tramite?.oficina !== oficina) {
    throw new ApiError(`La empresa no está en ${NOMBRE_OFICINA[oficina]} (${estadoDetallado(empresa).toLowerCase()}).`, 409, 'FUERA_DE_ETAPA')
  }
}

export interface ResolucionInput {
  numero: string
  anio: string
  fecha: string // AAAA-MM-DD
  archivo: Adjunto[]
  controles: string[]
  observaciones: string
}

export interface DictamenInput {
  controles: string[]
  texto: string
  informe: Adjunto[]
}

async function obtenerMaquina(empresa: EmpresaPerforadora, maquinaId: string): Promise<Maquina> {
  const maquina = empresa.maquinas.find((m) => m.id === maquinaId)
  if (!maquina) throw new ApiError('No se encontró la máquina.', 404, 'MAQUINA_NO_ENCONTRADA')
  return maquina
}

export const empresasApi = {
  /** Padrón: empresas con sus máquinas (el historial se pide solo en la ficha). Son pocas decenas. */
  async listar(): Promise<EmpresaPerforadora[]> {
    const { data } = await api.get<EmpresaConRelaciones[]>(`${EMPRESAS}?${embed('maquinas')}`)
    return data.map(componer).sort((a, b) => nombreEmpresa(a).localeCompare(nombreEmpresa(b), 'es'))
  },

  /** Bandeja de una oficina: empresas EN_TRAMITE en esa oficina (con sus máquinas). */
  async enOficina(oficina: OficinaEmpresa): Promise<EmpresaPerforadora[]> {
    const where = encodeURIComponent(JSON.stringify({ estado: { eq: 'EN_TRAMITE' }, tramite: { oficina: { eq: oficina } } }))
    const { data } = await api.get<EmpresaConRelaciones[]>(`${EMPRESAS}?_where=${where}&${embed('maquinas')}`)
    return data.map(componer).sort((a, b) => (a.tramite?.desde ?? '').localeCompare(b.tramite?.desde ?? ''))
  },

  /** Ficha: la empresa con sus máquinas y su historial. */
  async obtener(id: string): Promise<EmpresaPerforadora> {
    const { data } = await api.get<EmpresaConRelaciones>(`${EMPRESAS}/${id}?${embed('maquinas', 'movimientosEmpresas')}`)
    return componer(data)
  },

  /**
   * Alta (RF05-RF09): POST /empresas, POST /maquinas por cada máquina y el movimiento de
   * alta. La empresa entra al circuito en Jurídico.
   */
  async crear(datos: DatosEmpresa, maquinas: DatosMaquina[], usuario: string): Promise<EmpresaPerforadora> {
    const codigos = maquinas.map((m) => normalizarCodigo(m.codigo))
    await validarCuitLibre(datos.cuit)
    await validarCodigosLibres(codigos)
    const { data: empresa } = await api.post<EmpresaRegistro>(EMPRESAS, {
      ...datos,
      convenioMultilateral: datos.jurisdicciones.length > 0,
      resolucion: { numero: '', anio: '' },
      estado: 'EN_TRAMITE',
      tramite: { oficina: 'juridico', desde: ahora() },
      creado: ahora(),
      creadoPor: usuario,
    } satisfies Omit<EmpresaRegistro, 'id'>)
    for (const m of maquinas) {
      await api.post(MAQUINAS, { ...m, codigo: normalizarCodigo(m.codigo), empresaId: empresa.id, activa: true, alta: ahora() } satisfies Omit<Maquina, 'id'>)
    }
    await registrarMovimiento({
      empresaId: empresa.id,
      tipo: 'ALTA',
      usuario,
      observacion: `${maquinas.length} máquina${maquinas.length === 1 ? '' : 's'}: ${codigos.join(', ')}. Enviada a Jurídico.`,
    })
    return empresasApi.obtener(empresa.id)
  },

  /** Modificación (PATCH /empresas/:id): guarda los datos nuevos y asienta qué cambió y por qué. */
  async modificar(empresa: EmpresaPerforadora, datos: DatosEmpresa, observacion: string, usuario: string): Promise<EmpresaPerforadora> {
    exigirEditable(empresa)
    // La resolución no se edita acá: la registra Secretaría General.
    const nuevos = { ...datos, resolucion: empresa.resolucion, convenioMultilateral: datos.jurisdicciones.length > 0 }
    const cambios = compararEmpresa(datosDe(empresa), nuevos)
    if (cambios.length === 0) throw new ApiError('Los datos son los mismos que ya estaban guardados.', 400, 'SIN_CAMBIOS')
    if (datos.cuit !== empresa.cuit) await validarCuitLibre(datos.cuit, empresa.id)
    await tocarEmpresa(empresa.id, usuario, nuevos)
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'MODIFICACION', usuario, observacion, cambios })
    return empresasApi.obtener(empresa.id)
  },

  /** Baja lógica (RF10): deja de ofrecerse para autorizaciones nuevas; no se borra nada. */
  async darDeBaja(empresa: EmpresaPerforadora, motivo: string, usuario: string): Promise<EmpresaPerforadora> {
    if (empresa.estado !== 'ACTIVA') throw new ApiError(`Solo se da de baja una empresa habilitada (esta está ${estadoDetallado(empresa).toLowerCase()}).`, 409, 'NO_ACTIVA')
    await tocarEmpresa(empresa.id, usuario, { estado: 'BAJA', baja: { fecha: ahora(), motivo, usuario } })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'BAJA', usuario, observacion: motivo })
    return empresasApi.obtener(empresa.id)
  },

  /** Reactivación: la baja anterior queda como antecedente. */
  async reactivar(empresa: EmpresaPerforadora, usuario: string, observacion = ''): Promise<EmpresaPerforadora> {
    if (empresa.estado !== 'BAJA') throw new ApiError('La empresa no está dada de baja.', 409, 'YA_ACTIVA')
    await tocarEmpresa(empresa.id, usuario, {
      estado: 'ACTIVA',
      baja: null,
      bajasPrevias: [...(empresa.bajasPrevias ?? []), ...(empresa.baja ? [empresa.baja] : [])],
    })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'REACTIVACION', usuario, observacion })
    return empresasApi.obtener(empresa.id)
  },

  // --- Circuito del alta: Jurídico → Secretaría General ---------------------------------

  /** Jurídico aprueba: guarda el dictamen y la empresa pasa a Secretaría General. */
  async dictaminar(empresa: EmpresaPerforadora, input: DictamenInput, usuario: string): Promise<EmpresaPerforadora> {
    exigirEn(empresa, 'juridico')
    const dictamen: DictamenEmpresa = { ...input, fecha: ahora(), usuario }
    await tocarEmpresa(empresa.id, usuario, { dictamen, tramite: { oficina: 'secretaria_general', desde: ahora() } })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'DICTAMEN', usuario, observacion: `${input.texto} — Enviada a Secretaría General.` })
    return empresasApi.obtener(empresa.id)
  },

  /** Secretaría General registra la resolución que la habilita: la empresa queda ACTIVA. */
  async registrarResolucion(empresa: EmpresaPerforadora, input: ResolucionInput, usuario: string): Promise<EmpresaPerforadora> {
    exigirEn(empresa, 'secretaria_general')
    await tocarEmpresa(empresa.id, usuario, {
      estado: 'ACTIVA',
      tramite: null,
      resolucion: { numero: input.numero, anio: input.anio, fecha: input.fecha, archivo: input.archivo },
    })
    await registrarMovimiento({
      empresaId: empresa.id,
      tipo: 'RESOLUCION',
      usuario,
      observacion: `Resolución ${input.numero}/${input.anio} del ${input.fecha}. Empresa habilitada.${input.observaciones ? ` ${input.observaciones}` : ''}`,
    })
    return empresasApi.obtener(empresa.id)
  },

  /** Observar: vuelve a Planificación para corregir; después se reenvía a la misma oficina. */
  async observar(empresa: EmpresaPerforadora, oficina: OficinaEmpresa, motivo: string, usuario: string): Promise<EmpresaPerforadora> {
    exigirEn(empresa, oficina)
    await tocarEmpresa(empresa.id, usuario, { estado: 'OBSERVADA', tramite: null, observacion: { oficina, motivo, fecha: ahora(), usuario } })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'OBSERVACION', usuario, observacion: `${NOMBRE_OFICINA[oficina]}: ${motivo}` })
    return empresasApi.obtener(empresa.id)
  },

  /** Rechazar: el alta no procede (fin del trámite). La empresa queda registrada como rechazada. */
  async rechazar(empresa: EmpresaPerforadora, oficina: OficinaEmpresa, motivo: string, usuario: string): Promise<EmpresaPerforadora> {
    exigirEn(empresa, oficina)
    await tocarEmpresa(empresa.id, usuario, { estado: 'RECHAZADA', tramite: null, rechazo: { oficina, motivo, fecha: ahora(), usuario } })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'RECHAZO', usuario, observacion: `${NOMBRE_OFICINA[oficina]}: ${motivo}` })
    return empresasApi.obtener(empresa.id)
  },

  /** Planificación corrigió lo observado y la reenvía a la oficina que la observó. */
  async reenviar(empresa: EmpresaPerforadora, observacion: string, usuario: string): Promise<EmpresaPerforadora> {
    if (empresa.estado !== 'OBSERVADA' || !empresa.observacion) throw new ApiError('La empresa no está observada.', 409, 'NO_OBSERVADA')
    const oficina = empresa.observacion.oficina
    await tocarEmpresa(empresa.id, usuario, { estado: 'EN_TRAMITE', tramite: { oficina, desde: ahora() } })
    await registrarMovimiento({ empresaId: empresa.id, tipo: 'REENVIO', usuario, observacion: `Reenviada a ${NOMBRE_OFICINA[oficina]}.${observacion ? ` ${observacion}` : ''}` })
    return empresasApi.obtener(empresa.id)
  },

  // --- Parque de máquinas (/maquinas) ---------------------------------------------------

  /** POST /maquinas. */
  async agregarMaquina(empresa: EmpresaPerforadora, datos: DatosMaquina, usuario: string): Promise<EmpresaPerforadora> {
    exigirEditable(empresa)
    const codigo = normalizarCodigo(datos.codigo)
    await validarCodigosLibres([codigo])
    const { data: maquina } = await api.post<Maquina>(MAQUINAS, { ...datos, codigo, empresaId: empresa.id, activa: true, alta: ahora() } satisfies Omit<Maquina, 'id'>)
    await registrarMovimiento({ empresaId: empresa.id, maquinaId: maquina.id, maquina: codigo, tipo: 'ALTA_MAQUINA', usuario, observacion: `Modelo: ${maquina.modelo}` })
    await tocarEmpresa(empresa.id, usuario)
    return empresasApi.obtener(empresa.id)
  },

  /** PATCH /maquinas/:id con los datos que cambiaron. */
  async modificarMaquina(empresa: EmpresaPerforadora, maquinaId: string, datos: DatosMaquina, observacion: string, usuario: string): Promise<EmpresaPerforadora> {
    exigirEditable(empresa)
    const actual = await obtenerMaquina(empresa, maquinaId)
    const nuevos = { ...datos, codigo: normalizarCodigo(datos.codigo) }
    const cambios = compararMaquina(datosMaquinaDe(actual), nuevos)
    if (cambios.length === 0) throw new ApiError('Los datos de la máquina son los mismos que ya estaban guardados.', 400, 'SIN_CAMBIOS')
    if (nuevos.codigo !== actual.codigo) await validarCodigosLibres([nuevos.codigo], maquinaId)
    await api.patch(`${MAQUINAS}/${maquinaId}`, nuevos)
    await registrarMovimiento({ empresaId: empresa.id, maquinaId, maquina: nuevos.codigo, tipo: 'MODIFICACION_MAQUINA', usuario, observacion, cambios })
    await tocarEmpresa(empresa.id, usuario)
    return empresasApi.obtener(empresa.id)
  },

  /** PATCH /maquinas/:id → inactiva, con fecha y motivo. No se borra ni libera su código. */
  async bajaMaquina(empresa: EmpresaPerforadora, maquinaId: string, motivo: string, usuario: string): Promise<EmpresaPerforadora> {
    exigirEditable(empresa)
    const maquina = await obtenerMaquina(empresa, maquinaId)
    if (!maquina.activa) throw new ApiError('La máquina ya está dada de baja.', 409, 'MAQUINA_INACTIVA')
    await api.patch(`${MAQUINAS}/${maquinaId}`, { activa: false, baja: { fecha: ahora(), motivo, usuario } })
    await registrarMovimiento({ empresaId: empresa.id, maquinaId, maquina: maquina.codigo, tipo: 'BAJA_MAQUINA', usuario, observacion: motivo })
    await tocarEmpresa(empresa.id, usuario)
    return empresasApi.obtener(empresa.id)
  },

  /** PATCH /maquinas/:id → activa otra vez. */
  async reactivarMaquina(empresa: EmpresaPerforadora, maquinaId: string, usuario: string, observacion = ''): Promise<EmpresaPerforadora> {
    exigirEditable(empresa)
    const maquina = await obtenerMaquina(empresa, maquinaId)
    if (maquina.activa) throw new ApiError('La máquina ya está activa.', 409, 'MAQUINA_ACTIVA')
    await api.patch(`${MAQUINAS}/${maquinaId}`, { activa: true, baja: null })
    await registrarMovimiento({ empresaId: empresa.id, maquinaId, maquina: maquina.codigo, tipo: 'REACTIVACION_MAQUINA', usuario, observacion })
    await tocarEmpresa(empresa.id, usuario)
    return empresasApi.obtener(empresa.id)
  },
}
