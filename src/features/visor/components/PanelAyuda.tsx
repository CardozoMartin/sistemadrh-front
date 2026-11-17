import { Icon } from '@/components/ui/Icon'

const TEMAS: { icono: string; titulo: string; texto: string }[] = [
  { icono: 'search', titulo: 'Buscar', texto: 'Escriba arriba un titular, número de concesión, expediente, padrón o fuente. La lista y el mapa muestran solo lo que coincide.' },
  { icono: 'ads_click', titulo: 'Consultar una concesión', texto: 'Haga clic en un polígono (o en su punto, con el mapa alejado) para ver la ficha. El enlace de la página queda con esa concesión: se puede compartir.' },
  { icono: 'layers', titulo: 'Capas', texto: 'Las capas están ordenadas por tema (concesiones, aguas subterráneas, riego, hidrografía, límites…), vengan de la DRH, de Catastro o del Ministerio. Marque las que quiera ver o búsquelas por nombre. El botón de ajustes de cada capa tiene la opacidad, la leyenda y sus opciones.' },
  { icono: 'save', titulo: 'Su configuración', texto: 'Las capas que deja a la vista, su opacidad y el mapa base quedan guardados en esta PC: el visor se abre como lo dejó.' },
  { icono: 'straighten', titulo: 'Medir', texto: 'Con la regla o el área de la barra de herramientas, haga clic para agregar puntos. Doble clic o Enter termina; Esc cancela.' },
  { icono: 'pin_drop', titulo: 'Ir a una coordenada', texto: 'Ingrese X/Y en POSGAR 2007 faja 3 (como en los planos) o latitud/longitud de un GPS.' },
  { icono: 'upload_file', titulo: 'Comparar un archivo', texto: 'Cargue el KML o GeoJSON de un pedido para ver si se superpone con concesiones existentes antes de iniciar el trámite.' },
]

/** Ayuda breve del visor. */
export function PanelAyuda() {
  return (
    <div className="flex flex-col gap-3 p-3">
      {TEMAS.map((t) => (
        <div key={t.titulo} className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon name={t.icono} className="text-[18px]!" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.titulo}</p>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t.texto}</p>
          </div>
        </div>
      ))}
      <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
        Los datos salen de la base PostGIS de la DRH (las mismas capas que ve QGIS). Se guardan en POSGAR 2007 faja 3 (EPSG:5345); el mapa web los muestra en latitud/longitud.
      </div>
    </div>
  )
}
