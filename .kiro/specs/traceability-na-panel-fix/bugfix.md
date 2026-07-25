# Bugfix Requirements Document

## Introduction

Cuando un nodo de tipo módulo tiene `specStatus === 'na'` (no aplica trazabilidad), el panel lateral derecho muestra incorrectamente la barra de salud de trazabilidad y la sección "Spec EARS". Estos elementos no deberían aparecer para nodos marcados como "no aplica". En su lugar, la sección de trazabilidad debe mostrar únicamente el texto "No aplica trazabilidad" y la sección SPEC EARS no debe renderizarse.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema muestra la barra de progreso de salud de trazabilidad (health bar) con valor 0%
1.2 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema muestra la sección "Spec EARS" completa (con sus opciones de generar, copiar y descargar)
1.3 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema muestra el score numérico "Sin trazabilidad" y el badge "N/A" como si fuera un estado de falta de cobertura en vez de un estado explícito de exclusión

### Expected Behavior (Correct)

2.1 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema SHALL mostrar únicamente el texto "No aplica trazabilidad" en la sección de trazabilidad, sin renderizar la barra de progreso ni el score numérico
2.2 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema SHALL NO renderizar la sección "Spec EARS" en absoluto (ni título, ni contenido, ni botones de acción)
2.3 WHEN un nodo módulo con `specStatus === 'na'` es seleccionado THEN el sistema SHALL mostrar el badge "N/A" junto al texto informativo, indicando claramente que el módulo está excluido de trazabilidad

### Unchanged Behavior (Regression Prevention)

3.1 WHEN un nodo módulo con `specStatus === 'traced'` es seleccionado THEN el sistema SHALL CONTINUE TO mostrar la barra de salud de trazabilidad con el score correspondiente y la sección Spec EARS con el contenido generado
3.2 WHEN un nodo módulo con `specStatus === 'untraced'` es seleccionado THEN el sistema SHALL CONTINUE TO mostrar la barra de salud en 0% y el botón "Generar Spec" en la sección Spec EARS
3.3 WHEN un nodo módulo con `specStatus === 'drift'` es seleccionado THEN el sistema SHALL CONTINUE TO mostrar la barra de salud con el score actual, el badge "Drift" y el botón "Mejorar Spec"
3.4 WHEN un nodo de tipo carpeta o integración es seleccionado THEN el sistema SHALL CONTINUE TO mostrar sus secciones específicas sin sección de trazabilidad ni Spec EARS
