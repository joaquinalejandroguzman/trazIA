// Property-based tests para el constructor de contexto del chat
// Feature: chat-trazia

import fc from 'fast-check'
import { ModuleNode, SpecStatus } from '../../shared/types'
import { buildRepoContext, detectMentionedModules } from './context_builder'

// Generador de SpecStatus válido
const specStatusArb = fc.constantFrom<SpecStatus>('traced', 'drift', 'untraced', 'na')

// Generador de ModuleNode con campos obligatorios
const moduleNodeArb = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9_/]*\.[a-z]+$/),
  name: fc.stringMatching(/^[a-z][a-z0-9_-]{1,20}$/),
  type: fc.constant('module' as const),
  dependencies: fc.array(fc.stringMatching(/^[a-z][a-z0-9_/]*\.[a-z]+$/), { maxLength: 5 }),
  path: fc.stringMatching(/^src\/[a-z][a-z0-9_/]*\.[a-z]+$/),
  specStatus: specStatusArb,
  specHealthScore: fc.integer({ min: 0, max: 100 }),
  linesOfCode: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
  lastModified: fc.option(
    fc.integer({ min: 946684800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
    { nil: undefined }
  ),
  // Usar prefijos únicos para evitar falsos positivos en búsquedas de substring
  sourceContent: fc.option(
    fc.stringMatching(/^[a-z]{5,30}$/).map(s => `__SOURCE__${s}__`),
    { nil: undefined }
  ),
  earsSpec: fc.option(
    fc.stringMatching(/^[a-z]{5,30}$/).map(s => `__EARS__${s}__`),
    { nil: undefined }
  ),
})

describe('Feature: chat-trazia, Property 6: Contexto incluye metadatos completos de todos los módulos', () => {
  /**
   * Validates: Requirements 3.1
   * Para cualquier array de ModuleNode[], el contexto generado debe contener
   * id, name, path, type, dependencies, specStatus y specHealthScore de cada módulo.
   */
  it('el contexto incluye todos los metadatos requeridos de cada módulo', () => {
    fc.assert(
      fc.property(
        fc.array(moduleNodeArb, { minLength: 1, maxLength: 10 }),
        (modules) => {
          const ctx = buildRepoContext(modules)

          for (const mod of modules) {
            expect(ctx).toContain(mod.id)
            expect(ctx).toContain(mod.name)
            expect(ctx).toContain(mod.path)
            expect(ctx).toContain(mod.type)
            expect(ctx).toContain(mod.specStatus)
            expect(ctx).toContain(String(mod.specHealthScore))
            // Dependencias: si hay alguna, deben aparecer en el contexto
            for (const dep of mod.dependencies) {
              expect(ctx).toContain(dep)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: chat-trazia, Property 7: Truncado de README a 3000 caracteres', () => {
  /**
   * Validates: Requirements 3.2
   * Para cualquier string readme con longitud > 3000, el contexto debe contener
   * como máximo 3000 caracteres del readme.
   */
  it('el README se trunca a máximo 3000 caracteres', () => {
    fc.assert(
      fc.property(
        // Generar readme con caracteres alfanuméricos para evitar ambigüedades con whitespace
        fc.stringMatching(/^[A-Z0-9]{3001,5000}$/),
        fc.array(moduleNodeArb, { minLength: 1, maxLength: 3 }),
        (readme, modules) => {
          const ctx = buildRepoContext(modules, { readme })

          // El README truncado (primeros 3000 chars) debe estar presente
          const truncatedReadme = readme.slice(0, 3000)
          expect(ctx).toContain(truncatedReadme)

          // El caracter 3001 en adelante NO debe estar presente como continuación
          // Verificamos que el readme completo NO está en el output
          expect(ctx).not.toContain(readme)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: chat-trazia, Property 8: Exclusión de campos sensibles del contexto', () => {
  /**
   * Validates: Requirements 3.3, 3.4
   * Para cualquier ModuleNode con sourceContent o earsSpec que NO sea focusModule,
   * el contexto no debe contener su sourceContent ni earsSpec.
   */
  it('excluye sourceContent y earsSpec de módulos que no son focusModule', () => {
    fc.assert(
      fc.property(
        fc.array(
          moduleNodeArb.filter(m => m.sourceContent !== undefined || m.earsSpec !== undefined),
          { minLength: 1, maxLength: 5 }
        ),
        (modules) => {
          // Sin focusModule — ningún sourceContent ni earsSpec debe aparecer
          const ctx = buildRepoContext(modules)

          for (const mod of modules) {
            if (mod.sourceContent) {
              expect(ctx).not.toContain(mod.sourceContent)
            }
            if (mod.earsSpec) {
              expect(ctx).not.toContain(mod.earsSpec)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: chat-trazia, Property 13: Detección de módulo e inclusión de sourceContent', () => {
  /**
   * Validates: Requirements 11.1, 11.2, 11.5
   * Para cualquier mensaje que contiene el nombre de un módulo existente,
   * detectMentionedModule retorna ese módulo y buildRepoContext con focusModule
   * incluye su sourceContent.
   */
  it('detecta módulo por nombre e incluye su sourceContent en el contexto', () => {
    fc.assert(
      fc.property(
        fc.array(moduleNodeArb.map(m => ({ ...m, sourceContent: `CODE_${m.name}` })), { minLength: 1, maxLength: 5 }),
        fc.nat(),
        (modules, indexSeed) => {
          // Seleccionar un módulo aleatorio del array
          const targetIndex = indexSeed % modules.length
          const targetModule = modules[targetIndex]

          // Crear un mensaje que menciona el nombre del módulo
          const message = `¿Qué hace ${targetModule.name}?`

          // detectMentionedModules debe encontrarlo
          const detected = detectMentionedModules(message, modules)
          expect(detected.length).toBeGreaterThan(0)

          // buildRepoContext con focusModules debe incluir su sourceContent
          const ctx = buildRepoContext(modules, { focusModules: detected })
          expect(ctx).toContain(`CODE_${detected[0].name}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Feature: chat-trazia, Property 15: Límite de un solo módulo enriquecido por pregunta', () => {
  /**
   * Validates: Requirements 11.4
   * Para cualquier invocación a buildRepoContext, el contexto contiene el sourceContent
   * de como máximo 1 módulo.
   */
  it('el contexto contiene sourceContent de máximo 1 módulo (el focusModule)', () => {
    // Generador que siempre asigna sourceContent único
    const moduleWithSourceArb = moduleNodeArb.map((m) => ({
      ...m,
      sourceContent: `UNIQUE_SOURCE_${m.id}`,
    }))

    fc.assert(
      fc.property(
        fc.array(moduleWithSourceArb, { minLength: 2, maxLength: 8 }),
        fc.nat(),
        (modules: ModuleNode[], indexSeed: number) => {
          const focusIndex = indexSeed % modules.length
          const focusModule = modules[focusIndex]

          const ctx = buildRepoContext(modules, { focusModules: [focusModule] })

          // Solo el sourceContent del focusModule debe aparecer
          let sourceContentCount = 0
          for (const mod of modules) {
            if (mod.sourceContent && ctx.includes(mod.sourceContent)) {
              sourceContentCount++
            }
          }

          expect(sourceContentCount).toBeLessThanOrEqual(1)
          // Y si hay uno, debe ser el del focusModule
          if (sourceContentCount === 1) {
            expect(ctx).toContain(focusModule.sourceContent)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
