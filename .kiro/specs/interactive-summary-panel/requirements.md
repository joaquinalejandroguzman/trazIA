# Requirements Document

## Introduction

Este documento define los requisitos para agregar tres funcionalidades interactivas al panel lateral izquierdo `ProjectSummary` de TrazIA: una lista expandible de integraciones con navegación al grafo, un buscador/filtro de nodos por nombre, y un indicador visual de trazabilidad con mini gráfico. Estas funcionalidades transforman el panel de resumen estático en un punto de control interactivo que permite explorar y filtrar el grafo de arquitectura directamente desde la barra lateral.

## Glossary

- **Panel_Resumen**: Componente `ProjectSummary` ubicado en la barra lateral izquierda que muestra tarjetas de resumen del proyecto (módulos, integraciones, BD, APIs, stack)
- **Grafo**: Componente `ArchitectureGraph` que renderiza el grafo interactivo de arquitectura usando react-flow
- **Nodo**: Elemento visual del grafo que representa un módulo, carpeta o integración (tipos `ModuleNode`, `FolderNode`, `IntegrationNode`)
- **Integración**: Nodo de tipo `database` o `external_api` detectado por el agente de integraciones
- **fitToNode**: API imperativa expuesta por `ArchitectureGraph` vía ref que centra y hace zoom sobre un nodo específico del grafo
- **Trazabilidad**: Estado que indica si un módulo tiene especificación EARS generada (`traced`, `untraced`, `drift`, `na`)
- **Score_Efectivo**: Valor numérico 0–100 calculado a partir de `specStatus` y `specHealthScore` que determina el nivel de trazabilidad de un módulo
- **Dimming**: Efecto visual que reduce la opacidad de nodos no relevantes para resaltar los que coinciden con un filtro o selección
- **Lista_Integraciones**: Sección colapsable dentro del Panel_Resumen que muestra cada integración detectada por nombre
- **Buscador_Nodos**: Campo de entrada de texto en el Panel_Resumen que filtra nodos del grafo por coincidencia de nombre
- **Indicador_Trazabilidad**: Mini gráfico (donut o barra) en el Panel_Resumen que muestra la proporción de módulos trazados vs no trazados

## Requirements

### Requisito 1: Lista expandible de integraciones

**User Story:** Como desarrollador explorando un proyecto nuevo, quiero ver el detalle de cada integración detectada directamente en el panel de resumen y poder navegar a ella en el grafo, para entender rápidamente qué servicios externos usa el proyecto sin tener que buscarlos manualmente.

#### Criterios de Aceptación

1. WHEN el usuario hace click en la tarjeta de integraciones del Panel_Resumen, THE Lista_Integraciones SHALL expandirse mostrando el nombre de cada integración detectada en el análisis
2. WHEN la Lista_Integraciones está expandida y el usuario hace click en la tarjeta de integraciones, THE Lista_Integraciones SHALL colapsarse ocultando los nombres individuales
3. THE Lista_Integraciones SHALL mostrar cada integración con un icono diferenciado según su tipo: 🗄️ para tipo `database` y 🌐 para tipo `external_api`
4. WHEN el usuario hace click en el nombre de una integración dentro de la Lista_Integraciones, THE Panel_Resumen SHALL invocar la API fitToNode del Grafo con el id de la integración seleccionada, y THE Grafo SHALL centrar y hacer zoom sobre el nodo correspondiente
5. WHILE la Lista_Integraciones está expandida, THE Lista_Integraciones SHALL mostrar las integraciones agrupadas por tipo: primero bases de datos, luego APIs externas
6. WHILE no existen integraciones detectadas en el análisis, THE Panel_Resumen SHALL ocultar la sección de Lista_Integraciones
7. THE Lista_Integraciones SHALL mostrar un máximo de 20 integraciones visibles con scroll vertical si el listado excede ese límite

### Requisito 2: Búsqueda y filtrado de nodos

**User Story:** Como desarrollador explorando un proyecto grande, quiero buscar nodos por nombre desde el panel lateral para localizar rápidamente módulos, carpetas o integraciones específicas sin tener que recorrer visualmente todo el grafo.

#### Criterios de Aceptación

1. THE Buscador_Nodos SHALL renderizar un campo de texto con placeholder "Buscar nodos..." en la parte superior del Panel_Resumen
2. WHEN el usuario escribe texto en el Buscador_Nodos y el texto tiene al menos 2 caracteres, THE Buscador_Nodos SHALL filtrar nodos cuyo nombre contenga el texto ingresado como subcadena, sin distinguir mayúsculas de minúsculas
3. WHEN el texto del Buscador_Nodos tiene al menos 2 caracteres, THE Panel_Resumen SHALL mostrar una lista de resultados con un máximo de 50 nodos coincidentes debajo del campo de búsqueda, ordenados alfabéticamente por nombre
4. WHEN existen nodos coincidentes con la búsqueda, THE Grafo SHALL aplicar dimming reduciendo la opacidad a 0.25 en todos los nodos que no coincidan con el filtro, con una transición de 200ms
5. WHEN el usuario hace click en un resultado de la lista de búsqueda, THE Panel_Resumen SHALL invocar la API fitToNode del Grafo con el id del nodo seleccionado
6. WHEN el usuario hace click en un resultado de la lista de búsqueda, THE Buscador_Nodos SHALL limpiar el texto de búsqueda y ocultar la lista de resultados
7. WHEN el usuario borra todo el texto del Buscador_Nodos o el texto tiene menos de 2 caracteres, THE Grafo SHALL restaurar la opacidad normal (1.0) de todos los nodos con una transición de 200ms
8. THE Buscador_Nodos SHALL buscar coincidencias en módulos, carpetas e integraciones simultáneamente
9. WHILE existen resultados de búsqueda visibles, THE Panel_Resumen SHALL mostrar cada resultado con el icono correspondiente a su tipo de nodo: icono de archivo para módulos, icono de carpeta para carpetas, icono de base de datos para integraciones tipo `database`, e icono de red para integraciones tipo `external_api`
10. IF la búsqueda no produce resultados coincidentes y el texto tiene al menos 2 caracteres, THEN THE Panel_Resumen SHALL mostrar un mensaje indicando que no se encontraron nodos
11. WHEN el texto del Buscador_Nodos tiene menos de 2 caracteres, THE Panel_Resumen SHALL ocultar la lista de resultados sin mostrar mensaje de error

### Requisito 3: Indicadores de trazabilidad

**User Story:** Como líder técnico, quiero ver de un vistazo qué proporción del proyecto tiene especificaciones trazadas, para priorizar qué módulos necesitan documentación y evaluar la salud general del proyecto.

#### Criterios de Aceptación

1. THE Indicador_Trazabilidad SHALL renderizar un gráfico de tipo donut en el Panel_Resumen que muestre la distribución porcentual de módulos por estado de trazabilidad, con cuatro segmentos correspondientes a los estados `traced`, `untraced`, `drift` y `na`
2. THE Indicador_Trazabilidad SHALL representar los segmentos del gráfico utilizando los colores de trazabilidad definidos en el tema: verde para `traced`, rojo para `untraced`, amarillo para `drift`, y gris para `na`
3. THE Indicador_Trazabilidad SHALL mostrar en el centro del donut el porcentaje de módulos con `specStatus` igual a `traced` respecto al total de módulos analizados, formateado como número entero seguido del símbolo de porcentaje
4. WHEN el usuario hace click en un segmento del Indicador_Trazabilidad correspondiente a un estado de trazabilidad, THE Grafo SHALL aplicar dimming (opacidad reducida a 0.2) a todos los nodos de módulo cuyo specStatus no coincida con el estado seleccionado
5. WHEN el usuario hace click en el mismo segmento del Indicador_Trazabilidad que ya está activo, THE Grafo SHALL restaurar la opacidad de todos los nodos a 1.0
6. WHILE un filtro de trazabilidad está activo por selección de segmento, THE Indicador_Trazabilidad SHALL resaltar el segmento seleccionado separándolo visualmente del centro del donut respecto a los demás segmentos
7. THE Indicador_Trazabilidad SHALL calcular los porcentajes a partir de los campos `tracedCount`, `untracedCount` y `driftCount` del resultado del análisis, derivando el conteo de módulos `na` como `totalModules - tracedCount - untracedCount - driftCount`, y redondeando cada porcentaje al entero más cercano
8. WHILE el total de módulos analizados es cero, THE Panel_Resumen SHALL ocultar el Indicador_Trazabilidad
9. IF un estado de trazabilidad tiene cero módulos asociados, THEN THE Indicador_Trazabilidad SHALL omitir el segmento correspondiente del donut y no renderizarlo como elemento interactivo

### Requisito 4: Integración con el grafo

**User Story:** Como desarrollador, quiero que las acciones del panel de resumen se reflejen inmediatamente en el grafo sin interferir con otras interacciones existentes, para tener una experiencia de navegación fluida y coherente.

#### Criterios de Aceptación

1. WHEN el Panel_Resumen invoca fitToNode para cualquier nodo, THE Grafo SHALL animar la transición de centrado con una duración de 800 milisegundos, consistente con la constante `FIT_VIEW_DURATION` utilizada en las animaciones existentes del sistema
2. WHEN un filtro de búsqueda o trazabilidad aplica dimming, THE Grafo SHALL reducir la opacidad de los nodos no coincidentes a un valor entre 0.15 y 0.3, y SHALL mantener la funcionalidad de click en todos los nodos independientemente de su nivel de opacidad
3. WHEN el usuario selecciona un nodo directamente en el Grafo mediante click, THE Panel_Resumen SHALL limpiar cualquier filtro de búsqueda activo (vaciar el texto del Buscador_Nodos) y desactivar cualquier filtro de trazabilidad seleccionado, y THE Grafo SHALL restaurar la opacidad de todos los nodos a 1.0 en un máximo de 300 milisegundos
4. THE Panel_Resumen SHALL comunicarse con el Grafo exclusivamente a través de la ref imperativa existente (`ArchitectureGraphRef`) y props de callback gestionadas en App.tsx, sin acoplar estado interno entre componentes
5. IF el Panel_Resumen invoca fitToNode con un nodeId que no existe en el grafo, THEN THE Grafo SHALL ignorar la invocación sin producir errores visibles ni alterar la vista actual
6. WHEN un filtro de búsqueda y un filtro de trazabilidad se activan simultáneamente, THE Grafo SHALL aplicar dimming únicamente basado en el filtro activado más recientemente, reemplazando el dimming anterior
