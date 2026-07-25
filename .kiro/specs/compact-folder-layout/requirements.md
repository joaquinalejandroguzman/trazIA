# Requirements Document

## Introduction

El grafo interactivo de TrazIA actualmente posiciona los nodos dentro de las carpetas usando una grilla fija de 2 columnas y coloca las subcarpetas en una fila horizontal. Esto causa un desperdicio significativo de espacio cuando el repositorio analizado es grande (miles de módulos), generando carpetas excesivamente anchas y con mucho espacio vacío. Esta feature reemplaza el algoritmo de layout interno de carpetas por uno adaptativo que aprovecha mejor el espacio disponible, manteniendo la legibilidad y la estructura jerárquica del grafo.

## Glossary

- **Layout_Engine**: Algoritmo dentro de `buildLayoutNodes()` en `architecture_graph.tsx` que calcula posiciones y tamaños de los nodos del grafo
- **Folder_Node**: Nodo padre en React Flow que representa una carpeta del repositorio y contiene nodos hijos (archivos y subcarpetas)
- **File_Node**: Nodo hijo dentro de un Folder_Node que representa un archivo del repositorio
- **Adaptive_Grid**: Esquema de posicionamiento donde el número de columnas se ajusta dinámicamente según la cantidad de nodos hijos
- **Subfolder_Wrapping**: Estrategia de posicionamiento donde las subcarpetas se distribuyen en múltiples filas cuando exceden el ancho disponible, en lugar de extenderse horizontalmente de forma ilimitada
- **Root_Layout**: Posicionamiento de las carpetas de nivel raíz (sin padre) en el grafo

## Requirements

### Requirement 1: Columnas adaptativas para archivos dentro de carpetas

**User Story:** As a developer exploring a repository graph, I want files inside folders to be arranged in an adaptive grid, so that folders with many files use space efficiently and folders with few files remain compact.

#### Acceptance Criteria

1. WHEN a Folder_Node contains 1 to 3 File_Nodes, THE Layout_Engine SHALL arrange the File_Nodes in a single row (1 row × N columns where N equals the file count)
2. WHEN a Folder_Node contains 4 to 8 File_Nodes, THE Layout_Engine SHALL arrange the File_Nodes in a grid of 2 columns
3. WHEN a Folder_Node contains 9 to 15 File_Nodes, THE Layout_Engine SHALL arrange the File_Nodes in a grid of 3 columns
4. WHEN a Folder_Node contains more than 15 File_Nodes, THE Layout_Engine SHALL arrange the File_Nodes in a grid of 4 columns
5. THE Layout_Engine SHALL compute the Folder_Node width as the number of columns multiplied by (FILE_NODE_WIDTH + FOLDER_GAP) plus FOLDER_PADDING_X × 2, where FILE_NODE_WIDTH = 170 px and FOLDER_GAP = 12 px
6. THE Layout_Engine SHALL position each File_Node at x = FOLDER_PADDING_X + (index % columns) × (FILE_NODE_WIDTH + FOLDER_GAP) and y = FOLDER_PADDING_Y + floor(index / columns) × (FILE_NODE_HEIGHT + FOLDER_GAP), where FOLDER_PADDING_Y = 40 px and FILE_NODE_HEIGHT = 36 px
7. WHEN a Folder_Node contains 0 File_Nodes, THE Layout_Engine SHALL produce a file grid height of 0 and rely on subfolder content or minimum size for the folder dimensions

### Requirement 2: Distribución de subcarpetas con wrapping

**User Story:** As a developer viewing nested folder structures, I want subfolders to wrap into multiple rows when they exceed the available width, so that parent folders are not stretched excessively by a single horizontal row of subfolders.

#### Acceptance Criteria

1. WHEN a Folder_Node contains subcarpetas, THE Layout_Engine SHALL position the first row of subcarpetas below the file grid area, offset by one vertical gap unit (FOLDER_GAP) from the bottom of the last file row
2. THE Layout_Engine SHALL place subcarpetas in a row starting at the parent's horizontal padding offset (FOLDER_PADDING_X), advancing left-to-right, and SHALL wrap to a new row when the accumulated width — including inter-subfolder gaps (FOLDER_GAP between each pair) — would exceed the content width of the parent folder, where content width is defined as the maximum of the file grid width, the minimum folder width (200px), and any previously computed subfolder row width
3. WHEN a subcarpeta wraps to a new row, THE Layout_Engine SHALL position the new row at a Y coordinate equal to the top of the previous row plus the height of the tallest subcarpeta in that previous row plus one FOLDER_GAP unit
4. IF a single subcarpeta (including its computed width) is wider than the parent content width, THEN THE Layout_Engine SHALL place the subcarpeta alone in its own row and expand the parent folder width to accommodate it plus horizontal padding on both sides (FOLDER_PADDING_X × 2)
5. WHEN the parent folder width is expanded to accommodate an oversized subcarpeta, THE Layout_Engine SHALL recalculate the wrapping of all subsequent subcarpeta rows using the new content width

### Requirement 3: Dimensionado bottom-up de carpetas

**User Story:** As a developer viewing the graph, I want folder sizes to be computed from their actual content, so that there is minimal empty space within each folder.

#### Acceptance Criteria

1. THE Layout_Engine SHALL compute each Folder_Node size using a bottom-up traversal, resolving leaf folders first and propagating computed sizes upward to their parents until all folders are sized
2. THE Layout_Engine SHALL calculate the Folder_Node height as the file grid height plus the total wrapped subfolder rows height plus FOLDER_PADDING_Y (40 px top padding) plus FOLDER_PADDING_X (20 px bottom padding)
3. THE Layout_Engine SHALL calculate the Folder_Node width as the maximum of the file grid width and the widest wrapped subfolder row, plus FOLDER_PADDING_X × 2 (20 px per side)
4. WHEN a Folder_Node has no children (empty folder), THE Layout_Engine SHALL assign a minimum size of 120 px width and 60 px height
5. IF the subfolder row width exceeds the computed Folder_Node width, THEN THE Layout_Engine SHALL expand the Folder_Node width to contain all subfolders without overflow

### Requirement 4: Layout de carpetas raíz en grilla

**User Story:** As a developer viewing the top-level graph, I want root folders to be arranged in a grid layout rather than a single horizontal row, so that the graph fits better on screen and avoids extreme horizontal scrolling.

#### Acceptance Criteria

1. THE Layout_Engine SHALL arrange Root_Layout folders in a grid pattern, placing them in row-major order (left to right, top to bottom) across multiple rows
2. THE Layout_Engine SHALL determine the number of columns for Root_Layout based on the square root of the total number of root folders, rounded up, with a minimum of 2 and a maximum of 5
3. WHEN positioning root folders in the grid, THE Layout_Engine SHALL set each row's vertical offset to the sum of all previous rows' heights plus gaps, where each row's height equals the height of the tallest folder in that row, and all folders in a row share the same top-Y coordinate
4. THE Layout_Engine SHALL separate root folders with a fixed horizontal gap of 40 pixels between columns and a fixed vertical gap of 40 pixels between rows
5. WHEN the grid layout is complete, THE Layout_Engine SHALL position Integration nodes to the right of the grid's total width plus the horizontal gap, preserving their vertical stacking

### Requirement 5: Preservación de funcionalidad existente

**User Story:** As a developer using TrazIA, I want the compact layout to preserve all existing visual behaviors, so that nothing breaks when the layout algorithm changes.

#### Acceptance Criteria

1. THE Layout_Engine SHALL render each File_Node with zone-based background color and border derived from its file path, a file-type icon based on its extension, and a circular traceability indicator whose color interpolates between red (score 0), yellow (score 50), and green (score 100)
2. THE Layout_Engine SHALL render each Folder_Node with a dashed border styled in the zone color corresponding to its path, a semi-transparent zone-colored background, and a header displaying the folder icon and folder name with font size scaled by nesting depth
3. WHEN a user clicks a node, THE Layout_Engine SHALL invoke the onNodeClick callback with the corresponding GraphNode, apply a solid dark border and box-shadow to the selected node, increase opacity to 1 and stroke-width to 3 px on edges connected to the selected node, and reduce opacity to 0.25 on all non-connected edges
4. THE Layout_Engine SHALL assign the parentId property of each File_Node and nested Folder_Node to its containing Folder_Node id, so that react-flow renders children within the visual bounds of their parent
5. THE Layout_Engine SHALL position all Integration_Nodes at a horizontal offset of at least 40 px to the right of the rightmost root folder boundary, ensuring zero pixel overlap between Integration_Nodes and any Folder_Node or File_Node
6. THE Layout_Engine SHALL render edges of type "integration" with an orange stroke, dashed pattern when not selected, and animated state, and edges of type "dependency" with a grey stroke and solid pattern when not selected
