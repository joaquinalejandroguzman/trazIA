import { buildAnalysisResult } from './orchestrator'
import type { ModuleNode, IntegrationNode } from '../../shared/types'

function makeModule(overrides: Partial<ModuleNode> & { id: string }): ModuleNode {
  return {
    name: overrides.id.split('/').pop()?.replace(/\.[^.]+$/, '') ?? overrides.id,
    type: 'module',
    path: overrides.id,
    dependencies: [],
    specStatus: 'untraced',
    specHealthScore: 0,
    ...overrides,
  }
}

describe('buildAnalysisResult', () => {
  it('returns correct totals and counts', () => {
    const modules = [
      makeModule({ id: 'src/a.ts', specStatus: 'traced', specHealthScore: 80 }),
      makeModule({ id: 'src/b.ts', specStatus: 'untraced', specHealthScore: 0 }),
      makeModule({ id: 'src/c.ts', specStatus: 'drift', specHealthScore: 40 }),
      makeModule({ id: 'config.json', specStatus: 'na', specHealthScore: 0 }),
    ]
    const integrations: IntegrationNode[] = []

    const result = buildAnalysisResult('https://github.com/test/repo', modules, integrations)

    expect(result.totalModules).toBe(4)
    expect(result.tracedCount).toBe(1)
    expect(result.untracedCount).toBe(1)
    expect(result.driftCount).toBe(1)
  })

  it('excludes na modules from projectHealthScore', () => {
    const modules = [
      makeModule({ id: 'src/a.ts', specStatus: 'traced', specHealthScore: 100 }),
      makeModule({ id: 'config.json', specStatus: 'na', specHealthScore: 0 }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    // Only traced module counts: (100) / 1 = 100
    expect(result.projectHealthScore).toBe(100)
  })

  it('returns 0 healthScore when all modules are na', () => {
    const modules = [
      makeModule({ id: 'a.json', specStatus: 'na', specHealthScore: 0 }),
      makeModule({ id: 'b.css', specStatus: 'na', specHealthScore: 0 }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    expect(result.projectHealthScore).toBe(0)
  })

  it('creates dependency edges between modules', () => {
    const modules = [
      makeModule({ id: 'src/a.ts', dependencies: ['src/b.ts'] }),
      makeModule({ id: 'src/b.ts', dependencies: [] }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    const depEdges = result.edges.filter(e => e.type === 'dependency')
    expect(depEdges).toHaveLength(1)
    expect(depEdges[0]).toEqual({ source: 'src/a.ts', target: 'src/b.ts', type: 'dependency' })
  })

  it('creates integration edges', () => {
    const modules = [
      makeModule({ id: 'src/db.ts' }),
    ]
    const integrations: IntegrationNode[] = [{
      id: 'integration:pg',
      name: 'PostgreSQL',
      type: 'database',
      detectedIn: ['src/db.ts'],
      description: 'uses pg',
    }]

    const result = buildAnalysisResult('url', modules, integrations)
    const intEdges = result.edges.filter(e => e.type === 'integration')
    expect(intEdges).toHaveLength(1)
    expect(intEdges[0]).toEqual({ source: 'src/db.ts', target: 'integration:pg', type: 'integration' })
  })

  it('detects primary language', () => {
    const modules = [
      makeModule({ id: 'src/a.ts' }),
      makeModule({ id: 'src/b.ts' }),
      makeModule({ id: 'src/c.py' }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    expect(result.primaryLanguage).toBe('TypeScript')
  })

  it('creates folders for directories', () => {
    const modules = [
      makeModule({ id: 'src/routes/a.ts' }),
      makeModule({ id: 'src/routes/b.ts' }),
      makeModule({ id: 'src/utils/c.ts' }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    expect(result.folders.length).toBeGreaterThan(0)
    const folderIds = result.folders.map(f => f.id)
    expect(folderIds).toContain('src/routes')
  })

  it('assigns parentFolder to modules', () => {
    const modules = [
      makeModule({ id: 'src/routes/a.ts' }),
      makeModule({ id: 'src/routes/b.ts' }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    for (const mod of result.modules) {
      expect(mod.parentFolder).toBeDefined()
    }
  })

  it('rounds projectHealthScore to integer', () => {
    const modules = [
      makeModule({ id: 'a.ts', specStatus: 'traced', specHealthScore: 33 }),
      makeModule({ id: 'b.ts', specStatus: 'drift', specHealthScore: 34 }),
    ]

    const result = buildAnalysisResult('url', modules, [])
    // (33 + 34) / 2 = 33.5 → rounded to 34
    expect(result.projectHealthScore).toBe(34)
    expect(Number.isInteger(result.projectHealthScore)).toBe(true)
  })
})
