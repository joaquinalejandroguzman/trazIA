// Módulo de historial de conversación en memoria por sesión.
// Almacena los últimos MAX_HISTORY_MESSAGES mensajes por sesión usando FIFO.

/** Cantidad máxima de mensajes por sesión */
const MAX_HISTORY_MESSAGES = 8;

/** Mensaje del historial de conversación */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Store en memoria — se pierde al reiniciar el servidor */
const store: Map<string, ChatMessage[]> = new Map();

/**
 * Retorna el historial de mensajes para una sesión dada.
 * Si la sesión no existe, retorna un array vacío.
 */
export function getHistory(sessionId: string): ChatMessage[] {
  return store.get(sessionId) ?? [];
}

/**
 * Agrega un mensaje al historial de una sesión.
 * Cuando el historial supera MAX_HISTORY_MESSAGES, descarta los más antiguos (FIFO).
 */
export function addToHistory(sessionId: string, message: ChatMessage): void {
  const history = store.get(sessionId) ?? [];
  history.push(message);

  // Descartar los mensajes más antiguos si se supera el límite
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }

  store.set(sessionId, history);
}

/**
 * Limpia el historial de una sesión específica.
 */
export function clearHistory(sessionId: string): void {
  store.delete(sessionId);
}
