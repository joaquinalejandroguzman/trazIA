# Traceability NA Panel Fix — Bugfix Design

## Overview

Cuando un nodo módulo tiene `specStatus === 'na'`, el panel lateral derecho (`ModulePanel`) renderiza incorrectamente la barra de progreso de trazabilidad y la sección completa de "Spec EARS". El fix consiste en agregar una guarda condicional temprana dentro de la sección de trazabilidad para mostrar solo el texto informativo "No aplica trazabilidad" con su badge, y envolver la sección Spec EARS en un condicional que la oculte completamente cuando `specStatus === 'na'`.

## Glossary

- **Bug_Condition (C)**: El nodo seleccionado es un módulo cuyo `specStatus === 'na'` — indica que no necesita trazabilidad
- **Property (P)**: El panel muestra únicamente "No aplica trazabilidad" con badge "N/A" en la sección de trazabilidad, y NO renderiza la sección Spec EARS
- **Preservation**: El comportamiento actual para módulos con `specStatus` en `'traced'`, `'untraced'`, `'drift'` o `undefined` debe permanecer idéntico, así como el de nodos tipo carpeta/integración
- **ModulePanel**: Componente React en `packages/frontend/src/components/module_panel.tsx` que renderiza el panel lateral de detalle al seleccionar un nodo
- **specStatus**: Campo del tipo `SpecStatus` (`'traced' | 'untraced' | 'drift' | 'na'`) que indica el estado de trazabilidad de un módulo
- **getEffectiveScore**: Función en `constants/theme.ts` que retorna `-1` cuando `specStatus === 'na'`

## Bug Details

### Bug Condition

El bug se manifiesta cuando un nodo de tipo módulo con `specStatus === 'na'` es seleccionado en el grafo. El componente `ModulePanel` renderiza la sección de trazabilidad completa (barra de progreso, score, badge) y la sección "Spec EARS" como si fuera un módulo que necesita trazabilidad, en vez de mostrar solo un mensaje informativo de exclusión.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { node: GraphNode }
  OUTPUT: boolean
  
  RETURN input.node.type === 'module'
         AND (input.node as ModuleNode).specStatus === 'na'
END FUNCTION
```

### Examples

- **Módulo con `specStatus: 'na'`**: Se muestra barra de progreso al 0%, score "Sin trazabilidad", badge "N/A" y sección Spec EARS vacía. **Esperado**: Solo texto "No aplica trazabilidad" con badge "N/A", sin barra, sin sección Spec EARS.
- **Módulo con `specStatus: 'na'` y `earsSpec` definido (dato residual)**: Se muestra la spec EARS completa. **Esperado**: No se renderiza la sección Spec EARS.
- **Módulo con `specStatus: 'na'` y `specHealthScore: 0`**: Se muestra "0%" con la barra vacía. **Esperado**: Solo texto "No aplica trazabilidad".
- **Módulo con `specStatus: 'traced'` y score 85%**: Se muestra barra verde, score "85%", badge "Trazado". **Esperado (sin cambio)**: Idéntico al comportamiento actual.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Módulos con `specStatus === 'traced'` siguen mostrando la barra de salud con score, badge "Trazado", y sección Spec EARS con contenido/acciones
- Módulos con `specStatus === 'untraced'` siguen mostrando barra al 0%, badge "Sin spec", botón "Generar Spec" y sección Spec EARS con sus estados (sin contenido, generando, error)
- Módulos con `specStatus === 'drift'` siguen mostrando barra capeada al 50%, badge "Drift", botón "Mejorar Spec" y sección Spec EARS
- Nodos tipo carpeta o integración no muestran ninguna sección de trazabilidad ni Spec EARS (ya funciona así)
- El botón de cerrar panel, la información de ruta, dependencias y líneas de código no se ven afectados

**Scope:**
Todos los módulos cuyo `specStatus !== 'na'` deben comportarse exactamente igual antes y después del fix. El cambio es exclusivamente en el rendering condicional dentro del bloque JSX de módulos.

## Hypothesized Root Cause

Basado en el análisis del código en `module_panel.tsx`:

1. **Ausencia de guarda condicional en la sección de trazabilidad**: El IIFE que renderiza la sección de trazabilidad (líneas ~103-170) calcula `effectiveScore`, `badgeText`, etc., pero nunca retorna tempranamente un JSX alternativo cuando `specStatus === 'na'`. Solo oculta el botón de generar/mejorar con `showButton = specStatus !== 'na' && ...`, pero el resto de la UI (barra, score, badge) se renderiza igual.

2. **Ausencia de guarda condicional en la sección Spec EARS**: El segundo IIFE que renderiza la sección "Spec EARS" (líneas ~172-260) no tiene ningún chequeo de `specStatus === 'na'`. Renderiza la sección completa (título, botones de acción, contenido) independientemente del estado de trazabilidad.

3. **Lógica parcial existente**: La variable `showButton` ya contempla `specStatus !== 'na'`, lo que demuestra que la intención de excluir el caso 'na' existía, pero no se extendió al resto de los elementos visuales de ambas secciones.

## Correctness Properties

Property 1: Bug Condition — Panel NA muestra solo texto informativo

_For any_ módulo con `specStatus === 'na'` seleccionado en el panel, la sección de trazabilidad SHALL renderizar únicamente el texto "No aplica trazabilidad" con el badge "N/A", sin barra de progreso, sin score numérico, y la sección "Spec EARS" SHALL no renderizarse en absoluto (ni título, ni contenido, ni botones).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Comportamiento intacto para otros specStatus

_For any_ módulo con `specStatus !== 'na'` (incluyendo `'traced'`, `'untraced'`, `'drift'`, `undefined`), el panel SHALL continuar renderizando la barra de progreso, el score, el badge correspondiente, el botón condicional, y la sección Spec EARS completa con todos sus estados, produciendo exactamente el mismo resultado que antes del fix.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Asumiendo que el root cause es correcto:

**File**: `packages/frontend/src/components/module_panel.tsx`

**Function**: IIFE de la sección de trazabilidad + IIFE de la sección Spec EARS

**Specific Changes**:

1. **Early return en sección de trazabilidad para `specStatus === 'na'`**: Dentro del IIFE de la sección de trazabilidad, después de calcular `specStatus`, agregar un return temprano que renderice solo:
   - El título "Trazabilidad"
   - Un contenedor flex con el texto "No aplica trazabilidad" y el badge "N/A" (color gris `#adb5bd`)
   - Sin barra de progreso, sin score numérico, sin botón

2. **Condicional en sección Spec EARS**: Envolver el IIFE completo de la sección Spec EARS en una guarda `specStatus !== 'na'` para que no se renderice cuando el módulo está excluido de trazabilidad.

3. **Mantener badge "N/A" consistente**: El badge en la vista simplificada usará el mismo estilo que el actual (fontSize, padding, borderRadius, color blanco sobre fondo `#adb5bd`).

4. **Sin cambios en `getEffectiveScore`**: La función ya retorna `-1` para `specStatus === 'na'`, este comportamiento se mantiene intacto.

5. **Sin cambios en tipos ni props**: No se requieren modificaciones en `types/index.ts` ni en la interfaz `ModulePanelProps`.

## Testing Strategy

### Validation Approach

La estrategia de testing sigue dos fases: primero verificar que el bug se reproduce en el código sin fix (exploratory), luego validar que el fix corrige el defecto y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Confirmar que el código actual renderiza la barra de progreso y la sección Spec EARS para módulos con `specStatus === 'na'`.

**Test Plan**: Renderizar `ModulePanel` con un nodo módulo cuyo `specStatus === 'na'` y verificar que:
- Se encuentra un elemento con estilo de barra de progreso (height: 8px, borderRadius: 4px)
- Se encuentra el título "Spec EARS" en el DOM
- Se encuentra texto de score ("0%" o "Sin trazabilidad")

**Test Cases**:
1. **Barra de progreso visible**: Renderizar módulo NA → la barra de progreso con `height: '100%'` existe en el DOM (will fail on fixed code)
2. **Sección Spec EARS visible**: Renderizar módulo NA → el texto "Spec EARS" existe en el DOM (will fail on fixed code)
3. **Score numérico visible**: Renderizar módulo NA → "Sin trazabilidad" o "0%" está presente (will fail on fixed code)

**Expected Counterexamples**:
- La barra de progreso se renderiza con width 0% para módulos NA
- La sección Spec EARS se renderiza con estado "sin código fuente" o vacía
- Posible causa: ausencia de early return y de guarda condicional

### Fix Checking

**Goal**: Verificar que para todos los módulos con `specStatus === 'na'`, el panel muestra solo el texto informativo.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := render(ModulePanel, { node: input.node })
  ASSERT result.contains("No aplica trazabilidad")
  ASSERT result.contains("N/A" badge)
  ASSERT NOT result.containsProgressBar()
  ASSERT NOT result.contains("Spec EARS")
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los módulos con `specStatus !== 'na'`, el panel se comporta exactamente igual que antes.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT render_fixed(ModulePanel, input) = render_original(ModulePanel, input)
END FOR
```

**Testing Approach**: Property-based testing con `fast-check` es ideal para preservation checking porque:
- Genera combinaciones aleatorias de `specStatus` × `specHealthScore` × presencia de `earsSpec`
- Cubre edge cases que tests manuales podrían omitir (ej: score undefined + drift)
- Garantiza que el comportamiento es idéntico para todo el dominio de inputs no-NA

**Test Plan**: Observar el comportamiento del código actual para módulos con `specStatus !== 'na'`, capturar las invariantes (presencia de barra, score text, sección EARS), y escribir PBT que verifiquen que estas invariantes se mantienen tras el fix.

**Test Cases**:
1. **Barra de progreso preservada**: Para cualquier módulo con specStatus ∈ {traced, untraced, drift, undefined}, la barra de progreso se renderiza con el width correcto
2. **Sección Spec EARS preservada**: Para cualquier módulo con specStatus ∈ {traced, untraced, drift, undefined}, la sección "Spec EARS" se renderiza con título y estados correctos
3. **Botón condicional preservado**: El botón "Generar Spec" / "Mejorar Spec" sigue las mismas reglas de visibilidad según effective score
4. **Badge de estado preservado**: Los badges "Trazado", "Sin spec", "Drift" se muestran correctamente

### Unit Tests

- Renderizar módulo con `specStatus: 'na'` → verificar texto "No aplica trazabilidad" presente
- Renderizar módulo con `specStatus: 'na'` → verificar ausencia de barra de progreso
- Renderizar módulo con `specStatus: 'na'` → verificar ausencia de sección "Spec EARS"
- Renderizar módulo con `specStatus: 'na'` y `earsSpec` definido → verificar que aún así no se muestra la sección Spec EARS
- Renderizar módulo con `specStatus: 'traced'` → verificar que barra y Spec EARS siguen presentes

### Property-Based Tests

- Generar módulos aleatorios con `specStatus: 'na'` y variaciones de otros campos (earsSpec, specHealthScore, sourceContent) → verificar que siempre se muestra solo "No aplica trazabilidad" sin barra ni Spec EARS
- Generar módulos aleatorios con `specStatus ∈ {traced, untraced, drift, undefined}` × scores aleatorios → verificar que la barra, el score y la sección Spec EARS se renderizan correctamente (preservation)
- Generar combinaciones de specStatus × specHealthScore → verificar que el badge text/color es consistente con las reglas existentes

### Integration Tests

- Seleccionar un nodo NA en el grafo → verificar que el panel se abre con el contenido correcto
- Cambiar selección de un nodo NA a uno traced → verificar transición correcta del panel
- Cambiar selección de un nodo traced a uno NA → verificar que la barra y Spec EARS desaparecen
