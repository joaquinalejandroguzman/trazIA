# Implementation Plan: Responsive Graph Panels

## Overview

Transformar el layout principal de TrazIA de un grid estático con sidebar siempre visible a un sistema de paneles con toggle explícito que maximiza el espacio del grafo. La implementación se centra en: (1) un custom hook `usePanelLayout` que centraliza la lógica de estado, (2) nuevos componentes de UI para los toggles y wrappers, (3) refactorización del CSS para eliminar el grid de columnas y usar posicionamiento absoluto con animaciones GPU-optimizadas, y (4) integración de todo en `App.tsx`.

## Tasks

- [x] 1. Crear el hook `usePanelLayout` con lógica de estado centralizada
  - [x] 1.1 Implementar el hook `usePanelLayout` en `packages/frontend/src/hooks/use_panel_layout.ts`
    - Definir interfaces `PanelLayoutState` y `PanelLayoutActions`
    - Implementar estados internos: `leftPanelOpen` (default false), `rightPanelOpen` (default false), `chatOpen` (default false)
    - Implementar `toggleLeftPanel()`: flip de `leftPanelOpen` solo si `rightPanelOpen` es false
    - Implementar `openRightPanel()`: guardar estado previo de `leftPanelOpen` y `chatOpen` en refs, forzar ambos a false, setear `rightPanelOpen` a true
    - Implementar `closeRightPanel()`: restaurar `leftPanelOpen` y `chatOpen` desde los valores guardados, setear `rightPanelOpen` a false
    - Implementar `toggleChat()`: flip de `chatOpen` solo si `showChatToggle` es true
    - Implementar derivados: `showLeftToggle = !rightPanelOpen`, `showChatToggle = !rightPanelOpen && !leftPanelOpen`, `showChat = chatOpen && !rightPanelOpen && !leftPanelOpen`
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 1.2 Escribir property test: Toggle izquierdo es un flip
    - **Property 1: Toggle izquierdo es un flip**
    - **Validates: Requirements 1.3, 1.4**
    - Archivo: `packages/frontend/src/hooks/use_panel_layout.property.test.ts`
    - Generar estados arbitrarios donde `rightPanelOpen=false` y verificar que `toggleLeftPanel()` invierte `leftPanelOpen`

  - [ ]* 1.3 Escribir property test: Toggle chat es un flip
    - **Property 2: Toggle chat es un flip**
    - **Validates: Requirements 3.2, 3.3**
    - Generar estados donde `showChatToggle=true` y verificar que `toggleChat()` invierte `chatOpen`

  - [ ]* 1.4 Escribir property test: Vista Completa oculta todos los demás elementos
    - **Property 3: Vista Completa oculta todos los demás elementos**
    - **Validates: Requirements 1.2, 2.2, 2.3, 2.4**
    - Para cualquier combinación de `leftPanelOpen` y `chatOpen`, al llamar `openRightPanel()`, verificar que `showLeftToggle=false`, `showChatToggle=false`, `showChat=false`

  - [ ]* 1.5 Escribir property test: Vista Completa round-trip preserva estado
    - **Property 4: Vista Completa round-trip preserva estado**
    - **Validates: Requirements 2.5, 2.6, 2.7**
    - Para cualquier estado inicial, `openRightPanel()` seguido de `closeRightPanel()` restaura `leftPanelOpen` y `chatOpen` a sus valores originales

  - [ ]* 1.6 Escribir property test: Visibilidad del chat es derivación pura
    - **Property 5: Visibilidad del chat es derivación pura**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Verificar que `showChat === chatOpen && !rightPanelOpen && !leftPanelOpen` y que acciones sobre otros paneles no modifican `chatOpen`

  - [ ]* 1.7 Escribir unit tests para el hook `usePanelLayout`
    - Archivo: `packages/frontend/src/hooks/use_panel_layout.test.ts`
    - Test estado inicial (leftPanelOpen=false, rightPanelOpen=false, chatOpen=false)
    - Test `closeRightPanel()` sin `openRightPanel()` previo es no-op
    - Test `toggleLeftPanel()` durante Vista Completa es no-op
    - Test `toggleChat()` cuando showChatToggle=false es no-op
    - _Requirements: 1.1, 3.7_

- [x] 2. Checkpoint - Verificar hook
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Crear componentes de UI nuevos
  - [x] 3.1 Crear componente `ToggleSidebarButton` en `packages/frontend/src/components/toggle_sidebar_button.tsx`
    - Renderizar `<button>` con `aria-expanded` dinámico que refleje `isExpanded`
    - Implementar `aria-label` dinámico: "Abrir panel lateral" / "Cerrar panel lateral"
    - Posición absoluta dentro del contenedor del grafo (top: 8px, left: 8px)
    - Icono visual de hamburguesa/flecha según estado (usar FontAwesome ya disponible)
    - Prop `visible` controla renderizado (return null si false)
    - Operable con Enter y Space (nativo del `<button>`)
    - _Requirements: 1.2, 1.6, 6.1, 6.3, 6.5_

  - [x] 3.2 Crear componente `SidebarPanel` wrapper en `packages/frontend/src/components/sidebar_panel.tsx`
    - Renderizar `<aside>` con `transform: translateX(-100%)` cuando cerrado, `translateX(0)` cuando abierto
    - Posición absoluta sobre el grafo (no empuja el grid), z-index: 100
    - Ancho fijo 280px, transición con `var(--transition-open)` / `var(--transition-close)`
    - Aceptar `children` para ProjectSummary y GraphLegend
    - Respetar `prefers-reduced-motion` (duration 0ms)
    - _Requirements: 1.3, 1.4, 1.5, 5.1, 5.2, 5.5, 5.6_

  - [ ]* 3.3 Escribir unit tests para `ToggleSidebarButton`
    - Archivo: `packages/frontend/src/components/toggle_sidebar_button.test.tsx`
    - Verificar aria-expanded refleja estado
    - Verificar aria-label cambia según estado
    - Verificar que no renderiza cuando visible=false
    - Verificar keyboard operability (Enter, Space)
    - **Property 6: Aria attributes reflejan estado correctamente**
    - **Validates: Requirements 1.6, 6.1, 6.3, 6.5**

- [x] 4. Refactorizar `ModulePanel` a Vista Completa
  - [x] 4.1 Modificar `ModulePanel` en `packages/frontend/src/components/module_panel.tsx` para modo Vista Completa
    - Cambiar de `width: var(--panel-width)` en grid column a `position: absolute; inset: 0` dentro de `app__main`
    - Mantener botón de cierre existente con aria-label "Cerrar panel"
    - Añadir z-index: 200 para estar sobre el sidebar
    - Transición de apertura con opacity y transform (scale)
    - Eliminar la clase `.module-panel--open` con width fijo, reemplazar por `.module-panel--fullscreen`
    - _Requirements: 2.1, 2.8, 2.9, 5.1, 5.6_

  - [x] 4.2 Actualizar CSS en `packages/frontend/src/App.css` para el nuevo layout
    - Eliminar grid de 3 columnas (`grid-template-columns: var(--sidebar-width) 1fr var(--panel-width)`)
    - Cambiar `.app__main` a `grid-template-columns: 1fr` (grafo siempre 100%)
    - Eliminar `.app__main:has(.module-panel--open)` rule
    - Añadir nuevas variables CSS: `--transition-open`, `--transition-close`, z-indexes
    - Añadir `.sidebar-panel--open` / `.sidebar-panel--closed` con transforms
    - Añadir `.module-panel--fullscreen` con `position: absolute; inset: 0`
    - Añadir `.chat-fab--visible` / `.chat-fab--hidden` con opacity y pointer-events
    - Añadir media query `prefers-reduced-motion: reduce` con `transition-duration: 0ms`
    - Usar exclusivamente `opacity` y `transform` para animaciones
    - _Requirements: 1.1, 1.5, 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 5. Checkpoint - Verificar componentes individuales
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Refactorizar `ChatPanel` y añadir responsividad
  - [x] 6.1 Modificar `ChatPanel` en `packages/frontend/src/components/chat_panel.tsx`
    - Eliminar props `isSpecPanelOpen` y `specPanelWidth`
    - Añadir props: `isOpen`, `onToggle`, `visible`
    - Reposicionar FAB y panel a esquina inferior izquierda con posición fija
    - Implementar `aria-expanded` y `aria-label` dinámicos en el FAB ("Abrir chat" / "Cerrar chat")
    - Cuando `visible=false`, no renderizar FAB ni panel (pero mantener estado interno intacto)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.2, 6.4, 6.5_

  - [x] 6.2 Añadir CSS responsivo para `ChatPanel` en `packages/frontend/src/components/chat_panel.css`
    - Viewport < 768px: bottom sheet 100% ancho, 60% alto, border-radius solo esquinas superiores, offset 0px
    - Viewport 768px-1023px: 360px × 450px, offset 24px inferior e izquierdo
    - Viewport >= 1024px: 400px × 500px, offset 24px inferior e izquierdo
    - FAB: offset 24px en viewport >= 768px, 16px en viewport < 768px
    - Animación de apertura con `transform: scale` desde esquina inferior izquierda
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Integrar todo en `App.tsx`
  - [x] 7.1 Refactorizar `App.tsx` para usar `usePanelLayout` y nuevos componentes
    - Importar y usar `usePanelLayout` hook
    - Conectar `openRightPanel()` al evento de selección de nodo (`handleNodeClick`)
    - Conectar `closeRightPanel()` al evento de cierre del panel (`handleClosePanel`)
    - Reemplazar `<aside className="app__sidebar">` por `<SidebarPanel isOpen={leftPanelOpen}>`
    - Añadir `<ToggleSidebarButton>` dentro del graph container con props del hook
    - Pasar `visible`, `isOpen`, `onToggle` al `ChatPanel` refactorizado
    - Eliminar grid de sidebar del JSX (el grafo siempre ocupa 100%)
    - Implementar focus management: al ocultar un panel por efecto de otro, mover foco al botón de cierre del panel causante
    - Mantener navegación entre nodos dentro de Vista Completa (Req 2.9)
    - _Requirements: 1.1, 1.2, 2.1, 2.4, 2.5, 2.6, 2.7, 2.9, 3.6, 3.7, 5.3, 5.4, 6.6_

  - [ ]* 7.2 Escribir unit tests de integración para el layout completo
    - Archivo: `packages/frontend/src/App.test.tsx`
    - Test: dashboard carga con sidebar oculto y grafo 100%
    - Test: toggle izquierdo abre/cierra sidebar
    - Test: selección de nodo abre Vista Completa y oculta toggles
    - Test: cierre de Vista Completa restaura estado previo
    - Test: chat FAB visible solo cuando no hay sidebar ni Vista Completa
    - Test: focus management al entrar/salir de Vista Completa
    - _Requirements: 1.1, 2.5, 2.6, 2.7, 3.7, 6.6_

- [x] 8. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design's Correctness Properties section
- Unit tests validate specific examples and edge cases
- El diseño usa TypeScript con React — todos los ejemplos de código usan este stack
- `fast-check` v4.9 y `vitest` v1.5 ya están disponibles en el frontend package
- Las animaciones usan exclusivamente `opacity` y `transform` para evitar reflow

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3", "4.1", "4.2"] },
    { "id": 3, "tasks": ["6.1", "6.2"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2"] }
  ]
}
```
