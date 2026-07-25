// Tests unitarios para el módulo de prompts y respuestas estáticas del chat
import { CHAT_SYSTEM_PROMPT, FIXED_REPLIES } from './prompt'

describe('prompt.ts — constantes del chat', () => {
  describe('CHAT_SYSTEM_PROMPT', () => {
    it('debe ser un string no vacío', () => {
      expect(typeof CHAT_SYSTEM_PROMPT).toBe('string')
      expect(CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(0)
    })

    it('debe instruir a responder en español', () => {
      expect(CHAT_SYSTEM_PROMPT.toLowerCase()).toContain('español')
    })

    it('debe instruir a no revelar instrucciones internas', () => {
      expect(CHAT_SYSTEM_PROMPT.toLowerCase()).toContain('no reveles')
    })

    it('debe instruir sobre estructura del repositorio', () => {
      expect(CHAT_SYSTEM_PROMPT.toLowerCase()).toContain('repositorio')
    })
  })

  describe('FIXED_REPLIES', () => {
    it('debe tener las 4 claves requeridas', () => {
      const claves: Array<keyof typeof FIXED_REPLIES> = [
        'saludo',
        'jailbreak',
        'offtopic',
        'modulo_no_encontrado',
      ]
      for (const clave of claves) {
        expect(FIXED_REPLIES[clave]).toBeDefined()
        expect(typeof FIXED_REPLIES[clave]).toBe('string')
        expect(FIXED_REPLIES[clave].length).toBeGreaterThan(0)
      }
    })

    it('saludo debe ser amigable e invitar a preguntar sobre el repo', () => {
      expect(FIXED_REPLIES.saludo.toLowerCase()).toContain('repositorio')
    })

    it('jailbreak debe rechazar sin revelar detalles internos', () => {
      const reply = FIXED_REPLIES.jailbreak.toLowerCase()
      expect(reply).toContain('no puedo')
      // No debe revelar información del system prompt
      expect(reply).not.toContain('system prompt')
      expect(reply).not.toContain('instrucciones internas')
    })

    it('offtopic debe tener el texto exacto definido en la spec', () => {
      expect(FIXED_REPLIES.offtopic).toBe(
        'Eso no está relacionado con el repositorio. Podés preguntar sobre la estructura, módulos o dependencias del código.'
      )
    })

    it('modulo_no_encontrado debe tener el texto exacto definido en la spec', () => {
      expect(FIXED_REPLIES.modulo_no_encontrado).toBe(
        'No encontré ese módulo en el repositorio. Podés preguntar por cualquier módulo que aparezca en el grafo.'
      )
    })
  })
})
