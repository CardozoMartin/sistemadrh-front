import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import { useSesion } from '@/features/auth/context'
import { EmptyState, ErrorState, LoadingState, Alert } from '@/components/feedback/States'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useDominio } from '@/hooks/useDominio'
import { esNoEncontrado } from '@/services/api/errors'
import { AccionesOficina } from '../components/circuito/AccionesOficina'
import { AvisoDeuda } from '../components/circuito/AvisoDeuda'
import { BarraEtapas } from '../components/circuito/BarraEtapas'
import { DondeEsta } from '../components/circuito/DondeEsta'
import { DatosAlta } from '../components/circuito/DatosAlta'
import { RegistroExpediente } from '../components/circuito/RegistroExpediente'
import type { AltaBackend } from '../backend.types'
import { useAlta } from '../hooks'
import { admiteCorreccion } from './CorreccionDatosPage'

const TITULO = 'Expediente de alta de concesión'

/**
 * Un alta en el circuito de oficinas (backend real): dónde está, qué tiene que hacer la
 * oficina que lo tiene, los datos cargados y el historial completo de pases y actuaciones.
 */
export default function CircuitoAltaPage() {
  return <ExpedienteAlta consulta={false} />
}

/** Desde la búsqueda general: datos, auditoría e historial, sin el panel de trabajo de la oficina. */
export function ConsultaAltaPage() {
  return <ExpedienteAlta consulta />
}

/**
 * Los datos cargados del alta. En Recaudación no hacen falta para verificar la deuda: quedan
 * plegados y se abren con un botón.
 */
function DatosDelExpediente({ alta, plegado }: { alta: AltaBackend; plegado: boolean }) {
  const [abierto, setAbierto] = useState(!plegado)
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Datos del expediente</h2>
        {plegado && (
          <Button size="sm" variant="ghost" iconLeft={abierto ? 'expand_less' : 'visibility'} onClick={() => setAbierto(!abierto)}>
            {abierto ? 'Ocultar datos' : 'Ver datos del expediente'}
          </Button>
        )}
      </div>
      {abierto && (
        <div className="mt-4">
          <DatosAlta alta={alta} />
        </div>
      )}
    </Card>
  )
}

function ExpedienteAlta({ consulta }: { consulta: boolean }) {
  const { expedienteId } = useParams()
  const alta = useAlta(expedienteId)
  const { estados } = useDominio()
  const { puede } = useSesion()
  const navigate = useNavigate()

  if (alta.isPending) {
    return (
      <>
        <PageHeader title={TITULO} />
        <LoadingState mensaje="Cargando el expediente…" />
      </>
    )
  }
  if (alta.isError) {
    return (
      <>
        <PageHeader title={TITULO} />
        {esNoEncontrado(alta.error) ? (
          <EmptyState icon="search_off" titulo="No se encontró el expediente" />
        ) : (
          <ErrorState error={alta.error} onRetry={() => void alta.refetch()} reintentando={alta.isFetching} />
        )}
      </>
    )
  }

  const a = alta.data
  return (
    <>
      <PageHeader
        title={`Expediente ${a.numeroExpediente}`}
        description={`Alta de concesión · ${a.titulares[0] ? (a.titulares[0].razonSocial ?? `${a.titulares[0].apellido}, ${a.titulares[0].nombre}`) : 'sin titular cargado'}${a.concesion.numero ? ` · Concesión N° ${a.concesion.numero}` : ''}`}
        actions={
          puede('ALTA_CORREGIR') &&
          admiteCorreccion(a) && (
            <Button size="sm" variant="secondary" iconLeft="edit_note" title="Corregir errores materiales (datos mal escritos o KML mal cargado)" onClick={() => navigate(ROUTES.tramites.altaConcesion.correccion(a.id))}>
              Corregir datos
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-6">
        {a.datosSensiblesOcultos && (
          <Alert tone="info">Algunos datos se muestran ocultos (documentos, domicilios, contacto y montos): para verlos hace falta el permiso «Ver datos sensibles».</Alert>
        )}
        <Card className="p-5">
          <BarraEtapas circuito={a.circuito} />
        </Card>
        {a.avisoDeuda && <AvisoDeuda aviso={a.avisoDeuda} />}

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            {consulta ? (
              <Card className="p-6">
                <DondeEsta
                  oficina={a.circuito.oficinaNombre}
                  etapa={a.circuito.etapaNombre}
                  tomadoPor={a.circuito.tomadoPor?.nombre ?? null}
                  tomadoEn={a.circuito.tomadoEn}
                  terminado={['FINALIZADO', 'RECHAZADO', 'ARCHIVADO', 'ANULADO'].includes(a.circuito.estado) ? (estados.find((e) => e.codigo === a.circuito.estado)?.nombre ?? a.circuito.estado) : null}
                />
              </Card>
            ) : (
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {a.circuito.oficinaNombre} · {a.circuito.etapaNombre}
                  </h2>
                  {a.circuito.tomadoPor && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Lo tiene {a.circuito.tomadoPor.nombre} desde {new Date(a.circuito.tomadoEn!).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
                <AccionesOficina alta={a} />
              </Card>
            )}

            <DatosDelExpediente alta={a} plegado={!consulta && a.circuito.etapa === 'RECAUDACION'} />
          </div>

          {/* Historial y auditoría a pedido: no ocupan la pantalla hasta que se abren. */}
          <RegistroExpediente expedienteId={a.id} />
        </div>
      </div>
    </>
  )
}
