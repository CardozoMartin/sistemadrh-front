import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ListaBajas } from '../components/ListaBajas'

/** Bajas de pozo: las que están en trámite (o todas) y el botón para iniciar una nueva. */
export default function BajasPozoPage() {
  const navigate = useNavigate()
  const [todas, setTodas] = useState(false)
  return (
    <>
      <PageHeader
        title="Bajas de pozo en trámite"
        description="Las bajas a solicitud del titular recorren Pozos → Distrito → Jurídico → Secretaría General, que con la resolución da de baja el pozo. Las de oficio son directas: aparecen al incluir las terminadas."
        actions={
          <Button iconLeft="search" onClick={() => navigate(ROUTES.pozo.bajas)}>
            Buscar pozo para dar de baja
          </Button>
        }
      />
      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{todas ? 'Todas las bajas' : 'Bajas en trámite'}</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-4 rounded border-slate-300" />
            Incluir las terminadas
          </label>
        </div>
        <ListaBajas todas={todas} />
      </Card>
    </>
  )
}
