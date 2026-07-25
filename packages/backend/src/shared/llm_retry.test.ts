import { isTransientError, calculateBackoffDelay, withLlmRetry } from './llm_retry'

const ctx = { agente: 'test', módulo: 'retry' }

describe('isTransientError', () => {
  it('returns false for non-Error values', () => {
    expect(isTransientError('string')).toBe(false)
    expect(isTransientError(null)).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
    expect(isTransientError(42)).toBe(false)
  })

  it('returns true for ThrottlingException', () => {
    const err = Object.assign(new Error('rate limited'), { constructor: { name: 'ThrottlingException' } })
    expect(isTransientError(err)).toBe(true)
  })

  it('returns true for HTTP 429', () => {
    const err = Object.assign(new Error('too many requests'), { status: 429 })
    expect(isTransientError(err)).toBe(true)
  })

  it('returns true for HTTP 500-504', () => {
    for (const status of [500, 502, 503, 504, 529]) {
      const err = Object.assign(new Error(`HTTP ${status}`), { status })
      expect(isTransientError(err)).toBe(true)
    }
  })

  it('returns true for network error codes', () => {
    for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE']) {
      const err = Object.assign(new Error(code), { code })
      expect(isTransientError(err)).toBe(true)
    }
  })

  it('returns true for "Try your request again" message', () => {
    const err = new Error('Try your request again later')
    expect(isTransientError(err)).toBe(true)
  })

  it('returns true for "socket hang up" message', () => {
    const err = new Error('socket hang up')
    expect(isTransientError(err)).toBe(true)
  })

  it('returns false for non-transient errors', () => {
    const err = new Error('invalid API key')
    expect(isTransientError(err)).toBe(false)
  })

  it('returns false for HTTP 400', () => {
    const err = Object.assign(new Error('bad request'), { status: 400 })
    expect(isTransientError(err)).toBe(false)
  })
})

describe('calculateBackoffDelay', () => {
  it('returns baseDelay for attempt 1', () => {
    expect(calculateBackoffDelay(1, 1000, 30000)).toBe(1000)
  })

  it('doubles delay each attempt', () => {
    expect(calculateBackoffDelay(1, 1000, 30000)).toBe(1000)
    expect(calculateBackoffDelay(2, 1000, 30000)).toBe(2000)
    expect(calculateBackoffDelay(3, 1000, 30000)).toBe(4000)
  })

  it('caps at maxDelayMs', () => {
    expect(calculateBackoffDelay(10, 1000, 5000)).toBe(5000)
  })

  it('floors at 1000ms even with small base', () => {
    expect(calculateBackoffDelay(1, 100, 30000)).toBe(1000)
  })
})

describe('withLlmRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    const result = await withLlmRetry(fn, ctx, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on transient error and eventually succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }))
      .mockResolvedValue('ok')
    const result = await withLlmRetry(fn, ctx, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws immediately on non-transient error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('invalid key'))
    await expect(withLlmRetry(fn, ctx, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }))
      .rejects.toThrow('invalid key')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting retries on transient errors', async () => {
    const fn = jest.fn().mockRejectedValue(Object.assign(new Error('503'), { status: 503 }))
    await expect(withLlmRetry(fn, ctx, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 }))
      .rejects.toThrow('503')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
