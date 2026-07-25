// Motor de layout compacto para el grafo de arquitectura.
// Encapsula la lógica de cálculo de posiciones y tamaños de nodos
// sin depender de React ni ReactFlow, facilitando testing unitario y PBT.

import type { ModuleNode, FolderNode, IntegrationNode } from '../types'

// ─── Constantes de dimensionamiento ─────────────────────────────────────────

/** Ancho de un nodo de archivo (px) */
export const FILE_NODE_WIDTH = 170

/** Alto de un nodo de archivo (px) */
export const FILE_NODE_HEIGHT = 36

/** Padding horizontal interno de una carpeta (px) */
export const FOLDER_PADDING_X = 20

/** Padding vertical superior de una carpeta (px) */
export const FOLDER_PADDING_Y = 40

/** Separación entre nodos dentro de una carpeta (px) */
export const FOLDER_GAP = 12

/** Ancho de un nodo de integración (px) */
export const INTEGRATION_NODE_WIDTH = 150

/** Alto de un nodo de integración (px) */
export const INTEGRATION_NODE_HEIGHT = 50

/** Separación entre carpetas raíz en la grilla (px) */
export const ROOT_GAP = 40

/** Ancho mínimo de una carpeta (px) */
export const MIN_FOLDER_WIDTH = 200

/** Alto mínimo de una carpeta (px) */
export const MIN_FOLDER_HEIGHT = 60

/** Mínimo de columnas en la grilla de carpetas raíz */
export const MIN_ROOT_COLS = 2

/** Máximo de columnas en la grilla de carpetas raíz */
export const MAX_ROOT_COLS = 12

// ─── Tipos e interfaces ─────────────────────────────────────────────────────

/** Dimensiones de un elemento (ancho × alto) */
export interface Size {
  width: number
  height: number
}

/** Coordenadas de posición de un elemento */
export interface Position {
  x: number
  y: number
}

/** Información de layout calculada para una carpeta */
export interface FolderLayout {
  size: Size
  position: Position
  fileGridHeight: number
  contentWidth: number
}

/** Fila de subcarpetas tras aplicar wrapping */
export interface SubfolderRow {
  /** Índices en el array original de subcarpetas */
  indices: number[]
  /** Ancho acumulado de la fila incluyendo gaps */
  width: number
  /** Altura de la subcarpeta más alta en esta fila */
  height: number
}

/** Resultado final del cálculo de layout */
export interface LayoutResult {
  folderSizes: Map<string, Size>
  folderPositions: Map<string, Position>
  /** ContentWidth efectivo usado en el wrapping de cada carpeta (para posicionar subcarpetas) */
  folderContentWidths: Map<string, number>
  /** Ancho total de la grilla de raíces (para posicionar integraciones) */
  rootGridWidth: number
}

// ─── Funciones exportadas ───────────────────────────────────────────────────

/**
 * Determina el número de columnas adaptativo para una cantidad de archivos.
 * - 0 archivos → 0 columnas
 * - 1–3 archivos → N columnas (una sola fila)
 * - 4–8 archivos → 3 columnas
 * - 9–15 archivos → 4 columnas
 * - >15 archivos → 5 columnas
 */
export function getAdaptiveColumns(fileCount: number): number {
  if (fileCount === 0) return 0
  if (fileCount <= 3) return fileCount
  if (fileCount <= 8) return 3
  if (fileCount <= 15) return 4
  return 5
}

/**
 * Calcula el ancho de la grilla de archivos dado un número de columnas.
 * width = cols × (FILE_NODE_WIDTH + FOLDER_GAP)
 * Retorna 0 si cols === 0.
 */
export function computeFileGridWidth(cols: number): number {
  if (cols === 0) return 0
  return cols * (FILE_NODE_WIDTH + FOLDER_GAP)
}

/**
 * Calcula la altura de la grilla de archivos dado fileCount y cols.
 * height = ceil(fileCount / cols) × (FILE_NODE_HEIGHT + FOLDER_GAP)
 * Retorna 0 si fileCount === 0 o cols === 0.
 */
export function computeFileGridHeight(fileCount: number, cols: number): number {
  if (fileCount === 0 || cols === 0) return 0
  return Math.ceil(fileCount / cols) * (FILE_NODE_HEIGHT + FOLDER_GAP)
}

/**
 * Dado un array de tamaños de subcarpetas y el contentWidth disponible,
 * distribuye las subcarpetas en filas con wrapping greedy.
 * Retorna las filas resultantes y el contentWidth final (puede expandirse
 * si alguna subcarpeta es más ancha que el contentWidth original).
 */
export function wrapSubfolders(
  subfolderSizes: Size[],
  contentWidth: number
): { rows: SubfolderRow[]; finalContentWidth: number } {
  const rows: SubfolderRow[] = []
  let currentRow: SubfolderRow = { indices: [], width: 0, height: 0 }
  let finalContentWidth = contentWidth

  for (let i = 0; i < subfolderSizes.length; i++) {
    const itemWidth = subfolderSizes[i].width
    const gapNeeded = currentRow.indices.length > 0 ? FOLDER_GAP : 0
    const projectedWidth = currentRow.width + gapNeeded + itemWidth

    if (currentRow.indices.length > 0 && projectedWidth > contentWidth) {
      // Si el item solo no cabe en el contentWidth, expandimos
      if (itemWidth > contentWidth) {
        finalContentWidth = Math.max(finalContentWidth, itemWidth)
      }
      rows.push(currentRow)
      currentRow = { indices: [i], width: itemWidth, height: subfolderSizes[i].height }
    } else {
      currentRow.indices.push(i)
      currentRow.width += gapNeeded + itemWidth
      currentRow.height = Math.max(currentRow.height, subfolderSizes[i].height)
    }
  }

  if (currentRow.indices.length > 0) {
    rows.push(currentRow)
  }

  return { rows, finalContentWidth }
}

/**
 * Calcula el tamaño de una carpeta usando traversal bottom-up recursivo
 * con memoización. Resuelve hojas primero y propaga hacia arriba.
 * 
 * Optimiza el contentWidth para que la carpeta resultante tienda a un
 * aspect ratio cuadrado, distribuyendo subcarpetas de forma equilibrada.
 * 
 * Además guarda el contentWidth efectivo en contentWidthMemo para que
 * positionSubfoldersInParent use exactamente el mismo valor.
 */
export function calcFolderSize(
  folderId: string,
  modulesByFolder: Map<string, { length: number }>,
  subfoldersByParent: Map<string, string[]>,
  memo: Map<string, Size>,
  contentWidthMemo?: Map<string, number>
): Size {
  // Memoización: si ya se calculó, retornar directamente
  const cached = memo.get(folderId)
  if (cached) return cached

  const fileCount = modulesByFolder.get(folderId)?.length ?? 0
  const childIds = subfoldersByParent.get(folderId) ?? []

  // Carpeta vacía (sin archivos ni subcarpetas) → tamaño mínimo
  if (fileCount === 0 && childIds.length === 0) {
    const size: Size = { width: 120, height: 60 }
    memo.set(folderId, size)
    contentWidthMemo?.set(folderId, 120)
    return size
  }

  // Calcular grilla de archivos
  const cols = getAdaptiveColumns(fileCount)
  const fileGridWidth = computeFileGridWidth(cols)
  const fileGridHeight = computeFileGridHeight(fileCount, cols)

  // Calcular tamaños de subcarpetas recursivamente
  const subfolderSizes: Size[] = childIds.map(id =>
    calcFolderSize(id, modulesByFolder, subfoldersByParent, memo, contentWidthMemo)
  )

  // Calcular el contentWidth óptimo para un aspect ratio equilibrado.
  let optimalContentWidth = Math.max(fileGridWidth, MIN_FOLDER_WIDTH)

  if (subfolderSizes.length > 0) {
    // Estimar el área total de las subcarpetas
    const totalSubArea = subfolderSizes.reduce((sum, s) => sum + s.width * s.height, 0)

    // El alto ideal del bloque de subcarpetas debería ser proporcional
    // al ancho total para tender a un cuadrado.
    // Resolviendo: contentWidth = (fileGridHeight + sqrt(fileGridHeight² + 4*totalSubArea)) / 2
    const discriminant = fileGridHeight * fileGridHeight + 4 * totalSubArea
    const idealWidth = (fileGridHeight + Math.sqrt(discriminant)) / 2

    // Usar el ideal pero respetar mínimos: no más estrecho que la grilla de archivos
    // ni más estrecho que la subcarpeta más ancha individualmente
    const widestSub = subfolderSizes.reduce((max, s) => Math.max(max, s.width), 0)
    optimalContentWidth = Math.max(
      idealWidth,
      fileGridWidth,
      widestSub,
      MIN_FOLDER_WIDTH
    )
  }

  // Aplicar wrapping de subcarpetas con el contentWidth optimizado
  const { rows, finalContentWidth } = childIds.length > 0
    ? wrapSubfolders(subfolderSizes, optimalContentWidth)
    : { rows: [], finalContentWidth: optimalContentWidth }

  // Guardar el contentWidth efectivo para que positionSubfoldersInParent use el mismo
  contentWidthMemo?.set(folderId, finalContentWidth)

  // Calcular altura total de filas de subcarpetas
  let totalSubfolderRowsHeight = 0
  if (rows.length > 0) {
    totalSubfolderRowsHeight = FOLDER_GAP // gap entre file grid y primera fila de subcarpetas
    for (let i = 0; i < rows.length; i++) {
      totalSubfolderRowsHeight += rows[i].height
      if (i < rows.length - 1) {
        totalSubfolderRowsHeight += FOLDER_GAP // gap entre filas
      }
    }
  }

  // Ancho de la fila más ancha de subcarpetas
  const widestRow = rows.reduce((max, row) => Math.max(max, row.width), 0)

  // Dimensiones finales: usar el ancho real ocupado (no el contentWidth inflado)
  const width = Math.max(fileGridWidth, widestRow, MIN_FOLDER_WIDTH) + FOLDER_PADDING_X * 2
  const height = fileGridHeight + totalSubfolderRowsHeight + FOLDER_PADDING_Y + FOLDER_PADDING_X

  const size: Size = { width, height }
  memo.set(folderId, size)
  return size
}

/**
 * Simula la grilla con un número dado de columnas y retorna las dimensiones
 * totales resultantes sin crear el mapa de posiciones (evaluación rápida).
 */
function simulateGrid(
  count: number,
  cols: number,
  sizes: Size[]
): { totalWidth: number; totalHeight: number } {
  const numRows = Math.ceil(count / cols)
  const colWidths: number[] = new Array(cols).fill(0)
  const rowHeights: number[] = new Array(numRows).fill(0)

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    colWidths[col] = Math.max(colWidths[col], sizes[i].width)
    rowHeights[row] = Math.max(rowHeights[row], sizes[i].height)
  }

  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + (cols - 1) * ROOT_GAP
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (numRows - 1) * ROOT_GAP

  return { totalWidth, totalHeight }
}

/**
 * Calcula las posiciones de carpetas raíz en una grilla row-major optimizada
 * para producir un layout lo más cercano posible a un cuadrado.
 *
 * Evalúa múltiples candidatos de columnas y selecciona el que minimiza
 * la diferencia entre ancho y alto totales (aspect ratio → 1:1).
 */
export function computeRootGrid(
  rootFolderIds: string[],
  folderSizes: Map<string, Size>
): { positions: Map<string, Position>; totalWidth: number; totalHeight: number } {
  const positions = new Map<string, Position>()
  const count = rootFolderIds.length

  if (count === 0) {
    return { positions, totalWidth: 0, totalHeight: 0 }
  }

  // Obtener tamaños en orden para la simulación
  const sizes: Size[] = rootFolderIds.map(
    id => folderSizes.get(id) ?? { width: MIN_FOLDER_WIDTH, height: MIN_FOLDER_HEIGHT }
  )

  // Determinar rango de columnas a evaluar
  const minCols = Math.min(MIN_ROOT_COLS, count)
  const maxCols = Math.min(MAX_ROOT_COLS, count)

  // Evaluar cada candidato y seleccionar el que produce aspect ratio más cuadrado
  let bestCols = minCols
  let bestRatio = Infinity // |1 - width/height| → queremos minimizar esto

  for (let c = minCols; c <= maxCols; c++) {
    const { totalWidth, totalHeight } = simulateGrid(count, c, sizes)
    // Evitar divisiones por cero
    if (totalWidth === 0 || totalHeight === 0) continue
    const ratio = totalWidth / totalHeight
    const deviation = Math.abs(1 - ratio)
    if (deviation < bestRatio) {
      bestRatio = deviation
      bestCols = c
    }
  }

  const cols = bestCols
  const numRows = Math.ceil(count / cols)

  // Calcular ancho máximo por columna y alto máximo por fila
  const colWidths: number[] = new Array(cols).fill(0)
  const rowHeights: number[] = new Array(numRows).fill(0)

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    colWidths[col] = Math.max(colWidths[col], sizes[i].width)
    rowHeights[row] = Math.max(rowHeights[row], sizes[i].height)
  }

  // Calcular posiciones acumuladas
  const colX: number[] = [0]
  for (let c = 1; c < cols; c++) {
    colX[c] = colX[c - 1] + colWidths[c - 1] + ROOT_GAP
  }

  const rowY: number[] = [0]
  for (let r = 1; r < numRows; r++) {
    rowY[r] = rowY[r - 1] + rowHeights[r - 1] + ROOT_GAP
  }

  // Asignar posiciones en row-major order
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.set(rootFolderIds[i], { x: colX[col], y: rowY[row] })
  }

  // Calcular totalWidth y totalHeight
  const totalWidth = colX[cols - 1] + colWidths[cols - 1]
  const totalHeight = rowY[numRows - 1] + rowHeights[numRows - 1]

  return { positions, totalWidth, totalHeight }
}

/**
 * Posiciona subcarpetas dentro de un padre usando el algoritmo de wrapping.
 * Usa el contentWidth exacto que se calculó durante calcFolderSize para
 * garantizar consistencia entre tamaño y posicionamiento.
 * Retorna las posiciones relativas al padre.
 */
export function positionSubfoldersInParent(
  parentId: string,
  fileGridHeight: number,
  contentWidth: number,
  subfoldersByParent: Map<string, string[]>,
  folderSizes: Map<string, Size>
): Map<string, Position> {
  const positions = new Map<string, Position>()
  const childIds = subfoldersByParent.get(parentId)
  if (!childIds || childIds.length === 0) return positions

  // Obtener tamaños de cada subcarpeta
  const subfolderSizes: Size[] = childIds.map(
    id => folderSizes.get(id) ?? { width: MIN_FOLDER_WIDTH, height: MIN_FOLDER_HEIGHT }
  )

  // Aplicar wrapping con el contentWidth exacto que se usó en calcFolderSize
  const { rows } = wrapSubfolders(subfolderSizes, contentWidth)

  // Posicionar: primera fila a Y = FOLDER_PADDING_Y + fileGridHeight + FOLDER_GAP
  let currentY = FOLDER_PADDING_Y + fileGridHeight + FOLDER_GAP

  for (const row of rows) {
    let currentX = FOLDER_PADDING_X
    for (const idx of row.indices) {
      positions.set(childIds[idx], { x: currentX, y: currentY })
      currentX += subfolderSizes[idx].width + FOLDER_GAP
    }
    // Siguiente fila: Y anterior + altura de la fila + FOLDER_GAP
    currentY += row.height + FOLDER_GAP
  }

  return positions
}

/**
 * Orquesta todo el cálculo de layout. Punto de entrada principal.
 * Recibe los datos crudos del análisis y retorna posiciones y tamaños
 * de todas las carpetas más el ancho total de la grilla raíz.
 */
export function computeLayout(
  modules: ModuleNode[],
  folders: FolderNode[],
  integrations: IntegrationNode[]
): LayoutResult {
  // 1. Construir índice de módulos por carpeta (solo necesitamos el count)
  const modulesByFolder = new Map<string, { length: number }>()
  for (const mod of modules) {
    if (mod.parentFolder) {
      const existing = modulesByFolder.get(mod.parentFolder)
      if (existing) {
        existing.length++
      } else {
        modulesByFolder.set(mod.parentFolder, { length: 1 })
      }
    }
  }

  // 2. Construir índice de subcarpetas por padre e identificar carpetas raíz
  const subfoldersByParent = new Map<string, string[]>()
  const rootFolderIds: string[] = []

  for (const folder of folders) {
    if (folder.parentFolder) {
      const siblings = subfoldersByParent.get(folder.parentFolder)
      if (siblings) {
        siblings.push(folder.id)
      } else {
        subfoldersByParent.set(folder.parentFolder, [folder.id])
      }
    } else {
      rootFolderIds.push(folder.id)
    }
  }

  // 3. Calcular tamaños bottom-up para todas las carpetas
  //    contentWidthMemo guarda el contentWidth exacto usado en el wrapping
  const memo = new Map<string, Size>()
  const contentWidthMemo = new Map<string, number>()
  for (const folder of folders) {
    calcFolderSize(folder.id, modulesByFolder, subfoldersByParent, memo, contentWidthMemo)
  }

  // 4. Posicionar carpetas raíz en grilla
  const { positions: rootPositions, totalWidth: rootGridWidth } = computeRootGrid(rootFolderIds, memo)

  // 5. Posicionar subcarpetas recursivamente y propagar posiciones absolutas
  const folderPositions = new Map<string, Position>()

  function positionFolderRecursive(folderId: string, parentAbsolutePos: Position) {
    const fileCount = modulesByFolder.get(folderId)?.length ?? 0
    const cols = getAdaptiveColumns(fileCount)
    const fileGridHeight = computeFileGridHeight(fileCount, cols)
    // Usar el contentWidth exacto almacenado durante calcFolderSize
    const contentWidth = contentWidthMemo.get(folderId) ?? MIN_FOLDER_WIDTH

    // Posicionar subcarpetas de esta carpeta (posiciones relativas al padre)
    const childPositions = positionSubfoldersInParent(
      folderId, fileGridHeight, contentWidth, subfoldersByParent, memo
    )

    // Convertir posiciones relativas a absolutas y recurrir
    for (const [childId, relPos] of childPositions) {
      const absPos: Position = {
        x: parentAbsolutePos.x + relPos.x,
        y: parentAbsolutePos.y + relPos.y,
      }
      folderPositions.set(childId, absPos)
      positionFolderRecursive(childId, absPos)
    }
  }

  // Posicionar raíces y recurrir en cada una
  for (const [folderId, pos] of rootPositions) {
    folderPositions.set(folderId, pos)
    positionFolderRecursive(folderId, pos)
  }

  return {
    folderSizes: memo,
    folderPositions,
    folderContentWidths: contentWidthMemo,
    rootGridWidth,
  }
}
