import type { IntegrationType } from '../types'

// Fuente de verdad única para los colores del grafo
// Colores diferenciados por "zona" del proyecto y tipo de archivo

export interface StatusColorSet {
  bg: string      // fondo del nodo
  border: string  // borde del nodo
  text: string    // texto dentro del nodo
}

// ============================================================
// Colores por zona del proyecto (basado en ruta del archivo)
// ============================================================

export type ProjectZone = 'frontend' | 'backend' | 'config' | 'shared' | 'unknown'

export const ZONE_COLORS: Record<ProjectZone, StatusColorSet> = {
  frontend: { bg: '#ede7f6', border: '#7c4dff', text: '#311b92' },   // violeta
  backend:  { bg: '#e3f2fd', border: '#2196f3', text: '#0d47a1' },   // azul
  config:   { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c' },   // púrpura claro
  shared:   { bg: '#e8f5e9', border: '#4caf50', text: '#1b5e20' },   // verde
  unknown:  { bg: '#f5f5f5', border: '#9e9e9e', text: '#424242' },   // gris
}

// Colores para integraciones (BD y APIs externas)
export const INTEGRATION_COLORS: Record<IntegrationType, StatusColorSet> = {
  database:     { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },  // verde oscuro
  external_api: { bg: '#fff3e0', border: '#ef6c00', text: '#e65100' },  // naranja
}

// ============================================================
// Íconos por extensión de archivo
// ============================================================

export function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const name = filePath.split('/').pop()?.toLowerCase() ?? ''

  // Archivos de configuración por nombre
  if (name === 'package.json' || name === 'tsconfig.json') return '⚙️'
  if (name === 'dockerfile' || name.startsWith('docker-compose')) return '🐳'
  if (name === 'makefile' || name === 'rakefile') return '🔧'
  if (name.endsWith('.config.js') || name.endsWith('.config.ts')) return '⚙️'

  // Por extensión
  const iconMap: Record<string, string> = {
    // Frontend
    'html': '🌐',
    'htm': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'sass': '🎨',
    'less': '🎨',
    'vue': '💚',
    'svelte': '🧡',
    'astro': '🚀',
    // JavaScript/TypeScript
    'js': '📜',
    'jsx': '⚛️',
    'ts': '📘',
    'tsx': '⚛️',
    'mjs': '📜',
    'cjs': '📜',
    // Python
    'py': '🐍',
    'pyw': '🐍',
    // PHP
    'php': '🐘',
    'phtml': '🐘',
    // Ruby
    'rb': '💎',
    'erb': '💎',
    // Java/Kotlin
    'java': '☕',
    'kt': '🟣',
    'kts': '🟣',
    'scala': '🔴',
    // C#
    'cs': '🟦',
    // Go
    'go': '🐹',
    // Rust
    'rs': '🦀',
    // Swift
    'swift': '🐦',
    // Dart
    'dart': '🎯',
    // Config / data
    'json': '📋',
    'yaml': '📋',
    'yml': '📋',
    'toml': '📋',
    'xml': '📋',
    'ini': '📋',
    'env': '🔒',
    // Docs
    'md': '📝',
    'txt': '📄',
    'rst': '📝',
    // Shell
    'sh': '🖥️',
    'bash': '🖥️',
    'zsh': '🖥️',
    'bat': '🖥️',
    'ps1': '🖥️',
    // SQL
    'sql': '🗃️',
    // Lua
    'lua': '🌙',
    // R
    'r': '📊',
  }

  return iconMap[ext] ?? '📄'
}

// ============================================================
// Detección de zona del proyecto
// ============================================================

// Patrones de ruta que indican zona frontend
const FRONTEND_PATTERNS = [
  /\bfrontend\b/i, /\bclient\b/i, /\bweb\b/i, /\bui\b/i,
  /\bpublic\b/i, /\bstatic\b/i, /\bassets\b/i,
  /\bsrc\/components\b/i, /\bsrc\/pages\b/i, /\bsrc\/views\b/i,
  /\btemplates\b/i, /\bsrc\/app\b/i,
]

// Patrones de ruta que indican zona backend
const BACKEND_PATTERNS = [
  /\bbackend\b/i, /\bserver\b/i, /\bapi\b/i,
  /\bsrc\/routes\b/i, /\bsrc\/services\b/i, /\bsrc\/agents\b/i,
  /\bsrc\/controllers\b/i, /\bsrc\/models\b/i,
  /\bapp\/models\b/i, /\bapp\/views\b/i, /\bapp\/controllers\b/i,  // Rails/Django
]

// Patrones de archivos de configuración
const CONFIG_PATTERNS = [
  /\.(config|rc|cfg)\b/i, /^\./, /\bconfig\b/i, /\bsettings\b/i,
]

// Patrones de código compartido
const SHARED_PATTERNS = [
  /\bshared\b/i, /\bcommon\b/i, /\blib\b/i, /\butils\b/i, /\bhelpers\b/i,
]

/**
 * Detecta la "zona" del proyecto a la que pertenece un archivo según su ruta.
 */
export function detectZone(filePath: string): ProjectZone {
  // Extensiones que SIEMPRE son frontend sin importar la ruta
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (['html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'astro'].includes(ext)) {
    return 'frontend'
  }

  // Configuración por extensión/nombre
  const fileName = filePath.split('/').pop() ?? ''
  if (CONFIG_PATTERNS.some((p) => p.test(fileName))) return 'config'

  // Por ruta
  if (SHARED_PATTERNS.some((p) => p.test(filePath))) return 'shared'
  if (FRONTEND_PATTERNS.some((p) => p.test(filePath))) return 'frontend'
  if (BACKEND_PATTERNS.some((p) => p.test(filePath))) return 'backend'

  return 'unknown'
}

// ============================================================
// Colores para la leyenda
// ============================================================

export const ZONE_DOT_COLORS: Record<ProjectZone, string> = {
  frontend: ZONE_COLORS.frontend.border,
  backend: ZONE_COLORS.backend.border,
  config: ZONE_COLORS.config.border,
  shared: ZONE_COLORS.shared.border,
  unknown: ZONE_COLORS.unknown.border,
}
