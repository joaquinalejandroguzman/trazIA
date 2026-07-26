# Implementation Plan: Panel Node Navigation

## Overview

Extend the ModulePanel to support navigation to child files (when a folder is selected) and navigation to the parent folder (from any selected node). This involves adding two new helper functions in `folder_panel_helpers.ts`, generalizing the navigation handler in `App.tsx`, and rendering the new UI sections in `ModulePanel`.

## Tasks

- [x] 1. Add helper functions for child files and parent folder lookup
  - [x] 1.1 Implement `getSortedChildFiles` in `folder_panel_helpers.ts`
    - Add function that filters `allModules` by `parentFolder === folderId` AND `id ∈ graphNodeIds`
    - Sort results alphabetically using case-insensitive `localeCompare` (same pattern as `getSortedSubfolders`)
    - Export the function
    - _Requirements: 1.1, 1.5, 1.7_

  - [x] 1.2 Implement `getParentFolder` in `folder_panel_helpers.ts`
    - Add function that takes a node with optional `parentFolder` field and the `allFolders` array
    - Returns the matching `FolderNode` if found, otherwise `undefined`
    - Export the function
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.4, 3.6_

  - [x]* 1.3 Write property test for `getSortedChildFiles` (Property 1)
    - **Property 1: Child files filtering, existence validation, and sorting**
    - Generate arbitrary modules, folder ids, and graph node id sets with fast-check
    - Assert: returned items have `parentFolder === folderId` AND `id ∈ graphNodeIds`
    - Assert: result is sorted case-insensitive alphabetically by name
    - Assert: no items are missing (completeness)
    - **Validates: Requirements 1.1, 1.5, 1.7**

  - [x]* 1.4 Write property test for `truncateFolderName` (Property 2)
    - **Property 2: Name truncation invariant**
    - Generate arbitrary strings (0–100 length) with fast-check
    - Assert: if input.length ≤ 30, output === input
    - Assert: if input.length > 30, output.length === 31 AND output ends with '…'
    - **Validates: Requirements 1.6, 2.1, 3.1**

  - [x]* 1.5 Write property test for `getParentFolder` (Property 3)
    - **Property 3: Parent folder existence validation**
    - Generate arbitrary nodes with optional `parentFolder` and folder arrays with fast-check
    - Assert: returns matching folder if and only if `parentFolder` matches a folder id in the array
    - Assert: returns `undefined` when no match exists or `parentFolder` is undefined
    - **Validates: Requirements 2.5, 3.6**

- [x] 2. Generalize navigation handler in App.tsx
  - [x] 2.1 Replace `handleFolderNavigate` with `handleNodeNavigate` in `App.tsx`
    - Rename function to `handleNodeNavigate`
    - Extend lookup to search in both `result.folders` AND `result.modules`
    - Keep guard clause: if node not found, do nothing (no state change, no fitToNode)
    - Update the prop passed to `ModulePanel` from `onFolderNavigate` to `onNodeNavigate`
    - _Requirements: 4.1, 4.4, 4.5_

  - [x]* 2.2 Write property test for navigation guard (Property 5)
    - **Property 5: Navigation guard for non-existent nodes**
    - Generate arbitrary node ids that do NOT exist in folders/modules arrays
    - Assert: calling the handler does not change selectedNode and does not invoke fitToNode
    - **Validates: Requirements 4.5**

- [x] 3. Update ModulePanel props and render child files section
  - [x] 3.1 Update `ModulePanelProps` interface in `module_panel.tsx`
    - Rename `onFolderNavigate` to `onNodeNavigate` in the interface
    - Update all internal usages of the prop (subfolder button onClick handlers)
    - _Requirements: 4.2_

  - [x] 3.2 Render child files section in `ModulePanel` for folder nodes
    - Compute `graphNodeIds` set from `allModules` and `allFolders` ids
    - Call `getSortedChildFiles(node.id, allModules ?? [], graphNodeIds)`
    - If result is empty, omit the section entirely
    - Render section with title "Archivos" and buttons using `module-panel__folder-btn` class
    - Each button shows 📄 icon + `truncateFolderName(file.name)` and calls `onNodeNavigate?.(file.id)` on click
    - Set `title` attribute to full file name for tooltip on hover
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.3 Render parent folder section in `ModulePanel` for files and folders
    - Call `getParentFolder(node, allFolders ?? [])` for both module and folder nodes
    - If result is `undefined`, omit the section entirely
    - Render section with title "Carpeta padre" and a single button using `module-panel__folder-btn` class
    - Button shows 📁 icon + `truncateFolderName(parent.name)` and calls `onNodeNavigate?.(parent.id)` on click
    - Set `title` attribute to full parent name for tooltip
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Edge highlighting and integration tests
  - [x]* 5.1 Write property test for edge highlighting (Property 4)
    - **Property 4: Edge highlighting for selected node**
    - Generate arbitrary graph edges and selected node ids with fast-check
    - Assert: edges connected to selected node have `strokeWidth: 3`, `opacity: 1`, `animated: true`
    - Assert: unconnected edges have `opacity: 0.25`
    - **Validates: Requirements 4.3**

  - [x]* 5.2 Write unit tests for ModulePanel navigation UI
    - Test: folder with child files renders "Archivos" section with correct buttons
    - Test: click on child file button invokes `onNodeNavigate` with correct file id
    - Test: folder with zero child files does not render "Archivos" section
    - Test: module with parentFolder renders "Carpeta padre" section
    - Test: click on parent folder button invokes `onNodeNavigate` with correct folder id
    - Test: module without parentFolder does not render parent section
    - Test: root folder does not render parent section
    - Test: all navigation buttons use `module-panel__folder-btn` CSS class
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.4, 4.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific UI interactions and edge cases
- The project uses vitest + fast-check (already installed in frontend package)
- All helper property tests go in `packages/frontend/src/utils/folder_panel_helpers.property.test.ts`
- Edge highlighting property test goes in `packages/frontend/src/components/architecture_graph.property.test.ts`
- Unit tests for ModulePanel go in the existing `packages/frontend/src/components/module_panel.test.tsx`
- Navigation guard property test goes in `packages/frontend/src/app_navigation.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["5.1", "5.2"] }
  ]
}
```
