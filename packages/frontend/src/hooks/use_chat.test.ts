import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from './use_chat'
import type { ModuleNode } from '../types'

// Mock del apiClient
vi.mock('../services/api_client', () => ({
  default: {
    post: vi.fn(),
  },
}))

import apiClient from '../services/api_client'

const mockPost = vi.mocked(apiClient.post)

// Mock de crypto.randomUUID
const mockUUID = vi.fn(() => 'test-session-id-1234')
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: mockUUID },
})

// Módulos de ejemplo para los tests
const sampleModules: ModuleNode[] = [
  {
    id: 'src/app.ts',
    name: 'app',
    type: 'module',
    dependencies: ['src/routes/index.ts'],
    path: 'src/app.ts',
  },
]

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUUID.mockReturnValue('test-session-id-1234')
  })

  it('inicializa con mensaje de bienvenida', () => {
    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].content).toContain('TrazIA')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.analyzingModules).toBeNull()
  })

  it('genera sessionId al montar', () => {
    renderHook(() => useChat({ modules: sampleModules }))
    expect(mockUUID).toHaveBeenCalled()
  })

  it('sendMessage agrega mensaje del usuario inmediatamente (optimistic UI)', async () => {
    mockPost.mockResolvedValue({ data: { reply: 'Respuesta del asistente', sessionId: 'test-session-id-1234' } })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('Hola, ¿qué módulos hay?')
    })

    // El mensaje del usuario debe estar después del bienvenida
    expect(result.current.messages[1]).toEqual({
      role: 'user',
      content: 'Hola, ¿qué módulos hay?',
    })
  })

  it('sendMessage agrega reply del backend al estado', async () => {
    mockPost.mockResolvedValue({ data: { reply: 'Tenés 3 módulos principales.', sessionId: 'test-session-id-1234' } })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('¿Cuántos módulos hay?')
    })

    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages[2]).toEqual({
      role: 'assistant',
      content: 'Tenés 3 módulos principales.',
    })
  })

  it('setea isLoading durante la petición', async () => {
    let resolvePost: (value: unknown) => void
    mockPost.mockReturnValue(new Promise((resolve) => { resolvePost = resolve }))

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    // Iniciar envío sin esperar
    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('test')
    })

    // Durante la petición, isLoading debe ser true
    expect(result.current.isLoading).toBe(true)

    // Resolver la promesa
    await act(async () => {
      resolvePost!({ data: { reply: 'ok', sessionId: 'test-session-id-1234' } })
      await sendPromise
    })

    // Después de la respuesta, isLoading debe ser false
    expect(result.current.isLoading).toBe(false)
  })

  it('setea error con mensaje legible si la petición falla', async () => {
    mockPost.mockRejectedValue(new Error('No se pudo conectar con el servidor.'))

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('test')
    })

    expect(result.current.error).toBe('No se pudo conectar con el servidor.')
    expect(result.current.isLoading).toBe(false)
  })

  it('envía POST /api/chat con payload correcto', async () => {
    mockPost.mockResolvedValue({ data: { reply: 'ok', sessionId: 'test-session-id-1234' } })

    const { result } = renderHook(() => useChat({ modules: sampleModules, readme: '# Mi Proyecto' }))

    await act(async () => {
      await result.current.sendMessage('¿Qué hace app.ts?')
    })

    expect(mockPost).toHaveBeenCalledWith('/api/chat', {
      message: '¿Qué hace app.ts?',
      modules: sampleModules,
      readme: '# Mi Proyecto',
      sessionId: 'test-session-id-1234',
    })
  })

  it('clearChat resetea messages y genera nuevo sessionId', async () => {
    mockPost.mockResolvedValue({ data: { reply: 'Respuesta', sessionId: 'test-session-id-1234' } })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    // Enviar un mensaje primero (welcome + user + assistant = 3)
    await act(async () => {
      await result.current.sendMessage('test')
    })
    expect(result.current.messages).toHaveLength(3)

    // Configurar nuevo UUID para después del clearChat
    mockUUID.mockReturnValue('new-session-id-5678')

    // Limpiar chat — resetea al mensaje de bienvenida
    act(() => {
      result.current.clearChat()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.error).toBeNull()

    // Verificar que el nuevo sessionId se usa en el próximo envío
    await act(async () => {
      await result.current.sendMessage('después de clear')
    })

    expect(mockPost).toHaveBeenLastCalledWith('/api/chat', expect.objectContaining({
      sessionId: 'new-session-id-5678',
    }))
  })

  it('clearChat limpia también el error', async () => {
    mockPost.mockRejectedValue(new Error('Error de red'))

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('test')
    })
    expect(result.current.error).not.toBeNull()

    act(() => {
      result.current.clearChat()
    })

    expect(result.current.error).toBeNull()
  })

  it('setea analyzingModules cuando la respuesta contiene módulos y persiste hasta el próximo sendMessage', async () => {
    mockPost.mockResolvedValue({
      data: { reply: 'Analizando...', sessionId: 'test-session-id-1234', analyzingModules: ['app', 'router'] },
    })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('¿Qué hace el repo?')
    })

    // analyzingModules persiste después de la respuesta (ya no se resetea en el mismo handler)
    expect(result.current.analyzingModules).toEqual(['app', 'router'])

    // Se limpia al inicio del siguiente sendMessage
    mockPost.mockResolvedValue({
      data: { reply: 'Otra respuesta', sessionId: 'test-session-id-1234' },
    })

    await act(async () => {
      await result.current.sendMessage('Otra pregunta')
    })

    // Sin módulos en la segunda respuesta → queda null
    expect(result.current.analyzingModules).toBeNull()
  })

  it('mantiene analyzingModules en null cuando la respuesta no incluye módulos', async () => {
    mockPost.mockResolvedValue({
      data: { reply: 'Hola!', sessionId: 'test-session-id-1234' },
    })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('Hola')
    })

    expect(result.current.analyzingModules).toBeNull()
  })

  it('mantiene analyzingModules en null cuando analyzingModules es array vacío', async () => {
    mockPost.mockResolvedValue({
      data: { reply: 'Ok', sessionId: 'test-session-id-1234', analyzingModules: [] },
    })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('test')
    })

    expect(result.current.analyzingModules).toBeNull()
  })

  it('resetea analyzingModules a null cuando hay error', async () => {
    mockPost.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('test')
    })

    expect(result.current.analyzingModules).toBeNull()
  })

  it('clearChat resetea analyzingModules a null', async () => {
    mockPost.mockResolvedValue({
      data: { reply: 'ok', sessionId: 'test-session-id-1234', analyzingModules: ['app'] },
    })

    const { result } = renderHook(() => useChat({ modules: sampleModules }))

    await act(async () => {
      await result.current.sendMessage('test')
    })

    act(() => {
      result.current.clearChat()
    })

    expect(result.current.analyzingModules).toBeNull()
  })
})
