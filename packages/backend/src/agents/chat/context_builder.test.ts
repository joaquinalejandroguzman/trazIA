// Tests para el constructor de contexto del chat

import { ModuleNode } from '../../shared/types'
import { buildRepoContext, detectMentionedModule } from './context_builder'

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

  it('incluye sourceContent del focusModule y excluye el de otros módulos', () => {
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
