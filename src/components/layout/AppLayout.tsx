import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { DominioProvider } from '@/app/providers/DominioProvider'
import { NotificacionesProvider } from '@/features/notificaciones/NotificacionesProvider'
import { AvisoPedidosNumero } from '@/features/catastro/components/AvisoPedidosNumero'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { Sidebar } from './Sidebar'
import { BarraRuta, Topnav } from './Topnav'

const APP_NAME = 'Sistema DRH'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const crumbs = useBreadcrumbs()
  const pageTitle = crumbs.at(-1)?.label
  // Pantallas que ocupan todo el espacio, sin márgenes ni ancho máximo (ej: el visor).
  // Se marcan en la ruta con handle: { pantallaCompleta: true }.
  const pantallaCompleta = useMatches().some((m) => (m.handle as { pantallaCompleta?: boolean } | undefined)?.pantallaCompleta)

  // Cerrar el menú mobile al navegar
  useEffect(() => setSidebarOpen(false), [pathname])

  // Con el menú abierto, Escape lo cierra.
  useEffect(() => {
    if (!sidebarOpen) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [sidebarOpen])

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME
  }, [pageTitle])

  return (
    // 1) DominioProvider carga los datos de referencia (oficinas, trámites, estados…) desde la API.
    // 2) Las notificaciones en vivo necesitan el router (links), la caché de consultas y el dominio.
    <DominioProvider>
      <NotificacionesProvider>
        {/* Catastro: aviso de los pedidos de número de concesión de Secretaría General. */}
        <AvisoPedidosNumero />
        {/* Barra institucional a todo el ancho; debajo, el menú lateral y el contenido. */}
        <div className="flex h-full w-full flex-col overflow-hidden">
          <Topnav onOpenSidebar={() => setSidebarOpen(true)} menuSiempre={pantallaCompleta} />

          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {/* En pantalla completa el menú lateral se despliega encima (el mapa usa todo el ancho). */}
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} flotante={pantallaCompleta} />

            <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
              {!pantallaCompleta && <BarraRuta />}

              {pantallaCompleta ? (
                <main className="relative min-h-0 flex-1 overflow-hidden">
                  <Suspense fallback={<p className="p-4 text-sm text-slate-500">Cargando…</p>}>
                    <Outlet />
                  </Suspense>
                </main>
              ) : (
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                  <div className="mx-auto max-w-7xl">
                    <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
                      <Outlet />
                    </Suspense>
                  </div>
                </main>
              )}
            </div>
          </div>
        </div>
      </NotificacionesProvider>
    </DominioProvider>
  )
}
