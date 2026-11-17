import { RouterProvider } from 'react-router'
import { SesionProvider } from '@/features/auth/SesionProvider'
import { QueryProvider } from './providers/QueryProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { router } from './router'

export function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        {/* La sesión va afuera del router: el login y las rutas protegidas la leen. */}
        <SesionProvider>
          <RouterProvider router={router} />
        </SesionProvider>
      </ThemeProvider>
    </QueryProvider>
  )
}
