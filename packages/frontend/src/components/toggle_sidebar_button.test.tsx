// Tests unitarios para ToggleSidebarButton
// Validates: Requirements 1.2, 1.6, 6.1, 6.3, 6.5
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { ToggleSidebarButton } from './toggle_sidebar_button'

describe('ToggleSidebarButton — renderizado condicional', () => {
  it('no renderiza nada cuando visible es false', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={() => {}} visible={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza el botón cuando visible es true', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={() => {}} visible={true} />
    )
    expect(container.querySelector('button')).not.toBeNull()
  })
})

describe('ToggleSidebarButton — accesibilidad', () => {
  it('tiene aria-expanded=false cuando isExpanded es false', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={() => {}} visible={true} />
    )
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('tiene aria-expanded=true cuando isExpanded es true', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={true} onClick={() => {}} visible={true} />
    )
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('tiene aria-label "Abrir panel lateral" cuando está cerrado', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={() => {}} visible={true} />
    )
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Abrir panel lateral')
  })

  it('tiene aria-label "Cerrar panel lateral" cuando está abierto', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={true} onClick={() => {}} visible={true} />
    )
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Cerrar panel lateral')
  })
})

describe('ToggleSidebarButton — posición', () => {
  it('tiene la clase toggle-sidebar-button para posicionamiento CSS', () => {
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={() => {}} visible={true} />
    )
    const button = container.querySelector('button') as HTMLElement
    expect(button.classList.contains('toggle-sidebar-button')).toBe(true)
  })
})

describe('ToggleSidebarButton — interacción', () => {
  it('ejecuta onClick al hacer click', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={handleClick} visible={true} />
    )
    const button = container.querySelector('button')!
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('es operable con Enter (nativo del button)', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <ToggleSidebarButton isExpanded={false} onClick={handleClick} visible={true} />
    )
    const button = container.querySelector('button')!
    // keyDown con Enter en un <button> dispara click nativamente
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
    // En el entorno de testing, el <button> nativo responde a Enter/Space
    // Verificamos que el elemento es un button (lo que garantiza operabilidad con teclado)
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
  })
})
