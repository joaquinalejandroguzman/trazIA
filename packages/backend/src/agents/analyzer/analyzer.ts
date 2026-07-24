import fs from 'fs'
import path from 'path'
import type { ModuleNode } from '../../shared/types'

// Extensiones de archivo que TrazIA analiza (MVP: solo TS/JS)
const ANALYZABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

// Directorios a ignorar durante el escaneo
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.output', '__pycache__', '.kiro',
])

// Regex para detectar imports/requires en archivos TS/JS
const IMPORT_PATTERNS = [
  // import ... from './module'
  /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
  // import('module')
  /import\(['"]([^'"]+)['"]\)/g,
  // require('module')
  /require\(['"]([^'"]+)['"]\)/g,
  // export ... from './module'
  /export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
]

/**
 * Escanea recursivamente un directorio y retorna las rutas de archivos analizables.
 */
function scanFiles(dir: string, baseDir: string): string[] {
  const results: string[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, baseDir))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (ANALYZABLE_EXTENSIONS.has(ext)) {
        results.push(fullPath)
      }
    }
  }

  return results
}

/**
 * Extrae las dependencias (imports relativos) de un archivo fuente.
 * Solo retorna imports relativos (./... o ../...), no paquetes npm.
 */
function extractImports(filePath: string): string[] {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return []
  }

  const imports = new Set<string>()

  for (const pattern of IMPORT_PATTERNS) {
    // Reseteamos lastIndex porque usamos la flag /g
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1]
      // Solo imports relativos (no paquetes npm)
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.add(importPath)
      }
    }
  }

  return [...imports]
}

/**
 * Resuelve un import relativo a una ruta absoluta de archivo.
 * Maneja extensiones implícitas (.ts, .tsx, /index.ts, etc.)
 */
function resolveImport(importPath: string, fromFile: string, baseDir: string): string | null {
  const fromDir = path.dirname(fromFile)
  const resolved = path.resolve(fromDir, importPath)

  // Extensiones que TypeScript resuelve implícitamente
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js']

  // Caso 1: la ruta ya tiene extensión y existe
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return path.relative(baseDir, resolved)
  }

  // Caso 2: probar con extensiones implícitas
  for (const ext of extensions) {
    const candidate = resolved + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(baseDir, candidate)
    }
  }

  return null
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
 * Analiza un repositorio completo y extrae la estructura de módulos y dependencias.
 * Realiza análisis estático sin ejecutar el código.
 *
 * @param repoPath - Ruta absoluta al directorio del repositorio clonado
 * @returns Lista de ModuleNode con dependencias mapeadas
 */
export async function analyzeRepository(repoPath: string): Promise<ModuleNode[]> {
  // Escanear todos los archivos TS/JS del repo
  const files = scanFiles(repoPath, repoPath)

  // Construir set de IDs (rutas relativas) para resolver dependencias
  const fileIds = new Set(files.map((f) => path.relative(repoPath, f).replace(/\\/g, '/')))

  // Para cada archivo, extraer imports y resolver a IDs reales
  const modules: ModuleNode[] = files.map((filePath) => {
    const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/')
    const rawImports = extractImports(filePath)

    // Resolver imports a rutas relativas reales
    const dependencies: string[] = []
    for (const imp of rawImports) {
      const resolved = resolveImport(imp, filePath, repoPath)
      if (resolved) {
        const normalizedResolved = resolved.replace(/\\/g, '/')
        if (fileIds.has(normalizedResolved)) {
          dependencies.push(normalizedResolved)
        }
      }
    }

    // Generar nombre legible (última carpeta + archivo, sin extensión)
    const parts = relativePath.split('/')
    const name = parts.length > 1
      ? parts.slice(-2).join('/').replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
      : parts[0].replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')

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
      path: relativePath,
      specStatus: 'untraced' as const, // por defecto todo es untraced hasta que el Orquestador evalúe
      specHealthScore: 0,
      dependencies,
      linesOfCode: countLines(filePath),
      lastModified,
    }
  })

  return modules
}
