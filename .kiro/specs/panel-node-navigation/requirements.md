# Requirements Document

## Introduction

Esta feature extiende la navegación del panel lateral derecho (ModulePanel) en el visor de grafo de arquitectura de TrazIA. Actualmente, cuando se selecciona una carpeta, el panel muestra botones para navegar a sus subcarpetas hijas — al hacer click se selecciona el nodo en el grafo y se centra con zoom máximo. Esta feature agrega dos capacidades nuevas:

1. **Navegación a archivos hijos**: cuando se selecciona una carpeta, el panel también muestra botones para los archivos directos de esa carpeta, con el mismo comportamiento de selección + centrado + zoom que ya funciona para subcarpetas.

2. **Navegación al padre**: cuando se selecciona cualquier nodo (archivo o carpeta) que tiene una carpeta padre, el panel muestra un botón para navegar a esa carpeta padre directa, con el mismo comportamiento de selección + centrado + zoom.

## Glossary

- **Module_Panel**: Panel lateral derecho que muestra los detalles del nodo seleccionado en el grafo de arquitectura. Componente React `ModulePanel`.
- **Graph_Viewer**: Componente de visualización del grafo interactivo basado en react-flow. Componente React `ArchitectureGraph`.
- **Node**: Elemento visual del grafo que representa un archivo, carpeta o integración externa.
- **File_Node**: Nodo del grafo que representa un archivo del repositorio (tipo `module` en el modelo de datos).
- **Folder_Node**: Nodo del grafo que representa una carpeta del repositorio (tipo `folder` en el modelo de datos).
- **Navigation_Action**: Acción compuesta que selecciona un nodo en el grafo, lo centra en el viewport y aplica zoom máximo (2.5x). Es el comportamiento existente de `handleFolderNavigate`.
- **Parent_Folder**: Carpeta directa e inmediata que contiene al nodo seleccionado, identificada por el campo `parentFolder` del nodo.
- **Child_File**: Archivo que pertenece directamente a una carpeta seleccionada, identificado por tener su campo `parentFolder` igual al id de la carpeta.

## Requirements

### Requirement 1: Navegación a archivos hijos desde una carpeta seleccionada

**User Story:** Como desarrollador explorando el grafo, quiero hacer click en un archivo listado en el panel de una carpeta seleccionada, para que el grafo seleccione ese archivo y lo centre en pantalla con zoom máximo.

#### Acceptance Criteria

1. WHILE a Folder_Node is selected, THE Module_Panel SHALL display a list of clickable buttons for each Child_File of the selected folder.
2. WHEN a user clicks a Child_File button in the Module_Panel, THE Graph_Viewer SHALL execute a Navigation_Action targeting the corresponding File_Node.
3. WHEN a user clicks a Child_File button in the Module_Panel, THE Module_Panel SHALL update its content to display the details of the selected File_Node.
4. WHILE a Folder_Node with zero Child_Files is selected, THE Module_Panel SHALL omit the child files section entirely.
5. THE Module_Panel SHALL display Child_File buttons sorted alphabetically using case-insensitive comparison.
6. THE Module_Panel SHALL truncate Child_File names longer than 30 characters with an ellipsis character.
7. IF a Child_File node does not exist in the current graph, THEN THE Module_Panel SHALL omit that file from the list.

### Requirement 2: Navegación a la carpeta padre desde un archivo seleccionado

**User Story:** Como desarrollador explorando el grafo, quiero navegar a la carpeta padre de un archivo seleccionado desde el panel, para poder subir en la jerarquía del proyecto sin tener que buscar manualmente en el grafo.

#### Acceptance Criteria

1. WHILE a File_Node with a Parent_Folder is selected, THE Module_Panel SHALL display a clickable button showing the Parent_Folder name, truncated to 30 characters with an ellipsis character if the name exceeds that length.
2. WHEN a user clicks the Parent_Folder button in the Module_Panel, THE Graph_Viewer SHALL execute a Navigation_Action targeting the Parent_Folder node.
3. WHEN a user clicks the Parent_Folder button in the Module_Panel, THE Module_Panel SHALL update its content to display the details of the Parent_Folder.
4. WHILE a File_Node without a Parent_Folder is selected, THE Module_Panel SHALL omit the parent folder section entirely.
5. IF a File_Node's Parent_Folder reference does not correspond to an existing Folder_Node in the graph, THEN THE Module_Panel SHALL omit the parent folder section entirely.

### Requirement 3: Navegación a la carpeta padre desde una carpeta seleccionada

**User Story:** Como desarrollador explorando el grafo, quiero navegar a la carpeta padre de una carpeta seleccionada desde el panel, para poder subir en la jerarquía del proyecto sin tener que buscar manualmente en el grafo.

#### Acceptance Criteria

1. WHILE a Folder_Node with a Parent_Folder is selected, THE Module_Panel SHALL display a clickable button showing the Parent_Folder name, truncated to 30 characters with an ellipsis character if the name exceeds that length.
2. WHEN a user clicks the Parent_Folder button in the Module_Panel, THE Graph_Viewer SHALL execute a Navigation_Action targeting the Parent_Folder node.
3. WHEN a user clicks the Parent_Folder button in the Module_Panel, THE Module_Panel SHALL update its content to display the details of the Parent_Folder.
4. WHILE a Folder_Node without a Parent_Folder is selected (root-level folder), THE Module_Panel SHALL omit the parent folder section entirely.
5. THE Module_Panel SHALL display only the immediate Parent_Folder — no ancestors beyond the direct parent.
6. IF a Folder_Node's Parent_Folder reference does not match any existing Folder_Node in the graph, THEN THE Module_Panel SHALL omit the parent folder section entirely.

### Requirement 4: Consistencia del comportamiento de navegación

**User Story:** Como desarrollador, quiero que toda la navegación desde el panel se comporte de manera uniforme, para tener una experiencia predecible al explorar el grafo.

#### Acceptance Criteria

1. THE Navigation_Action SHALL center the target node in the viewport and apply a zoom level of 2.5x with an animation duration of 800 milliseconds.
2. THE Module_Panel SHALL render Parent_Folder buttons, Child_File buttons, and existing subfolder buttons using the same CSS class, the same fixed height, the same font size, and the same hover/active states so that they are visually indistinguishable in shape and interaction feedback.
3. WHEN a Navigation_Action is executed, THE Graph_Viewer SHALL increase the stroke width of edges connected to the newly selected node to 3px, set their opacity to 1, and animate them, while reducing unconnected edges to an opacity of 0.25.
4. IF a Navigation_Action is triggered while a previous animation is still in progress, THEN THE Graph_Viewer SHALL cancel the previous animation and execute the new Navigation_Action targeting the most recently requested node.
5. IF a Navigation_Action targets a node that does not exist in the current graph, THEN THE Module_Panel SHALL remain unchanged and no viewport animation SHALL occur.
