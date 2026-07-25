import { parseHaikuClassification } from './analyzer'

describe('parseHaikuClassification', () => {
  it('parses valid JSON with fence', () => {
    const raw = '```json\n{"specStatus":"traced","specHealthScore":85}\n```'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'traced', specHealthScore: 85 })
  })

  it('parses valid JSON without fence', () => {
    const raw = '{"specStatus":"drift","specHealthScore":42}'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'drift', specHealthScore: 42 })
  })

  it('parses JSON embedded in prose', () => {
    const raw = 'Here is the result:\n{"specStatus":"untraced","specHealthScore":10}\nDone.'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 10 })
  })

  it('clamps score above 100', () => {
    const raw = '{"specStatus":"traced","specHealthScore":150}'
    const result = parseHaikuClassification(raw)
    expect(result.specHealthScore).toBe(100)
  })

  it('clamps negative score to 0', () => {
    const raw = '{"specStatus":"traced","specHealthScore":-10}'
    const result = parseHaikuClassification(raw)
    expect(result.specHealthScore).toBe(0)
  })

  it('returns defaults for invalid JSON', () => {
    const result = parseHaikuClassification('not json at all')
    expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
  })

  it('returns defaults when specStatus is missing', () => {
    const raw = '{"specHealthScore":50}'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
  })

  it('returns defaults when specHealthScore is not a number', () => {
    const raw = '{"specStatus":"traced","specHealthScore":"high"}'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
  })

  it('returns defaults for unknown specStatus', () => {
    const raw = '{"specStatus":"unknown","specHealthScore":50}'
    const result = parseHaikuClassification(raw)
    expect(result.specStatus).toBe('untraced')
  })

  it('handles unbalanced braces gracefully', () => {
    const raw = '{"specStatus":"traced","specHealthScore":80'
    const result = parseHaikuClassification(raw)
    expect(result).toEqual({ specStatus: 'untraced', specHealthScore: 0 })
  })
})
