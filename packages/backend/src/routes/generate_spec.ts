import { Router, type Request, type Response } from 'express'

const router = Router()

// POST /api/generate-spec — placeholder para funcionalidad futura
// En el MVP actual, el endpoint principal es /api/analyze (pipeline completo).
// Este endpoint se mantiene como stub para no romper el frontend existente.
router.post('/generate-spec', async (_req: Request, res: Response) => {
  res.status(501).json({
    error: 'Funcionalidad no disponible en el MVP. Usa /api/analyze para el pipeline completo.',
  })
})

export default router
