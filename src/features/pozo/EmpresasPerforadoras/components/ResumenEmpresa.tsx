import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatearFecha } from '@/config/expedientes'
import type { Adjunto } from '@/types/domain'
import { cuitConFormato } from '../reglas'
import type { EmpresaPerforadora } from '../types'

function Dato({ label, children, ancho }: { label: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</p>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{children || '—'}</div>
    </div>
  )
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <Icon name={icono} className="text-lg! text-primary" /> {titulo}
      </h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

const archivos = (xs?: Adjunto[]) =>
  xs?.length ? (
    <ul className="flex flex-col gap-0.5">
      {xs.map((a) => (
        <li key={a.nombre} className="flex items-center gap-1.5 font-normal">
          <Icon name="description" className="text-base! text-slate-400" /> {a.nombre}
        </li>
      ))}
    </ul>
  ) : null

/** Datos de la empresa en solo lectura (revisión de Jurídico / Secretaría y ficha en trámite). */
export function ResumenEmpresa({ empresa }: { empresa: EmpresaPerforadora }) {
  const dt = empresa.direccionTecnica
  return (
    <Card className="flex flex-col gap-8 p-6 md:p-8">
      {/* Mismo orden y etiquetas que el formulario (prototipo AgregarEmpresa.html). */}
      <Bloque titulo="Datos generales de la empresa" icono="apartment">
        <Dato label="CUIL/CUIT">{cuitConFormato(empresa.cuit)}</Dato>
        <Dato label="Num. documento">{empresa.documento}</Dato>
        <Dato label="Ingresos Brutos">{empresa.ingresosBrutos}</Dato>
        <Dato label="Persona jurídica">{empresa.tipoPersona === 'juridica' ? 'Sí' : 'No'}</Dato>
        <Dato label="Nombre">{empresa.tipoPersona === 'juridica' ? empresa.razonSocial : empresa.nombre}</Dato>
        <Dato label="Apellido">{empresa.apellido}</Dato>
        <Dato label="Domicilio fiscal">{empresa.domicilio}</Dato>
        <Dato label="Telefono fiscal">{empresa.telefono}</Dato>
        <Dato label="Provincia">{empresa.provincia}</Dato>
        <Dato label="Departamento / Localidad">{[empresa.departamento, empresa.localidad].filter(Boolean).join(' · ')}</Dato>
        <Dato label="Resolucion">
          {empresa.resolucion.numero ? (
            <>
              {empresa.resolucion.numero}/{empresa.resolucion.anio}
              {empresa.resolucion.fecha && <span className="font-normal"> · firmada el {formatearFecha(empresa.resolucion.fecha)}</span>}
              {archivos(empresa.resolucion.archivo)}
            </>
          ) : (
            <span className="font-normal text-slate-500">Pendiente (la emite Secretaría General)</span>
          )}
        </Dato>
        <Dato label="Registro de comercio">{empresa.registroComercio}</Dato>
        <Dato label="Observaciones" ancho>
          {empresa.observaciones && <span className="font-normal">{empresa.observaciones}</span>}
        </Dato>
      </Bloque>

      <Bloque titulo="Ingresos multilaterales" icono="schema">
        <Dato label="Jurisdiccion · Numero de ingreso · Condicion o categoria" ancho>
          {empresa.jurisdicciones.length > 0 && (
            <ul className="flex flex-col gap-0.5 font-normal">
              {empresa.jurisdicciones.map((j) => (
                <li key={`${j.jurisdiccion}-${j.numero}`}>
                  <strong>{j.jurisdiccion}</strong> · {j.numero}
                  {j.condicion && ` · ${j.condicion}`}
                </li>
              ))}
            </ul>
          )}
        </Dato>
      </Bloque>

      <Bloque titulo="Direccion tecnica" icono="engineering">
        <Dato label="Nombre">{dt.nombre}</Dato>
        <Dato label="Apellido">{dt.apellido}</Dato>
        <Dato label="Direccion">{dt.domicilio}</Dato>
        <Dato label="Email">{dt.email}</Dato>
      </Bloque>

      {/* Empresas cargadas antes con documentación adjunta. */}
      {(empresa.notaSolicitud.length > 0 || empresa.documentacionLegal.length > 0) && (
        <Bloque titulo="Documentación" icono="folder_open">
          <Dato label="Nota de solicitud">{archivos(empresa.notaSolicitud)}</Dato>
          <Dato label="Documentación legal">{archivos(empresa.documentacionLegal)}</Dato>
        </Bloque>
      )}

      {empresa.dictamen && (
        <Bloque titulo="Circuito" icono="account_tree">
          {empresa.dictamen && (
            <Dato label={`Dictamen de Jurídico · ${formatearFecha(empresa.dictamen.fecha)} · ${empresa.dictamen.usuario}`} ancho>
              <span className="font-normal">{empresa.dictamen.texto}</span>
              {archivos(empresa.dictamen.informe)}
            </Dato>
          )}
        </Bloque>
      )}
    </Card>
  )
}
