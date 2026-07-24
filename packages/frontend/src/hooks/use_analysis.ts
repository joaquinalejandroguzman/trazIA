import { useState, useCallback } from 'react'
import apiClient from '../services/api_client'
import { SAMPLE_ANALYSIS } from '../mocks/sample_analysis'
import type {
  AnalysisResult,
  AnalysisStatus,
  GenerateSpecResponse,
  ModuleNode,
} from '../types'

// Activa datos mock cuando el backend no está disponible (variable de entorno o fallback automático)
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Simula un delay de red realista en modo mock
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Hook principal que gestiona el ciclo de vida del análisis de un repo
export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingSpec, setGeneratingSpec] = useState<string | null>(null) // moduleId en progreso

  // Dispara el análisis completo del repo
  const analyzeRepo = useCallback(async (repoUrl: string) => {
    setStatus('loading')
    setError(null)
    setResult(null)

    // Modo mock: simula respuesta del backend con datos de ejemplo
    if (USE_MOCK) {
      await sleep(1800) // simula latencia del agente
      setResult({ ...SAMPLE_ANALYSIS, repoUrl })
      setStatus('success')
      return
    }

    try {
      const response = await apiClient.post<AnalysisResult>('/api/analyze', { repoUrl })
      setResult(response.data)
      setStatus('success')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al analizar el repositorio'
      setError(message)
      setStatus('error')
    }
  }, [])

  // Genera la spec EARS on-demand para un módulo sin trazabilidad
  const generateSpec = useCallback(
    async (moduleId: string): Promise<GenerateSpecResponse | null> => {
      setGeneratingSpec(moduleId)

      // Modo mock: genera spec de ejemplo con delay simulado
      if (USE_MOCK) {
        await sleep(2200)
        const mockSpec = `# Spec generada para ${moduleId}

**WHEN** el módulo es invocado con parámetros válidos
**THEN** el sistema **SHALL** procesar la petición y retornar el resultado esperado

**IF** los parámetros son inválidos
**THEN** el sistema **SHALL** lanzar un error descriptivo con contexto

**WHERE** el módulo interactúa con servicios externos
**THE** sistema **SHALL** manejar timeouts y errores de red con reintentos`

        const mockResponse: GenerateSpecResponse = {
          moduleId,
          specContent: mockSpec,
          savedPath: `.kiro/specs/${moduleId.replace(/\//g, '_')}.md`,
        }

        if (result) {
          const updatedModules: ModuleNode[] = result.modules.map((m) =>
            m.id === moduleId
              ? {
                  ...m,
                  specStatus: 'traced' as const,
                  specHealthScore: 78,
                  specContent: mockSpec,
                }
              : m
          )
          const newTracedCount = result.tracedCount + 1
          const newUntracedCount = Math.max(0, result.untracedCount - 1)
          setResult({
            ...result,
            modules: updatedModules,
            tracedCount: newTracedCount,
            untracedCount: newUntracedCount,
            projectHealthScore: Math.round(
              ((newTracedCount * 100 + result.driftCount * 60) / result.totalModules)
            ),
          })
        }

        setGeneratingSpec(null)
        return mockResponse
      }

      try {
        const response = await apiClient.post<GenerateSpecResponse>('/api/generate-spec', {
          moduleId,
          repoUrl: result?.repoUrl,
        })

        // Actualiza el módulo en el resultado local con la spec generada
        if (result) {
          const updatedModules: ModuleNode[] = result.modules.map((m) =>
            m.id === moduleId
              ? { ...m, specStatus: 'traced' as const, specContent: response.data.specContent }
              : m
          )
          setResult({ ...result, modules: updatedModules })
        }

        return response.data
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Error al generar spec'
        setError(message)
        return null
      } finally {
        setGeneratingSpec(null)
      }
    },
    [result]
  )

  // Limpia solo el error sin tocar el análisis en curso ni el resultado
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Resetea el estado completo para analizar un nuevo repo
  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setGeneratingSpec(null)
  }, [])

  return {
    status,
    result,
    error,
    generatingSpec,
    analyzeRepo,
    generateSpec,
    clearError,
    reset,
  }
}
