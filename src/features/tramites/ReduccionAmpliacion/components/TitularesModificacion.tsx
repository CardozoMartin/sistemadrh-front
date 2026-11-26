import { Icon } from '@/components/ui/Icon'
import type { DomicilioBackend, PersonaBackend } from '../../shared/circuitoBackend/tipos'
import type { ModificacionBackend } from '../backend.types'

const domicilioTexto = (d: DomicilioBackend | undefined) =>
  d ? [d.calle && `${d.calle}${d.numero ? ` ${d.numero}` : ''}`, d.localidad, d.departamento, d.distrito && `Distrito ${d.distrito}`].filter(Boolean).join(', ') : null

function Persona({ persona, domicilio }: { persona: PersonaBackend; domicilio: DomicilioBackend | undefined }) {
  const datos: [string, string | null][] = [
    [persona.tipoDocumento ?? 'Documento', persona.documento],
    ['Correo', persona.email],
    ['Teléfono', persona.telefono],
    ['Domicilio legal', domicilioTexto(domicilio)],
  ]
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-4 py-2 dark:divide-slate-700 dark:border-slate-700">
      <p className="py-1.5 font-semibold text-slate-900 dark:text-white">{persona.nombreCompleto}</p>
      {datos.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex justify-between gap-3 py-1.5 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{etiqueta}</span>
          <span className={valor ? 'text-right font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>{valor || 'No registrado'}</span>
        </div>
      ))}
    </div>
  )
}

/** Los titulares de la concesión y, si el trámite los cambia, los nuevos (propuestos hasta que finaliza). */
export function TitularesModificacion({ datos }: { datos: ModificacionBackend }) {
  const m = datos.modificacion
  const finalizado = m.estado === 'FINALIZADO'
  const columnas = [
    { titulo: finalizado ? 'Titulares (vigentes)' : 'Titulares actuales', icono: 'person', personas: m.titularesActuales, domicilios: m.domiciliosActuales },
    ...(m.cambiaTitular && !finalizado ? [{ titulo: 'Nuevos titulares (propuestos)', icono: 'person_add', personas: m.nuevosTitulares, domicilios: m.nuevosDomicilios }] : []),
  ]
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 md:grid-cols-2">
        {columnas.map((c) => (
          <div key={c.titulo} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              <Icon name={c.icono} className="text-[18px]!" />
              {c.titulo}
            </p>
            {c.personas.length === 0 ? <p className="text-sm text-slate-400">Sin datos cargados.</p> : c.personas.map((p, i) => <Persona key={p.personaId} persona={p} domicilio={c.domicilios[i] ?? c.domicilios[0]} />)}
          </div>
        ))}
      </div>
      {!m.cambiaTitular && !finalizado && <p className="text-xs text-slate-500 dark:text-slate-400">El trámite no cambia los titulares: la concesión conserva los suyos.</p>}
    </div>
  )
}
