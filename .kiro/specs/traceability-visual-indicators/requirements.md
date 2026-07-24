# Requirements Document

## Introduction

Este documento define los requisitos para los indicadores visuales de trazabilidad en el grafo de arquitectura de TrazIA. La funcionalidad permite que los nodos de tipo módulo (`ModuleNode`) muestren un color gradual (rojo → amarillo → verde) en función de su `specHealthScore` (0–100). Cuando un módulo tiene baja trazabilidad (zona roja), el `ModulePanel` muestra un botón "Generar Spec" que invoca la función `generateSpec` del hook `useAnalysis`, la cual llama al endpoint `POST /api/generate-spec` del backend para producir una especificación EARS retroactiva.

Esta feature se integra con la infraestructura existente:
- Los tipos `ModuleNode.specStatus` (`'traced' | 'untraced' | 'drift'`) y `ModuleNode.specHealthScore` (0–100) ya están definidos en `packages/frontend/src/types/index.ts`
- La función `generateSpec` del hook `useAnalysis` ya actualiza el `result` local con el nuevo `specStatus` y `specHealthScore` tras generar la spec
- El sistema de colores por zona (`ZONE_COLORS` en `constants/theme.ts`) permanece intacto — la colorización de trazabilidad se añade como capa visual complementaria
- Los campos de trazabilidad en `AnalysisResult` (`tracedCount`, `untracedCount`, `driftCount`, `projectHealthScore`) ya existen y se actualizan tras la generación

## Glossary

- **Module_Node**: Nodo del grafo de tipo `module` que representa un archivo del repositorio analizado, definido en `packages/frontend/src/types/index.ts`
- **Graph_Node**: Nodo visual de react-flow correspondiente a un Module_Node en el componente `ArchitectureGraph`
- **Traceability_Score**: Campo `specHealthScore` (número entero 0–100, inclusive en ambos extremos) del Module_Node que indica el nivel de cobertura de especificación EARS del módulo
- **Effective_Score**: Valor final de score usado para Color_Interpolation después de aplicar las reglas de override por Spec_Status
- **Spec_Status**: Campo `specStatus` del Module_Node con valores posibles: `'traced'`, `'untraced'`, `'drift'`
- **Traceability_Color**: Color calculado por interpolación aplicado al Traceability_Indicator según su Effective_Score
- **Traceability_Indicator**: Elemento circular (10px de diámetro) posicionado dentro del Graph_Node, a la derecha del texto del nombre de archivo, que muestra el Traceability_Color como color de relleno
- **Red_Zone**: Effective_Score 0–33, color de salida desde rojo hacia near-amber (baja trazabilidad)
- **Yellow_Zone**: Effective_Score 34–66, color de salida desde near-amber hacia near-green (trazabilidad parcial, spec desalineada)
- **Green_Zone**: Effective_Score 67–100, color de salida desde near-green hacia verde completo (trazabilidad completa)
- **Module_Panel**: Panel lateral derecho (`ModulePanel` en `components/module_panel.tsx`) que muestra detalles del nodo seleccionado
- **Generate_Spec_Button**: Botón de acción en el Module_Panel que invoca `generateSpec(moduleId)` del hook `useAnalysis`
- **Color_Interpolation**: Función pura que recibe un Effective_Score (0–100) y retorna un color hexadecimal interpolado entre rojo (#e53935 en 0), amarillo (#fdd835 en 50) y verde (#43a047 en 100)
- **Zone_Colors**: Sistema existente de colores por ubicación en el proyecto (`ZONE_COLORS` en `constants/theme.ts`) que categoriza archivos en frontend/backend/config/shared/unknown
- **useAnalysis_Hook**: Hook personalizado (`hooks/use_analysis.ts`) que expone `generateSpec`, `generatingSpec`, `result` y `error`

## Requirements

### Requirement 1: Colorización gradual de nodos de módulo según trazabilidad

**User Story:** Como desarrollador que explora el grafo de arquitectura, quiero ver a simple vista qué módulos tienen buena, parcial o nula trazabilidad mediante un código de colores gradual, para identificar rápidamente las áreas del proyecto que necesitan especificaciones EARS.

#### Acceptance Criteria

1. WHEN a Module_Node has a Traceability_Score between 0 and 33 (inclusive), THE Graph_Node SHALL render with the Color_Interpolation output for that score within the Red_Zone range (red at 0, transitioning toward amber as score approaches 33)
2. WHEN a Module_Node has a Traceability_Score between 34 and 66 (inclusive), THE Graph_Node SHALL render with the Color_Interpolation output for that score within the Yellow_Zone range (amber tones transitioning from near-red at 34 toward near-green at 66)
3. WHEN a Module_Node has a Traceability_Score between 67 and 100 (inclusive), THE Graph_Node SHALL render with the Color_Interpolation output for that score within the Green_Zone range (transitioning from near-amber at 67 toward full green at 100)
4. IF a Module_Node has no Traceability_Score defined (specHealthScore is undefined or null), THEN THE Graph_Node SHALL render with the Color_Interpolation output for an effective score of 0, treating the module as fully untraced
5. THE Color_Interpolation SHALL produce a continuous gradient across the full 0–100 range, mapping score 0 to red, score 50 to amber, and score 100 to green, with linearly interpolated colors for all intermediate values
6. IF a Module_Node has a Spec_Status of `'untraced'`, THEN THE Graph_Node SHALL render with the Color_Interpolation output for an effective score of 0, regardless of the Traceability_Score value
7. IF a Module_Node has a Spec_Status of `'drift'`, THEN THE Graph_Node SHALL render with the Color_Interpolation output capped at an effective score of no more than 50, using the minimum between the actual Traceability_Score and 50
8. IF a Module_Node has no Spec_Status defined (specStatus is undefined), THEN THE Graph_Node SHALL treat it as untraced with effective score of 0
9. WHEN both Spec_Status and Traceability_Score are defined for a Module_Node, THE Graph_Node SHALL apply the Spec_Status override rules (criteria 6 and 7) before applying the Color_Interpolation, such that Spec_Status takes precedence over raw Traceability_Score

### Requirement 2: Indicador visual de trazabilidad como círculo coloreado dentro del nodo

**User Story:** Como desarrollador, quiero que el color de trazabilidad sea visible sin interferir con la zona cromática existente del nodo (Zone_Colors de frontend/backend/config/shared), para poder distinguir tanto la ubicación como la salud de cada módulo simultáneamente.

#### Acceptance Criteria

1. THE Graph_Node SHALL render a Traceability_Indicator (circular element of 10px diameter) filled with the Traceability_Color, positioned inside the node content area to the right of the file name text, vertically centered within the node height
2. THE Graph_Node SHALL preserve the existing Zone_Colors `bg` as background color, Zone_Colors `text` as text color, and Zone_Colors `border` on all four sides from `ZONE_COLORS` for module nodes, without modification when the Traceability_Indicator is displayed
3. WHEN a Module_Node is selected, THE Graph_Node SHALL display both the Traceability_Indicator (circle with Traceability_Color fill) and the existing selection highlight (`boxShadow: '0 0 0 2px rgba(0,0,0,0.2)'`), without one replacing the other
4. IF the Traceability_Color is not yet available for a Module_Node (score has not been computed), THEN THE Graph_Node SHALL render the module node without the Traceability_Indicator (default styling, no circle displayed)
5. THE Traceability_Indicator SHALL only appear on nodes of type `'module'`; nodes of type `'folder'` and integration nodes (`'database'`, `'external_api'`) SHALL retain their current styling unchanged without any traceability circle

### Requirement 3: Botón de generación de spec en el panel lateral

**User Story:** Como desarrollador que identifica un módulo con baja trazabilidad en el grafo, quiero poder generar su especificación EARS directamente desde el panel de detalles, para corregir el problema sin salir del contexto visual.

#### Acceptance Criteria

1. WHEN a Module_Node with specStatus 'untraced' or specHealthScore 0–33 is selected, THE Module_Panel SHALL display the Generate_Spec_Button with the label "Generar Spec"
2. WHEN a Module_Node with specStatus 'drift' or specHealthScore 34–66 is selected, THE Module_Panel SHALL display the Generate_Spec_Button with the label "Mejorar Spec"
3. WHEN a Module_Node with specStatus 'traced' and specHealthScore 67–100 is selected, THE Module_Panel SHALL NOT display the Generate_Spec_Button
4. IF the selected Module_Node has no specStatus defined (undefined), THEN THE Module_Panel SHALL treat it as Red_Zone and display the Generate_Spec_Button with the label "Generar Spec"
5. WHEN the user clicks the Generate_Spec_Button, THE Module_Panel SHALL invoke the `generateSpec` function from the useAnalysis_Hook with the selected Module_Node ID as argument
6. WHILE the `generatingSpec` state from useAnalysis_Hook equals the selected Module_Node ID, THE Generate_Spec_Button SHALL display the text "Generando..." and SHALL be disabled (non-clickable and with aria-disabled attribute set to true)
7. WHEN the `generateSpec` function completes successfully, THE Module_Panel SHALL update the displayed specHealthScore and specStatus to reflect the new values from the updated `result` in useAnalysis_Hook, and the Generate_Spec_Button visibility SHALL re-evaluate based on criteria 1–3
8. IF the `generateSpec` function returns null (indicating failure), THEN THE Module_Panel SHALL display the error message from useAnalysis_Hook below the Generate_Spec_Button, limited to 200 characters with truncation, and the message SHALL remain visible until the user clicks the Generate_Spec_Button again or selects a different node
9. WHEN the user selects a different node or closes the Module_Panel while an error message is displayed, THE Module_Panel SHALL clear the displayed error message

### Requirement 4: Visualización del score de trazabilidad en el panel

**User Story:** Como desarrollador, quiero ver el porcentaje exacto de trazabilidad de un módulo seleccionado junto con su estado, para entender cuantitativamente su cobertura de especificación.

#### Acceptance Criteria

1. WHEN a Module_Node is selected, THE Module_Panel SHALL display a section titled "Trazabilidad" showing the Traceability_Score as a whole-number percentage rounded down (e.g., a score of 78.6 displays as "78%")
2. WHILE a Module_Node is selected, THE Module_Panel SHALL display a horizontal progress bar whose width equals the Traceability_Score percentage of the bar's total width (e.g., score 78 fills 78% of the bar), colored using the Color_Interpolation function
3. WHEN a Module_Node has no Traceability_Score defined (specHealthScore is undefined), THE Module_Panel SHALL display "Sin trazabilidad" with the score shown as "0%" and the progress bar at 0% width filled with the color returned by Color_Interpolation for score 0
4. WHILE a Module_Node is selected, THE Module_Panel SHALL display the Spec_Status as a colored badge with text: "Trazado" (green badge) for `'traced'`, "Sin spec" (red badge) for `'untraced'`, or "Drift" (yellow badge) for `'drift'`
5. WHEN a Module_Node has no Spec_Status defined (specStatus is undefined), THE Module_Panel SHALL display the badge "Sin spec" with red color, treating the module as untraced
6. WHILE a Module_Node is selected, THE Module_Panel SHALL display the "Trazabilidad" section after the existing module detail sections (Ruta, Líneas de código, Última modificación, Dependencias) and before the panel's closing boundary

### Requirement 5: Actualización reactiva del grafo tras generación de spec

**User Story:** Como desarrollador, quiero que el grafo refleje inmediatamente el nuevo estado de trazabilidad después de generar una spec, para confirmar visualmente que la acción tuvo efecto.

#### Acceptance Criteria

1. WHEN the `generateSpec` function from useAnalysis_Hook completes successfully and updates `result.modules` with a new `specStatus` value for the target module, THE Graph_Node corresponding to that module SHALL update the Traceability_Indicator fill color to the Traceability_Color mapped from the new Effective_Score within 1 second of the state update
2. WHEN a Graph_Node's Effective_Score changes, THE Graph_Node SHALL apply a CSS transition of 300ms on the Traceability_Indicator `background-color` property so the color change is visually animated rather than instant
3. THE ArchitectureGraph component SHALL re-render the affected Module_Node via React's standard reconciliation (driven by the updated `modules` prop from `result.modules`) without resetting the current viewport position or zoom level
4. IF the `generateSpec` function fails (returns null or throws an error), THEN THE Graph_Node SHALL retain its previous Traceability_Color unchanged

### Requirement 6: Función de interpolación de color como utilidad reutilizable

**User Story:** Como desarrollador del equipo TrazIA, quiero que la lógica de interpolación de color esté centralizada en el módulo de tema (`constants/theme.ts`), para reutilizarla consistentemente entre el grafo y el panel.

#### Acceptance Criteria

1. THE Color_Interpolation function SHALL be exported from `constants/theme.ts` as a named export `getTraceabilityColor(score: number): string`
2. THE Color_Interpolation function SHALL clamp the input to the range [0, 100] before calculating the color; IF the input is NaN or not a finite number, THEN THE Color_Interpolation function SHALL treat it as 0
3. THE Color_Interpolation function SHALL return a lowercase hex color string (format `#rrggbb`, 7 characters total) for any input
4. THE Color_Interpolation function SHALL perform piecewise linear interpolation per RGB channel between the color anchors: red (`#e53935`) at score 0, yellow (`#fdd835`) at score 50, and green (`#43a047`) at score 100
5. THE Color_Interpolation function SHALL be a pure function with no side effects, returning the same output for the same input across all invocations
