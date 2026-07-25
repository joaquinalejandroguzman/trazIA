// Tests de property-based y unitarios para ModulePanel — Properties 5 y 6
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render } from '@testing-library/react'
import React from 'react'
import { ModulePanel } from './module_panel'
import { getEffectiveScore } from '../constants/theme'
import type { ModuleNode, SpecStatus } from '../types'

// Helper: crea un ModuleNode de prueba con los campos de trazabilidad
function createTestModule(overrides: Partial<ModuleNode> = {}): ModuleNode {
  return {
    id: 'test-module',
    name: 'test.ts',
    type: 'module',
    dependencies: [],
    path: 'packages/frontend/src/test.ts',
    ...overrides,
  }
}

// Props por defecto para el panel
const defaultProps = {
  onClose: () => {},
  onGenerateSpec: async () => {},
  generatingSpec: null,
  specError: null,
  specErrorModules: new Set<string>(),
  clearSpecError: () => {},
}

// ============================================================
// Property 5: Button visibility follows effective zone classification
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ============================================================
describe('Property 5: Button visibility follows effective zone classification', () => {
  it('el botón muestra el label correcto según el effective score', () => {
    const specStatusArb = fc.oneof(
      fc.constant(undefined as SpecStatus | undefined),
      fc.constant('traced' as SpecStatus),
      fc.constant('untraced' as SpecStatus),
      fc.constant('drift' as SpecStatus)
    )

    const scoreArb = fc.oneof(
      fc.constant(undefined as number | undefined),
      fc.integer({ min: 0, max: 100 })
    )

    fc.assert(
      fc.property(specStatusArb, scoreArb, (specStatus, specHealthScore) => {
        const module = createTestModule({ specStatus, specHealthScore })
        const { container, unmount } = render(
          <ModulePanel node={module} {...defaultProps} />
        )

        const effectiveScore = getEffectiveScore(specStatus, specHealthScore)

        // Buscar el botón de generación/mejora
        const button = container.querySelector('.module-panel__generate-btn')

        if (specStatus === 'traced' && effectiveScore >= 67) {
          // No debe haber botón
          expect(button).toBeNull()
        } else if (effectiveScore <= 33) {
          // Botón con "Generar Spec"
          expect(button).not.toBeNull()
          expect(button!.textContent).toBe('Generar Spec')
        } else {
          // effectiveScore entre 34 y 66 → "Mejorar Spec"
          expect(button).not.toBeNull()
          expect(button!.textContent).toBe('Mejorar Spec')
        }

        unmount()
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================================
// Property 6: Score display and progress bar accuracy
// Validates: Requirements 4.1, 4.2
// ============================================================
describe('Property 6: Score display and progress bar accuracy', () => {
  it('muestra Math.floor(score)% como texto y la barra tiene width score%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const module = createTestModule({
            specStatus: 'traced',
            specHealthScore: score,
          })

          const { container, unmount } = render(
            <ModulePanel node={module} {...defaultProps} />
          )

          // Verificar que el texto del score se muestra como porcentaje
          const scoreText = `${Math.floor(score)}%`
          expect(container.textContent).toContain(scoreText)

          // Verificar el ancho de la barra de progreso
          // La barra es el div hijo dentro del contenedor de progreso
          const progressBars = container.querySelectorAll('div[style]')
          let foundBar = false
          progressBars.forEach((el) => {
            const style = (el as HTMLElement).style
            if (style.width === `${Math.floor(score)}%` && style.borderRadius === '4px' && style.height === '100%') {
              foundBar = true
            }
          })
          expect(foundBar).toBe(true)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================================
// Property 1: Bug Condition — Panel NA renderiza barra de progreso
// y sección Spec EARS incorrectamente
// Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
// ============================================================
describe('Property 1 (Bug Condition): Panel NA muestra solo texto informativo', () => {
  it('para módulos con specStatus "na", el panel muestra "No aplica trazabilidad", badge "N/A", sin barra de progreso ni sección "Spec EARS"', () => {
    // Generadores: specHealthScore arbitrario (0-100), earsSpec y sourceContent opcionales
    const specHealthScoreArb = fc.oneof(
      fc.constant(undefined as number | undefined),
      fc.integer({ min: 0, max: 100 })
    )
    const earsSpecArb = fc.oneof(
      fc.constant(undefined as string | undefined),
      fc.string({ minLength: 1, maxLength: 200 })
    )
    const sourceContentArb = fc.oneof(
      fc.constant(undefined as string | undefined),
      fc.string({ minLength: 1, maxLength: 500 })
    )

    fc.assert(
      fc.property(specHealthScoreArb, earsSpecArb, sourceContentArb, (specHealthScore, earsSpec, sourceContent) => {
        const module = createTestModule({
          specStatus: 'na',
          specHealthScore,
          earsSpec,
          sourceContent,
        })

        const { container, queryByText, unmount } = render(
          <ModulePanel node={module} {...defaultProps} />
        )

        // Assert: "No aplica trazabilidad" es visible
        expect(queryByText('No aplica trazabilidad')).not.toBeNull()

        // Assert: badge "N/A" está presente (ya se renderiza con el texto 'N/A')
        expect(container.textContent).toContain('N/A')

        // Assert: NO hay barra de progreso (div con height 8px y borderRadius 4px como contenedor)
        const allDivs = container.querySelectorAll('div')
        let hasProgressBar = false
        allDivs.forEach((el) => {
          const style = (el as HTMLElement).style
          if (style.height === '8px' && style.borderRadius === '4px') {
            hasProgressBar = true
          }
        })
        expect(hasProgressBar).toBe(false)

        // Assert: NO se muestra la sección "Spec EARS"
        expect(queryByText('Spec EARS')).toBeNull()

        unmount()
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================================
// Tests unitarios (example-based)
// ============================================================
describe('ModulePanel — badges de estado', () => {
  it('muestra "Trazado" para specStatus traced', () => {
    const module = createTestModule({ specStatus: 'traced', specHealthScore: 80 })
    const { container, unmount } = render(<ModulePanel node={module} {...defaultProps} />)
    expect(container.textContent).toContain('Trazado')
    unmount()
  })

  it('muestra "Sin spec" para specStatus untraced', () => {
    const module = createTestModule({ specStatus: 'untraced', specHealthScore: 0 })
    const { container, unmount } = render(<ModulePanel node={module} {...defaultProps} />)
    expect(container.textContent).toContain('Sin spec')
    unmount()
  })

  it('muestra "Sin spec" cuando specStatus es undefined', () => {
    const module = createTestModule({ specStatus: undefined })
    const { container, unmount } = render(<ModulePanel node={module} {...defaultProps} />)
    expect(container.textContent).toContain('Sin spec')
    unmount()
  })

  it('muestra "Drift" para specStatus drift', () => {
    const module = createTestModule({ specStatus: 'drift', specHealthScore: 40 })
    const { container, unmount } = render(<ModulePanel node={module} {...defaultProps} />)
    expect(container.textContent).toContain('Drift')
    unmount()
  })
})

describe('ModulePanel — texto "Sin trazabilidad"', () => {
  it('muestra "Sin trazabilidad" cuando specHealthScore es undefined', () => {
    const module = createTestModule({ specStatus: 'untraced', specHealthScore: undefined })
    const { container, unmount } = render(<ModulePanel node={module} {...defaultProps} />)
    expect(container.textContent).toContain('Sin trazabilidad')
    unmount()
  })
})

describe('ModulePanel — indicador solo en módulos', () => {
  it('no renderiza la sección de trazabilidad para nodos tipo folder', () => {
    const folderNode = {
      id: 'folder-1',
      name: 'src',
      type: 'folder' as const,
      path: 'packages/frontend/src',
      childCount: 5,
    }
    const { container, unmount } = render(<ModulePanel node={folderNode} {...defaultProps} />)
    expect(container.textContent).not.toContain('Trazabilidad')
    unmount()
  })
})

// ============================================================
// Property 2: Preservation — Comportamiento intacto para specStatus !== 'na'
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ============================================================

describe('Property 2: Preservation — progress bar and Spec EARS section present for non-NA modules', () => {
  // Arbitrary para specStatus excluyendo 'na'
  const nonNaSpecStatusArb = fc.oneof(
    fc.constant('traced' as SpecStatus),
    fc.constant('untraced' as SpecStatus),
    fc.constant('drift' as SpecStatus)
  )

  const scoreArb = fc.integer({ min: 0, max: 100 })

  const earsSpecArb = fc.oneof(
    fc.constant(undefined as string | undefined),
    fc.string({ minLength: 1, maxLength: 200 })
  )

  it('para todo módulo con specStatus !== "na", renderiza barra de progreso y sección "Spec EARS"', () => {
    fc.assert(
      fc.property(nonNaSpecStatusArb, scoreArb, earsSpecArb, (specStatus, specHealthScore, earsSpec) => {
        const module = createTestModule({ specStatus, specHealthScore, earsSpec })
        const { container, unmount } = render(
          <ModulePanel node={module} {...defaultProps} />
        )

        // Verificar presencia de la barra de progreso (contenedor con height: 8px, borderRadius: 4px)
        const allDivs = container.querySelectorAll('div[style]')
        let hasProgressBar = false
        allDivs.forEach((el) => {
          const style = (el as HTMLElement).style
          if (style.height === '8px' && style.borderRadius === '4px') {
            hasProgressBar = true
          }
        })
        expect(hasProgressBar).toBe(true)

        // Verificar presencia del título "Spec EARS"
        expect(container.textContent).toContain('Spec EARS')

        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it('para todo módulo con specStatus === "traced", el texto del score muestra el valor de specHealthScore', () => {
    fc.assert(
      fc.property(scoreArb, earsSpecArb, (specHealthScore, earsSpec) => {
        const module = createTestModule({ specStatus: 'traced', specHealthScore, earsSpec })
        const { container, unmount } = render(
          <ModulePanel node={module} {...defaultProps} />
        )

        // El score se muestra como Math.floor(specHealthScore)%
        const expectedText = `${Math.floor(specHealthScore)}%`
        expect(container.textContent).toContain(expectedText)

        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it('badges correctos por specStatus: Trazado/Sin spec/Drift', () => {
    const badgeMapping: Array<{ status: SpecStatus; expectedBadge: string }> = [
      { status: 'traced', expectedBadge: 'Trazado' },
      { status: 'untraced', expectedBadge: 'Sin spec' },
      { status: 'drift', expectedBadge: 'Drift' },
    ]

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        scoreArb,
        earsSpecArb,
        (statusIdx, specHealthScore, earsSpec) => {
          const { status, expectedBadge } = badgeMapping[statusIdx]
          const module = createTestModule({ specStatus: status, specHealthScore, earsSpec })
          const { container, unmount } = render(
            <ModulePanel node={module} {...defaultProps} />
          )

          expect(container.textContent).toContain(expectedBadge)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})
