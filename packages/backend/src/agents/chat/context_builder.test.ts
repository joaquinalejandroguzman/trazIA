// Tests para el constructor de contexto del chat

import { ModuleNode } from '../../shared/types'
import { buildRepoContext, detectMentionedModule, detectMentionedModules, isGeneralRepoQuestion, SNIPPET_LIMIT_SMALL, SNIPPET_LIMIT_LARGE } from './context_builder'

// Helper para crear módulos de prueba
function createModule(overrides: Partial<ModuleNode> = {}): ModuleNode {
  return {
    id: 'src/services/payments.ts',
    name: 'payments',
    type: 'module',
    dependencies: ['src/utils/logger.ts'],
    path: 'src/services/payments.ts',
    specStatus: 'traced',
    specHealthScore: 85,
    ...overrides,
  }
}

describe('buildRepoContext', () => {
  it('incluye metadatos básicos de cada módulo', () => {
    const modules: ModuleNode[] = [
      createModule({ id: 'src/a.ts', name: 'módulo-a', path: 'src/a.ts', specStatus: 'traced', specHealthScore: 90 }),
      createModule({ id: 'src/b.ts', name: 'módulo-b', path: 'src/b.ts', dependencies: [], specStatus: 'untraced', specHealthScore: 20 }),
    ]

    const ctx = buildRepoContext(modules)

    // Verifica presencia de campos requeridos para cada módulo
    expect(ctx).toContain('módulo-a')
    expect(ctx).toContain('src/a.ts')
    expect(ctx).toContain('traced')
    expect(ctx).toContain('90')
    expect(ctx).toContain('módulo-b')
    expect(ctx).toContain('untraced')
    expect(ctx).toContain('20')
  })

  it('excluye sourceContent y earsSpec cuando no hay focusModule', () => {
    const modules: ModuleNode[] = [
      createModule({
        sourceContent: 'const secret = "CÓDIGO_FUENTE_SECRETO"',
        earsSpec: 'EARS_SPEC_CONTENT',
      }),
    ]

    const ctx = buildRepoContext(modules)

    expect(ctx).not.toContain('CÓDIGO_FUENTE_SECRETO')
    expect(ctx).not.toContain('EARS_SPEC_CONTENT')
  })

  it('incluye sourceContent del focusModule (deprecated) y excluye el de otros módulos', () => {
    const focusModule = createModule({
      id: 'src/focus.ts',
      name: 'focus',
      path: 'src/focus.ts',
      sourceContent: 'CONTENIDO_DEL_FOCUS_MODULE',
    })
    const otherModule = createModule({
      id: 'src/other.ts',
      name: 'other',
      path: 'src/other.ts',
      sourceContent: 'CONTENIDO_OCULTO_DEL_OTRO',
    })

    const ctx = buildRepoContext([focusModule, otherModule], { focusModule })

    expect(ctx).toContain('CONTENIDO_DEL_FOCUS_MODULE')
    expect(ctx).toContain('--- Código fuente (focus) ---')
    expect(ctx).toContain('--- Fin código fuente ---')
    expect(ctx).not.toContain('CONTENIDO_OCULTO_DEL_OTRO')
  })

  it('trunca el README a 3000 caracteres', () => {
    const longReadme = 'A'.repeat(5000)
    const modules: ModuleNode[] = [createModule()]

    const ctx = buildRepoContext(modules, { readme: longReadme })

    // El README truncado debe tener máximo 3000 chars de 'A'
    const readmeSection = ctx.split('=== README del Proyecto ===')[1]
    expect(readmeSection).toBeDefined()
    // Contar las 'A' en la sección de readme
    const aCount = (readmeSection!.match(/A/g) || []).length
    expect(aCount).toBe(3000)
  })

  it('incluye el README completo si no excede 3000 caracteres', () => {
    const shortReadme = 'Este es un README corto.'
    const modules: ModuleNode[] = [createModule()]

    const ctx = buildRepoContext(modules, { readme: shortReadme })

    expect(ctx).toContain(shortReadme)
  })

  it('maneja gracefully módulos sin campos opcionales', () => {
    const mod = createModule({
      linesOfCode: undefined,
      lastModified: undefined,
    })

    const ctx = buildRepoContext([mod])

    expect(ctx).not.toContain('Líneas de código')
    expect(ctx).not.toContain('Última modificación')
  })

  it('incluye campos opcionales cuando están presentes', () => {
    const mod = createModule({
      linesOfCode: 150,
      lastModified: '2024-01-15T10:00:00Z',
    })

    const ctx = buildRepoContext([mod])

    expect(ctx).toContain('150')
    expect(ctx).toContain('2024-01-15T10:00:00Z')
  })

  it('muestra "ninguna" cuando un módulo no tiene dependencias', () => {
    const mod = createModule({ dependencies: [] })

    const ctx = buildRepoContext([mod])

    expect(ctx).toContain('ninguna')
  })

  it('lista las dependencias separadas por coma', () => {
    const mod = createModule({ dependencies: ['src/a.ts', 'src/b.ts'] })

    const ctx = buildRepoContext([mod])

    expect(ctx).toContain('src/a.ts, src/b.ts')
  })

  it('genera salida en texto plano (no JSON pesado)', () => {
    const modules: ModuleNode[] = [createModule()]

    const ctx = buildRepoContext(modules)

    // No debería parecer un JSON
    expect(ctx).not.toMatch(/^\s*\{/)
    expect(ctx).not.toMatch(/^\s*\[/)
  })
})

describe('detectMentionedModule', () => {
  const modules: ModuleNode[] = [
    createModule({ id: 'src/services/payments.ts', name: 'payments', path: 'src/services/payments.ts' }),
    createModule({ id: 'src/routes/auth.ts', name: 'auth', path: 'src/routes/auth.ts' }),
    createModule({ id: 'src/utils/logger.ts', name: 'logger', path: 'src/utils/logger.ts' }),
  ]

  it('detecta un módulo por nombre exacto (case-insensitive)', () => {
    const result = detectMentionedModule('¿Qué hace PAYMENTS?', modules)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('payments')
  })

  it('detecta un módulo por último segmento del path', () => {
    const result = detectMentionedModule('explicame auth.ts', modules)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('auth')
  })

  it('retorna null cuando no hay match', () => {
    const result = detectMentionedModule('¿Cómo funciona la base de datos?', modules)

    expect(result).toBeNull()
  })

  it('retorna el primer match cuando hay múltiples coincidencias', () => {
    const result = detectMentionedModule('quiero saber de payments y auth', modules)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('payments')
  })

  it('es case-insensitive en la comparación', () => {
    const result = detectMentionedModule('explicame LOGGER', modules)

    expect(result).not.toBeNull()
    expect(result!.name).toBe('logger')
  })

  it('retorna null con array vacío de módulos', () => {
    const result = detectMentionedModule('¿Qué hace payments?', [])

    expect(result).toBeNull()
  })

  it('retorna null con mensaje vacío', () => {
    const result = detectMentionedModule('', modules)

    expect(result).toBeNull()
  })
})

describe('detectMentionedModules', () => {
  const modules: ModuleNode[] = [
    createModule({ id: 'src/services/payments.ts', name: 'payments', path: 'src/services/payments.ts' }),
    createModule({ id: 'src/routes/auth.ts', name: 'auth', path: 'src/routes/auth.ts' }),
    createModule({ id: 'src/utils/logger.ts', name: 'logger', path: 'src/utils/logger.ts' }),
  ]

  it('retorna todos los módulos mencionados en orden del array de entrada', () => {
    const result = detectMentionedModules('quiero saber de auth y payments', modules)

    // payments aparece primero porque está primero en el array de módulos
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('payments')
    expect(result[1].name).toBe('auth')
  })

  it('deduplica: mismo módulo matchea por nombre y path → aparece solo una vez', () => {
    const modsWithOverlap: ModuleNode[] = [
      createModule({ id: 'src/auth.ts', name: 'auth', path: 'src/auth.ts' }),
    ]

    // "auth" matchea tanto por nombre como por último segmento del path (auth.ts)
    const result = detectMentionedModules('hablame de auth y auth.ts', modsWithOverlap)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('auth')
  })

  it('retorna array vacío con mensaje vacío', () => {
    const result = detectMentionedModules('', modules)

    expect(result).toEqual([])
  })

  it('retorna array vacío con array de módulos vacío', () => {
    const result = detectMentionedModules('quiero saber de payments', [])

    expect(result).toEqual([])
  })
})

describe('isGeneralRepoQuestion', () => {
  const modules: ModuleNode[] = [
    createModule({ id: 'src/services/payments.ts', name: 'payments', path: 'src/services/payments.ts' }),
  ]

  it('retorna false cuando hay keyword + módulo mencionado', () => {
    // Tiene keyword "proyecto" pero también menciona un módulo
    const result = isGeneralRepoQuestion('cuéntame sobre el proyecto', modules)

    expect(result).toBe(false)
  })

  it('retorna true cuando solo hay keyword y no hay módulo mencionado', () => {
    const result = isGeneralRepoQuestion('cuéntame sobre el proyecto', [])

    expect(result).toBe(true)
  })

  it('retorna false cuando no hay keyword ni módulo mencionado', () => {
    const result = isGeneralRepoQuestion('hola qué tal', [])

    expect(result).toBe(false)
  })

  it('retorna false con mensaje vacío o solo whitespace', () => {
    expect(isGeneralRepoQuestion('', [])).toBe(false)
    expect(isGeneralRepoQuestion('   ', [])).toBe(false)
  })
})

describe('buildRepoContext con includeSnippets: false', () => {
  it('no incluye sourceContent cuando includeSnippets es false, pero sí metadatos', () => {
    const mod = createModule({
      id: 'src/focus.ts',
      name: 'focus',
      path: 'src/focus.ts',
      sourceContent: 'CONTENIDO_QUE_NO_DEBE_APARECER',
      specStatus: 'traced',
      specHealthScore: 95,
    })

    const ctx = buildRepoContext([mod], { focusModules: [mod], includeSnippets: false })

    expect(ctx).not.toContain('CONTENIDO_QUE_NO_DEBE_APARECER')
    expect(ctx).not.toContain('--- Código fuente')
    // Metadatos sí presentes
    expect(ctx).toContain('focus')
    expect(ctx).toContain('src/focus.ts')
    expect(ctx).toContain('traced')
    expect(ctx).toContain('95')
  })

  it('incluye sourceContent truncado cuando includeSnippets es true', () => {
    const content = 'X'.repeat(1000)
    const mod = createModule({
      id: 'src/focus.ts',
      name: 'focus',
      path: 'src/focus.ts',
      sourceContent: content,
    })

    const ctx = buildRepoContext([mod], { focusModules: [mod], includeSnippets: true })

    expect(ctx).toContain('--- Código fuente (focus) ---')
    // Truncado a SNIPPET_LIMIT_SMALL (500) porque hay < 5 focusModules
    const snippet = ctx.split('--- Código fuente (focus) ---')[1]?.split('--- Fin código fuente ---')[0]
    expect(snippet!.trim().length).toBe(SNIPPET_LIMIT_SMALL)
  })
})

describe('buildRepoContext con focusModules array', () => {
  it('trunca snippets a 500 chars con 3 focusModules', () => {
    const content = 'A'.repeat(1000)
    const mods = Array.from({ length: 3 }, (_, i) =>
      createModule({
        id: `src/mod${i}.ts`,
        name: `mod${i}`,
        path: `src/mod${i}.ts`,
        sourceContent: content,
      })
    )

    const ctx = buildRepoContext(mods, { focusModules: mods })

    // Cada módulo debe tener su snippet truncado a 500
    for (const mod of mods) {
      const sections = ctx.split(`--- Código fuente (${mod.name}) ---`)
      expect(sections.length).toBe(2)
      const snippet = sections[1].split('--- Fin código fuente ---')[0]
      expect(snippet.trim().length).toBe(SNIPPET_LIMIT_SMALL)
    }
  })

  it('trunca snippets a 300 chars con 5+ focusModules', () => {
    const content = 'B'.repeat(1000)
    const mods = Array.from({ length: 5 }, (_, i) =>
      createModule({
        id: `src/mod${i}.ts`,
        name: `mod${i}`,
        path: `src/mod${i}.ts`,
        sourceContent: content,
      })
    )

    const ctx = buildRepoContext(mods, { focusModules: mods })

    // Cada módulo debe tener su snippet truncado a 300
    for (const mod of mods) {
      const sections = ctx.split(`--- Código fuente (${mod.name}) ---`)
      expect(sections.length).toBe(2)
      const snippet = sections[1].split('--- Fin código fuente ---')[0]
      expect(snippet.trim().length).toBe(SNIPPET_LIMIT_LARGE)
    }
  })
})
