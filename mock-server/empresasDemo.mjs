// Empresas perforadoras de ejemplo para build-db.mjs. Se arman con sus máquinas y su
// historial adentro (más fácil de leer) y se separan en los tres recursos de la API:
//   /empresas, /maquinas (empresaId) y /movimientosEmpresas (empresaId, maquinaId).
// Cubren todos los estados: activas, pendiente de resolución, con convenio multilateral,
// con una máquina de baja y una empresa dada de baja.

/** CUIT/CUIL válido (dígito verificador módulo 11) a partir de prefijo + DNI. */
function cuit(prefijo, dni) {
  for (let n = dni; ; n++) {
    const base = `${prefijo}${String(n).padStart(8, '0')}`
    const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, p, i) => a + p * Number(base[i]), 0)
    const dv = 11 - (suma % 11)
    if (dv === 10) continue
    return `${base}${dv === 11 ? 0 : dv}`
  }
}

/** Foto de referencia ilustrativa: un equipo perforador sobre camión (SVG en data URL). */
function foto(codigo, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
<rect width="320" height="220" fill="#e0f2fe"/><rect y="170" width="320" height="50" fill="#a3a38a"/>
<rect x="40" y="120" width="170" height="40" rx="4" fill="${color}"/><rect x="210" y="105" width="60" height="55" rx="6" fill="${color}"/>
<rect x="222" y="115" width="36" height="20" rx="3" fill="#bae6fd"/>
<polygon points="70,120 95,120 130,20 118,20" fill="#475569"/><rect x="112" y="14" width="24" height="10" fill="#334155"/>
<line x1="124" y1="24" x2="124" y2="165" stroke="#1e293b" stroke-width="3"/>
<circle cx="80" cy="168" r="16" fill="#1e293b"/><circle cx="150" cy="168" r="16" fill="#1e293b"/><circle cx="240" cy="168" r="16" fill="#1e293b"/>
<text x="16" y="34" font-family="monospace" font-size="20" font-weight="bold" fill="#0f172a">${codigo}</text></svg>`
  return { nombre: `${codigo.toLowerCase()}.svg`, tamanioBytes: svg.length, tipo: 'image/svg+xml', dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
}

const fecha = (dias) => new Date(Date.UTC(2026, 0, 15) + dias * 86400000).toISOString()
const USUARIO = 'Usuario demo'
let id = 0
const ev = (tipo, dias, extra = {}) => ({ id: `ev-${++id}`, tipo, fecha: fecha(dias), usuario: USUARIO, ...extra })

function maquina(codigo, modelo, color, dias, extra = {}) {
  return {
    id: `maq-${codigo.toLowerCase()}`,
    codigo,
    modelo,
    capacidadDiametro: '12 1/4"',
    capacidadProfundidad: '300',
    alturaTorre: '12',
    vehiculoPatente: '',
    vehiculoModelo: '',
    observacion: '',
    foto: foto(codigo, color),
    activa: true,
    alta: fecha(dias),
    ...extra,
  }
}

const base = {
  tipoPersona: 'juridica',
  nombre: '',
  apellido: '',
  documento: '',
  convenioMultilateral: false,
  jurisdicciones: [],
  registroComercio: '',
  provincia: 'TUCUMÁN',
  observaciones: '',
  notaSolicitud: [{ nombre: 'nota-solicitud.pdf', tamanioBytes: 182340, tipo: 'application/pdf' }],
  documentacionLegal: [{ nombre: 'estatuto-social.pdf', tamanioBytes: 845221, tipo: 'application/pdf' }],
}

/**
 * Separa empresas con máquinas e historial embebidos en las colecciones de la API.
 * Lo usa también la migración de bases viejas (colección `empresasPerforadoras`).
 */
export function normalizarEmpresas(lista) {
  const empresas = []
  const maquinas = []
  const movimientosEmpresas = []
  for (const { maquinas: ms = [], historial = [], ...empresa } of lista) {
    empresas.push({ creadoPor: USUARIO, ...empresa, ...(empresa.modificado && !empresa.modificadoPor ? { modificadoPor: USUARIO } : {}) })
    for (const m of ms) maquinas.push({ ...m, empresaId: empresa.id })
    for (const h of historial) {
      const maquina = h.maquina ? ms.find((m) => m.codigo === h.maquina) : null
      movimientosEmpresas.push({ ...h, empresaId: empresa.id, ...(maquina ? { maquinaId: maquina.id } : {}) })
    }
  }
  return { empresas, maquinas, movimientosEmpresas }
}

/** Colecciones /empresas, /maquinas y /movimientosEmpresas de ejemplo. */
export function empresasDemo() {
  id = 0
  return normalizarEmpresas([...empresasBase().map(conCircuito), ...empresasEnCircuito()])
}

// --- Circuito del alta: Planificación → Jurídico (dictamen) → Secretaría General (resolución) ---

const JURIDICO = 'Dra. L. Vega' // usuarios de /usuarios (seed/dominio.json)
const SECRETARIA = 'C. Molina'
const CONTROLES_JURIDICO = [
  'Identidad y CUIT/CUIL verificados',
  'Documentación legal completa (estatuto, nota de solicitud)',
  'Inscripción en Ingresos Brutos / Convenio Multilateral acreditada',
  'Dirección técnica a cargo de un profesional habilitado',
]
const masDias = (iso, dias) => new Date(new Date(iso).getTime() + dias * 86400000).toISOString()
const evEn = (tipo, iso, usuario, extra = {}) => ({ id: `ev-${++id}`, tipo, fecha: iso, usuario, ...extra })

function dictamenDe(creado) {
  return {
    fecha: masDias(creado, 3),
    usuario: JURIDICO,
    controles: CONTROLES_JURIDICO,
    texto: 'Se verificó la documentación legal y la dirección técnica. Procede la inscripción en el registro de empresas perforadoras.',
    informe: [],
  }
}

/**
 * Las empresas de ejemplo habilitadas (o dadas de baja después) recorrieron el circuito:
 * se agregan su dictamen, la fecha de la resolución y los movimientos. La que no tenía
 * resolución queda en Secretaría General (pendiente de resolución).
 */
function conCircuito(e) {
  const dictamen = dictamenDe(e.creado)
  const historial = [...e.historial, evEn('DICTAMEN', dictamen.fecha, JURIDICO, { observacion: `${dictamen.texto} — Enviada a Secretaría General.` })]
  if (!e.resolucion.numero) {
    return { ...e, estado: 'EN_TRAMITE', tramite: { oficina: 'secretaria_general', desde: dictamen.fecha }, dictamen, historial }
  }
  const fechaRes = masDias(e.creado, 7)
  // El año de la resolución es el de su firma.
  const resolucion = { ...e.resolucion, anio: fechaRes.slice(0, 4), fecha: fechaRes.slice(0, 10), archivo: [{ nombre: `resolucion-${e.resolucion.numero}-${e.resolucion.anio}.pdf`, tamanioBytes: 254120, tipo: 'application/pdf' }] }
  historial.push(evEn('RESOLUCION', fechaRes, SECRETARIA, { observacion: `Resolución ${e.resolucion.numero}/${e.resolucion.anio} del ${resolucion.fecha}. Empresa habilitada.` }))
  return { ...e, dictamen, resolucion, tramite: null, historial }
}

/** Dos altas en curso: una esperando el dictamen de Jurídico y otra observada. */
function empresasEnCircuito() {
  const enJuridico = fecha(100)
  const observada = fecha(80)
  return [
    {
      ...base,
      id: 'emp-06',
      razonSocial: 'Perforaciones Valle Calchaquí S.R.L.',
      cuit: cuit('30', 71654321),
      ingresosBrutos: '901-654321-0',
      domicilio: 'Av. Perón 2100',
      telefono: '0381-4881234',
      departamento: 'YERBA BUENA',
      localidad: 'EL CORTE',
      resolucion: { numero: '', anio: '' },
      direccionTecnica: { nombre: 'Sofía', apellido: 'Medina', profesion: 'Ingeniera en recursos hídricos', matricula: 'MP 2210', email: 'smedina@vallecalchaqui.com.ar', domicilio: '' },
      estado: 'EN_TRAMITE',
      tramite: { oficina: 'juridico', desde: enJuridico },
      creado: enJuridico,
      maquinas: [maquina('VC-01', 'Massenza MI-28', '#0d9488', 100, { capacidadProfundidad: '350', alturaTorre: '11', vehiculoPatente: 'AF654LM', vehiculoModelo: 'Volkswagen Constellation 17.280' })],
      historial: [evEn('ALTA', enJuridico, USUARIO, { observacion: '1 máquina: VC-01. Enviada a Jurídico.' })],
    },
    {
      ...base,
      id: 'emp-07',
      razonSocial: 'Hidrogeo Burruyacú S.A.',
      cuit: cuit('30', 71777333),
      ingresosBrutos: '',
      documentacionLegal: [],
      domicilio: 'Ruta 304 Km 12',
      telefono: '0381-4990077',
      departamento: 'BURRUYACU',
      localidad: 'VILLA BURRUYACU',
      resolucion: { numero: '', anio: '' },
      direccionTecnica: { nombre: 'Martín', apellido: 'Sosa', profesion: 'Técnico perforista', matricula: '', email: '', domicilio: '' },
      estado: 'OBSERVADA',
      tramite: null,
      observacion: { oficina: 'juridico', fecha: masDias(observada, 4), usuario: JURIDICO, motivo: 'Falta el estatuto social y la constancia de inscripción en Ingresos Brutos.' },
      creado: observada,
      maquinas: [maquina('HB-10', 'Schramm T450', '#ea580c', 80)],
      historial: [
        evEn('ALTA', observada, USUARIO, { observacion: '1 máquina: HB-10. Enviada a Jurídico.' }),
        evEn('OBSERVACION', masDias(observada, 4), JURIDICO, { observacion: 'Jurídico: Falta el estatuto social y la constancia de inscripción en Ingresos Brutos.' }),
      ],
    },
  ]
}

function empresasBase() {
  return [
    {
      ...base,
      id: 'emp-01',
      razonSocial: 'Perforaciones del Norte S.R.L.',
      cuit: cuit('30', 71234567),
      ingresosBrutos: '901-123456-7',
      registroComercio: 'Matrícula 4512 - Folio 88',
      domicilio: 'Av. Roca 1250',
      telefono: '0381-4567890',
      departamento: 'TAFI VIEJO',
      localidad: 'TAFI VIEJO',
      resolucion: { numero: '145', anio: '2026' },
      direccionTecnica: { nombre: 'Ana', apellido: 'Gómez', profesion: 'Geóloga', matricula: 'MP 1203', email: 'ana.gomez@pnorte.com.ar', domicilio: 'Av. Roca 1250' },
      estado: 'ACTIVA',
      creado: fecha(0),
      modificado: fecha(40),
      maquinas: [
        maquina('PN-001-A', 'Ingersoll Rand T4W', '#2563eb', 0, { vehiculoPatente: 'AB123CD', vehiculoModelo: 'Mercedes-Benz Atego 1726', capacidadProfundidad: '450', alturaTorre: '13.5' }),
        maquina('PN-002-A', 'Failing 1500', '#0891b2', 0, { capacidadDiametro: '17 1/2"', vehiculoPatente: 'AC456EF', vehiculoModelo: 'Iveco Tector 170E28' }),
      ],
      historial: [
        ev('MODIFICACION', 40, { observacion: 'Cambio de número de la línea fija.', cambios: [{ etiqueta: 'Teléfono', antes: '0381-4500000', ahora: '0381-4567890' }] }),
        ev('ALTA', 0, { observacion: '2 máquinas: PN-001-A, PN-002-A' }),
      ],
    },
    {
      ...base,
      id: 'emp-02',
      razonSocial: 'Hidroperforaciones Tucumán S.A.',
      cuit: cuit('30', 70987654),
      ingresosBrutos: '901-765432-1',
      domicilio: 'Ruta 9 Km 1290',
      telefono: '0381-4321098',
      departamento: 'CRUZ ALTA',
      localidad: 'BANDA DEL RIO SALI',
      resolucion: { numero: '98', anio: '2025' },
      direccionTecnica: { nombre: 'Luis', apellido: 'Paz', profesion: 'Ingeniero hidráulico', matricula: 'MP 877', email: 'lpaz@hidrotuc.com.ar', domicilio: '' },
      estado: 'ACTIVA',
      creado: fecha(5),
      modificado: fecha(60),
      maquinas: [
        maquina('HT-007', 'Gardner Denver 1500', '#16a34a', 5, { vehiculoPatente: 'AD789GH', vehiculoModelo: 'Ford Cargo 1722' }),
        maquina('HT-003', 'Speedstar 15K', '#64748b', 5, { activa: false, baja: { fecha: fecha(60), motivo: 'Vendida a una empresa de Santiago del Estero.', usuario: USUARIO } }),
      ],
      historial: [
        ev('BAJA_MAQUINA', 60, { maquina: 'HT-003', observacion: 'Vendida a una empresa de Santiago del Estero.' }),
        ev('ALTA', 5, { observacion: '2 máquinas: HT-007, HT-003' }),
      ],
    },
    {
      ...base,
      id: 'emp-03',
      tipoPersona: 'fisica',
      razonSocial: '',
      nombre: 'Roberto Carlos',
      apellido: 'Díaz',
      documento: '25432198',
      cuit: cuit('20', 25432198),
      ingresosBrutos: '',
      domicilio: 'San Martín 480',
      telefono: '381-5123456',
      departamento: 'CAPITAL',
      localidad: 'SAN MIGUEL DE TUCUMAN',
      resolucion: { numero: '', anio: '' },
      direccionTecnica: { nombre: 'Roberto Carlos', apellido: 'Díaz', profesion: 'Técnico perforista', matricula: '', email: 'rcdiaz.perforaciones@gmail.com', domicilio: 'San Martín 480' },
      estado: 'PENDIENTE_RESOLUCION',
      creado: fecha(95),
      maquinas: [maquina('RD-001', 'Perforadora rotativa Prominas R-500', '#d97706', 95, { capacidadProfundidad: '200', alturaTorre: '9' })],
      historial: [ev('ALTA', 95, { observacion: '1 máquina: RD-001' })],
    },
    {
      ...base,
      id: 'emp-04',
      razonSocial: 'Aguas Profundas del NOA S.A.',
      cuit: cuit('30', 71555888),
      ingresosBrutos: 'CM 924-556677-2',
      domicilio: 'Av. Belgrano 2100',
      telefono: '0387-4219900',
      provincia: 'SALTA',
      departamento: 'CAPITAL',
      localidad: 'SALTA',
      convenioMultilateral: true,
      jurisdicciones: [
        { jurisdiccion: 'Salta', numero: '924-556677-2', condicion: 'Sede' },
        { jurisdiccion: 'Tucumán', numero: '901-556677-0', condicion: 'Convenio Multilateral' },
      ],
      resolucion: { numero: '210', anio: '2024' },
      direccionTecnica: { nombre: 'Marta', apellido: 'Ríos', profesion: 'Geóloga', matricula: 'COPAIPA 5521', email: 'mrios@aguasnoa.com.ar', domicilio: '' },
      estado: 'ACTIVA',
      creado: fecha(-120),
      maquinas: [maquina('AP-100', 'Atlas Copco RD20', '#7c3aed', -120, { capacidadProfundidad: '600', alturaTorre: '15', vehiculoPatente: 'AE321JK', vehiculoModelo: 'Scania P310' })],
      historial: [ev('ALTA', -120, { observacion: '1 máquina: AP-100' })],
    },
    {
      ...base,
      id: 'emp-05',
      razonSocial: 'Perforaciones Aconquija S.R.L.',
      cuit: cuit('30', 69876543),
      ingresosBrutos: '901-998877-3',
      domicilio: 'Mendoza 755',
      telefono: '0381-4229911',
      departamento: 'CAPITAL',
      localidad: 'SAN MIGUEL DE TUCUMAN',
      resolucion: { numero: '33', anio: '2019' },
      direccionTecnica: { nombre: 'Jorge', apellido: 'Luna', profesion: 'Ingeniero civil', matricula: 'MP 455', email: '', domicilio: '' },
      estado: 'BAJA',
      creado: fecha(-900),
      modificado: fecha(30),
      baja: { fecha: fecha(30), motivo: 'Cese de actividades informado por nota.', usuario: USUARIO },
      maquinas: [maquina('PA-01', 'Bucyrus-Erie 22W', '#be185d', -900)],
      historial: [ev('BAJA', 30, { observacion: 'Cese de actividades informado por nota.' }), ev('ALTA', -900, { observacion: '1 máquina: PA-01' })],
    },
  ]
}
