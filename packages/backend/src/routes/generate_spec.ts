import { Router, type Request, type Response } from 'express'
import { generateEarsSpec } from '../agents/ears_writer/ears_writer'

const router = Router()

// POST /api/generate-spec — genera spec EARS on-demand para un módulo individual
router.post('/generate-spec', async (req: Request, res: Response) => {
  try {
    const { moduleId, moduleName, sourceContent } = req.body

    // Validar campos requeridos: non-empty strings
    if (!moduleId || typeof moduleId !== 'string' || moduleId.trim() === '') {
      res.status(400).json({ error: "Campo 'moduleId' es requerido y debe ser un string no vacío" })
      return
    }
    if (!moduleName || typeof moduleName !== 'string' || moduleName.trim() === '') {
      res.status(400).json({ error: "Campo 'moduleName' es requerido y debe ser un string no vacío" })
      return
    }
    if (!sourceContent || typeof sourceContent !== 'string' || sourceContent.trim() === '') {
      res.status(400).json({ error: "Campo 'sourceContent' es requerido y debe ser un string no vacío" })
      return
    }

    // Validar longitud máxima de sourceContent
    if (sourceContent.length > 100_000) {
      res.status(400).json({ error: 'sourceContent excede el límite de 100,000 caracteres' })
      return
    }

    // Invocar agente EARS Writer (sin retry wrapper adicional — ya tiene withLlmRetry internamente)
    const resultado = await generateEarsSpec(moduleName, sourceContent)

    // Si el resultado empieza con el prefijo de error, retornar 502
    if (resultado.startsWith('> ⚠️')) {
      res.status(502).json({ error: `Error upstream al generar spec: ${resultado}` })
      return
    }

    // Respuesta exitosa
    res.status(200).json({ moduleId, earsSpec: resultado })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ agente: 'generate-spec', módulo: req.body?.moduleName, error: mensaje }))
    res.status(500).json({ error: 'Error interno al generar spec' })
  }
})

export default router
