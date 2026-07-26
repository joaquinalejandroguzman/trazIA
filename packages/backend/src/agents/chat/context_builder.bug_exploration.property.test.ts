// Bug condition exploration test — Bug 2: sourceContent leaking into general questions
// Feature: multi-module-chat-bugs
// Este test DEBE FALLAR en código sin fixear — el fallo confirma que el bug existe.

import fc from 'fast-check'
import { ModuleNode, SpecStatus } from '../../shared/types'
import { buildRepoContext } from './context_builder'

// Generador de SpecStatus válido
const specStatusArb = fc.constantFrom<SpecStatus>('traced', 'drift', 'untraced', 'na')

// Generador de ModuleNode con sourceContent siempre presente (marcado con prefijo único)
const moduleWithSourceArb: fc.Arbitrary<ModuleNode> = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9_/]{2,15}\.[a-z]+$/),
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{2,12}$/),
  type: fc.constant('module' as const),
  dependencies: fc.array(fc.stringMatching(/^[a-z][a-z0-9_/]*\.[a-z]+$/), { maxLength: 3 }),
  path: fc.stringMatching(/^src\/[a-z][a-z0-9_/]{2,15}\.[a-z]+$/),
  specStatus: specStatusArb,
  specHealthScore: fc.integer({ min: 0, max: 100 }),
  linesOfCode: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
  lastModified: fc.option(
    fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
    { nil: undefined }
  ),
  // sourceContent siempre presente con marcador único para detectar su presencia
  sourceContent: fc.stringMatching(/^[a-z]{5,20}$/).map(s => `__SOURCE__${s}__`),
  earsSpec: fc.option(
    fc.stringMatching(/^[a-z]{5,20}$/).map(s => `__EARS__${s}__`),
    { nil: undefined }
  ),
}) as fc.Arbitrary<ModuleNode>

describe('Feature: multi-module-chat-bugs, Property 1: Bug Condition — includeSnippets:false Still Includes sourceContent', () => {
  /**
   * Validates: Requirements 1.2
   *
   * Bug 2: Cuando isGeneralRepoQuestion es true, focusModules = modules envía snippets
   * de código de todos los módulos al LLM. Este test demuestra que pasar
   * includeSnippets: false NO tiene efecto en el código sin fixear — el sourceContent
   * sigue apareciendo en el output.
   *
   * EXPECTED: Este test FALLA en código sin fixear (confirma que el bug existe).
   */
  it('buildRepoContext con includeSnippets:false NO debe incluir sourceContent de ningún módulo', () => {
    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 1, maxLength: 8 }),
        (modules: ModuleNode[]) => {
          // Invocar buildRepoContext con focusModules = todos los módulos e includeSnippets: false
          // Nota: includeSnippets no existe aún en la interfaz, se pasa igualmente para demostrar
          // que no tiene efecto (el bug).
          const result = buildRepoContext(modules, {
            focusModules: modules,
            includeSnippets: false,
          } as any)

          // ASSERT 1: El output NO debe contener sourceContent de ningún módulo
          for (const mod of modules) {
            if (mod.sourceContent) {
              expect(result).not.toContain(mod.sourceContent)
            }
          }

          // ASSERT 2: El output SÍ debe contener metadata de cada módulo
          for (const mod of modules) {
            expect(result).toContain(mod.name)
            expect(result).toContain(mod.path)
            expect(result).toContain(mod.specStatus)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
