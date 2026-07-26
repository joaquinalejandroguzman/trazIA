import { useState, useCallback, useRef } from 'react'
import apiClient from '../services/api_client'
import type { ChatMessage, ChatRequest, ChatResponse, ModuleNode } from '../types'

// Opciones de configuración para el hook de chat
interface UseChatOptions {
  modules: ModuleNode[]
  readme?: string
}

// Retorno del hook: estado + acciones
interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  analyzingModules: string[] | null
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void
}

// Mensaje de bienvenida que se muestra al abrir el chat
const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de TrazIA. Podés preguntarme sobre la estructura del repositorio, sus módulos, dependencias o integraciones. ¿En qué te puedo ayudar?',
}

// Hook principal que gestiona el estado del chat contextual y la comunicación con el backend
export function useChat(options: UseChatOptions): UseChatReturn {
  const { modules, readme } = options

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzingModules, setAnalyzingModules] = useState<string[] | null>(null)

  // Mantener sessionId estable entre re-renders con useRef
  const sessionIdRef = useRef<string>(crypto.randomUUID())

  // Envía un mensaje al backend y actualiza el estado local (optimistic UI)
  const sendMessage = useCallback(async (text: string): Promise<void> => {
    // Agregar mensaje del usuario inmediatamente (optimistic UI)
    const userMessage: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)
    setAnalyzingModules(null)

    try {
      const payload: ChatRequest = {
        message: text,
        modules,
        readme,
        sessionId: sessionIdRef.current,
      }

      const response = await apiClient.post<ChatResponse>('/api/chat', payload)

      // Actualizar analyzingModules si la respuesta incluye módulos analizados
      const responseModules = response.data.analyzingModules
      if (responseModules && responseModules.length > 0) {
        setAnalyzingModules(responseModules)
      } else {
        setAnalyzingModules(null)
      }

      // Agregar respuesta del asistente al estado local
      const assistantMessage: ChatMessage = { role: 'assistant', content: response.data.reply }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al enviar el mensaje. Intentá de nuevo.'
      setError(message)
      setAnalyzingModules(null)
    } finally {
      setIsLoading(false)
    }
  }, [modules, readme])

  // Resetea la conversación y genera un nuevo sessionId
  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
    setError(null)
    setAnalyzingModules(null)
    sessionIdRef.current = crypto.randomUUID()
  }, [])

  return {
    messages,
    isLoading,
    error,
    analyzingModules,
    sendMessage,
    clearChat,
  }
}
