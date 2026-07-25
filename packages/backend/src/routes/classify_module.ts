import { Router, type Request, type Response } from 'express'
import { bedrockClient, BEDROCK_MODEL_ANALYZER } from '../clients/bedrock_client'
import { withLlmRetry } from '../shared/llm_retry'
import { parseHaikuClassification } from '../agents/analyzer/analyzer'
import type { SpecStatus } from '../shared/types'

const router = Router()

// Cuerpo esperado en la request
interface ClassifyModuleRequest {
  moduleId: string      // ruta relativa del archivo (ej: "src/services/payment.ts")
  sourceContent: string // contenido del archivo (puede venir truncado)
}

// Respuesta del endpoint
interface ClassifyModuleResponse {
  moduleId: string
  specStatus: SpecStatus
  specHealthScore: number
}

/**
 * POST /api/classify-module
 * Clasifica un módulo con Claude Haiku vía Bedrock y retorna su specStatus y specHealthScore.
 * Se llama on-demand cuando el usuario hace click en un nodo del grafo.
 */
router.post('/classify-module', async (req: Request, res: Response) => {
  const { moduleId, sourceContent } = req.body as ClassifyModuleRequest

  // Validaciones básicas
  if (!moduleId || typeof moduleId !== 'string') {
    res.status(400).json({ error: 'moduleId es requerido y debe ser un string' })
    return
  }
  if (typeof sourceContent !== 'string') {
    res.status(400).json({ error: 'sourceContent debe ser un string' })
    return
  }

  // Truncar a 4000 chars para no exceder el contexto de Haiku
  const truncatedContent = sourceContent.slice(0, 4000)

  try {
    const prompt = `Eres un analizador de código. Dado el siguiente fragmento de código fuente, determina:
1. specStatus: si el módulo tiene una especificación actualizada ("traced"), desincronizada ("drift") o sin especificación ("untraced").
2. specHealthScore: un entero del 0 al 100 que refleja la calidad y cobertura de la spec.

Responde ÚNICAMENTE con JSON válido en este formato:
{"specStatus": "traced"|"drift"|"untraced", "specHealthScore": <número 0-100>}

Código del módulo (${moduleId}):
${truncatedContent}`

    const response = await withLlmRetry(
      () =>
        bedrockClient.messages.create({
          model: BEDROCK_MODEL_ANALYZER,
          // eslint-disable-next-line camelcase
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      { agente: 'classify-module', módulo: moduleId }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const classification = parseHaikuClassification(text)

    console.log(JSON.stringify({
      agente: 'classify-module',
      módulo: moduleId,
      resultado: classification,
    }))

    const result: ClassifyModuleResponse = {
      moduleId,
      specStatus: classification.specStatus,
      specHealthScore: classification.specHealthScore,
    }

    res.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'

    console.error(JSON.stringify({
      agente: 'classify-module',
      módulo: moduleId,
      error: message,
    }))

    if (message.includes('Variable de entorno requerida no definida')) {
      res.status(503).json({ error: `Servicio de IA no disponible: ${message}` })
      return
    }

    res.status(500).json({ error: `Error al clasificar módulo: ${message}` })
  }
})

export default router
