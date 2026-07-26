// Constructor de contexto para el chat — comprime metadatos de módulos
// en un string legible por el LLM y detecta menciones de módulos específicos

import { ModuleNode } from '../../shared/types'

/** Máximo de caracteres para el README en el contexto */
const MAX_README_LENGTH = 3000

/** Límite de chars de sourceContent por módulo con 1-4 focusModules */
export const SNIPPET_LIMIT_SMALL = 500
/** Límite de chars de sourceContent por módulo con 5+ focusModules */
export const SNIPPET_LIMIT_LARGE = 300

/**
 * Opciones para la construcción de contexto
 */
interface BuildRepoContextOptions {
  readme?: string
  /** @deprecated Use focusModules instead */
  focusModule?: ModuleNode
  focusModules?: ModuleNode[]
  /** Si es false, no incluir sourceContent aunque el módulo esté en focusModules. Default: true */
  includeSnippets?: boolean
}

/**
 * Construye el contexto del repositorio para enviar al LLM.
 * Incluye metadatos de todos los módulos en formato texto plano legible.
 * Si se provee focusModules, incluye snippets truncados de cada uno.
 * Si se provee focusModule (deprecated) sin focusModules, lo trata como [focusModule].
 * Si se provee readme, lo trunca a MAX_README_LENGTH caracteres.
 */
export function buildRepoContext(
  modules: ModuleNode[],
  options?: BuildRepoContextOptions
): string {
  const sections: string[] = []

  // Resolver focusModules efectivos (backward compat con focusModule singular)
  const effectiveFocusModules = options?.focusModules ??
    (options?.focusModule ? [options.focusModule] : [])

  // Determinar límite de snippet según cantidad de módulos
  const snippetLimit = effectiveFocusModules.length >= 5
    ? SNIPPET_LIMIT_LARGE
    : SNIPPET_LIMIT_SMALL

  // Set para lookup O(1) de módulos focalizados
  const focusIds = new Set(effectiveFocusModules.map(m => m.id))

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

    // Incluir sourceContent para módulos en focusModules (solo si includeSnippets !== false)
    if (focusIds.has(mod.id) && mod.sourceContent && options?.includeSnippets !== false) {
      lines.push(`--- Código fuente (${mod.name}) ---`)
      lines.push(mod.sourceContent.slice(0, snippetLimit))
      lines.push(`--- Fin código fuente ---`)
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
 * Detecta TODOS los módulos mencionados en el mensaje.
 * Reemplaza detectMentionedModule (que retorna solo el primero).
 * Matching: case-insensitive substring contra name y último segmento de path.
 * Cada módulo aparece como máximo una vez, en el orden del array de entrada.
 */
export function detectMentionedModules(
  message: string,
  modules: ModuleNode[]
): ModuleNode[] {
  const lowerMessage = message.toLowerCase()
  const result: ModuleNode[] = []
  const seenIds = new Set<string>()

  for (const mod of modules) {
    if (seenIds.has(mod.id)) continue

    // Comparar contra el nombre del módulo
    const lowerName = mod.name.toLowerCase()
    if (lowerName && lowerMessage.includes(lowerName)) {
      result.push(mod)
      seenIds.add(mod.id)
      continue
    }

    // Comparar contra el último segmento del path
    const lastSegment = mod.path.split('/').pop()?.toLowerCase()
    if (lastSegment && lowerMessage.includes(lastSegment)) {
      result.push(mod)
      seenIds.add(mod.id)
    }
  }

  return result
}

/** @deprecated Use detectMentionedModules instead */
export function detectMentionedModule(
  message: string,
  modules: ModuleNode[]
): ModuleNode | null {
  return detectMentionedModules(message, modules)[0] ?? null
}

/** Keywords que indican una pregunta general sobre el repositorio */
export const GENERAL_KEYWORDS: string[] = [
  'repo', 'repositorio', 'proyecto', 'app', 'aplicación',
  'código', 'código fuente', 'general'
]

/**
 * Determina si el mensaje es una pregunta general sobre el repositorio.
 * Retorna true si el mensaje contiene al menos un keyword general como
 * substring case-insensitive Y mentionedModules está vacío.
 * Retorna false para mensajes vacíos o solo whitespace.
 */
export function isGeneralRepoQuestion(
  message: string,
  mentionedModules: ModuleNode[]
): boolean {
  if (!message || !message.trim()) return false
  if (mentionedModules.length > 0) return false

  const lowerMessage = message.toLowerCase()
  return GENERAL_KEYWORDS.some(keyword => lowerMessage.includes(keyword))
}
