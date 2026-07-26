import { Router, type Request, type Response } from 'express'
import type { AnalyzeRequest, AnalysisResult } from '../shared/types'
import { cloneRepository, cleanupClonedRepo } from '../services/git_cloner'
import { analyzeRepository } from '../agents/analyzer/analyzer'
import { detectRepositoryIntegrations } from '../agents/integrations/integrations'
import { buildAnalysisResult } from '../agents/orchestrator/orchestrator'

const router = Router()

// POST /api/analyze — clona un repositorio y analiza su arquitectura e integraciones
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

    // Paso 2: Analizar estructura (módulos + dependencias internas)
    const { modules, readme } = await analyzeRepository(clonedPath)

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'analyzer',
      mensaje: `Análisis de estructura completo: ${modules.length} módulos detectados`,
    }))

    // Paso 3: Detectar integraciones externas (BD, APIs, SDKs)
    const integrations = await detectRepositoryIntegrations(clonedPath)

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'integrations',
      mensaje: `Integraciones detectadas: ${integrations.length}`,
    }))

    // Paso 4: Orquestar — combinar estructura + integraciones en el grafo final
    const result: AnalysisResult = buildAnalysisResult(repoUrl.trim(), modules, integrations, readme)

    console.log(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'orchestrator',
      mensaje: `Grafo armado: ${result.totalModules} módulos, ${result.totalIntegrations} integraciones, ${result.edges.length} aristas`,
    }))

    res.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'

    console.error(JSON.stringify({
      agente: 'analyze-route',
      módulo: 'error',
      error: message,
    }))

    // Detectar errores específicos para retornar códigos HTTP apropiados
    if (message.includes('Variable de entorno requerida no definida')) {
      res.status(503).json({ error: `Servicio de IA no disponible: ${message}` })
      return
    }
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
      await cleanupClonedRepo(clonedPath)
    }
  }
})

export default router
