// Agente EARS Writer — genera especificaciones en formato EARS (Easy Approach to Requirements Syntax)
// para cada módulo del repositorio usando Claude Sonnet vía AWS Bedrock.
// Ante fallo total (tras reintentos), retorna un Markdown de error sin lanzar excepción.

import { bedrockClient, BEDROCK_MODEL_EARS } from '../../clients/bedrock_client'
import { limitedMap } from '../../shared/concurrency_limiter'
import { withLlmRetry } from '../../shared/llm_retry'
import { ModuleNode } from '../../shared/types'

/**
 * Construye el prompt EARS para un módulo dado.
 * El prompt instruye a Sonnet a usar los patrones EARS obligatorios.
 */
function buildEarsPrompt(moduleName: string, sourceContent: string): string {
  return `Eres un redactor de especificaciones de software. Dado el siguiente código fuente del módulo "${moduleName}", genera una especificación de requisitos en formato EARS (Easy Approach to Requirements Syntax).

Usa obligatoriamente estos patrones EARS:
- WHEN <trigger> THE SYSTEM SHALL <response>
- WHILE <condition> THE SYSTEM SHALL <response>  
- IF <condition> THEN THE SYSTEM SHALL <response>

Formato de respuesta (Markdown):
# Requirements: ${moduleName}

## Requisitos

[Aquí los requisitos en sintaxis EARS]

Código fuente:
${sourceContent}`
}

/**
 * Genera una spec en formato EARS para un módulo dado su código fuente.
 * Retorna Markdown listo para guardarse como requirements.md.
 * Ante fallo total (tras reintentos), retorna un Markdown de error sin lanzar excepción.
 *
 * @param moduleName - nombre del módulo (ej: "src/agents/analyzer/analyzer.ts")
 * @param sourceContent - contenido del archivo fuente ya leído (truncado antes de llamar)
 * @returns string con la spec EARS en Markdown, o mensaje de error embebido en Markdown
 */
export async function generateEarsSpec(
  moduleName: string,
  sourceContent: string
): Promise<string> {
  try {
    const response = await withLlmRetry(
      () =>
        bedrockClient.messages.create({
          model: BEDROCK_MODEL_EARS,
          // eslint-disable-next-line camelcase
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: buildEarsPrompt(moduleName, sourceContent),
            },
          ],
        }),
      { agente: 'ears-writer', módulo: moduleName }
    )

    // Extraer texto de la respuesta, igual que el Analyzer
    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    return text
  } catch (error) {
    // Ante fallo total: retornar Markdown de error sin lanzar excepción
    const mensaje = error instanceof Error ? error.message : String(error)
    return `> ⚠️ Error al generar la spec: ${mensaje}`
  }
}

/**
 * Genera specs EARS para una lista de módulos con concurrencia limitada.
 * Módulos sin sourceContent reciben earsSpec vacío.
 * Módulos con sourceContent reciben earsSpec desde generateEarsSpec.
 * Ante fallo de un módulo, continúa con los demás (earsSpec vacío como fallback).
 *
 * @param modules - lista de módulos del pipeline (con sourceContent ya cargado)
 * @returns nueva lista de módulos con el campo earsSpec asignado
 */
export async function generateEarsSpecs(
  modules: ModuleNode[]
): Promise<ModuleNode[]> {
  // Procesar módulos con concurrencia limitada para evitar throttling en Bedrock
  const results = await limitedMap(
    modules,
    async (module) => {
      // Módulos sin sourceContent reciben spec vacía
      if (!module.sourceContent) {
        return { ...module, earsSpec: '' }
      }

      // Módulos con sourceContent reciben spec generada por Sonnet
      const earsSpec = await generateEarsSpec(module.name, module.sourceContent)
      return { ...module, earsSpec }
    },
    // Ante error en un módulo, continuar con los demás — spec vacía como fallback
    (module) => ({ ...module, earsSpec: '' })
  )

  // Con onError definido, nunca hay undefined en results — cast seguro
  return results as ModuleNode[]
}
