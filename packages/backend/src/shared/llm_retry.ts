// Utilidad de retry con backoff exponencial para llamadas a LLM
// Detecta errores transitorios (throttling, rate limits) y reintenta con demora creciente
// Errores no transitorios se propagan inmediatamente sin reintentar

/**
 * Opciones de configuración para el mecanismo de retry
 */
export interface RetryOptions {
  maxRetries?: number      // máximo de reintentos (por defecto: MAX_LLM_RETRIES del env o 3)
  baseDelayMs?: number     // demora base en ms (por defecto: BASE_RETRY_DELAY_MS del env o 1000)
  maxDelayMs?: number      // demora máxima en ms (por defecto: MAX_RETRY_DELAY_MS del env o 30000)
}

/**
 * Contexto de la operación LLM para logging
 */
export interface RetryContext {
  agente: string    // nombre del agente que invoca (ej: "analyzer", "ears_writer")
  módulo: string    // módulo o recurso siendo procesado (ej: nombre del archivo)
}

// Leer configuración desde variables de entorno con defaults
const MAX_LLM_RETRIES = parseInt(process.env.MAX_LLM_RETRIES || '3', 10)
const BASE_RETRY_DELAY_MS = parseInt(process.env.BASE_RETRY_DELAY_MS || '1000', 10)
const MAX_RETRY_DELAY_MS = parseInt(process.env.MAX_RETRY_DELAY_MS || '30000', 10)

/**
 * Determina si un error es transitorio y debe reintentar
 * Errores transitorios típicos: ThrottlingException, rate limits (429), mensajes con "Try your request again"
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  
  return (
    error.message.includes('Try your request again') ||
    error.constructor.name === 'ThrottlingException' ||
    ('status' in error && (error as { status: number }).status === 429)
  )
}

/**
 * Calcula la demora de backoff exponencial para un intento dado
 * Fórmula: min(maxDelayMs, max(1000, baseDelayMs * 2^(attempt - 1)))
 * 
 * @param attempt - número de intento (1-indexed)
 * @param baseDelayMs - demora base en milisegundos
 * @param maxDelayMs - demora máxima en milisegundos
 * @returns demora en milisegundos
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
  const cappedDelay = Math.max(1000, exponentialDelay)
  return Math.min(maxDelayMs, cappedDelay)
}

/**
 * Ejecuta una función asíncrona con retry automático ante errores transitorios
 * 
 * @param fn - función asíncrona a ejecutar
 * @param context - contexto para logging (agente y módulo)
 * @param options - opciones de retry (maxRetries, baseDelayMs, maxDelayMs)
 * @returns resultado de la función exitosa
 * @throws error original si no es transitorio o si se agotan los reintentos
 */
export async function withLlmRetry<T>(
  fn: () => Promise<T>,
  context: RetryContext,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_LLM_RETRIES
  const baseDelayMs = options?.baseDelayMs ?? BASE_RETRY_DELAY_MS
  const maxDelayMs = options?.maxDelayMs ?? MAX_RETRY_DELAY_MS
  
  const startTime = Date.now()
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Si el error no es transitorio, propagarlo inmediatamente sin reintentar
      if (!isTransientError(error)) {
        throw error
      }
      
      // Si es el último intento, loggear y propagar el error
      if (attempt === maxRetries) {
        const tiempoTotalMs = Date.now() - startTime
        console.error(JSON.stringify({
          agente: context.agente,
          módulo: context.módulo,
          intentos: maxRetries,
          últimoError: lastError.message,
          tiempoTotalMs
        }))
        throw lastError
      }
      
      // Calcular demora y esperar antes del próximo intento
      const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  // Este punto nunca debería alcanzarse, pero TypeScript lo requiere
  throw lastError || new Error('withLlmRetry: error inesperado')
}
