// Tests unitarios para parseHaikuClassification
// Verifica el flujo de extracción de 5 pasos: FENCE → BRACE → PARSE → VALIDATE → clamp

// Mock del cliente Bedrock para evitar dependencia de variables de entorno
jest.mock('../../../clients/bedrock_client', () => ({
  bedrockClient: {},
  BEDROCK_MODEL_ANALYZER: 'mock-model',
}))

jest.mock('../../../shared/llm_retry', () => ({
  withLlmRetry: jest.fn(),
}))

import { parseHaikuClassification } from '../analyzer'

describe('parseHaikuClassification', () => {
  // --- Paso 1: FENCE ---
  describe('extracción de fences Markdown', () => {
    it('extrae JSON de un fence ```json', () => {
      const raw = '```json\n{"specStatus":"traced","specHealthScore":85}\n```'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 85 })
    })

    it('extrae JSON de un fence ``` sin tag de lenguaje', () => {
      const raw = '```\n{"specStatus":"drift","specHealthScore":42}\n```'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'drift', specHealthScore: 42 })
    })

    it('extrae JSON con prosa antes y después del fence', () => {
      const raw = 'Aquí va mi análisis:\n```json\n{"specStatus":"traced","specHealthScore":100}\n```\nEspero que sirva.'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 100 })
    })
  })

  // --- Paso 2: BRACE ---
  describe('localización de primer {...} balanceado', () => {
    it('extrae JSON con prosa circundante sin fence', () => {
      const raw = 'El resultado es: {"specStatus":"untraced","specHealthScore":0} y eso es todo.'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('retorna defaults si no hay llave de apertura', () => {
      const raw = 'No hay JSON aquí, solo texto plano.'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('retorna defaults si las llaves no están balanceadas', () => {
      const raw = '{"specStatus":"traced","specHealthScore":50'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })
  })

  // --- Paso 3: PARSE ---
  describe('parseo de JSON', () => {
    it('retorna defaults si el JSON es sintácticamente inválido', () => {
      const raw = '{specStatus: traced, specHealthScore: 50}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('parsea JSON válido directamente', () => {
      const raw = '{"specStatus":"drift","specHealthScore":75}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'drift', specHealthScore: 75 })
    })
  })

  // --- Paso 4: VALIDATE ---
  describe('validación de campos', () => {
    it('retorna defaults si falta specStatus', () => {
      const raw = '{"specHealthScore":50}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('retorna defaults si falta specHealthScore', () => {
      const raw = '{"specStatus":"traced"}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('retorna defaults si specStatus no es string', () => {
      const raw = '{"specStatus":123,"specHealthScore":50}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('retorna defaults si specHealthScore no es number', () => {
      const raw = '{"specStatus":"traced","specHealthScore":"50"}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('sustituye specStatus inválido por untraced', () => {
      const raw = '{"specStatus":"unknown","specHealthScore":50}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 50 })
    })

    it('acepta traced con specHealthScore 0 sin modificación', () => {
      const raw = '{"specStatus":"traced","specHealthScore":0}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 0 })
    })
  })

  // --- Paso 5: CLAMP ---
  describe('clamping de specHealthScore', () => {
    it('clampea valor negativo a 0', () => {
      const raw = '{"specStatus":"traced","specHealthScore":-10}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 0 })
    })

    it('clampea valor mayor a 100 a 100', () => {
      const raw = '{"specStatus":"drift","specHealthScore":150}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'drift', specHealthScore: 100 })
    })

    it('acepta valor decimal dentro de [0, 100] sin redondeo', () => {
      const raw = '{"specStatus":"traced","specHealthScore":72.5}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 72.5 })
    })

    it('acepta exactamente 0', () => {
      const raw = '{"specStatus":"untraced","specHealthScore":0}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('acepta exactamente 100', () => {
      const raw = '{"specStatus":"traced","specHealthScore":100}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 100 })
    })
  })

  // --- Caso integrado ---
  describe('casos integrados', () => {
    it('retorna defaults para string vacío', () => {
      const result = parseHaikuClassification('')
      expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
    })

    it('maneja JSON con propiedades extra (las ignora)', () => {
      const raw = '{"specStatus":"traced","specHealthScore":80,"extra":"value","nested":{"a":1}}'
      const result = parseHaikuClassification(raw)
      expect(result).toEqual({ specStatus: 'traced', specHealthScore: 80 })
    })
  })
})
