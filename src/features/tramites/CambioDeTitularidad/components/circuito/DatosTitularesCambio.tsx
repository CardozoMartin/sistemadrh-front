import { Icon } from '@/components/ui/Icon'
import type { CambioBackend, DomicilioCambio, PersonaCambio } from '../../backend.types'

const domicilioTexto = (d: DomicilioCambio | undefined) =>
  d ? [d.calle && `${d.calle}${d.numero ? ` ${d.numero}` : ''}`, d.localidad, d.departamento, d.distrito && `Distrito ${d.distrito}`].filter(Boolean).join(', ') : null

/** CUIT/CUIL de una persona: el documento si es de 11 dígitos. */
const esCuit = (p: PersonaCambio) => p.tipoDocumento === 'CUIT' || p.tipoDocumento === 'CUIL'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{etiqueta}</span>
      <span className={valor ? 'text-right font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>{valor || 'No registrado'}</span>
    </div>
  )
}

function Persona({ persona, domicilio, padron }: { persona: PersonaCambio; domicilio: DomicilioCambio | undefined; padron: string | null }) {
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-4 py-2 dark:divide-slate-700 dark:border-slate-700">
      <p className="py-1.5 font-semibold text-slate-900 dark:text-white">{persona.nombreCompleto}</p>
      <Dato etiqueta="DNI" valor={persona.tipoDocumento === 'DNI' ? persona.documento : null} />
      <Dato etiqueta="CUIT / CUIL" valor={esCuit(persona) ? persona.documento : null} />
      <Dato etiqueta="Correo" valor={persona.email} />
      <Dato etiqueta="Teléfono" valor={persona.telefono} />
      <Dato etiqueta="Padrón vinculado" valor={padron} />
      <Dato etiqueta="Domicilio fiscal" valor={domicilioTexto(domicilio)} />
    </div>
  )
}

/**
 * Verificación de deuda (caso de uso, paso 14): los datos del titular actual y del nuevo, lado a
 * lado. El nuevo es una propuesta: la concesión sigue a nombre del actual hasta que el trámite finaliza.
 */
export function DatosTitularesCambio({ datos }: { datos: CambioBackend }) {
  const { cambio } = datos
  const padron = cambio.concesion.padron
  const columnas = [
    { titulo: 'Titular actual', icono: 'person', personas: cambio.titularesActuales, domicilios: cambio.domiciliosActuales },
    { titulo: 'Nuevo titular (propuesto)', icono: 'person_add', personas: cambio.nuevosTitulares, domicilios: cambio.nuevosDomicilios },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {columnas.map((c) => (
        <div key={c.titulo} className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            <Icon name={c.icono} className="text-[18px]!" />
            {c.titulo}
          </p>
          {c.personas.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos cargados.</p>
          ) : (
            c.personas.map((p, i) => <Persona key={p.personaId} persona={p} domicilio={c.domicilios[i] ?? c.domicilios[0]} padron={padron} />)
          )}
        </div>
      ))}
    </div>
  )
}
