import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { leerGrados } from '@/lib/coordenadas'
import { aPosgar, dePosgar, formatearPosgar } from '@/lib/posgar'
import { formatoArea, formatoDistancia, type ResultadoMedicion, type TipoMedicion } from '../medicion'
import { BotonIcono, claseFlotante, claseInput } from './ui'

export type Herramienta = TipoMedicion | 'coordenada'

interface Props {
  herramienta: Herramienta | null
  onHerramienta: (h: Herramienta | null) => void
  onVistaInicial: () => void
  pantallaCompleta: boolean
  onPantallaCompleta: () => void
  actualizando: boolean
  onActualizar: () => void
}

const Separador = () => <span className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" />

/**
 * Barra de herramientas (arriba a la derecha): vista inicial, ir a una coordenada, medir
 * distancia y área, pantalla completa y volver a leer las capas de la base.
 */
export function BarraHerramientas({ herramienta, onHerramienta, onVistaInicial, pantallaCompleta, onPantallaCompleta, actualizando, onActualizar }: Props) {
  const alternar = (h: Herramienta) => onHerramienta(herramienta === h ? null : h)
  return (
    <div role="toolbar" aria-label="Herramientas del mapa" className={cn('flex items-center gap-0.5 rounded-xl p-1', claseFlotante)}>
      <BotonIcono icono="home" titulo="Vista inicial (todas las concesiones)" onClick={onVistaInicial} />
      <BotonIcono icono="pin_drop" titulo="Ir a una coordenada" activo={herramienta === 'coordenada'} onClick={() => alternar('coordenada')} />
      <Separador />
      <BotonIcono icono="straighten" titulo="Medir distancia" activo={herramienta === 'distancia'} onClick={() => alternar('distancia')} />
      <BotonIcono icono="square_foot" titulo="Medir área" activo={herramienta === 'area'} onClick={() => alternar('area')} />
      <Separador />
      <BotonIcono icono={pantallaCompleta ? 'fullscreen_exit' : 'fullscreen'} titulo={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={onPantallaCompleta} />
      <BotonIcono icono="refresh" titulo="Volver a leer las capas de la base" onClick={onActualizar} disabled={actualizando}>
        {actualizando ? <Spinner className="size-5" /> : undefined}
      </BotonIcono>
    </div>
  )
}

/** Encabezado de las tarjetas que se abren debajo de la barra. */
function Encabezado({ icono, titulo, onCerrar }: { icono: string; titulo: string; onCerrar: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
      <Icon name={icono} className="text-[20px]! text-primary" />
      <p className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
      <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
        <Icon name="close" className="text-[18px]!" />
      </button>
    </div>
  )
}

/** Recuadro amplio alrededor de Tucumán para aceptar una coordenada. */
const ADMITIDO = { latMin: -28.6, latMax: -25.5, lngMin: -66.8, lngMax: -64.0 }
const leerNumero = (texto: string) => Number(texto.trim().replace(/\s/g, '').replace(',', '.'))

/**
 * «Ir a coordenada»: POSGAR 2007 faja 3 (X, Y en metros, como en los planos) o latitud y
 * longitud (GPS, Google Earth), en decimal o en grados, minutos y segundos. Acepta coma o punto decimal.
 */
export function IrACoordenada({ onIr, onCerrar }: { onIr: (lat: number, lng: number, texto: string) => void; onCerrar: () => void }) {
  const [sistema, setSistema] = useState<'posgar' | 'grados'>('posgar')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const posgar = sistema === 'posgar'

  function enviar(e: FormEvent) {
    e.preventDefault()
    // En grados se acepta decimal o grados, minutos y segundos (27°03'13" S), como en los formularios.
    const x = posgar ? leerNumero(a) : (leerGrados(a)?.valor ?? NaN)
    const y = posgar ? leerNumero(b) : (leerGrados(b)?.valor ?? NaN)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !a.trim() || !b.trim()) return setError(posgar ? 'Complete los dos valores con números.' : `Use grados decimales (-27.0536) o grados, minutos y segundos (27°03'13" S).`)
    const { lat, lng } = posgar ? dePosgar(x, y) : { lat: x, lng: y }
    if (lat < ADMITIDO.latMin || lat > ADMITIDO.latMax || lng < ADMITIDO.lngMin || lng > ADMITIDO.lngMax) {
      return setError(
        posgar ? 'Ese punto cae fuera de Tucumán. En POSGAR faja 3, X ronda 3.500.000 e Y 7.000.000.' : 'Ese punto cae fuera de Tucumán. La latitud ronda -27 y la longitud -65.',
      )
    }
    setError(null)
    const p = aPosgar(lat, lng)
    onIr(lat, lng, `<strong>Coordenada</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}<br>POSGAR ${formatearPosgar(p)}`)
  }

  return (
    <div className={cn('w-80 max-w-[calc(100vw-1.5rem)] rounded-xl', claseFlotante)}>
      <Encabezado icono="pin_drop" titulo="Ir a una coordenada" onCerrar={onCerrar} />
      <form onSubmit={enviar} className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-900">
          {(
            [
              ['posgar', 'POSGAR 07 faja 3'],
              ['grados', 'Latitud / longitud'],
            ] as const
          ).map(([valor, nombre]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setSistema(valor)
                setError(null)
              }}
              className={cn('rounded-md px-2 py-1.5', sistema === valor ? 'bg-white text-primary shadow-sm dark:bg-slate-700' : 'text-slate-500')}
            >
              {nombre}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">{posgar ? 'X (este)' : 'Latitud'}</span>
            <input value={a} onChange={(e) => setA(e.target.value)} inputMode={posgar ? 'decimal' : 'text'} placeholder={posgar ? '3538383' : '-27.3674'} className={cn(claseInput, 'font-mono')} autoFocus />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">{posgar ? 'Y (norte)' : 'Longitud'}</span>
            <input value={b} onChange={(e) => setB(e.target.value)} inputMode={posgar ? 'decimal' : 'text'} placeholder={posgar ? '6973558' : '-65.6120'} className={cn(claseInput, 'font-mono')} />
          </label>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          <Icon name="my_location" className="text-[18px]!" /> Ir al punto
        </button>
      </form>
    </div>
  )
}

/** Resultado de la medición en curso. */
export function TarjetaMedicion({ tipo, resultado, onNueva, onCerrar }: { tipo: TipoMedicion; resultado: ResultadoMedicion | null; onNueva: () => void; onCerrar: () => void }) {
  const area = tipo === 'area'
  const r = resultado?.tipo === tipo ? resultado : null
  const minimo = area ? 3 : 2
  const listo = r && r.vertices >= minimo
  return (
    <div className={cn('w-72 max-w-[calc(100vw-1.5rem)] rounded-xl', claseFlotante)}>
      <Encabezado icono={area ? 'square_foot' : 'straighten'} titulo={area ? 'Medir área' : 'Medir distancia'} onCerrar={onCerrar} />
      <div className="flex flex-col gap-2 p-3">
        {listo ? (
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums dark:text-white">{area ? formatoArea(r.metrosCuadrados) : formatoDistancia(r.metros)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {area && `Perímetro ${formatoDistancia(r.metros)} · `}
              {r.vertices} puntos{r.terminada ? '' : ' · en curso'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Haga clic en el mapa para marcar {area ? 'los vértices del área' : 'el recorrido'}.</p>
        )}
        <p className="text-[11px] text-slate-400">Doble clic o Enter termina · Esc cancela · calculado en POSGAR 07</p>
        {r?.terminada && (
          <button type="button" onClick={onNueva} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
            <Icon name="restart_alt" className="text-[18px]!" /> Nueva medición
          </button>
        )}
      </div>
    </div>
  )
}
