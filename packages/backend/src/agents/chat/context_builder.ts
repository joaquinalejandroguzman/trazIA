// Constructor de contexto para el chat — comprime metadatos de módulos
// en un string legible por el LLM y detecta menciones de módulos específicos

import { ModuleNode } from '../../shared/types'

/** Máximo de caracteres para el README en el contexto */
const MAX_README_LENGTH = 3000

/**
 * Opciones para la construcción de contexto
 */
interface BuildRepoContextOptions {
  readme?: string
  focusModule?: ModuleNode
}

/**
 * Construye el contexto del repositorio para enviar al LLM.
 * Incluye metadatos de todos los módulos en formato texto plano legible.
 * Si se provee un focusModule, incluye su sourceContent.
 * Si se provee readme, lo trunca a MAX_README_LENGTH caracteres.
 */
export function buildRepoContext(
  modules: ModuleNode[],
  options?: BuildRepoContextOptions
): string {
  const sections: string[] = []

  // Sección de módulos
  sections.push('=== Módulos del Repositorio ===')
  sections.push(`Total: ${modules.length} módulos\n`)

  for (const mod of modules) {
    const lines: string[] = []
    lines.push(`• ${mod.name}`)
    lines.push(`  ID: ${mod.id}`)
    lines.push(`  Path: ${mod.path}`)
    lines.push(`  Tipo: ${mod.type}`)
    lines.push(`  Dependencias: ${mod.dependencies.length > 0 ? mod.dependencies.join(', ') : 'ninguna'}`)
    lines.push(`  Estado spec: ${mod.specStatus}`)
    lines.push(`  Health score: ${mod.specHealthScore}`)

    // Campos opcionales — solo si están presentes
    if (mod.linesOfCode !== undefined) {
      lines.push(`  Líneas de código: ${mod.linesOfCode}`)
    }
    if (mod.lastModified !== undefined) {
      lines.push(`  Última modificación: ${mod.lastModified}`)
    }

    // Incluir sourceContent SOLO para el focusModule
    if (options?.focusModule && mod.id === options.focusModule.id && mod.sourceContent) {
      lines.push(`  --- Código fuente ---`)
      lines.push(mod.sourceContent)
      lines.push(`  --- Fin código fuente ---`)
    }

    sections.push(lines.join('\n'))
  }

  // Sección de README (truncado a MAX_README_LENGTH)
  if (options?.readme) {
    const truncatedReadme = options.readme.length > MAX_README_LENGTH
      ? options.readme.slice(0, MAX_README_LENGTH)
      : options.readme

    sections.push('\n=== README del Proyecto ===')
    sections.push(truncatedReadme)
  }

  return sections.join('\n')
}

/**
 * Detecta si el mensaje del usuario menciona un módulo específico del array.
 * Estrategia: comparación case-insensitive contra `module.name` o último
 * segmento del `module.path`.
 * Retorna el primer módulo que matchee, o null si ninguno matchea.
 */
export function detectMentionedModule(
  message: string,
  modules: ModuleNode[]
): ModuleNode | null {
  const lowerMessage = message.toLowerCase()

  for (const mod of modules) {
    // Comparar contra el nombre del módulo
    const lowerName = mod.name.toLowerCase()
    if (lowerMessage.includes(lowerName)) {
      return mod
    }

    // Comparar contra el último segmento del path
    const lastSegment = mod.path.split('/').pop()?.toLowerCase()
    if (lastSegment && lowerMessage.includes(lastSegment)) {
      return mod
    }
  }

  return null
}
