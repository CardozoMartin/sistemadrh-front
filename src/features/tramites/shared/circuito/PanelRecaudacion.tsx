import { useState } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { Alert } from '@/components/feedback/States'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { mensajeDeError } from '@/services/api/errors'
import type { AntecedentesDeuda, BorradorAvisoDeuda, NotificarDeudaDto, ResultadoAvisoDeuda } from './deuda.types'
import { Observaciones, Opciones } from './campos'
import { ResumenEnvio } from './ResumenEnvio'
import type { Terminado } from './terminado'
import { AvisoDeudaPanel } from './AvisoDeudaPanel'
import { CursoConDeudaPanel } from './CursoConDeudaPanel'
import { opcionesAptoNoApto } from './opciones'
import { estadoDeudaPorTitular, faltaEnDecision, SIGUIENTE_A_RECAUDACION as SIGUIENTE, type DecisionDeuda, type EstadoDeudaTitular, type VerificacionDeuda } from './recaudacion'

/**
 * Los hooks de Recaudación de cada trámite (cambio de titularidad, anulación…): mismos endpoints
 * del circuito común, cada uno bajo su ruta y con su caché.
 */
export interface HooksRecaudacion {
  useAntecedentes: (id: string) => UseQueryResult<AntecedentesDeuda>
  useVerificar: (id: string) => UseMutationResult<unknown, Error, VerificacionDeuda>
  useBorradorAviso: (id: string, habilitado: boolean) => UseQueryResult<BorradorAvisoDeuda>
  useNotificar: (id: string) => UseMutationResult<ResultadoAvisoDeuda, Error, NotificarDeudaDto>
  useCursoConDeuda: (id: string) => UseMutationResult<unknown, Error, string>
}

interface Props {
  expediente: { id: string; numero: string }
  /** La concesión sobre la que se tramita y cómo se marca en la lista (ej: «La que se transfiere»). */
  concesionDelTramite: { id: string; etiqueta: string }
  /** Ids de persona de los titulares actuales y de los nuevos (vacío si el trámite no los cambia). */
  actuales: string[]
  nuevos: string[]
  /** Textos propios del trámite, debajo de cada título. */
  textos: { deudaTitulares: string; concesiones: (titulares: string) => string }
  enEspera: boolean
  hooks: HooksRecaudacion
  onTerminado: (t: Terminado) => void
}

/**
 * Recaudación (común a los trámites sobre una concesión). El sistema trae las concesiones
 * otorgadas de los titulares y si tienen deuda. Recaudación decide:
 *   - Apto (sin deuda): con confirmación, pasa a Distrito («trámite enviado»).
 *   - No apto (tiene deuda): se marca en qué concesión y el motivo; queda en espera en Recaudación.
 *     En espera se puede avisar al titular por correo o, si no se pudo cobrar, darle curso con una nota.
 */
export function PanelRecaudacion({ expediente, concesionDelTramite, actuales, nuevos, textos, enEspera, hooks, onTerminado }: Props) {
  const id = expediente.id
  const antecedentes = hooks.useAntecedentes(id)
  const verificar = hooks.useVerificar(id)
  const [decision, setDecision] = useState<DecisionDeuda | ''>(enEspera ? 'NO_APTO' : '')
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [observaciones, setObservaciones] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  if (antecedentes.isPending) return <p className="text-sm text-slate-500">Buscando las concesiones de los titulares…</p>
  if (antecedentes.isError) return <Alert>No se pudieron consultar las concesiones de los titulares: {mensajeDeError(antecedentes.error)}</Alert>

  const { titulares, concesiones, otrasDeudas } = antecedentes.data
  const tieneDeuda = (c: (typeof concesiones)[number]) => decision === 'NO_APTO' && (marcadas[c.id] ?? c.tieneDeuda)
  const conDeuda = concesiones.filter(tieneDeuda)
  const nombreDe = (personaId: string) => titulares.find((t) => t.personaId === personaId)?.nombre ?? personaId

  const falta = faltaEnDecision({ decision, conDeuda: conDeuda.length, otrasDeudas: otrasDeudas.length, observaciones })

  function guardar() {
    setConfirmar(false)
    if (!decision || falta) return
    const numero = expediente.numero
    verificar.mutate(
      {
        resultado: decision,
        concesiones: concesiones.map((c) => ({ concesionId: c.id, tieneDeuda: tieneDeuda(c) })),
        observaciones: observaciones.trim() || undefined,
      },
      {
        onSuccess: () =>
          onTerminado(
            decision === 'APTO'
              ? { titulo: 'Trámite enviado', mensaje: `El expediente ${numero} no posee deuda y fue enviado a ${SIGUIENTE}.` }
              : { titulo: 'Quedó en espera por deuda', mensaje: `El expediente ${numero} queda en Recaudación hasta que se pague. Puede avisar al titular por correo.` },
          ),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {enEspera && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <Icon name="pause_circle" className="mt-0.5 text-red-600 dark:text-red-300" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">En espera · pendiente de pago</p>
            <p>Cuando paguen, marque «Apto»: se levanta la deuda y pasa a {SIGUIENTE}. Mientras tanto puede avisar por correo o, si no se puede cobrar, darle curso con deuda.</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Estado de deuda de cada titular</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{textos.deudaTitulares}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {estadoDeudaPorTitular(antecedentes.data, actuales, nuevos).map((t) => (
          <TarjetaDeuda key={t.personaId} titular={t} />
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Concesiones de los titulares</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {textos.concesiones(titulares.map((t) => t.nombre).join(' · '))}
        </p>
      </div>

      {concesiones.length === 0 ? (
        <p className="text-sm text-slate-500">Los titulares no tienen concesiones otorgadas en el sistema.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {concesiones.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                tieneDeuda(c) ? 'border-red-300 bg-red-50/50 dark:border-red-500/40 dark:bg-red-500/5' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Concesión {c.numero ? `N° ${c.numero}` : `id ${c.id}`}
                  {c.id === concesionDelTramite.id && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{concesionDelTramite.etiqueta}</span>}
                  {c.tieneDeuda && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Deuda registrada</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[c.localidad, c.departamento].filter(Boolean).join(', ') || 'Sin ubicación'} · de {c.deTitulares.map(nombreDe).join(' y ')}
                </p>
              </div>
              <a
                href={ROUTES.visorConcesion(c.id)}
                target="_blank"
                rel="noopener"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5 dark:border-slate-700"
              >
                <Icon name="map" className="text-[18px]!" />
                Ver concesión
              </a>
              {decision === 'NO_APTO' && (
                <label className="flex shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold dark:border-slate-700">
                  <input type="checkbox" className="size-4 accent-red-600" checked={tieneDeuda(c)} onChange={(e) => setMarcadas({ ...marcadas, [c.id]: e.target.checked })} />
                  Tiene deuda
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      {otrasDeudas.length > 0 && (
        <Alert tone="info">
          Deudas registradas antes, sin concesión: {otrasDeudas.map((d) => `${nombreDe(d.personaId)} · ${d.detalle}`).join(' — ')}.
        </Alert>
      )}

      {/* Paso 12: ¿posee deuda? */}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">¿Posee deuda?</p>
      <Opciones
        valor={decision}
        onChange={(d) => {
          if (d !== decision) setObservaciones('')
          setDecision(d)
        }}
        opciones={opcionesAptoNoApto('No posee deuda (apto)', 'Posee deuda (no apto)')}
      />

      {/* Paso 13: observaciones (obligatorias si posee deuda). */}
      {decision && (
        <Observaciones
          valor={observaciones}
          onChange={setObservaciones}
          obligatorio={decision === 'NO_APTO'}
          placeholder={decision === 'NO_APTO' ? 'Qué se adeuda (ej: canon de riego 2025 de la concesión 906)' : 'Si hace falta aclarar algo'}
        />
      )}
      {falta && <p className="text-xs font-medium text-red-600 dark:text-red-400">{falta}</p>}
      {verificar.error && <Alert>{mensajeDeError(verificar.error)}</Alert>}

      {/* Paso 14-16: guardar y continuar → confirmación → enviar. */}
      <div>
        <Button
          iconRight={decision === 'NO_APTO' ? 'pause_circle' : 'send'}
          variant={decision === 'NO_APTO' ? 'secondary' : 'primary'}
          loading={verificar.isPending}
          disabled={!decision || !!falta || verificar.isPending}
          onClick={() => setConfirmar(true)}
        >
          {decision === 'NO_APTO' ? (enEspera ? 'Guardar: sigue en espera' : 'Guardar: queda en espera por deuda') : `Guardar y continuar a ${SIGUIENTE}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        tone={decision === 'NO_APTO' ? 'danger' : 'info'}
        title={decision === 'NO_APTO' ? '¿Dejar el trámite en espera por deuda?' : `¿Enviar el trámite a ${SIGUIENTE}?`}
        message={
          decision === 'NO_APTO'
            ? 'El expediente queda en espera en Recaudación hasta que se pague. La deuda queda registrada en las concesiones marcadas.'
            : 'Revise lo que se envía:'
        }
        confirmLabel={decision === 'NO_APTO' ? 'Sí, dejar en espera' : 'Sí, enviar'}
        cancelLabel="Cancelar"
        onConfirm={guardar}
        onCancel={() => setConfirmar(false)}
      >
        <ResumenEnvio
          filas={[
            ['Expediente', expediente.numero],
            ['Titulares', titulares.map((t) => t.nombre).join(' · ')],
            ['¿Posee deuda?', decision === 'NO_APTO' ? `Sí: ${conDeuda.map((c) => `N° ${c.numero ?? c.id}`).join(', ') || 'deudas sin concesión'}` : 'No'],
            ['Observaciones', observaciones.trim() || null],
            ['Destino', decision === 'NO_APTO' ? 'Queda en espera en Recaudación' : SIGUIENTE],
          ]}
        />
      </ConfirmDialog>

      {enEspera && (
        <>
          <AvisoDeudaPanel expedienteId={id} hooks={hooks} />
          <CursoConDeudaPanel expedienteId={id} numero={expediente.numero} hooks={hooks} onTerminado={onTerminado} />
        </>
      )}
    </div>
  )
}

const ROL: Record<EstadoDeudaTitular['rol'], string> = { actual: 'Titular actual', nuevo: 'Nuevo titular', ambos: 'Titular actual y nuevo' }

/** Una persona del trámite: sus concesiones y si tiene deuda registrada. */
function TarjetaDeuda({ titular }: { titular: EstadoDeudaTitular }) {
  const conDeuda = titular.deudas.length > 0
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        conDeuda ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/5' : 'border-green-200 bg-green-50/60 dark:border-green-500/30 dark:bg-green-500/5',
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{ROL[titular.rol]}</p>
      <p className="font-semibold text-slate-900 dark:text-white">{titular.nombre}</p>
      <p className={cn('mt-1 flex items-center gap-1.5 text-sm font-semibold', conDeuda ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300')}>
        <Icon name={conDeuda ? 'error' : 'check_circle'} filled className="text-[18px]!" />
        {conDeuda ? `Con deuda: ${titular.deudas.join(' · ')}` : 'Sin deuda registrada'}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {titular.concesiones.length ? `Concesiones: ${titular.concesiones.join(', ')}` : 'Sin concesiones otorgadas'}
      </p>
    </div>
  )
}
