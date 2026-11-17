import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { MODO_DEMO } from '@/services/demo/modo'

/**
 * Aviso de «Modo demo» en la barra superior (solo con VITE_MODO_DEMO=true): los datos de los
 * módulos del backend real son emulados y quedan en este navegador. «Reiniciar» vuelve a los
 * datos de ejemplo.
 */
export function IndicadorDemo() {
  const qc = useQueryClient()
  const [confirmar, setConfirmar] = useState(false)
  if (!MODO_DEMO) return null

  async function reiniciar() {
    const { reiniciarDemo } = await import('@/services/demo/servidor')
    reiniciarDemo()
    setConfirmar(false)
    await qc.invalidateQueries()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        title="Datos de demostración guardados en este navegador. Clic para volver a los datos de ejemplo."
        className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950 hover:bg-amber-300"
      >
        <Icon name="science" className="text-[16px]!" />
        <span className="hidden sm:inline">Modo demo</span>
      </button>
      <ConfirmDialog
        open={confirmar}
        tone="danger"
        title="¿Reiniciar la demo?"
        message="Se borran los trámites cargados en este navegador (altas, bajas de pozo, puntos) y se vuelve a los datos de ejemplo. Los datos de json-server no cambian."
        confirmLabel="Sí, reiniciar"
        cancelLabel="Cancelar"
        onConfirm={() => void reiniciar()}
        onCancel={() => setConfirmar(false)}
      />
    </>
  )
}
