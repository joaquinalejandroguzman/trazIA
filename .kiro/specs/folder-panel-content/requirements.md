# Requirements Document

## Introduction

Mejora del panel lateral derecho (ModulePanel) cuando se selecciona un nodo de tipo carpeta. Actualmente muestra un contador genérico "X elementos directos". El cambio reemplaza ese contador por un desglose entre carpetas directas y archivos directos, agrega una lista de botones con las subcarpetas directas ordenadas alfabéticamente, y permite centrar el grafo en una subcarpeta al hacer click en su botón.

## Glossary

- **Module_Panel**: Componente del panel lateral derecho que muestra los detalles de un nodo seleccionado en el grafo de arquitectura.
- **Folder_Node**: Nodo del grafo que representa una carpeta del proyecto analizado.
- **Module_Node**: Nodo del grafo que representa un archivo/módulo del proyecto analizado.
- **Direct_Child_Folder**: Carpeta cuyo campo `parentFolder` apunta al id de la carpeta seleccionada.
- **Direct_Child_File**: Módulo cuyo campo `parentFolder` apunta al id de la carpeta seleccionada.
- **Folder_Button**: Botón pequeño dentro de la sección de contenido del panel que representa una subcarpeta directa.
- **Graph_View**: Componente ReactFlow que renderiza el grafo de arquitectura y soporta operaciones de centrado (fitView).

## Requirements

### Requirement 1: Mostrar conteo desglosado de carpetas y archivos directos

**User Story:** Como desarrollador explorando un repositorio, quiero ver cuántas carpetas y cuántos archivos contiene directamente una carpeta seleccionada, para entender su composición sin tener que contarlos manualmente en el grafo.

#### Acceptance Criteria

1. WHEN a Folder_Node is selected, THE Module_Panel SHALL display the count of Direct_Child_Folders as "X carpetas directas" in the content section, where X is the integer count.
2. WHEN a Folder_Node is selected, THE Module_Panel SHALL display the count of Direct_Child_Files as "X archivos directos" in the content section, positioned immediately below the Direct_Child_Folders count.
3. WHEN the count of Direct_Child_Folders is zero, THE Module_Panel SHALL display "0 carpetas directas".
4. WHEN the count of Direct_Child_Files is zero, THE Module_Panel SHALL display "0 archivos directos".
5. WHEN the count of Direct_Child_Folders is exactly 1, THE Module_Panel SHALL display "1 carpeta directa" (singular form).
6. WHEN the count of Direct_Child_Files is exactly 1, THE Module_Panel SHALL display "1 archivo directo" (singular form).
7. THE Module_Panel SHALL replace the previous "X elementos directos" text with the two separate counts described in criteria 1 and 2.

### Requirement 2: Listar subcarpetas directas como botones ordenados alfabéticamente

**User Story:** Como desarrollador explorando un repositorio, quiero ver las subcarpetas directas listadas como botones en el panel, para poder identificar rápidamente qué contiene la carpeta y navegar hacia ellas.

#### Acceptance Criteria

1. WHEN a Folder_Node with at least one Direct_Child_Folder is selected, THE Module_Panel SHALL display a list of Folder_Buttons representing each Direct_Child_Folder below the content counts section.
2. THE Module_Panel SHALL order the Folder_Buttons alphabetically by the folder name using locale-independent, case-insensitive Unicode comparison.
3. WHEN a Folder_Node has zero Direct_Child_Folders, THE Module_Panel SHALL not display the Folder_Button list section.
4. THE Module_Panel SHALL display each Folder_Button with the folder name as its label, truncated to 30 characters followed by an ellipsis character when the name exceeds that length.
5. WHEN two or more Direct_Child_Folders share the same case-insensitive name, THE Module_Panel SHALL preserve their original order relative to each other (stable sort).

### Requirement 3: Centrar el grafo en una subcarpeta al hacer click en su botón

**User Story:** Como desarrollador explorando un repositorio, quiero hacer click en el botón de una subcarpeta en el panel y que el grafo se centre en ella, para poder navegar visualmente la jerarquía sin perderme en el grafo completo.

#### Acceptance Criteria

1. WHEN a user clicks a Folder_Button, THE Graph_View SHALL animate the viewport so that the target Folder_Node's bounding box is fully visible and centered, using a transition duration of no more than 800 milliseconds.
2. WHEN a user clicks a Folder_Button, THE Graph_View SHALL adjust the zoom level to the minimum zoom that fits the entire target Folder_Node within the viewport with a padding ratio of at least 0.15 relative to the viewport dimensions, without exceeding the configured maximum zoom level.
3. WHEN a user clicks a Folder_Button, THE Graph_View SHALL visually mark the target Folder_Node as selected and deselect the previously selected node.
4. WHEN a user clicks a Folder_Button, THE Module_Panel SHALL update its content to display the details of the clicked Folder_Node, including its path, Direct_Child_Folder count, and Direct_Child_File count.
