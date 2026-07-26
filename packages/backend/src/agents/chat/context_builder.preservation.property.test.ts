// Property-based preservation tests para context_builder
// Feature: multi-module-chat-bugs — Preservation properties (BEFORE fix)
// Estas propiedades capturan el comportamiento ACTUAL que debe preservarse tras el fix.

import fc from 'fast-check'
import { ModuleNode } from '../../shared/types'
import {
  buildRepoContext,
  detectMentionedModules,
  isGeneralRepoQuestion,
  SNIPPET_LIMIT_SMALL,
  SNIPPET_LIMIT_LARGE,
  GENERAL_KEYWORDS,
} from './context_builder'

// --- Generadores ---

const specStatusArb = fc.constantFrom<ModuleNode['specStatus']>('traced', 'drift', 'untraced', 'na')

// Generador de ModuleNode con sourceContent garantizado (para tests de snippets)
const moduleWithSourceArb = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9_]{2,10}\/[a-z][a-z0-9_]{2,10}\.[a-z]{2,3}$/),
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{2,15}$/),
  type: fc.constant('module' as const),
  dependencies: fc.array(fc.stringMatching(/^[a-z][a-z0-9_]{2,8}\.[a-z]{2,3}$/), { maxLength: 3 }),
  path: fc.stringMatching(/^src\/[a-z][a-z0-9_]{2,10}\/[a-z][a-z0-9_]{2,10}\.[a-z]{2,3}$/),
  specStatus: specStatusArb,
  specHealthScore: fc.integer({ min: 0, max: 100 }),
  linesOfCode: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
  lastModified: fc.option(
    fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
    { nil: undefined }
  ),
  sourceContent: fc.stringMatching(/^[a-z]{10,600}$/).map(s => `__PRESERVE_SRC__${s}__`),
  earsSpec: fc.option(
    fc.stringMatching(/^[a-z]{5,20}$/).map(s => `__EARS__${s}__`),
    { nil: undefined }
  ),
})

// Generador de ModuleNode sin sourceContent
const moduleWithoutSourceArb = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9_]{2,10}\/[a-z][a-z0-9_]{2,10}\.[a-z]{2,3}$/),
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{2,15}$/),
  type: fc.constant('module' as const),
  dependencies: fc.array(fc.stringMatching(/^[a-z][a-z0-9_]{2,8}\.[a-z]{2,3}$/), { maxLength: 3 }),
  path: fc.stringMatching(/^src\/[a-z][a-z0-9_]{2,10}\/[a-z][a-z0-9_]{2,10}\.[a-z]{2,3}$/),
  specStatus: specStatusArb,
  specHealthScore: fc.integer({ min: 0, max: 100 }),
  linesOfCode: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
  lastModified: fc.option(
    fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
    { nil: undefined }
  ),
  sourceContent: fc.constant(undefined),
  earsSpec: fc.option(
    fc.stringMatching(/^[a-z]{5,20}$/).map(s => `__EARS__${s}__`),
    { nil: undefined }
  ),
})

// Generador de ModuleNode genérico (con o sin sourceContent)
const moduleNodeArb = fc.oneof(moduleWithSourceArb, moduleWithoutSourceArb)

// --- Preservation A ---
describe('Preservation A: focusModules sin includeSnippets incluye sourceContent truncado', () => {
  /**
   * Validates: Requirements 3.2, 3.4, 3.5
   * Para cualquier array de ModuleNode con sourceContent y focusModules especificado
   * (sin parámetro includeSnippets), el output incluye sourceContent truncado
   * al snippetLimit correspondiente (500 para <5 módulos, 300 para >=5).
   */
  it('incluye sourceContent truncado a 500 chars cuando hay <5 focusModules', () => {
    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 1, maxLength: 4 }),
        (modules) => {
          // Asegurar IDs únicos
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length === 0) return

          const ctx = buildRepoContext(uniqueModules, { focusModules: uniqueModules })

          for (const mod of uniqueModules) {
            // El sourceContent truncado a SNIPPET_LIMIT_SMALL debe estar presente
            const expectedSnippet = mod.sourceContent!.slice(0, SNIPPET_LIMIT_SMALL)
            expect(ctx).toContain(expectedSnippet)
            // Si el sourceContent es más largo que el límite, el contenido completo NO debe estar
            if (mod.sourceContent!.length > SNIPPET_LIMIT_SMALL) {
              expect(ctx).not.toContain(mod.sourceContent!)
            }
          }
        }
      ),
      { numRuns: 80 }
    )
  })

  it('incluye sourceContent truncado a 300 chars cuando hay >=5 focusModules', () => {
    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 5, maxLength: 8 }),
        (modules) => {
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length < 5) return

          const ctx = buildRepoContext(uniqueModules, { focusModules: uniqueModules })

          for (const mod of uniqueModules) {
            const expectedSnippet = mod.sourceContent!.slice(0, SNIPPET_LIMIT_LARGE)
            expect(ctx).toContain(expectedSnippet)
            // Si sourceContent > SNIPPET_LIMIT_LARGE, no debe incluirse entero
            if (mod.sourceContent!.length > SNIPPET_LIMIT_LARGE) {
              expect(ctx).not.toContain(mod.sourceContent!)
            }
          }
        }
      ),
      { numRuns: 80 }
    )
  })
})

// --- Preservation B ---
describe('Preservation B: sin focusModules excluye todo sourceContent', () => {
  /**
   * Validates: Requirements 3.2
   * Para cualquier array de ModuleNode sin focusModules especificado,
   * el output NO debe contener sourceContent de ningún módulo.
   */
  it('excluye sourceContent de todos los módulos cuando no hay focusModules', () => {
    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 1, maxLength: 8 }),
        (modules) => {
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length === 0) return

          // Sin focusModules
          const ctx = buildRepoContext(uniqueModules)

          for (const mod of uniqueModules) {
            // sourceContent NO debe aparecer en el output
            expect(ctx).not.toContain(mod.sourceContent!)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Preservation C ---
describe('Preservation C: focusModule (deprecated singular) incluye sourceContent', () => {
  /**
   * Validates: Requirements 3.5
   * Para cualquier ModuleNode con sourceContent usando la API deprecated focusModule,
   * el output incluye su sourceContent truncado a SNIPPET_LIMIT_SMALL (ya que es 1 solo módulo).
   */
  it('incluye sourceContent del focusModule (API deprecated)', () => {
    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 1, maxLength: 5 }),
        fc.nat(),
        (modules, indexSeed) => {
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length === 0) return

          const focusIndex = indexSeed % uniqueModules.length
          const focusModule = uniqueModules[focusIndex]

          // Usar API deprecated focusModule (singular)
          const ctx = buildRepoContext(uniqueModules, { focusModule })

          // El sourceContent truncado del focusModule debe estar presente
          const expectedSnippet = focusModule.sourceContent!.slice(0, SNIPPET_LIMIT_SMALL)
          expect(ctx).toContain(expectedSnippet)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Preservation D ---
describe('Preservation D: isGeneralRepoQuestion retorna false con módulos mencionados', () => {
  /**
   * Validates: Requirements 3.6
   * Para cualquier mensaje con keyword general + módulos mencionados no vacíos,
   * isGeneralRepoQuestion retorna false.
   */
  it('retorna false cuando mentionedModules no está vacío (incluso con keyword)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GENERAL_KEYWORDS),
        fc.stringMatching(/^[a-z ]{0,20}$/),
        fc.array(moduleWithSourceArb, { minLength: 1, maxLength: 5 }),
        (keyword, padding, modules) => {
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length === 0) return

          // Mensaje que contiene un keyword general
          const message = `${padding} ${keyword} ${padding}`

          // Con módulos mencionados no vacíos → siempre false
          const result = isGeneralRepoQuestion(message, uniqueModules)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Preservation E ---
describe('Preservation E: detectMentionedModules no produce duplicados', () => {
  /**
   * Validates: Requirements 3.4
   * Para cualquier mensaje y array de ModuleNode,
   * detectMentionedModules nunca retorna módulos duplicados (por id).
   */
  it('nunca retorna módulos con id duplicado', () => {
    fc.assert(
      fc.property(
        fc.array(moduleNodeArb, { minLength: 1, maxLength: 10 }),
        fc.stringMatching(/^[a-z ]{1,50}$/),
        (modules, messagePart) => {
          const uniqueModules = deduplicateById(modules)
          if (uniqueModules.length === 0) return

          // Construir mensaje que menciona algunos módulos
          const mentionNames = uniqueModules.slice(0, 3).map(m => m.name).join(' ')
          const message = `${messagePart} ${mentionNames}`

          const result = detectMentionedModules(message, uniqueModules)

          // Verificar que no hay duplicados por id
          const ids = result.map(m => m.id)
          const uniqueIds = new Set(ids)
          expect(ids.length).toBe(uniqueIds.size)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('nunca retorna duplicados incluso con módulos que matchean por nombre Y path', () => {
    fc.assert(
      fc.property(
        moduleWithSourceArb,
        (mod) => {
          // Crear mensaje que menciona tanto el nombre como el último segmento del path
          const lastSegment = mod.path.split('/').pop() ?? ''
          const message = `hablemos de ${mod.name} y también ${lastSegment}`

          const result = detectMentionedModules(message, [mod])

          // Máximo 1 resultado (sin duplicados)
          const ids = result.map(m => m.id)
          const uniqueIds = new Set(ids)
          expect(ids.length).toBe(uniqueIds.size)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// --- Helper ---

/** Deduplica módulos por id para evitar colisiones del generador */
function deduplicateById(modules: ModuleNode[]): ModuleNode[] {
  const seen = new Set<string>()
  return modules.filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}
