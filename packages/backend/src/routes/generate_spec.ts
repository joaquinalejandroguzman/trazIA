import { Router, type Request, type Response } from 'express'
import type { GenerateSpecResponse } from '../shared/types'

const router = Router()

// POST /api/generate-spec — genera spec EARS on-demand para un módulo sin trazabilidad
router.post('/generate-spec', async (req: Request, res: Response) => {
  try {
    const { moduleId, repoUrl } = req.body as { moduleId: string; repoUrl: string }

    if (!moduleId || typeof moduleId !== 'string') {
      res.status(400).json({ error: 'moduleId es requerido y debe ser un string' })
      return
    }

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: 'repoUrl es requerido y debe ser un string' })
      return
    }

    // TODO: implementar generación de spec
    // 1. Recuperar código del módulo
    // 2. Invocar Agente Redactor EARS (Lambda)
    // 3. Guardar spec en .kiro/specs/
    // 4. Retornar GenerateSpecResponse

    const mockResponse: GenerateSpecResponse = {
      moduleId,
      specContent: '# Spec generada\n\n**WHEN** ...\n**THEN** el sistema **SHALL** ...',
      savedPath: `.kiro/specs/${moduleId.replace(/\//g, '_')}.md`,
    }

    res.json(mockResponse)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    res.status(500).json({ error: `Error al generar spec: ${message}` })
  }
})

export default router
