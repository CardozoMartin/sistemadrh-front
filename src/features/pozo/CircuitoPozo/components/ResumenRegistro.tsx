import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { formatoFecha, formatoNumero } from '../../BajaDePozo/estilos'
import { calcularCaudales, codigoServicioDe } from '../caudales'
import type { RegistroPozoBackend } from '../types'

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-100">{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  )
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
        <Icon name={icono} className="text-[18px]! text-primary" />
        {titulo}
      </h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">{children}</dl>
    </section>
  )
}

const m = (n: number | null | undefined, unidad: string, dec = 2) => (n === null || n === undefined ? null : `${formatoNumero(n, dec)} ${unidad}`)

/**
 * Caudales de la concesión (Catastro): erogado, tributario y hectáreas equivalentes según el uso.
 * ⚠ Reglas del prototipo, a validar con la oficina (ver caudales.ts).
 */
export function PanelCaudales({ caudalM3h, regimenM3h, uso }: { caudalM3h: number | null; regimenM3h: number | null; uso: string | null }) {
  const c = calcularCaudales(caudalM3h, regimenM3h, uso)
  const codigo = codigoServicioDe(uso)
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
        <Dato etiqueta="Caudal de bombeo" valor={m(c.bombeoLps, 'l/s')} />
        <Dato etiqueta="Régimen de bombeo" valor={m(c.regimenLps, 'l/s')} />
        <Dato etiqueta="Caudal erogado" valor={c.erogadoLps === null ? null : `${formatoNumero(c.erogadoLps, 2)} l/s (${c.origenErogado === 'regimen' ? 'régimen' : 'bombeo'})`} />
        <Dato etiqueta="Código de servicio" valor={uso ? (codigo === null ? 'No lleva (sin cobro)' : String(codigo)) : null} />
        <Dato etiqueta="Caudal tributario" valor={uso === 'COMUN' ? 'No tributa (consumo humano)' : m(c.tributarioLps, 'l/s')} />
        <Dato etiqueta="Equivalente" valor={m(c.equivalenteHa, 'ha')} />
        <Dato ancho etiqueta="Regla" valor={c.regla ? `${c.regla.texto} · hectáreas: ${c.regla.textoHas}` : uso ? null : 'Elija el uso de la concesión'} />
      </dl>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <Icon name="warning" className="text-[16px]!" />
        Reglas tomadas del prototipo: el erogado es el mayor entre bombeo y régimen; el tributario lo redondea hacia arriba según el uso. A validar con Catastro y Recaudación.
      </p>
    </div>
  )
}

/** La ficha que cargó Pozos en el alta, de solo lectura para las demás oficinas. */
export function ResumenRegistro({ r }: { r: RegistroPozoBackend }) {
  const f = r.ficha
  const p = r.pozo
  const c = r.catastro
  return (
    <div className="flex flex-col gap-6">
      <Bloque titulo="Registro de oficio" icono="gavel">
        <Dato etiqueta="Registro" valor={r.expediente.numero} />
        <Dato etiqueta="Motivo" valor={f.motivo} />
        <Dato etiqueta="Fecha de ingreso" valor={formatoFecha(f.fechaIngreso)} />
        <Dato etiqueta="Registró" valor={`${f.registradoPor}`} />
        <Dato etiqueta="Causante" valor={f.causante} />
        <Dato etiqueta="CUIT / DNI" valor={f.documento} />
        <Dato ancho etiqueta="Asunto" valor={f.asunto} />
        <Dato etiqueta="Jurisdicción DRH" valor={f.jurisdiccionDrh ? 'Sí' : 'No (no genera concesión)'} />
        <Dato etiqueta="Empresa perforadora" valor={f.empresa} />
      </Bloque>
      <Bloque titulo="Pozo" icono="water_pump">
        <Dato etiqueta="ID interno" valor={p.idInterno} />
        <Dato etiqueta="Nombre" valor={p.alias} />
        <Dato etiqueta="Profundidad" valor={m(f.construccion.profundidad, 'm', 1)} />
        <Dato etiqueta="Cota" valor={m(f.ubicacion.cota, 'm s. n. m.', 0)} />
        <Dato etiqueta="Ubicación" valor={[f.ubicacion.paraje, f.ubicacion.localidad, f.ubicacion.departamento].filter(Boolean).join(', ')} />
        <Dato etiqueta="Distrito" valor={f.ubicacion.distrito} />
        <Dato ancho etiqueta="Cuenca subterránea" valor={f.ubicacion.cuencaSubterranea} />
        <Dato ancho etiqueta={`POSGAR 07 faja 3${f.sistemaCoordenada === 'POSGAR_FAJA3' ? ' (cargada)' : ''}`} valor={`X ${formatoNumero(p.coordX, 2)} · Y ${formatoNumero(p.coordY, 2)}`} />
        <Dato ancho etiqueta={`Latitud / longitud${f.sistemaCoordenada === 'WGS84' ? ' (cargada)' : ''}`} valor={`${p.latitud.toFixed(6)}, ${p.longitud.toFixed(6)}`} />
        <Dato etiqueta="Caudal de bombeo" valor={m(r.caudalM3h, 'm³/h')} />
        <Dato etiqueta="Régimen declarado" valor={m(r.regimenM3h, 'm³/h')} />
        <Dato ancho etiqueta="Usos del agua declarados" valor={f.usos.map((u) => `${u.uso} (${formatoNumero(u.cantidad)} ${u.unidad})`).join(' · ')} />
      </Bloque>
      {c && (
        <Bloque titulo="Concesión (Catastro)" icono="map">
          <Dato etiqueta="N° de concesión" valor={c.numeroConcesion} />
          <Dato etiqueta="Tipo" valor={c.tipoConcesion} />
          <Dato etiqueta="Rige" valor={c.rigeDesde ? `desde ${formatoFecha(c.rigeDesde)}${c.rigeHasta ? ` hasta ${formatoFecha(c.rigeHasta)}` : ''}` : null} />
          <Dato etiqueta="Uso" valor={c.uso} />
          <Dato ancho etiqueta="Titulares" valor={c.titulares.map((t) => `${t.nombre} (${t.caracter.toLowerCase()}, ${t.documento})`).join(' · ')} />
          <Dato etiqueta="Matrícula catastral" valor={c.catastral.matricula} />
          <Dato etiqueta="Parcela" valor={c.catastral.parcela} />
          {r.resolucion && <Dato etiqueta="Resolución" valor={`${r.resolucion.numero}/${r.resolucion.anio} del ${formatoFecha(r.resolucion.fecha)}`} />}
          {r.concesion && <Dato etiqueta="Concesión" valor={`N° ${r.concesion.numero} · ${r.concesion.estado.toLowerCase()}`} />}
        </Bloque>
      )}
      {c?.uso && <PanelCaudales caudalM3h={r.caudalM3h} regimenM3h={r.regimenM3h} uso={c.uso} />}
    </div>
  )
}
