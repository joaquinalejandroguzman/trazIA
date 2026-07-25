import fs from 'fs'
import path from 'path'

// ============================================================
// Módulo de escaneo de archivos compartido entre agentes.
// Lógica invertida: incluye TODO excepto lo que es basura/ruido.
// ============================================================

// Directorios que NUNCA se escanean (dependencias, generados, caché)
const IGNORED_DIRS = new Set([
  // Dependencias
  'node_modules', 'vendor', 'bower_components', '.pnpm',
  // Control de versiones
  '.git', '.svn', '.hg',
  // Generados / build
  'dist', 'build', 'out', '.output', 'target', 'bin', 'obj',
  // Caché y temporales
  '.cache', '.tmp', '.temp', '.parcel-cache', '.turbo',
  // Coverage y testing
  'coverage', '.nyc_output',
  // Frameworks específicos
  '.next', '.nuxt', '.svelte-kit', '.astro',
  // Python
  '__pycache__', '.venv', 'venv', 'env', '.env',
  // IDE
  '.idea', '.vscode',
  // Migraciones de ORM (generadas automáticamente, no reflejan arquitectura)
  'migrations', 'migrate',
  // Assets / recursos estáticos (no representan arquitectura)
  'assets', 'static', 'images', 'icons', 'fonts', 'media',
  'img', 'pictures', 'illustrations',
  // Librerías vendored / copiadas
  'lib', 'third_party', 'third-party', 'external', 'libs',
  // Estilos puros (sin lógica de negocio)
  'styles', 'css', 'scss', 'themes',
  // Fixtures / mocks / snapshots de testing
  '__fixtures__', '__mocks__', '__snapshots__', 'fixtures',
  'mocks', 'testdata', 'test-data',
  // Documentación
  'docs', 'doc', 'wiki', '.github',
  // Storybook / demos / ejemplos
  '.storybook', 'stories', '__stories__', 'examples', 'demo',
  // Internacionalización / traducciones
  'locales', 'i18n', 'translations', 'lang',
  // Scripts de CI / infra
  'scripts', '.circleci', '.husky',
  // Proyecto propio
  '.kiro',
])

// Extensiones de archivos binarios/assets que NO aportan a la estructura del sistema
const EXCLUDED_EXTENSIONS = new Set([
  // Imágenes
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp', '.tiff', '.avif',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Audio/video
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.avi', '.mov', '.flac',
  // Documentos binarios
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Archivos comprimidos
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  // Ejecutables y binarios
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  // Source maps
  '.map',
  // Lockfiles (se excluyen por nombre abajo, pero por si acaso)
  '.lock',
  // Snapshots de testing
  '.snap',
  // Patches / diffs
  '.patch', '.diff',
  // Logs
  '.log',
  // Data dumps
  '.csv', '.tsv',
  // XML (config/build en la mayoría de proyectos, no arquitectura)
  '.xml',
])

// Archivos específicos por nombre que no aportan a la arquitectura
const EXCLUDED_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'Cargo.lock', 'poetry.lock', 'Pipfile.lock',
  '.DS_Store', 'Thumbs.db', '.gitkeep', '.gitattributes', '.gitignore',
  'LICENSE', 'LICENSE.md', 'LICENSE.txt',
  '__init__.py',    // Python: marcador de paquete, no contiene lógica arquitectónica
  // Manifiestos / meta de frontend
  'manifest.json', 'robots.txt', 'sitemap.xml', 'browserconfig.xml',
  // Config de herramientas de desarrollo (no es arquitectura)
  '.browserslistrc', '.babelrc', '.postcssrc',
  'babel.config.js', 'babel.config.cjs', 'babel.config.json',
  'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
  'tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs',
  'webpack.config.js', 'webpack.config.ts', 'webpack.config.cjs',
  'rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs',
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'vitest.config.ts', 'vitest.config.js',
  'jest.config.js', 'jest.config.ts', 'jest.config.cjs',
  '.stylelintrc', '.stylelintrc.json',
  'tsconfig.build.json', 'tsconfig.node.json',
])

// Patrones de nombre de archivo que indican basura/generados
const EXCLUDED_PATTERNS: RegExp[] = [
  /\.min\.(js|css)$/,           // Minificados
  /\.bundle\.(js|css)$/,        // Bundles generados
  /\.chunk\.(js|css)$/,         // Chunks de webpack/vite
  /\.compiled\./,               // Archivos compilados intermedios
  /\.d\.ts$/,                   // TypeScript declarations generadas
  /\.generated\./,              // Archivos generados
  /^\.env/,                     // Variables de entorno (.env, .env.local, etc.)
  /^\d{4}[_-]/,                 // Migraciones con timestamp (ej: 20240315_create_users.ts, 2024-03-15_add_col.py)
  /^\d{4}_\w+\.py$/,            // Migraciones Django (ej: 0001_initial.py, 0012_auto_add_field.py)
]

// Tamaño máximo de archivo para considerar como texto legible (500KB)
// Archivos más grandes probablemente son data dumps o generados
const MAX_FILE_SIZE_BYTES = 500 * 1024

/**
 * Determina si un archivo debe ser excluido del escaneo.
 * Retorna true si el archivo es "basura" y no aporta a la estructura.
 */
function isExcludedFile(fileName: string, filePath: string): boolean {
  // Excluir por nombre exacto
  if (EXCLUDED_FILENAMES.has(fileName)) return true

  // Excluir por extensión
  const ext = path.extname(fileName).toLowerCase()
  if (EXCLUDED_EXTENSIONS.has(ext)) return true

  // Excluir por patrón
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(fileName)) return true
  }

  // Excluir archivos demasiado grandes (probablemente generados o data)
  try {
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_FILE_SIZE_BYTES) return true
  } catch {
    // Si no se puede leer, lo excluimos
    return true
  }

  return false
}

/**
 * Escanea recursivamente un directorio y retorna las rutas de TODOS los archivos
 * relevantes para la estructura del proyecto.
 * 
 * Lógica: incluir todo excepto directorios ignorados, archivos binarios,
 * minificados, generados y otros artefactos de build/cache.
 */
export function scanAllFiles(dir: string, baseDir: string): string[] {
  const results: string[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    // Ignorar directorios ocultos (empiezan con .) excepto archivos de config
    if (entry.isDirectory() && entry.name.startsWith('.')) continue
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...scanAllFiles(fullPath, baseDir))
    } else if (entry.isFile()) {
      if (!isExcludedFile(entry.name, fullPath)) {
        results.push(fullPath)
      }
    }
  }

  return results
}

// Extensiones donde sabemos parsear imports para extraer dependencias
const PARSEABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.php', '.phtml',
  '.rb', '.erb',
  '.java', '.kt', '.kts', '.scala',
  '.cs',
  '.go',
  '.rs',
  '.swift',
  '.dart',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm', '.vue', '.svelte', '.astro', // Frontend templates
])

/**
 * Indica si un archivo tiene una extensión donde podemos parsear imports.
 */
export function canParseImports(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return PARSEABLE_EXTENSIONS.has(ext)
}

/**
 * Retorna el "lenguaje" del archivo para seleccionar la estrategia de parsing.
 */
export function getFileLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const langMap: Record<string, string> = {
    '.ts': 'js', '.tsx': 'js', '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js',
    '.py': 'python', '.pyw': 'python',
    '.php': 'php', '.phtml': 'php',
    '.rb': 'ruby', '.erb': 'ruby',
    '.java': 'java', '.kt': 'java', '.kts': 'java', '.scala': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.dart': 'dart',
    '.css': 'css', '.scss': 'css', '.sass': 'css', '.less': 'css',
    '.html': 'html', '.htm': 'html', '.vue': 'html', '.svelte': 'html', '.astro': 'html',
  }
  return langMap[ext] ?? 'unknown'
}

/**
 * Indica si un archivo es de texto y puede ser analizado para detectar integraciones.
 * Incluye todos los archivos de código fuente (cualquier lenguaje).
 */
export function isTextSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  // Extensiones de código fuente donde vale la pena buscar patrones de integración
  const textExtensions = new Set([
    // JS/TS
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    // Python
    '.py', '.pyw',
    // PHP
    '.php', '.phtml',
    // Ruby
    '.rb', '.erb',
    // Java/Kotlin/Scala
    '.java', '.kt', '.kts', '.scala',
    // C#
    '.cs',
    // Go
    '.go',
    // Rust
    '.rs',
    // Swift
    '.swift',
    // Dart
    '.dart',
    // Config/infra (pueden tener connection strings)
    '.yaml', '.yml', '.toml', '.ini', '.cfg',
    // Otros
    '.lua', '.r', '.R', '.jl', '.ex', '.exs', '.clj',
  ])
  return textExtensions.has(ext)
}
