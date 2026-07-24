# Requirements Document

## Introduction

Esta feature agrega títulos con jerarquía tipográfica a los nodos de carpeta en el grafo interactivo de arquitectura. Cada carpeta muestra un título centrado en la parte superior del nodo, cuyo tamaño de fuente sigue la convención de encabezados HTML (h1–h6) según la profundidad de la carpeta en el árbol. Esto permite al usuario identificar rápidamente el nivel jerárquico de cada carpeta a simple vista.

## Glossary

- **Graph_Renderer**: Componente React (`ArchitectureGraph`) que construye y renderiza los nodos del grafo interactivo usando ReactFlow.
- **Folder_Node**: Nodo visual en el grafo que representa una carpeta del proyecto. Tiene tipo `'group'` en ReactFlow y agrupa a sus módulos hijos.
- **Depth_Level**: Nivel de profundidad de una carpeta en el árbol jerárquico. Una carpeta raíz (sin `parentFolder`) tiene Depth_Level 1, su hija directa tiene Depth_Level 2, y así sucesivamente.
- **Hierarchy_Title**: Título centrado en la parte superior de un Folder_Node cuyo tamaño de fuente corresponde al nivel de encabezado HTML (h1–h6) que refleja su Depth_Level.
- **Folder_Label**: Etiqueta visual que muestra el ícono 📁 y el nombre de la carpeta dentro de un Folder_Node.

## Requirements

### Requirement 1: Calcular el nivel de profundidad de cada carpeta

**User Story:** Como desarrollador que explora un proyecto, quiero que el sistema determine automáticamente el nivel de profundidad de cada carpeta, para que el título refleje correctamente su posición en la jerarquía.

#### Acceptance Criteria

1. WHEN a Folder_Node has no parentFolder, THE Graph_Renderer SHALL assign Depth_Level 1 to that Folder_Node.
2. WHEN a Folder_Node has a parentFolder that references an existing Folder_Node, THE Graph_Renderer SHALL assign Depth_Level equal to the parent Folder_Node Depth_Level plus one.
3. WHEN a Folder_Node has a computed Depth_Level greater than 6, THE Graph_Renderer SHALL use Depth_Level 6 for selecting the heading tag (h1 through h6) while preserving the actual computed Depth_Level for hierarchy calculations.
4. IF a Folder_Node has a parentFolder that references a non-existent Folder_Node id, THEN THE Graph_Renderer SHALL treat that Folder_Node as a root folder and assign Depth_Level 1.
5. IF the parentFolder chain contains a circular reference, THEN THE Graph_Renderer SHALL stop traversal and assign Depth_Level 1 to the Folder_Node where the cycle is detected.

### Requirement 2: Renderizar el título con tamaño tipográfico jerárquico

**User Story:** Como desarrollador que explora un proyecto, quiero que cada carpeta muestre un título con tamaño de fuente proporcional a su nivel en la jerarquía, para poder distinguir visualmente los niveles de anidamiento.

#### Acceptance Criteria

1. THE Graph_Renderer SHALL render a Hierarchy_Title inside each Folder_Node, displaying the folder name as text content.
2. WHEN a Folder_Node has Depth_Level 1, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 1.5rem.
3. WHEN a Folder_Node has Depth_Level 2, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 1.25rem.
4. WHEN a Folder_Node has Depth_Level 3, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 1.0rem.
5. WHEN a Folder_Node has Depth_Level 4, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 0.875rem.
6. WHEN a Folder_Node has Depth_Level 5, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 0.8rem.
7. WHEN a Folder_Node has Depth_Level 6, THE Graph_Renderer SHALL render the Hierarchy_Title with a font size of 0.75rem.
8. IF a Folder_Node has a Depth_Level greater than 6, THEN THE Graph_Renderer SHALL render the Hierarchy_Title with the same font size as Depth_Level 6 (0.75rem).
9. THE Graph_Renderer SHALL derive the Depth_Level of a Folder_Node by counting the number of ancestor folders in its parentFolder chain, where a root folder (no parentFolder) has Depth_Level 1.

### Requirement 3: Centrar el título horizontalmente en la parte superior del nodo

**User Story:** Como desarrollador que explora un proyecto, quiero que el título de cada carpeta esté centrado horizontalmente en la zona superior del nodo, para que la presentación sea limpia y consistente.

#### Acceptance Criteria

1. THE Graph_Renderer SHALL position the Hierarchy_Title vertically within the top 40px header area of the Folder_Node (the FOLDER_PADDING_Y zone).
2. THE Graph_Renderer SHALL center the Hierarchy_Title horizontally relative to the full width of the Folder_Node, such that the combined content (icon and folder name) is equidistant from the left and right edges.
3. THE Graph_Renderer SHALL display the folder name as the text content of the Hierarchy_Title.
4. THE Graph_Renderer SHALL render the 📁 icon to the left of the folder name within the Hierarchy_Title, separated by a gap of 4px.
5. IF the folder name exceeds the available width of the Folder_Node header area, THEN THE Graph_Renderer SHALL truncate the folder name with an ellipsis so that the Hierarchy_Title does not overflow the Folder_Node boundaries.

### Requirement 4: Mantener el estilo visual consistente con el tema del grafo

**User Story:** Como desarrollador que explora un proyecto, quiero que los títulos de carpeta se integren visualmente con el esquema de colores existente del grafo, para que la interfaz sea coherente.

#### Acceptance Criteria

1. THE Graph_Renderer SHALL apply the zone-specific text color (from `ZONE_COLORS[zone].text`) to the Hierarchy_Title based on the folder path, using the `detectZone()` function to determine the zone.
2. THE Graph_Renderer SHALL use font weight 700 (bold) for the Hierarchy_Title text.
3. THE Graph_Renderer SHALL apply opacity 0.9 to the Hierarchy_Title text to maintain visual hierarchy relative to the folder border and child nodes.
