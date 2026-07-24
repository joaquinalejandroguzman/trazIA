// Cliente Bedrock singleton — instanciado una sola vez al arrancar el proceso
// Todos los agentes deben importar bedrockClient desde aquí; nunca instanciar el suyo propio

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk'

/**
 * Valida que una variable de entorno esté definida y retorna su valor.
 * Lanza un error sincrónico al cargar el módulo si la variable no existe,
 * lo que permite detectar configuraciones incompletas antes de procesar peticiones.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable de entorno requerida no definida: ${name}`)
  return value
}

// Región AWS donde están disponibles los modelos Bedrock (ej: sa-east-1)
export const BEDROCK_REGION = requireEnv('BEDROCK_REGION')

// ID del inference profile de Haiku para el Agente Analizador
export const BEDROCK_MODEL_ANALYZER = requireEnv('BEDROCK_MODEL_ANALYZER')

// ID del inference profile de Sonnet para el Agente EARS Writer
export const BEDROCK_MODEL_EARS = requireEnv('BEDROCK_MODEL_EARS')

// Instancia única del cliente Bedrock
// Las credenciales se resuelven via cadena estándar del AWS SDK
// (perfil trazia-backend en ~/.aws/credentials o variables de entorno AWS_*)
export const bedrockClient = new AnthropicBedrock({ awsRegion: BEDROCK_REGION })
