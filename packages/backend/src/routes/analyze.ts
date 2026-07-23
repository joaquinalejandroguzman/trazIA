import { Router, type Request, type Response } from 'express'
import type { AnalyzeRequest, AnalysisResult } from '../shared/types'

const router = Router()

// POST /api/analyze — inicia el análisis completo de un repositorio
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body as AnalyzeRequest

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: 'repoUrl es requerido y debe ser un string' })
      return
    }

    // TODO: implementar flujo completo
    // 1. Clonar repositorio (o validar acceso si es GitHub)
    // 2. Invocar Agente Analizador (Lambda)
    // 3. Invocar Agente Orquestador (Lambda) — calcula Spec Health Score
    // 4. Retornar AnalysisResult

    const mockResult: AnalysisResult = {
      repoUrl,
      analyzedAt: new Date().toISOString(),
      projectHealthScore: 0,
      modules: [],
      totalModules: 0,
      tracedCount: 0,
      driftCount: 0,
      untracedCount: 0,
    }

    res.json(mockResult)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    res.status(500).json({ error: `Error al analizar repositorio: ${message}` })
  }
})

export default router
