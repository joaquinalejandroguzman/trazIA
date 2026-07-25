// Tests para el módulo de historial de conversación en memoria
import { getHistory, addToHistory, clearHistory, ChatMessage } from './history';

describe('agents/chat/history', () => {
  // Limpiar la sesión de test entre cada caso
  const SESSION_ID = 'test-session-001';

  beforeEach(() => {
    clearHistory(SESSION_ID);
  });

  describe('getHistory', () => {
    it('retorna array vacío si la sesión no existe', () => {
      const history = getHistory('sesion-inexistente');
      expect(history).toEqual([]);
    });

    it('retorna los mensajes almacenados para una sesión existente', () => {
      const msg: ChatMessage = { role: 'user', content: 'hola' };
      addToHistory(SESSION_ID, msg);

      const history = getHistory(SESSION_ID);
      expect(history).toEqual([msg]);
    });
  });

  describe('addToHistory', () => {
    it('agrega un mensaje al historial de la sesión', () => {
      addToHistory(SESSION_ID, { role: 'user', content: 'pregunta' });
      addToHistory(SESSION_ID, { role: 'assistant', content: 'respuesta' });

      const history = getHistory(SESSION_ID);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'pregunta' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'respuesta' });
    });

    it('mantiene exactamente 8 mensajes cuando se agregan más (FIFO)', () => {
      // Agregar 10 mensajes
      for (let i = 1; i <= 10; i++) {
        addToHistory(SESSION_ID, { role: 'user', content: `mensaje ${i}` });
      }

      const history = getHistory(SESSION_ID);
      expect(history).toHaveLength(8);
      // Los primeros 2 mensajes deben haber sido descartados
      expect(history[0].content).toBe('mensaje 3');
      expect(history[7].content).toBe('mensaje 10');
    });

    it('descarta los mensajes más antiguos al superar el límite de 8', () => {
      // Agregar exactamente 8 mensajes
      for (let i = 1; i <= 8; i++) {
        addToHistory(SESSION_ID, { role: 'user', content: `msg ${i}` });
      }
      expect(getHistory(SESSION_ID)).toHaveLength(8);

      // Agregar el 9° — debe descartar el primero
      addToHistory(SESSION_ID, { role: 'assistant', content: 'msg 9' });
      const history = getHistory(SESSION_ID);
      expect(history).toHaveLength(8);
      expect(history[0].content).toBe('msg 2');
      expect(history[7].content).toBe('msg 9');
    });

    it('maneja sesiones independientes sin interferencia', () => {
      const sessionA = 'session-a';
      const sessionB = 'session-b';

      addToHistory(sessionA, { role: 'user', content: 'en A' });
      addToHistory(sessionB, { role: 'user', content: 'en B' });

      expect(getHistory(sessionA)).toHaveLength(1);
      expect(getHistory(sessionB)).toHaveLength(1);
      expect(getHistory(sessionA)[0].content).toBe('en A');
      expect(getHistory(sessionB)[0].content).toBe('en B');

      // Limpiar
      clearHistory(sessionA);
      clearHistory(sessionB);
    });
  });

  describe('clearHistory', () => {
    it('elimina todos los mensajes de una sesión', () => {
      addToHistory(SESSION_ID, { role: 'user', content: 'algo' });
      addToHistory(SESSION_ID, { role: 'assistant', content: 'respuesta' });

      clearHistory(SESSION_ID);
      expect(getHistory(SESSION_ID)).toEqual([]);
    });

    it('no lanza error al limpiar una sesión que no existe', () => {
      expect(() => clearHistory('sesion-fantasma')).not.toThrow();
    });
  });
});
