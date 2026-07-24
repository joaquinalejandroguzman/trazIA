// Tests de property-based y unitarios para ModulePanel — Properties 5 y 6
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { render, screen } from '@testing-library/react'
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
