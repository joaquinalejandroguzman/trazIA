import fs from 'fs'
import path from 'path'
import type { ModuleNode, SpecStatus } from '../../shared/types'
import { scanAllFiles, canParseImports, getFileLanguage } from '../../shared/file_scanner'
import { bedrockClient, BEDROCK_MODEL_ANALYZER } from '../../clients/bedrock_client'
import { withLlmRetry } from '../../shared/llm_retry'

// Nota: el Analizador mapea TODOS los archivos relevantes del proyecto como nodos.
// Extrae aristas de dependencia (imports) en todos los lenguajes soportados.
// La detección de integraciones externas es responsabilidad del Agente de Integraciones.

// ============================================================
// Patrones de import por lenguaje
// ============================================================

// JS/TS: import/require/export from
const JS_IMPORT_PATTERNS = [
  /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
  /import\(['"]([^'"]+)['"]\)/g,
  /require\(['"]([^'"]+)['"]\)/g,
  /export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
]

// Python: from X import Y / import X
const PYTHON_IMPORT_PATTERNS = [
  /^from\s+(\.[\w.]*)\s+import/gm,           // from .module import X (relativo)
  /^from\s+([\w.]+)\s+import/gm,             // from module.sub import X (absoluto)
  /^import\s+([\w.]+)/gm,                     // import module.sub
]

// PHP: use, require, include
const PHP_IMPORT_PATTERNS = [
  /(?:require|include)(?:_once)?\s*\(?['"]([^'"]+)['"]\)?/g,   // require 'file.php'
  /use\s+([\w\\]+)/g,                                            // use Namespace\Class
]

// Ruby: require, require_relative
const RUBY_IMPORT_PATTERNS = [
  /require_relative\s+['"]([^'"]+)['"]/g,     // require_relative './file'
  /require\s+['"]([^'"]+)['"]/g,              // require 'module'
]

// Java/Kotlin/Scala: import
const JAVA_IMPORT_PATTERNS = [
  /^import\s+([\w.]+)/gm,                     // import com.package.Class
]

// C#: using
const CSHARP_IMPORT_PATTERNS = [
  /^using\s+([\w.]+)\s*;/gm,                  // using Namespace.Sub;
]

// Go: import
const GO_IMPORT_PATTERNS = [
  /import\s+"([^"]+)"/g,                       // import "path/to/package"
  /import\s+\w+\s+"([^"]+)"/g,                // import alias "path/to/package"
  /^\s+"([^"]+)"/gm,                           // dentro de bloque import ( ... )
]

// Rust: use, mod
const RUST_IMPORT_PATTERNS = [
  /^use\s+(crate::[\w:]+)/gm,                 // use crate::module::sub
  /^mod\s+(\w+)\s*;/gm,                       // mod module_name;
]

// Swift: import
const SWIFT_IMPORT_PATTERNS = [
  /^import\s+(\w+)/gm,                        // import Foundation
]

// Dart: import
const DART_IMPORT_PATTERNS = [
  /import\s+['"]([^'"]+)['"]/g,               // import 'package:x/y.dart'
]

// CSS/SCSS/Less: @import, @use
const CSS_IMPORT_PATTERNS = [
  /@import\s+['"]([^'"]+)['"]/g,              // @import 'file.css'
  /@use\s+['"]([^'"]+)['"]/g,                 // @use 'module' (SCSS)
  /@forward\s+['"]([^'"]+)['"]/g,             // @forward 'module' (SCSS)
]

// HTML/Vue/Svelte/Astro: <script src>, <link href>, import dentro de <script>
const HTML_IMPORT_PATTERNS = [
  /<script[^>]+src=["']([^"']+)["']/g,        // <script src="app.js">
  /<link[^>]+href=["']([^"']+\.css[^"']*)["']/g, // <link href="style.css">
  /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,  // import dentro de <script>
  /require\(['"]([^'"]+)['"]\)/g,             // require dentro de <script>
  /<(?:img|source|video|audio)[^>]+src=["']([^"']+)["']/g, // NO incluir — son assets
]

/**
 * Extrae los strings de import de un archivo según su lenguaje.
 * Retorna los paths/nombres crudos tal como aparecen en el código.
 */
function extractRawImports(filePath: string, content: string): string[] {
  const lang = getFileLanguage(filePath)
  const imports = new Set<string>()

  let patterns: RegExp[]

  switch (lang) {
    case 'js':
      patterns = JS_IMPORT_PATTERNS
      break
    case 'python':
      patterns = PYTHON_IMPORT_PATTERNS
      break
    case 'php':
      patterns = PHP_IMPORT_PATTERNS
      break
    case 'ruby':
      patterns = RUBY_IMPORT_PATTERNS
      break
    case 'java':
      patterns = JAVA_IMPORT_PATTERNS
      break
    case 'csharp':
      patterns = CSHARP_IMPORT_PATTERNS
      break
    case 'go':
      patterns = GO_IMPORT_PATTERNS
      break
    case 'rust':
      patterns = RUST_IMPORT_PATTERNS
      break
    case 'swift':
      patterns = SWIFT_IMPORT_PATTERNS
      break
    case 'dart':
      patterns = DART_IMPORT_PATTERNS
      break
    case 'css':
      patterns = CSS_IMPORT_PATTERNS
      break
    case 'html':
      // Solo extraer script src y link href (no img/video/audio que son assets)
      patterns = HTML_IMPORT_PATTERNS
      break
    default:
      return []
  }

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath) {
        imports.add(importPath)
      }
    }
  }

  return [...imports]
}

/**
 * Determina si un import es "relativo" (referencia un archivo local del proyecto)
 * según las convenciones del lenguaje.
 */
function isLocalImport(importPath: string, lang: string): boolean {
  switch (lang) {
    case 'js':
      // Solo imports con ./ o ../ son relativos en JS/TS
      return importPath.startsWith('.') || importPath.startsWith('/')

    case 'python':
      // Imports relativos empiezan con punto
      return importPath.startsWith('.')

    case 'php':
      // require/include con path relativo
      return importPath.startsWith('.') || importPath.startsWith('/')
        || importPath.endsWith('.php') || importPath.endsWith('.phtml')

    case 'ruby':
      // require_relative siempre es local; require con ./ también
      return importPath.startsWith('.') || importPath.startsWith('/')

    case 'java':
    case 'csharp':
    case 'swift':
      // En Java/C#/Swift todos los imports son por namespace — los intentamos resolver
      // contra la estructura real de archivos
      return true

    case 'go':
      // Solo imports que no empiezan con dominio (github.com/, golang.org/, etc.)
      return !importPath.includes('.')

    case 'rust':
      // crate:: es local, mod es local
      return importPath.startsWith('crate::') || !importPath.includes('::')

    case 'dart':
      // package: es externo, rutas relativas son locales
      return !importPath.startsWith('package:') && !importPath.startsWith('dart:')

    case 'css':
      // Referencias relativas o sin protocolo
      return !importPath.startsWith('http') && !importPath.startsWith('//')

    case 'html':
      // Excluir CDN, URLs absolutas, data URIs
      return !importPath.startsWith('http') && !importPath.startsWith('//')
        && !importPath.startsWith('data:') && !importPath.startsWith('#')

    default:
      return importPath.startsWith('.') || importPath.startsWith('/')
  }
}

/**
 * Intenta resolver un import a un archivo real dentro del repo.
 * Estrategia por lenguaje.
 */
function resolveImport(
  importPath: string,
  fromFile: string,
  baseDir: string,
  lang: string,
  fileIds: Set<string>
): string | null {
  const fromDir = path.dirname(fromFile)

  switch (lang) {
    case 'js': {
      // Resolver ruta relativa con extensiones implícitas
      const resolved = path.resolve(fromDir, importPath)
      const extensions = [
        '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '/index.ts', '/index.tsx', '/index.js', '/index.mjs',
      ]
      for (const ext of extensions) {
        const candidate = path.relative(baseDir, resolved + ext).replace(/\\/g, '/')
        if (fileIds.has(candidate)) return candidate
      }
      return null
    }

    case 'python': {
      // from .module import X → buscar ./module.py o ./module/__init__.py
      if (importPath.startsWith('.')) {
        // Contar puntos para subir niveles
        const dots = importPath.match(/^\.+/)?.[0].length ?? 1
        const modulePath = importPath.slice(dots).replace(/\./g, '/')
        let resolveDir = fromDir
        for (let i = 1; i < dots; i++) {
          resolveDir = path.dirname(resolveDir)
        }
        const base = path.resolve(resolveDir, modulePath)
        const candidates = [
          path.relative(baseDir, base + '.py'),
          path.relative(baseDir, path.join(base, '__init__.py')),
        ]
        for (const c of candidates) {
          const normalized = c.replace(/\\/g, '/')
          if (fileIds.has(normalized)) return normalized
        }
      } else {
        // Import absoluto: convertir puntos a / y buscar desde raíz del repo
        const modulePath = importPath.replace(/\./g, '/')
        const candidates = [
          modulePath + '.py',
          modulePath + '/__init__.py',
        ]
        for (const c of candidates) {
          if (fileIds.has(c)) return c
        }
      }
      return null
    }

    case 'php': {
      // Resolver path relativo directamente
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        const resolved = path.resolve(fromDir, importPath)
        const candidate = path.relative(baseDir, resolved).replace(/\\/g, '/')
        if (fileIds.has(candidate)) return candidate
      }
      // use Namespace\Class → buscar Namespace/Class.php (PSR-4 simplificado)
      const psr4Path = importPath.replace(/\\/g, '/') + '.php'
      // Buscar en fileIds cualquier archivo que termine con este path
      for (const fid of fileIds) {
        if (fid.endsWith(psr4Path) || fid.endsWith(psr4Path.toLowerCase())) {
          return fid
        }
      }
      return null
    }

    case 'ruby': {
      // require_relative './file' → resolver directamente
      const resolved = path.resolve(fromDir, importPath)
      const candidates = [
        path.relative(baseDir, resolved + '.rb'),
        path.relative(baseDir, resolved),
      ]
      for (const c of candidates) {
        const normalized = c.replace(/\\/g, '/')
        if (fileIds.has(normalized)) return normalized
      }
      return null
    }

    case 'java': {
      // import com.package.Class → buscar com/package/Class.java (o .kt, .scala)
      const javaPath = importPath.replace(/\./g, '/')
      const extensions = ['.java', '.kt', '.kts', '.scala']
      for (const ext of extensions) {
        const candidate = javaPath + ext
        for (const fid of fileIds) {
          if (fid.endsWith(candidate)) return fid
        }
      }
      return null
    }

    case 'csharp': {
      // using Namespace.Sub → buscar archivos .cs que contengan ese namespace
      // Simplificación: buscar Sub.cs o Namespace/Sub.cs
      const parts = importPath.split('.')
      const last = parts[parts.length - 1]
      const candidate = parts.join('/') + '.cs'
      for (const fid of fileIds) {
        if (fid.endsWith(candidate) || fid.endsWith(`${last}.cs`)) {
          return fid
        }
      }
      return null
    }

    case 'go': {
      // Imports locales (sin punto en path) → buscar carpeta con ese nombre
      // Go organiza por paquete/directorio
      for (const fid of fileIds) {
        if (fid.includes(importPath + '/') || fid.startsWith(importPath + '/')) {
          return fid
        }
      }
      return null
    }

    case 'rust': {
      // crate::module::sub → buscar src/module/sub.rs o src/module/sub/mod.rs
      if (importPath.startsWith('crate::')) {
        const modPath = importPath.replace('crate::', '').replace(/::/g, '/')
        const candidates = [
          `src/${modPath}.rs`,
          `src/${modPath}/mod.rs`,
        ]
        for (const c of candidates) {
          if (fileIds.has(c)) return c
        }
      } else {
        // mod name → buscar name.rs o name/mod.rs en mismo directorio
        const relDir = path.relative(baseDir, fromDir).replace(/\\/g, '/')
        const candidates = [
          `${relDir}/${importPath}.rs`,
          `${relDir}/${importPath}/mod.rs`,
        ]
        for (const c of candidates) {
          if (fileIds.has(c)) return c
        }
      }
      return null
    }

    case 'dart': {
      // Imports relativos: resolver directamente
      const resolved = path.resolve(fromDir, importPath)
      const candidate = path.relative(baseDir, resolved).replace(/\\/g, '/')
      if (fileIds.has(candidate)) return candidate
      return null
    }

    case 'css': {
      // @import './file.css' → resolver relativo
      const resolved = path.resolve(fromDir, importPath)
      // Probar con y sin extensión, con prefijo _
      const baseName = path.basename(importPath)
      const dir = path.dirname(resolved)
      const candidates = [
        path.relative(baseDir, resolved),
        path.relative(baseDir, resolved + '.css'),
        path.relative(baseDir, resolved + '.scss'),
        path.relative(baseDir, resolved + '.less'),
        path.relative(baseDir, path.join(dir, `_${baseName}.scss`)),
        path.relative(baseDir, path.join(dir, `_${baseName}.sass`)),
      ]
      for (const c of candidates) {
        const normalized = c.replace(/\\/g, '/')
        if (fileIds.has(normalized)) return normalized
      }
      return null
    }

    case 'html': {
      // <script src="js/app.js"> o <link href="css/style.css"> → resolver relativo al HTML
      const resolved = path.resolve(fromDir, importPath)
      const candidate = path.relative(baseDir, resolved).replace(/\\/g, '/')
      if (fileIds.has(candidate)) return candidate
      // También intentar desde la raíz del proyecto (path absoluto desde /)
      const fromRoot = importPath.startsWith('/') ? importPath.slice(1) : importPath
      if (fileIds.has(fromRoot)) return fromRoot
      return null
    }

    default:
      return null
  }
}

/**
 * Cuenta las líneas de código de un archivo (excluyendo líneas vacías).
 */
function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n').filter((line) => line.trim().length > 0).length
  } catch {
    return 0
  }
}

/**
 * Genera un nombre legible para un archivo a partir de su ruta relativa.
 * Ej: "src/services/payment.ts" → "services/payment"
 */
function generateReadableName(relativePath: string): string {
  const parts = relativePath.split('/')
  const lastPart = parts[parts.length - 1].replace(/\.[^.]+$/, '')

  if (parts.length > 1) {
    return `${parts[parts.length - 2]}/${lastPart}`
  }
  return lastPart
}

// ============================================================
// Clasificación con Haiku (specStatus + specHealthScore)
// ============================================================

interface HaikuClassification {
  specStatus: SpecStatus
  specHealthScore: number
}

/**
 * Clasifica un módulo usando Claude Haiku vía AWS Bedrock.
 * Retorna defaults si la respuesta no es JSON parseable o si falla permanentemente.
 */
async function classifyModuleWithHaiku(
  module: ModuleNode,
  sourceContent: string
): Promise<HaikuClassification> {
  const defaults: HaikuClassification = { specStatus: 'untraced', specHealthScore: 0 }

  try {
    const prompt = `Eres un analizador de código. Dado el siguiente fragmento de código fuente, determina:
1. specStatus: si el módulo tiene una especificación actualizada ("traced"), desincronizada ("drift") o sin especificación ("untraced").
2. specHealthScore: un entero del 0 al 100 que refleja la calidad y cobertura de la spec.

Responde ÚNICAMENTE con JSON válido en este formato:
{"specStatus": "traced"|"drift"|"untraced", "specHealthScore": <número 0-100>}

Código del módulo (${module.name}):
${sourceContent}`

    const response = await withLlmRetry(
      () =>
        bedrockClient.messages.create({
          model: BEDROCK_MODEL_ANALYZER,
          // eslint-disable-next-line camelcase
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      { agente: 'analyzer', módulo: module.id }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      const parsed = JSON.parse(text) as { specStatus?: unknown; specHealthScore?: unknown }
      const status = parsed.specStatus
      const score = parsed.specHealthScore

      const validStatuses: SpecStatus[] = ['traced', 'drift', 'untraced']
      const resolvedStatus: SpecStatus =
        typeof status === 'string' && validStatuses.includes(status as SpecStatus)
          ? (status as SpecStatus)
          : 'untraced'

      const rawScore = typeof score === 'number' ? score : Number(score)
      const resolvedScore = isNaN(rawScore)
        ? 0
        : Math.max(0, Math.min(100, Math.round(rawScore)))

      return { specStatus: resolvedStatus, specHealthScore: resolvedScore }
    } catch {
      // Parse fallido — retornar defaults
      return defaults
    }
  } catch (error) {
    // Fallo permanente tras reintentos
    console.error(JSON.stringify({ agente: 'analyzer', módulo: module.id, error: String(error) }))
    return defaults
  }
}

/**
 * Analiza un repositorio completo y extrae la estructura de módulos y dependencias.
 * Incluye TODOS los archivos relevantes como nodos del grafo.
 * Extrae aristas de dependencia en todos los lenguajes soportados.
 *
 * @param repoPath - Ruta absoluta al directorio del repositorio clonado
 * @returns Lista de ModuleNode con dependencias mapeadas
 */
export async function analyzeRepository(repoPath: string): Promise<ModuleNode[]> {
  // Escanear TODOS los archivos relevantes del repo (lógica invertida: todo menos basura)
  const files = scanAllFiles(repoPath, repoPath)

  // Construir set de IDs (rutas relativas) para resolver dependencias
  const fileIds = new Set(files.map((f) => path.relative(repoPath, f).replace(/\\/g, '/')))

  // Para cada archivo, construir el ModuleNode
  const modules: ModuleNode[] = files.map((filePath) => {
    const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/')

    // Leer contenido del archivo y truncar a 4000 chars si supera ese límite
    let sourceContent = ''
    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8')
      sourceContent = rawContent.slice(0, 4000)
    } catch {
      // No crítico, se deja vacío
    }

    // Extraer imports si el lenguaje está soportado
    let dependencies: string[] = []
    if (canParseImports(filePath)) {
      if (sourceContent) {
        const lang = getFileLanguage(filePath)
        const rawImports = extractRawImports(filePath, sourceContent)

        // Filtrar solo imports locales y resolverlos contra archivos reales
        const resolved = new Set<string>()
        for (const imp of rawImports) {
          if (isLocalImport(imp, lang)) {
            const target = resolveImport(imp, filePath, repoPath, lang, fileIds)
            if (target && target !== relativePath) { // no auto-referenciarse
              resolved.add(target)
            }
          }
        }
        dependencies = [...resolved]
      }
    }

    // Generar nombre legible
    const name = generateReadableName(relativePath)

    // Obtener fecha de última modificación
    let lastModified: string | undefined
    try {
      const stats = fs.statSync(filePath)
      lastModified = stats.mtime.toISOString()
    } catch {
      // No crítico
    }

    return {
      id: relativePath,
      name,
      type: 'module' as const,
      path: relativePath,
      dependencies,
      linesOfCode: countLines(filePath),
      lastModified,
      sourceContent,  // almacenar contenido truncado
      // Valores por defecto — se sobreescribirán tras clasificación con Haiku
      specStatus: 'untraced' as const,
      specHealthScore: 0,
    }
  })

  // Clasificar todos los módulos en paralelo con Haiku
  const classifications = await Promise.all(
    modules.map((module) =>
      classifyModuleWithHaiku(module, module.sourceContent || '')
    )
  )

  // Aplicar clasificaciones a los módulos
  modules.forEach((module, index) => {
    module.specStatus = classifications[index].specStatus
    module.specHealthScore = classifications[index].specHealthScore
  })

  return modules
}
