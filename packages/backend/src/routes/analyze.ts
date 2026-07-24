import { Router, type Request, type Response } from 'express'
import type { AnalyzeRequest, AnalysisResult } from '../shared/types'
import { cloneRepository, cleanupClonedRepo } from '../services/git_cloner'
import { analyzeRepository } from '../agents/analyzer/analyzer'

const router = Router()

// POST /api/analyze — clona un repositorio y analiza su arquitectura
router.post('/analyze', async (req: Request, res: Response) => {
  let clonedPath: string | null = null

  try {
    const { repoUrl } = req.body as AnalyzeRequest

    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: 'repoUrl es requerido y debe ser un string' })
      return
    }

    // Validar formato URL de GitHub
    if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(repoUrl.trim())) {
      res.status(400).json({ error: 'Solo se soportan repositorios públicos de GitHub' })
      return
    }

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'analyze',
      mensaje: `Iniciando análisis de ${repoUrl}`,
    }))

    // Paso 1: Clonar repositorio
    clonedPath = await cloneRepository(repoUrl)

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'git-cloner',
      mensaje: `Repositorio clonado en ${clonedPath}`,
    }))

    // Paso 2: Analizar estructura (módulos + dependencias)
    const modules = await analyzeRepository(clonedPath)

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'analyzer',
      mensaje: `Análisis completo: ${modules.length} módulos detectados`,
    }))

    // Paso 3: Calcular conteos por estado
    // (Sin el Orquestador, todos los módulos empiezan como 'untraced')
    const tracedCount = modules.filter((m) => m.specStatus === 'traced').length
    const driftCount = modules.filter((m) => m.specStatus === 'drift').length
    const untracedCount = modules.filter((m) => m.specStatus === 'untraced').length

    // Calcular score del proyecto (por ahora: proporción de traced * 100)
    const projectHealthScore = modules.length > 0
      ? Math.round((tracedCount * 100 + driftCount * 60) / modules.length)
      : 0

    const result: AnalysisResult = {
      repoUrl: repoUrl.trim(),
      analyzedAt: new Date().toISOString(),
      projectHealthScore,
      modules,
      totalModules: modules.length,
      tracedCount,
      driftCount,
      untracedCount,
    }

    res.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'

    console.error(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'error',
      error: message,
    }))

    // Detectar errores específicos para retornar códigos HTTP apropiados
    if (message.includes('no encontrado') || message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('privado') || message.includes('autenticación')) {
      res.status(403).json({ error: message })
      return
    }

    res.status(500).json({ error: `Error al analizar repositorio: ${message}` })
  } finally {
    // Limpiar repo clonado del disco temporal
    if (clonedPath) {
      cleanupClonedRepo(clonedPath)
    }
  }
})

export default router
