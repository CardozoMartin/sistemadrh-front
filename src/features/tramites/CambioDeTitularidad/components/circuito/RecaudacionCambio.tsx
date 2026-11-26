import type { CambioBackend } from '../../backend.types'
import { useAntecedentesDeudaCambio, useBorradorAvisoCambio, useCursoConDeudaCambio, useNotificarDeudaCambio, useVerificarDeudaCambio } from '../../hooks'
import { PanelRecaudacion, type HooksRecaudacion } from '../../../shared/circuito/PanelRecaudacion'
import type { Terminado } from '../../../shared/circuito/terminado'

const HOOKS: HooksRecaudacion = {
  useAntecedentes: useAntecedentesDeudaCambio,
  useVerificar: useVerificarDeudaCambio,
  useBorradorAviso: useBorradorAvisoCambio,
  useNotificar: useNotificarDeudaCambio,
  useCursoConDeuda: useCursoConDeudaCambio,
}

/**
 * Recaudación en el Cambio de Titularidad (caso de uso, pasos 11-17): el panel común con las
 * concesiones del titular actual y del nuevo (incluida la que se transfiere).
 */
export function RecaudacionCambio({ datos, enEspera, onTerminado }: { datos: CambioBackend; enEspera: boolean; onTerminado: (t: Terminado) => void }) {
  return (
    <PanelRecaudacion
      expediente={datos.expediente}
      concesionDelTramite={{ id: datos.cambio.concesion.id, etiqueta: 'La que se transfiere' }}
      // Se revisa la deuda de los dos: el dueño anterior y el nuevo titular.
      actuales={datos.cambio.titularesActuales.map((t) => t.personaId)}
      nuevos={datos.cambio.nuevosTitulares.map((t) => t.personaId)}
      textos={{
        deudaTitulares: 'El cambio no avanza si el titular actual o el nuevo tienen deuda.',
        concesiones: (titulares) => `Del titular actual y del nuevo: ${titulares}. Tener otras concesiones solo se informa; lo que frena el cambio es la deuda.`,
      }}
      enEspera={enEspera}
      hooks={HOOKS}
      onTerminado={onTerminado}
    />
  )
}
