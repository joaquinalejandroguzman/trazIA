import type { FolderNode, ModuleNode } from '../types'

/** Resultado del conteo de hijos directos de una carpeta */
export interface DirectChildCounts {
  folders: number
  files: number
}

/** Límite de caracteres para nombres de carpeta en botones */
export const MAX_FOLDER_NAME_LENGTH = 30

/** Duración de la animación de centrado en milisegundos */
export const FIT_VIEW_DURATION = 800

/** Padding relativo al viewport para fitView */
export const FIT_VIEW_PADDING = 0.15

/**
 * Retorna las subcarpetas directas de una carpeta, ordenadas alfabéticamente.
 * Usa localeCompare con sensitivity 'base' para comparación case-insensitive.
 * El sort es estable: carpetas con nombres case-insensitive iguales mantienen su orden original.
 */
export function getSortedSubfolders(
  folderId: string,
  allFolders: readonly FolderNode[]
): FolderNode[] {
  // Filtrar subcarpetas directas (parentFolder === folderId)
  const directChildren = allFolders.filter(
    (folder) => folder.parentFolder === folderId
  )

  // Ordenar alfabéticamente con comparación case-insensitive (estable en motores modernos)
  return directChildren.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

/**
 * Formatea un conteo en su etiqueta en español con pluralización correcta.
 * - count === 1 → singular ("carpeta directa" / "archivo directo")
 * - count !== 1 → plural ("carpetas directas" / "archivos directos")
 */
export function formatChildLabel(
  count: number,
  type: 'folder' | 'file'
): string {
  if (type === 'folder') {
    const label = count === 1 ? 'carpeta directa' : 'carpetas directas'
    return `${count} ${label}`
  }
  const label = count === 1 ? 'archivo directo' : 'archivos directos'
  return `${count} ${label}`
}

/**
 * Cuenta las carpetas y archivos directos de una carpeta dada.
 * Filtra folders y modules buscando los que tienen parentFolder === folderId.
 */
export function countDirectChildren(
  folderId: string,
  allFolders: readonly FolderNode[],
  allModules: readonly ModuleNode[]
): DirectChildCounts {
  const folders = allFolders.filter(f => f.parentFolder === folderId).length
  const files = allModules.filter(m => m.parentFolder === folderId).length
  return { folders, files }
}

/**
 * Trunca un nombre de carpeta a maxLength caracteres, agregando "…" si excede.
 * Si el nombre tiene ≤ maxLength caracteres, se retorna sin modificar.
 */
export function truncateFolderName(name: string, maxLength: number = MAX_FOLDER_NAME_LENGTH): string {
  if (name.length <= maxLength) {
    return name
  }
  return name.slice(0, maxLength) + '…'
}
