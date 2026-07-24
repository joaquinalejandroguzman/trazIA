// Lógica principal del Agente Orquestador
// Combina el mapa de estructura (Analizador) con las integraciones detectadas (Agente de Integraciones)
// y arma el grafo final con agrupación por carpetas que consume el frontend

import type { ModuleNode, FolderNode, IntegrationNode, GraphEdge, AnalysisResult } from '../../shared/types'

/**
 * Detecta el lenguaje/stack predominante analizando las extensiones de los módulos.
 */
function detectPrimaryLanguage(modules: ModuleNode[]): string {
  const extCounts = new Map<string, number>()

  for (const mod of modules) {
    const ext = mod.path.split('.').pop()?.toLowerCase() ?? ''
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1)
  }

  const langCounts = new Map<string, number>()
  const extToLang: Record<string, string> = {
    'ts': 'TypeScript', 'tsx': 'TypeScript',
    'js': 'JavaScript', 'jsx': 'JavaScript', 'mjs': 'JavaScript', 'cjs': 'JavaScript',
    'py': 'Python', 'pyw': 'Python',
    'php': 'PHP', 'phtml': 'PHP',
    'rb': 'Ruby', 'erb': 'Ruby',
    'java': 'Java', 'kt': 'Kotlin', 'scala': 'Scala',
    'cs': 'C#',
    'go': 'Go',
    'rs': 'Rust',
    'swift': 'Swift',
    'dart': 'Dart',
    'vue': 'Vue', 'svelte': 'Svelte',
  }

  for (const [ext, count] of extCounts) {
    const lang = extToLang[ext]
    if (lang) {
      langCounts.set(lang, (langCounts.get(lang) ?? 0) + count)
    }
  }

  let maxLang = 'Unknown'
  let maxCount = 0
  for (const [lang, count] of langCounts) {
    if (count > maxCount) {
      maxLang = lang
      maxCount = count
    }
  }

  return maxLang
}

/**
 * Construye la jerarquía de carpetas a partir de los módulos.
 * Cada módulo se asigna a su carpeta padre, y se crean carpetas hasta el primer nivel
 * que tenga más de un hijo o sea una carpeta "significativa" del proyecto.
 * 
 * Estrategia: crear carpetas solo para directorios que contienen 2+ archivos/subcarpetas.
 * Esto evita crear carpetas intermedias vacías que solo añaden ruido visual.
 */
function buildFolderHierarchy(modules: ModuleNode[]): {
  folders: FolderNode[]
  moduleParentMap: Map<string, string>
} {
  // Contar archivos por carpeta (todos los niveles)
  const folderContents = new Map<string, Set<string>>() // folder → set de hijos directos (archivos + subcarpetas)

  for (const mod of modules) {
    const parts = mod.path.split('/')
    if (parts.length < 2) {
      // Archivo en raíz — su padre es "."
      if (!folderContents.has('.')) folderContents.set('.', new Set())
      folderContents.get('.')!.add(mod.id)
    } else {
      // Registrar en su carpeta directa
      const parentFolder = parts.slice(0, -1).join('/')
      if (!folderContents.has(parentFolder)) folderContents.set(parentFolder, new Set())
      folderContents.get(parentFolder)!.add(mod.id)

      // Registrar subcarpetas en sus padres (para la jerarquía)
      for (let i = parts.length - 2; i > 0; i--) {
        const ancestor = parts.slice(0, i).join('/')
        const child = parts.slice(0, i + 1).join('/')
        if (!folderContents.has(ancestor)) folderContents.set(ancestor, new Set())
        folderContents.get(ancestor)!.add(child)
      }
      // Raíz contiene el primer directorio
      if (parts.length > 1) {
        if (!folderContents.has('.')) folderContents.set('.', new Set())
        folderContents.get('.')!.add(parts[0])
      }
    }
  }

  // Determinar qué carpetas son "significativas" (tienen 2+ hijos o son primer nivel)
  const significantFolders = new Set<string>()
  
  // Primer nivel siempre es significativo (ej: "src", "packages", "frontend")
  const rootContents = folderContents.get('.') ?? new Set()
  for (const child of rootContents) {
    if (!child.includes('/') && !child.includes('.')) { // es carpeta, no archivo
      significantFolders.add(child)
    }
  }

  // Carpetas con 2+ hijos directos son significativas
  for (const [folder, children] of folderContents) {
    if (folder !== '.' && children.size >= 1) {
      significantFolders.add(folder)
    }
  }

  // Construir FolderNodes
  const folders: FolderNode[] = []
  const moduleParentMap = new Map<string, string>()

  for (const folderPath of significantFolders) {
    const parts = folderPath.split('/')
    const folderName = parts[parts.length - 1]

    // Determinar el parentFolder (carpeta ancestro significativa más cercana)
    let parentFolder: string | undefined
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestor = parts.slice(0, i).join('/')
      if (significantFolders.has(ancestor)) {
        parentFolder = ancestor
        break
      }
    }

    const directChildren = folderContents.get(folderPath) ?? new Set()

    folders.push({
      id: folderPath,
      name: folderName,
      type: 'folder',
      path: folderPath,
      parentFolder,
      childCount: directChildren.size,
    })
  }

  // Asignar cada módulo a su carpeta padre significativa más cercana
  for (const mod of modules) {
    const parts = mod.path.split('/')
    if (parts.length < 2) {
      // Archivo en raíz — no tiene carpeta padre
      continue
    }

    // Buscar la carpeta padre significativa más cercana
    for (let i = parts.length - 1; i > 0; i--) {
      const candidate = parts.slice(0, i).join('/')
      if (significantFolders.has(candidate)) {
        moduleParentMap.set(mod.id, candidate)
        break
      }
    }
  }

  return { folders, moduleParentMap }
}

/**
 * Combina los resultados del Analizador y el Agente de Integraciones
 * en un AnalysisResult completo con jerarquía de carpetas para el frontend.
 */
export function buildAnalysisResult(
  repoUrl: string,
  modules: ModuleNode[],
  integrations: IntegrationNode[]
): AnalysisResult {
  // Construir jerarquía de carpetas
  const { folders, moduleParentMap } = buildFolderHierarchy(modules)

  // Asignar parentFolder a cada módulo
  const modulesWithParent: ModuleNode[] = modules.map((mod) => ({
    ...mod,
    parentFolder: moduleParentMap.get(mod.id),
  }))

  // Construir aristas
  const edges: GraphEdge[] = []
  const moduleIds = new Set(modules.map((m) => m.id))

  // Aristas de dependencia entre módulos (imports internos)
  for (const mod of modules) {
    for (const dep of mod.dependencies) {
      if (moduleIds.has(dep)) {
        edges.push({
          source: mod.id,
          target: dep,
          type: 'dependency',
        })
      }
    }
  }

  // Aristas de integración (módulo → integración externa)
  for (const integration of integrations) {
    for (const moduleId of integration.detectedIn) {
      if (moduleIds.has(moduleId)) {
        edges.push({
          source: moduleId,
          target: integration.id,
          type: 'integration',
        })
      }
    }
  }

  // Detectar lenguaje/stack predominante
  const primaryLanguage = detectPrimaryLanguage(modules)

  return {
    repoUrl,
    analyzedAt: new Date().toISOString(),
    modules: modulesWithParent,
    folders,
    integrations,
    edges,
    totalModules: modules.length,
    totalIntegrations: integrations.length,
    primaryLanguage,
  }
}
