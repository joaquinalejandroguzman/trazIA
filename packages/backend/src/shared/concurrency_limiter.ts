// Limitador de concurrencia para fan-outs de llamadas a Bedrock
// Controla cuántas promesas se ejecutan en simultáneo, evitando throttling

/**
 * Parsea el valor de la variable de entorno de concurrencia y devuelve un entero positivo,
 * o el default proporcionado.
 * Exportado para facilitar el testeo unitario aislado.
 *
 * @param raw - valor crudo de la variable de entorno (puede ser undefined o string)
 * @param defaultValue - valor por defecto si el parseo falla (default: 4)
 * @returns entero positivo válido para usar como límite de concurrencia
 */
export function parseConcurrency(raw: string | undefined, defaultValue = 4): number {
  if (raw === undefined || raw === '') {
    return defaultValue
  }

  const parsed = parseInt(raw, 10)

  // Retornar default si no es un número, es <= 0, o no es entero
  if (Number.isNaN(parsed) || parsed <= 0 || String(parsed) !== raw) {
    return defaultValue
  }

  return parsed
}

// Valor evaluado al cargar el módulo — lee MAX_LLM_CONCURRENCY del entorno
export const MAX_CONCURRENCY: number = parseConcurrency(process.env.MAX_LLM_CONCURRENCY)

/**
 * Ejecuta `fn` sobre cada elemento de `items` con concurrencia máxima MAX_CONCURRENCY.
 * Preserva el orden: results[i] corresponde a items[i].
 * No lanza excepción aunque fn(items[i]) falle; en ese caso results[i] recibe el valor
 * retornado por onError(items[i], err), que por defecto es undefined.
 *
 * Usa el patrón worker-pool: lanza min(MAX_CONCURRENCY, items.length) workers
 * que comparten un índice atómico (seguro en JS single-thread).
 *
 * @param items    — lista de entradas
 * @param fn       — función asíncrona a ejecutar por ítem
 * @param onError  — handler de error por ítem (opcional); retorna el valor de fallback
 */
export async function limitedMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  onError?: (item: T, error: unknown) => R
): Promise<(R | undefined)[]> {
  // Caso borde: lista vacía
  if (items.length === 0) {
    return []
  }

  // Pre-asignar el array de resultados para preservar orden
  const results: (R | undefined)[] = new Array(items.length)

  // Índice compartido entre workers — seguro porque JS es single-thread
  let nextIndex = 0

  // Función worker: toma ítems de la cola hasta que se agotan
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      // Capturar el índice actual antes de incrementar (atómico en JS)
      const i = nextIndex
      nextIndex++

      try {
        results[i] = await fn(items[i])
      } catch (error: unknown) {
        // Capturar error por ítem: usar onError si está definido, sino undefined
        results[i] = onError ? onError(items[i], error) : undefined
      }
    }
  }

  // Lanzar min(MAX_CONCURRENCY, items.length) workers en paralelo
  const workerCount = Math.min(MAX_CONCURRENCY, items.length)
  const workers: Promise<void>[] = []

  for (let w = 0; w < workerCount; w++) {
    workers.push(worker())
  }

  // Esperar a que todos los workers terminen
  await Promise.all(workers)

  return results
}
