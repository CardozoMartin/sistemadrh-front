import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { RUTA_BANDEJA } from '@/config/routes'
import { AvisoDeuda } from '../../shared/circuito/AvisoDeuda'
import { DondeEsta } from '../../shared/circuito/DondeEsta'
import { HistorialExpediente } from '../../shared/circuito/HistorialExpediente'
import { nombres, numeroConcesion } from '../../shared/formato'
import type { Terminado } from '../../shared/circuito/terminado'
import type { ReubicacionBackend } from '../backend.types'
import { DatosReubicacion } from '../components/circuito/DatosReubicacion'
import { PanelOficina } from '../components/circuito/PanelOficina'
import { ConReubicacion } from '../components/ConReubicacion'
import { terminado as terminadoComo } from '../formato'

const TITULO = 'Expediente de reubicación'

/**
 * Una reubicación en el circuito de oficinas (backend real): dónde está, qué hace la oficina que la
 * tiene, lo vigente contra lo propuesto y el historial completo.
 * Etapas con pantalla: Recaudación, Distrito, Jurídico, la corrección en Catastro si Jurídico la
 * observa, Secretaría General y el cierre en Catastro.
 */
export default function CircuitoReubicacionPage() {
  const { expedienteId } = useParams()
  return (
    <ConReubicacion expedienteId={expedienteId} titulo={TITULO} mensajeCarga="Cargando el expediente…" tituloNoEncontrado="No se encontró el expediente">
      {(datos) => <Circuito datos={datos} />}
    </ConReubicacion>
  )
}

function Circuito({ datos }: { datos: ReubicacionBackend }) {
  const navigate = useNavigate()
  /** «Trámite enviado»: vive acá porque, al pasar de oficina, el panel de trabajo desaparece. */
  const [terminado, setTerminado] = useState<(Terminado & { oficina: string }) | null>(null)
  const { expediente, reubicacion: r } = datos

  return (
    <>
      <PageHeader title={`${TITULO} ${expediente.numero}`} description={`Concesión ${numeroConcesion(r.concesion)} · ${nombres(r.titulares) || 'sin titular registrado'}`} />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <DondeEsta
            oficina={expediente.oficinaNombre}
            etapa={expediente.etapaNombre}
            tomadoPor={expediente.tomadoPor?.nombre ?? null}
            tomadoEn={expediente.tomadoEn}
            terminado={terminadoComo(r.estado)}
          />
        </Card>

        {datos.avisoDeuda && <AvisoDeuda aviso={datos.avisoDeuda} />}

        {r.estado === 'EN_TRAMITE' && <PanelOficina datos={datos} onTerminado={(t) => setTerminado({ ...t, oficina: expediente.oficinaActual })} />}

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">La reubicación</h2>
          <DatosReubicacion datos={datos} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Historial del expediente</h2>
          <HistorialExpediente expedienteId={expediente.id} />
        </Card>
      </div>

      <ConfirmDialog
        open={!!terminado}
        tone="success"
        title={terminado?.titulo ?? ''}
        message={terminado?.mensaje ?? ''}
        confirmLabel="Volver a la bandeja"
        cancelLabel="Ver el expediente"
        onConfirm={() => navigate(RUTA_BANDEJA[terminado!.oficina as keyof typeof RUTA_BANDEJA] ?? '/')}
        onCancel={() => setTerminado(null)}
      />
    </>
  )
}
