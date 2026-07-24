import axios, { AxiosInstance, AxiosError, type InternalAxiosRequestConfig } from 'axios'

// Lee la URL base del entorno; usa localhost:3001 como fallback
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Timeout ampliado: 3 minutos para repos medianos
const REQUEST_TIMEOUT_MS = 180_000

// Cantidad máxima de reintentos para errores transitorios (5xx, timeout, red)
const MAX_RETRIES = 1
const RETRY_DELAY_MS = 2000

// Instancia configurada de axios para comunicarse con el backend de TrazIA
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Determina si un error es transitorio y amerita retry (excluye ECONNABORTED, que se maneja aparte)
function isRetryableError(error: AxiosError): boolean {
  // Error de red sin respuesta (servidor caído, sin conexión)
  if (!error.response) return true
  // Errores del servidor (5xx) son transitorios
  const status = error.response.status
  return status >= 500 && status < 600
}

// Genera un mensaje legible en español para el usuario según el tipo de error HTTP
function getReadableErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNABORTED') {
    return 'La operación tardó demasiado. Intentá con un repositorio más chico o volvé a intentar.'
  }

  if (!error.response) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión a internet.'
  }

  const status = error.response.status
  // Extrae mensaje del body si existe
  const serverMessage = (error.response.data as { error?: string })?.error

  switch (status) {
    case 400:
      return serverMessage ?? 'Datos inválidos en la solicitud.'
    case 403:
      return 'Acceso denegado. Solo se soportan repositorios públicos de GitHub.'
    case 404:
      return 'Repositorio no encontrado. Verificá que la URL sea correcta y que sea público.'
    case 422:
      return serverMessage ?? 'No se pudo procesar la solicitud. Verificá los datos ingresados.'
    case 429:
      return 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.'
    case 500:
    case 502:
    case 503:
      return 'Error interno del servidor. Intentá de nuevo en unos segundos.'
    case 504:
      return 'El servidor tardó demasiado en responder. Intentá con un repositorio más chico.'
    default:
      return serverMessage ?? `Error inesperado (${status}). Intentá de nuevo.`
  }
}

// Interceptor de respuesta: transforma errores en mensajes legibles + retry para transitorios
apiClient.interceptors.response.use(
  // Respuestas exitosas pasan directo
  (response) => response,

  // Manejo de errores
  async (error: AxiosError) => {
    // Timeout: rechazar inmediatamente sin reintentar
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new Error('La operación tardó demasiado. Intentá con un repositorio más chico o volvé a intentar.')
      )
    }

    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number; _skipRetry?: boolean }

    // Si la request marcó _skipRetry, no reintentar — ir directo al error legible
    if (config?._skipRetry) {
      const readableMessage = getReadableErrorMessage(error)
      return Promise.reject(new Error(readableMessage))
    }

    // Retry para errores transitorios (solo si no superamos el límite)
    if (config && isRetryableError(error)) {
      const retryCount = config._retryCount ?? 0

      if (retryCount < MAX_RETRIES) {
        config._retryCount = retryCount + 1

        // Espera antes de reintentar (backoff simple)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))

        return apiClient(config)
      }
    }

    // Si no es retryable o ya agotamos retries, lanzar error con mensaje legible
    const readableMessage = getReadableErrorMessage(error)
    const enhancedError = new Error(readableMessage)
    return Promise.reject(enhancedError)
  }
)

export default apiClient
