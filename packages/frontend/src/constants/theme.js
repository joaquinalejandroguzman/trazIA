export const ZONE_COLORS = {
    frontend: { bg: '#ede7f6', border: '#7c4dff', text: '#311b92' }, // violeta
    backend: { bg: '#e3f2fd', border: '#2196f3', text: '#0d47a1' }, // azul
    config: { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c' }, // púrpura claro
    shared: { bg: '#e8f5e9', border: '#4caf50', text: '#1b5e20' }, // verde
    unknown: { bg: '#f5f5f5', border: '#9e9e9e', text: '#424242' }, // gris
};
// Colores para integraciones (BD y APIs externas)
export const INTEGRATION_COLORS = {
    database: { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' }, // verde oscuro
    external_api: { bg: '#fff3e0', border: '#ef6c00', text: '#e65100' }, // naranja
};
// ============================================================
// Íconos por extensión de archivo
// ============================================================
export function getFileIcon(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const name = filePath.split('/').pop()?.toLowerCase() ?? '';
    // Archivos de configuración por nombre
    if (name === 'package.json' || name === 'tsconfig.json')
        return '⚙️';
    if (name === 'dockerfile' || name.startsWith('docker-compose'))
        return '🐳';
    if (name === 'makefile' || name === 'rakefile')
        return '🔧';
    if (name.endsWith('.config.js') || name.endsWith('.config.ts'))
        return '⚙️';
    // Por extensión
    const iconMap = {
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
    };
    return iconMap[ext] ?? '📄';
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
];
// Patrones de ruta que indican zona backend
const BACKEND_PATTERNS = [
    /\bbackend\b/i, /\bserver\b/i, /\bapi\b/i,
    /\bsrc\/routes\b/i, /\bsrc\/services\b/i, /\bsrc\/agents\b/i,
    /\bsrc\/controllers\b/i, /\bsrc\/models\b/i,
    /\bapp\/models\b/i, /\bapp\/views\b/i, /\bapp\/controllers\b/i, // Rails/Django
];
// Patrones de archivos de configuración
const CONFIG_PATTERNS = [
    /\.(config|rc|cfg)\b/i, /^\./, /\bconfig\b/i, /\bsettings\b/i,
];
// Patrones de código compartido
const SHARED_PATTERNS = [
    /\bshared\b/i, /\bcommon\b/i, /\blib\b/i, /\butils\b/i, /\bhelpers\b/i,
];
/**
 * Detecta la "zona" del proyecto a la que pertenece un archivo según su ruta.
 */
export function detectZone(filePath) {
    // Extensiones que SIEMPRE son frontend sin importar la ruta
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (['html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'astro'].includes(ext)) {
        return 'frontend';
    }
    // Configuración por extensión/nombre
    const fileName = filePath.split('/').pop() ?? '';
    if (CONFIG_PATTERNS.some((p) => p.test(fileName)))
        return 'config';
    // Por ruta
    if (SHARED_PATTERNS.some((p) => p.test(filePath)))
        return 'shared';
    if (FRONTEND_PATTERNS.some((p) => p.test(filePath)))
        return 'frontend';
    if (BACKEND_PATTERNS.some((p) => p.test(filePath)))
        return 'backend';
    return 'unknown';
}
// ============================================================
// Colores para la leyenda
// ============================================================
export const ZONE_DOT_COLORS = {
    frontend: ZONE_COLORS.frontend.border,
    backend: ZONE_COLORS.backend.border,
    config: ZONE_COLORS.config.border,
    shared: ZONE_COLORS.shared.border,
    unknown: ZONE_COLORS.unknown.border,
};
// ============================================================
// Trazabilidad — interpolación de color y score efectivo
// ============================================================
// Anchors RGB para la interpolación lineal de color de trazabilidad
export const TRACEABILITY_ANCHORS = {
    red: { r: 0xe5, g: 0x39, b: 0x35 }, // #e53935 — score 0
    yellow: { r: 0xfd, g: 0xd8, b: 0x35 }, // #fdd835 — score 50
    green: { r: 0x43, g: 0xa0, b: 0x47 }, // #43a047 — score 100
};
/**
 * Interpola un color hexadecimal entre rojo → amarillo → verde
 * según el score de trazabilidad (0–100).
 *
 * Interpolación lineal por canal RGB en dos segmentos:
 *   [0, 50]   rojo → amarillo
 *   [50, 100]  amarillo → verde
 *
 * Clamping: NaN/Infinity/-Infinity → 0, negativo → 0, >100 → 100
 * Formato de salida: siempre `#rrggbb` en minúsculas (7 caracteres)
 */
export function getTraceabilityColor(score) {
    // Score -1 indica specStatus 'na' — color gris neutro
    if (score < 0)
        return '#adb5bd';
    // Clamping de valores no finitos y fuera de rango
    let s = Number.isFinite(score) ? score : 0;
    if (s < 0)
        s = 0;
    if (s > 100)
        s = 100;
    const { red, yellow, green } = TRACEABILITY_ANCHORS;
    let r;
    let g;
    let b;
    if (s <= 50) {
        // Segmento [0, 50]: rojo → amarillo
        const t = s / 50;
        r = Math.round(red.r + (yellow.r - red.r) * t);
        g = Math.round(red.g + (yellow.g - red.g) * t);
        b = Math.round(red.b + (yellow.b - red.b) * t);
    }
    else {
        // Segmento [50, 100]: amarillo → verde
        const t = (s - 50) / 50;
        r = Math.round(yellow.r + (green.r - yellow.r) * t);
        g = Math.round(yellow.g + (green.g - yellow.g) * t);
        b = Math.round(yellow.b + (green.b - yellow.b) * t);
    }
    // Formato #rrggbb en minúsculas
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}
/**
 * Calcula el score efectivo aplicando las reglas de precedencia de specStatus:
 * - specStatus undefined → 0 (tratar como untraced)
 * - specStatus 'untraced' → 0 (siempre rojo, ignora score)
 * - specStatus 'drift' → min(specHealthScore ?? 0, 50) (cap en 50)
 * - specStatus 'traced' → specHealthScore ?? 0
 */
export function getEffectiveScore(specStatus, specHealthScore) {
    const score = specHealthScore ?? 0;
    // No aplica — el módulo no necesita spec
    if (specStatus === 'na') {
        return -1;
    }
    if (specStatus === undefined || specStatus === 'untraced') {
        return 0;
    }
    if (specStatus === 'drift') {
        return Math.min(score, 50);
    }
    // specStatus === 'traced'
    return score;
}
