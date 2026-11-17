import { useFieldArray, useFormContext } from 'react-hook-form'
import { FormSection } from '@/components/form'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { domicilioVacio, type DomicilioForm } from '../schemas/domicilio'
import { titularVacio, type TitularForm } from '../schemas/titular'
import { DomicilioFields } from './DomicilioFields'
import { TitularFields } from './TitularFields'

/** Forma mínima del formulario que usa este bloque (alta, cambio de titularidad, permisos…). */
interface FormTitulares {
  titulares: TitularForm[]
  domicilios: DomicilioForm[]
}

function BotonEliminar({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
    >
      <Icon name="delete" />
    </button>
  )
}

interface Props {
  /** Título del primer titular (ej: "Nuevo titular"). */
  tituloTitular?: string
}

/** Titular/es y domicilio/s legal/es, con alta y baja de adicionales (campos `titulares` y `domicilios`). */
export function TitularesDomiciliosFields({ tituloTitular = 'Titular' }: Props) {
  const { control } = useFormContext<FormTitulares>()
  const titulares = useFieldArray({ control, name: 'titulares' })
  const domicilios = useFieldArray({ control, name: 'domicilios' })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        {titulares.fields.map((field, i) =>
          i === 0 ? (
            <FormSection key={field.id} title={tituloTitular} icon="person">
              <TitularFields prefix="titulares.0" />
            </FormSection>
          ) : (
            <FormSection
              key={field.id}
              variant="boxed"
              title={`Titular adicional ${i}`}
              icon="person"
              actions={<BotonEliminar title="Eliminar titular" onClick={() => titulares.remove(i)} />}
            >
              <TitularFields prefix={`titulares.${i}`} />
            </FormSection>
          ),
        )}
        <div>
          <Button size="sm" iconLeft="person_add" onClick={() => titulares.append(titularVacio())}>
            Agregar otro titular
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
        {domicilios.fields.map((field, i) =>
          i === 0 ? (
            <FormSection key={field.id} title="Domicilio legal" icon="location_on">
              <DomicilioFields prefix="domicilios.0" />
            </FormSection>
          ) : (
            <FormSection
              key={field.id}
              variant="boxed"
              title={`Domicilio adicional ${i}`}
              icon="location_on"
              actions={<BotonEliminar title="Eliminar domicilio" onClick={() => domicilios.remove(i)} />}
            >
              <DomicilioFields prefix={`domicilios.${i}`} />
            </FormSection>
          ),
        )}
        <div>
          <Button size="sm" variant="secondary" iconLeft="add_location_alt" onClick={() => domicilios.append(domicilioVacio())}>
            Agregar otra dirección
          </Button>
        </div>
      </div>
    </div>
  )
}
