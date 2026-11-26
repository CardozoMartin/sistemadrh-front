import { beforeEach, describe, expect, it, vi } from 'vitest'

// El cliente HTTP real no se usa: se verifica a qué endpoint va cada acción y con qué cuerpo.
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/services/api/backend', () => ({ backend: { get, post } }))

const { anulacionApi } = await import('./api')

const ID = 'exp-1'
const RESPUESTA = { expediente: { id: ID } }

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: RESPUESTA })
  post.mockReset().mockResolvedValue({ data: RESPUESTA })
})

describe('anulacionApi: consultas', () => {
  it('devuelve solo el cuerpo de la respuesta', async () => {
    await expect(anulacionApi.obtener(ID)).resolves.toBe(RESPUESTA)
    expect(get).toHaveBeenCalledWith(`/tramites/anulacion/${ID}`)
  })

  it('checklist del catálogo de ANULACION', async () => {
    await anulacionApi.checklist()
    expect(get).toHaveBeenCalledWith('/catalogos/documentos/ANULACION')
  })

  it('listar: en trámite por defecto; con `todos`, también las terminadas', async () => {
    await anulacionApi.listar()
    expect(get).toHaveBeenLastCalledWith('/tramites/anulacion', { params: undefined })
    await anulacionApi.listar(true)
    expect(get).toHaveBeenLastCalledWith('/tramites/anulacion', { params: { todos: true } })
  })

  it('el PDF de la resolución se pide como blob', async () => {
    await anulacionApi.archivoResolucion(ID)
    expect(get).toHaveBeenCalledWith(`/tramites/anulacion/${ID}/resolucion/archivo`, { responseType: 'blob' })
  })
})

describe('anulacionApi: acciones', () => {
  it('iniciar manda el DTO tal cual', async () => {
    const dto = { concesionId: '15', expediente: { numero: '123', reparticion: '332', anio: 2026 }, documentacionPresentada: [1], motivo: 'Renuncia del titular' }
    await anulacionApi.iniciar(dto)
    expect(post).toHaveBeenCalledWith('/tramites/anulacion', dto)
  })

  it('cancelar manda el motivo como observaciones', async () => {
    await anulacionApi.cancelar(ID, 'Iniciada por error de carga')
    expect(post).toHaveBeenCalledWith(`/tramites/anulacion/${ID}/cancelar`, { observaciones: 'Iniciada por error de carga' })
  })

  it('enviar a Recaudación', async () => {
    await anulacionApi.enviar(ID)
    expect(post).toHaveBeenCalledWith(`/tramites/anulacion/${ID}/enviar`, {})
  })

  it('tomar el expediente (común a todos los trámites)', async () => {
    await anulacionApi.tomar(ID)
    expect(post).toHaveBeenCalledWith(`/expedientes/${ID}/tomar`)
  })

  it('dictaminar va a la oficina que dictamina', async () => {
    const dto = { resultado: 'apto', observaciones: 'Sin observaciones técnicas' } as never
    await anulacionApi.dictaminar(ID, 'distrito', dto)
    expect(post).toHaveBeenLastCalledWith(`/tramites/anulacion/${ID}/distrito`, dto)
    await anulacionApi.dictaminar(ID, 'juridico', dto)
    expect(post).toHaveBeenLastCalledWith(`/tramites/anulacion/${ID}/juridico`, dto)
  })

  it('resolución: multipart con el PDF', async () => {
    const archivo = new File(['%PDF'], 'resolucion.pdf', { type: 'application/pdf' })
    await anulacionApi.resolucion(ID, { numero: '279', anio: 2026, fecha: '2026-11-10', archivo })
    const [url, form, opciones] = post.mock.calls[0]
    expect(url).toBe(`/tramites/anulacion/${ID}/resolucion`)
    expect(form).toBeInstanceOf(FormData)
    expect((form as FormData).get('numero')).toBe('279')
    expect(opciones).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('verificación final (baja): con o sin observaciones', async () => {
    await anulacionApi.verificacionFinal(ID, 'Cotejada con el expediente')
    expect(post).toHaveBeenLastCalledWith(`/tramites/anulacion/${ID}/verificacion-final`, { observaciones: 'Cotejada con el expediente' })
    await anulacionApi.verificacionFinal(ID)
    expect(post).toHaveBeenLastCalledWith(`/tramites/anulacion/${ID}/verificacion-final`, { observaciones: undefined })
  })

  it('si el backend rechaza, el error llega a quien llamó', async () => {
    post.mockRejectedValueOnce(new Error('La concesión ya está anulada'))
    await expect(anulacionApi.verificacionFinal(ID)).rejects.toThrow('La concesión ya está anulada')
  })
})
