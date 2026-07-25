// Router de intención — clasificación determinística del mensaje del usuario
// Sin invocar al LLM, reduce costos y latencia para mensajes que no requieren generación

/**
 * Categorías de intención del mensaje del usuario
 */
export type ChatIntent = 'saludo' | 'jailbreak' | 'offtopic' | 'pregunta_repo'

/**
 * Regla extensible de clasificación de intención.
 * Para agregar nuevas reglas, basta con agregar elementos al array INTENT_RULES.
 */
export interface IntentRule {
  intent: ChatIntent
  match: (message: string) => boolean
}

// Patrones de jailbreak / prompt injection
const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore previous instructions/i,
  /olvidá las instrucciones/i,
  /olvida las instrucciones/i,
  /actúa como/i,
  /actua como/i,
  /sos un/i,
]

// Patrones de saludo
const SALUDO_PATTERNS: RegExp[] = [
  /\bhola\b/i,
  /\bbuenos días\b/i,
  /\bbuenos dias\b/i,
  /\bqué tal\b/i,
  /\bque tal\b/i,
  /\bhey\b/i,
  /\bbuen día\b/i,
  /\bbuen dia\b/i,
]

// Patrones de temas no técnicos (offtopic)
const OFFTOPIC_PATTERNS: RegExp[] = [
  /\bclima\b/i,
  /\btiempo\b.*\b(hoy|mañana|lluvia|sol)\b/i,
  /\bpolítica\b/i,
  /\bpolitica\b/i,
  /\belecciones\b/i,
  /\bfútbol\b/i,
  /\bfutbol\b/i,
  /\bdeportes?\b/i,
  /\brecetas?\b/i,
  /\bcocina\b/i,
  /\bpartido\b.*\b(de|del)\b/i,
  /\bgobierno\b/i,
  /\bpresidente\b/i,
]

/**
 * Array de reglas ordenadas por prioridad.
 * Orden: jailbreak > saludo > offtopic.
 * Para extender la clasificación, agregar nuevos elementos a este array.
 */
export const INTENT_RULES: IntentRule[] = [
  {
    intent: 'jailbreak',
    match: (message: string): boolean =>
      JAILBREAK_PATTERNS.some((pattern) => pattern.test(message)),
  },
  {
    intent: 'saludo',
    match: (message: string): boolean =>
      SALUDO_PATTERNS.some((pattern) => pattern.test(message)),
  },
  {
    intent: 'offtopic',
    match: (message: string): boolean =>
      OFFTOPIC_PATTERNS.some((pattern) => pattern.test(message)),
  },
]

/**
 * Clasifica la intención del mensaje del usuario evaluando las reglas en orden de prioridad.
 * Retorna 'pregunta_repo' como default si ninguna regla matchea.
 */
export function classifyIntent(message: string): ChatIntent {
  for (const rule of INTENT_RULES) {
    if (rule.match(message)) {
      return rule.intent
    }
  }
  return 'pregunta_repo'
}
