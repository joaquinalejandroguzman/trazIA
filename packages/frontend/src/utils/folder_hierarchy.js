/** Escala tipográfica: depth → fontSize en rem (indexado por depth - 1) */
export const HIERARCHY_FONT_SIZES = [
    '1.5rem', // depth 1 (raíz)
    '1.25rem', // depth 2
    '1.0rem', // depth 3
    '0.875rem', // depth 4
    '0.8rem', // depth 5
    '0.75rem', // depth 6+
];
/** Profundidad máxima soportada por la escala tipográfica */
const MAX_HIERARCHY_DEPTH = 6;
/**
 * Calcula la profundidad de una carpeta en el árbol jerárquico.
 * Recorre la cadena de parentFolder hacia arriba, usando un Set de visitados
 * para detectar referencias circulares en O(n).
 *
 * - Carpeta sin parentFolder → depth 1
 * - parentFolder inexistente en el mapa → depth 1 (orphan, se trata como raíz)
 * - Referencia circular detectada → depth 1 (safety)
 * - Caso normal → parent.depth + 1
 */
export function computeFolderDepth(folderId, foldersMap) {
    const folder = foldersMap.get(folderId);
    // Si la carpeta no existe en el mapa, retorna depth 1
    if (!folder)
        return 1;
    // Si no tiene parentFolder, es raíz
    if (!folder.parentFolder)
        return 1;
    // Recorrido ascendente con detección de ciclos
    const visited = new Set();
    visited.add(folderId);
    let currentId = folder.parentFolder;
    let depth = 1;
    while (currentId) {
        // Detectar ciclo: si ya visitamos este nodo, abortar y retornar depth 1
        if (visited.has(currentId))
            return 1;
        const parent = foldersMap.get(currentId);
        // Parent inexistente → el nodo actual se trata como orphan (raíz efectiva),
        // retorna depth acumulado hasta aquí
        if (!parent)
            return depth;
        visited.add(currentId);
        depth++;
        // Si el parent no tiene parentFolder, es raíz → terminamos
        if (!parent.parentFolder)
            break;
        currentId = parent.parentFolder;
    }
    return depth;
}
/**
 * Devuelve el fontSize correspondiente a un nivel de profundidad.
 * Clampea a nivel 6 (índice 5) para depths mayores a 6.
 */
export function getHierarchyFontSize(depth) {
    const index = Math.min(depth, MAX_HIERARCHY_DEPTH) - 1;
    return HIERARCHY_FONT_SIZES[index];
}
