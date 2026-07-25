// Ruta POST /api/chat — endpoint principal del chat contextual
// Valida, sanitiza, clasifica intención y orquesta la generación de respuestas

import crypto from 'crypto'
import { Router, type Request, type Response } from 'express'
import { bedrockClient } from '../clients/bedrock_client'
import { classifyIntent } from '../agents/chat/router'
import { buildRepoContext, detectMentionedModule } from '../agents/chat/context_builder'
import { CHAT_SYSTEM_PROMPT, FIXED_REPLIES } from '../agents/chat/prompt'
import { getHistory, addToHistory } from '../agents/chat/history'
import { withLlmRetry } from '../shared/llm_retry'
import type { ModuleNode } from '../shared/types'

/** Modelo de chat — Haiku para respuestas rápidas y económicas */
const CHAT_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'

/** Temperature baja para respuestas factuales y consistentes */
const CHAT_TEMPERATURE = 0.3

/** Timeout máximo para la invocación al LLM (30 segundos) */
const CHAT_TIMEOUT_MS = 30_000

/** Máximo de tokens en la respuesta generada */
const CHAT_MAX_TOKENS = 1024

/** Largo máximo del mensaje del usuario antes de truncar */
const MAX_MESSAGE_LENGTH = 1000

/** Interfaz del request del chat */
interface ChatRequest {
  message: string
  modules: ModuleNode[]
  readme?: string
  sessionId?: string
}

/** Interfaz del response del chat */
interface ChatResponse {
  reply: string
  sessionId: string
}

const router = Router()

// POST /api/chat — recibe un mensaje del usuario y genera una respuesta contextual
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, modules, readme, sessionId: incomingSessionId } = req.body as ChatRequest

    // Validar que message exista y no esté vacío
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'El campo message es requerido y no puede estar vacío' })
      return
    }

    // Validar que modules exista y sea un array
    if (!modules || !Array.isArray(modules)) {
      res.status(400).json({ error: 'El campo modules es requerido y debe ser un array' })
      return
    }

    // Sanitizar: truncar mensaje a MAX_MESSAGE_LENGTH caracteres
    const truncatedMessage = message.slice(0, MAX_MESSAGE_LENGTH)

    // Generar sessionId si no viene en el request
    const sessionId = incomingSessionId || crypto.randomUUID()

    // Clasificar intención del mensaje
    const intent = classifyIntent(truncatedMessage)

    // Respuestas fijas para saludo, jailbreak y offtopic (sin invocar al LLM)
    if (intent === 'saludo' || intent === 'jailbreak' || intent === 'offtopic') {
      const response: ChatResponse = {
        reply: FIXED_REPLIES[intent],
        sessionId,
      }
      res.json(response)
      return
    }

    // intent === 'pregunta_repo' — requiere invocación al LLM
    // Detectar si el mensaje menciona un módulo específico
    const detectedModule = detectMentionedModule(truncatedMessage, modules)

    // Construir contexto del repositorio
    const repoContext = buildRepoContext(modules, {
      readme,
      focusModule: detectedModule ?? undefined,
    })

    // Obtener historial de la sesión
    const history = getHistory(sessionId)

    // Configurar AbortController con timeout de 30s
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

    let reply: string

    try {
      // Invocar LLM con retry para errores transitorios
      const llmResponse = await withLlmRetry(
        () =>
          bedrockClient.messages.create(
            {
              model: CHAT_MODEL,
              max_tokens: CHAT_MAX_TOKENS,
              temperature: CHAT_TEMPERATURE,
              system: `${CHAT_SYSTEM_PROMPT}\n\n--- Contexto del Repositorio ---\n${repoContext}`,
              messages: [
                ...history.map((msg) => ({
                  role: msg.role as 'user' | 'assistant',
                  content: msg.content,
                })),
                { role: 'user' as const, content: truncatedMessage },
              ],
            },
            { signal: controller.signal }
          ),
        { agente: 'chat', módulo: 'llm-invocation' }
      )

      clearTimeout(timeoutId)

      // Extraer texto de la respuesta del LLM
      const textBlock = llmResponse.content.find(
        (block: { type: string }) => block.type === 'text'
      )
      reply = textBlock && 'text' in textBlock ? (textBlock as { type: 'text'; text: string }).text : 'No pude generar una respuesta.'
    } catch (error: unknown) {
      clearTimeout(timeoutId)

      // Verificar si fue un timeout (abort)
      if (error instanceof Error && error.name === 'AbortError') {
        const response: ChatResponse = {
          reply: 'La respuesta tardó demasiado. Intentá con una pregunta más corta.',
          sessionId,
        }
        res.json(response)
        return
      }

      // Error no transitorio del LLM (ya pasó por withLlmRetry)
      console.error(JSON.stringify({
        agente: 'chat-route',
        módulo: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido',
      }))

      const response: ChatResponse = {
        reply: 'Error al generar respuesta. Intentá de nuevo.',
        sessionId,
      }
      res.json(response)
      return
    }

    // Actualizar historial con el mensaje del usuario y la respuesta del asistente
    addToHistory(sessionId, { role: 'user', content: truncatedMessage })
    addToHistory(sessionId, { role: 'assistant', content: reply })

    const response: ChatResponse = {
      reply,
      sessionId,
    }
    res.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'

    console.error(JSON.stringify({
      agente: 'chat-route',
      módulo: 'error',
      error: message,
    }))

    res.status(500).json({ error: `Error interno del servidor: ${message}` })
  }
})

export default router
