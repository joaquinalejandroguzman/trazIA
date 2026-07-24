import { useState, useCallback } from 'react'
import apiClient from '../services/api_client'
import { SAMPLE_ANALYSIS } from '../mocks/sample_analysis'
import type { AnalysisResult, AnalysisStatus, ModuleNode, GenerateSpecResponse } from '../types'

// Activa datos mock cuando el backend no está disponible
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Timeout para la generación de spec on-demand (30 segundos)
const GENERATE_SPEC_TIMEOUT_MS = 30_000

// Simula un delay de red realista en modo mock
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Hook principal que gestiona el ciclo de vida del análisis de un repo
export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatingSpec, setGeneratingSpec] = useState<string | null>(null)
  const [specErrorModules, setSpecErrorModules] = useState<Set<string>>(new Set())

  // Dispara el análisis completo del repo (pipeline: Analizador → Integraciones → Orquestador)
  const analyzeRepo = useCallback(async (repoUrl: string) => {
    setStatus('loading')
    setError(null)
    setResult(null)
    setSpecErrorModules(new Set())

    // Modo mock: simula respuesta del backend con datos de ejemplo
    if (USE_MOCK) {
      await sleep(1800) // simula latencia del pipeline de agentes
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

  // Genera la spec EARS on-demand para un módulo individual
  const generateSpec = useCallback(
    async (moduleId: string): Promise<GenerateSpecResponse | null> => {
      // Guard: módulo no encontrado en el resultado
      if (!result) return null
      const module = result.modules.find((m) => m.id === moduleId)
      if (!module) return null

      // Guard: cache hit — ya tiene earsSpec generada
      if (module.earsSpec) {
        return { moduleId, earsSpec: module.earsSpec }
      }

      // Guard: sourceContent vacío o undefined — no se puede generar
      if (!module.sourceContent) return null

      // Guard: módulo con error previo — bloqueado hasta que el usuario limpie el error
      if (specErrorModules.has(moduleId)) return null

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
          earsSpec: mockSpec,
        }

        // Actualizar solo earsSpec del módulo, sin tocar specStatus ni specHealthScore
        setResult((prev) => {
          if (!prev) return prev
          const updatedModules: ModuleNode[] = prev.modules.map((m) =>
            m.id === moduleId ? { ...m, earsSpec: mockSpec } : m
          )
          return { ...prev, modules: updatedModules }
        })

        setGeneratingSpec(null)
        return mockResponse
      }

      // Configurar AbortController con timeout de 30 segundos
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GENERATE_SPEC_TIMEOUT_MS)

      try {
        const response = await apiClient.post<GenerateSpecResponse>(
          '/api/generate-spec',
          { moduleId, moduleName: module.name, sourceContent: module.sourceContent },
          { signal: controller.signal, _skipRetry: true } as never
        )

        clearTimeout(timeoutId)

        // Éxito: actualizar solo module.earsSpec, NO modificar specStatus ni specHealthScore
        setResult((prev) => {
          if (!prev) return prev
          const updatedModules: ModuleNode[] = prev.modules.map((m) =>
            m.id === moduleId ? { ...m, earsSpec: response.data.earsSpec } : m
          )
          return { ...prev, modules: updatedModules }
        })

        return response.data
      } catch (err: unknown) {
        clearTimeout(timeoutId)

        // Agregar moduleId al set de errores (502, timeout, red)
        setSpecErrorModules((prev) => new Set(prev).add(moduleId))

        const message =
          err instanceof Error ? err.message : 'Error al generar spec'
        setError(message)
        return null
      } finally {
        setGeneratingSpec(null)
      }
    },
    [result, specErrorModules]
  )

  // Limpia el error de un módulo específico para permitir reintento manual
  const clearSpecError = useCallback((moduleId: string) => {
    setSpecErrorModules((prev) => {
      const next = new Set(prev)
      next.delete(moduleId)
      return next
    })
  }, [])

  // Limpia solo el error global sin tocar el análisis en curso ni el resultado
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Resetea el estado completo para analizar un nuevo repo
  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setSpecErrorModules(new Set())
  }, [])

  return {
    status,
    result,
    error,
    generatingSpec,
    specErrorModules,
    analyzeRepo,
    generateSpec,
    clearSpecError,
    clearError,
    reset,
  }
}
