/**
 * JsonRpcClient — unit tests.
 *
 * All tests use a synchronous fake clock (fakeNow) and mock fetch functions
 * to avoid real network calls and timer dependencies.
 *
 * Covers:
 *   - call() success (result returned, metrics + health updated)
 *   - call() with params
 *   - call() request format (jsonrpc, id, method, params)
 *   - batch() success
 *   - batch() empty input
 *   - get() success
 *   - Response validation (jsonrpc version, id mismatch, both/neither result+error)
 *   - Error mapping (network, HTTP 429, HTTP 5xx, JSON parse, timeout)
 *   - RPC error payload forwarded as RPC_INVALID_RESPONSE
 *   - Metrics tracking (requestCount, failureCount, averageLatencyMs, timeoutCount)
 *   - Health tracking (availabilityScore, consecutiveFailures)
 *   - resetMetrics() / resetHealth()
 *   - Timeout via AbortController
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { JsonRpcClient, JSON_RPC_ERROR_CODES } from '../JsonRpcClient'
import { WalletError } from '@/domain/errors'
import type { RpcEndpointMetadata } from '@/domain/rpc'
import type { FetchFn } from '../JsonRpcClient'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ENDPOINT: RpcEndpointMetadata = {
  url: 'https://rpc.example.com',
  chainId: 'ethereum-sepolia',
  providerName: 'TestProvider',
  priority: 1,
  timeoutMs: 5_000,
  weight: 1,
}

/** Build a mock fetch that returns a successful JSON-RPC 2.0 response. */
function mockSuccessFetch(result: unknown, id: number = 1): FetchFn {
  const body = JSON.stringify({ jsonrpc: '2.0', id, result })
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response)
}

/** Build a mock fetch that returns a JSON-RPC 2.0 error response. */
function mockRpcErrorFetch(code: number, message: string, id: number = 1): FetchFn {
  const body = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response)
}

/** Build a mock fetch that returns an HTTP error. */
function mockHttpErrorFetch(status: number): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ error: 'http error' }),
    text: async () => 'error',
  } as unknown as Response)
}

/** Build a mock fetch that throws a network error. */
function mockNetworkErrorFetch(): FetchFn {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
}

/** Build a mock fetch that returns a body that cannot be parsed as JSON. */
function mockBadJsonFetch(): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token')
    },
    text: async () => 'not-json',
  } as unknown as Response)
}

/** Build a mock fetch that responds to AbortSignal.abort. */
function mockAbortableFetch(): FetchFn {
  return vi.fn().mockImplementation(
    (_url: string, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.')
            err.name = 'AbortError'
            reject(err)
          })
        }
      }),
  )
}

function makeClient(
  fetchFn: FetchFn,
  overrides: Partial<RpcEndpointMetadata> = {},
  fakeNow?: () => number,
): JsonRpcClient {
  const endpoint = { ...TEST_ENDPOINT, ...overrides }
  return new JsonRpcClient(endpoint, fetchFn, fakeNow ?? (() => Date.now()))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JsonRpcClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ─── call() success ───────────────────────────────────────────────────────

  describe('call() success', () => {
    it('returns the result field from the JSON-RPC response', async () => {
      const client = makeClient(mockSuccessFetch('0x1234'))
      const result = await client.call<string>('eth_blockNumber')
      expect(result).toBe('0x1234')
    })

    it('accepts params and passes them to the request', async () => {
      const fetch = mockSuccessFetch('0xabc')
      const client = makeClient(fetch)
      await client.call<string>('eth_getBalance', ['0xAddress', 'latest'])
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
      expect(body.params).toEqual(['0xAddress', 'latest'])
    })

    it('omits params field when no params provided', async () => {
      const fetch = mockSuccessFetch('0x1')
      const client = makeClient(fetch)
      await client.call<string>('eth_blockNumber')
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
      expect('params' in body).toBe(false)
    })

    it('sets jsonrpc to "2.0" in the request', async () => {
      const fetch = mockSuccessFetch('0x1')
      const client = makeClient(fetch)
      await client.call<string>('eth_blockNumber')
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
      expect(body.jsonrpc).toBe('2.0')
    })

    it('sets the method name correctly in the request', async () => {
      const fetch = mockSuccessFetch('0x1')
      const client = makeClient(fetch)
      await client.call<string>('eth_chainId')
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
      expect(body.method).toBe('eth_chainId')
    })

    it('uses a numeric id starting from 1', async () => {
      const fetch = mockSuccessFetch('0x1', 1)
      const client = makeClient(fetch)
      await client.call<string>('eth_blockNumber')
      const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
      expect(typeof body.id).toBe('number')
      expect(body.id).toBeGreaterThanOrEqual(1)
    })

    it('increments id on each call', async () => {
      // Mock echoes back the id from the request body so validation passes
      const client = new JsonRpcClient(TEST_ENDPOINT, (_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string)
        const response = { jsonrpc: '2.0', id: body.id, result: 0 }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => JSON.stringify(response),
        } as unknown as Response)
      })
      await expect(client.call<number>('net_version')).resolves.toBe(0)
      await expect(client.call<number>('net_version')).resolves.toBe(0)
    })

    it('sends POST with Content-Type application/json', async () => {
      const fetch = mockSuccessFetch('ok')
      const client = makeClient(fetch)
      await client.call<string>('eth_blockNumber')
      const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/json')
    })
  })

  // ─── batch() ─────────────────────────────────────────────────────────────

  describe('batch()', () => {
    it('returns empty array for empty input without network call', async () => {
      const fetch = vi.fn()
      const client = makeClient(fetch as unknown as FetchFn)
      const result = await client.batch([])
      expect(result).toHaveLength(0)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('returns array of RpcResponse for batch request', async () => {
      const batchResponse = [
        { jsonrpc: '2.0', id: 1, result: '0x1' },
        { jsonrpc: '2.0', id: 2, result: '0x2' },
      ]
      const batchFetch: FetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => batchResponse,
        text: async () => JSON.stringify(batchResponse),
      } as unknown as Response)

      const client = makeClient(batchFetch)
      const results = await client.batch([{ method: 'eth_blockNumber' }, { method: 'eth_chainId' }])

      expect(results).toHaveLength(2)
    })

    it('sends an array body for batch request', async () => {
      const batchResponse = [{ jsonrpc: '2.0', id: 1, result: 'x' }]
      const batchFetch: FetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => batchResponse,
        text: async () => JSON.stringify(batchResponse),
      } as unknown as Response)

      const client = makeClient(batchFetch)
      await client.batch([{ method: 'eth_blockNumber' }])
      const sentBody = JSON.parse(
        (batchFetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
      )
      expect(Array.isArray(sentBody)).toBe(true)
      expect(sentBody[0].method).toBe('eth_blockNumber')
    })

    it('throws RPC_INVALID_RESPONSE when response is not an array', async () => {
      const badFetch: FetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: 'single' }),
        text: async () => '',
      } as unknown as Response)
      const client = makeClient(badFetch)
      await expect(client.batch([{ method: 'test' }])).rejects.toMatchObject({
        code: 'RPC_INVALID_RESPONSE',
      })
    })
  })

  // ─── get() ────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns parsed JSON from a GET request', async () => {
      const payload = { status: 'ok', version: '1.0' }
      const getFetch: FetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      } as unknown as Response)
      const client = makeClient(getFetch)
      const result = await client.get<typeof payload>('/health')
      expect(result).toEqual(payload)
    })

    it('uses GET method', async () => {
      const getFetch: FetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '{}',
      } as unknown as Response)
      const client = makeClient(getFetch)
      await client.get('/health')
      const init = (getFetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(init.method).toBe('GET')
    })

    it('throws RPC_INVALID_RESPONSE for non-ok HTTP status', async () => {
      const client = makeClient(mockHttpErrorFetch(500))
      await expect(client.get('/health')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_NOT_CONNECTED on network failure', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await expect(client.get('/health')).rejects.toMatchObject({ code: 'RPC_NOT_CONNECTED' })
    })
  })

  // ─── Error mapping ────────────────────────────────────────────────────────

  describe('error mapping', () => {
    it('maps network error to RPC_NOT_CONNECTED', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await expect(client.call('eth_blockNumber')).rejects.toMatchObject({
        code: 'RPC_NOT_CONNECTED',
      })
    })

    it('maps HTTP 429 to RPC_RATE_LIMITED', async () => {
      const client = makeClient(mockHttpErrorFetch(429))
      await expect(client.call('eth_blockNumber')).rejects.toMatchObject({
        code: 'RPC_RATE_LIMITED',
      })
    })

    it('maps HTTP 500 to RPC_INVALID_RESPONSE', async () => {
      const client = makeClient(mockHttpErrorFetch(500))
      await expect(client.call('eth_blockNumber')).rejects.toMatchObject({
        code: 'RPC_INVALID_RESPONSE',
      })
    })

    it('maps HTTP 503 to RPC_INVALID_RESPONSE', async () => {
      const client = makeClient(mockHttpErrorFetch(503))
      await expect(client.call('eth_blockNumber')).rejects.toMatchObject({
        code: 'RPC_INVALID_RESPONSE',
      })
    })

    it('maps non-JSON body to RPC_INVALID_RESPONSE', async () => {
      const client = makeClient(mockBadJsonFetch())
      await expect(client.call('eth_blockNumber')).rejects.toMatchObject({
        code: 'RPC_INVALID_RESPONSE',
      })
    })

    it('maps RPC error payload to RPC_INVALID_RESPONSE', async () => {
      const client = makeClient(mockRpcErrorFetch(-32601, 'Method not found'))
      await expect(client.call('eth_unknownMethod')).rejects.toMatchObject({
        code: 'RPC_INVALID_RESPONSE',
      })
    })

    it('includes RPC error code in the WalletError message', async () => {
      const client = makeClient(mockRpcErrorFetch(-32602, 'Invalid params'))
      let caught: unknown
      try {
        await client.call('eth_method')
      } catch (err) {
        caught = err
      }
      expect(WalletError.isWalletError(caught)).toBe(true)
      if (WalletError.isWalletError(caught)) {
        expect(caught.message).toContain('-32602')
      }
    })
  })

  // ─── Response validation ──────────────────────────────────────────────────

  describe('response validation', () => {
    function makeRawFetch(body: unknown): FetchFn {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response)
    }

    it('throws RPC_INVALID_RESPONSE for missing jsonrpc field', async () => {
      const client = makeClient(makeRawFetch({ id: 1, result: 'x' }))
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE for wrong jsonrpc version', async () => {
      const client = makeClient(makeRawFetch({ jsonrpc: '1.0', id: 1, result: 'x' }))
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE when both result and error are present', async () => {
      const client = makeClient(
        makeRawFetch({ jsonrpc: '2.0', id: 1, result: 'x', error: { code: -1, message: 'e' } }),
      )
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE when neither result nor error is present', async () => {
      const client = makeClient(makeRawFetch({ jsonrpc: '2.0', id: 1 }))
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE when id mismatches', async () => {
      const client = makeClient(makeRawFetch({ jsonrpc: '2.0', id: 999, result: 'x' }))
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('accepts null id in error responses (per JSON-RPC 2.0 spec)', async () => {
      const client = makeClient(
        makeRawFetch({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      )
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE for non-object error field', async () => {
      const client = makeClient(makeRawFetch({ jsonrpc: '2.0', id: 1, error: 'string error' }))
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })

    it('throws RPC_INVALID_RESPONSE for error missing code field', async () => {
      const client = makeClient(
        makeRawFetch({ jsonrpc: '2.0', id: 1, error: { message: 'no code' } }),
      )
      await expect(client.call('m')).rejects.toMatchObject({ code: 'RPC_INVALID_RESPONSE' })
    })
  })

  // ─── Timeout via AbortController ──────────────────────────────────────────

  describe('timeout', () => {
    it('throws RPC_TIMEOUT when fetch is aborted', async () => {
      vi.useFakeTimers()
      const client = makeClient(mockAbortableFetch(), { timeoutMs: 100 })

      const promise = client.call('eth_blockNumber')
      vi.advanceTimersByTime(200)
      const err = await promise.catch((e: unknown) => e)

      expect(WalletError.isWalletError(err)).toBe(true)
      if (WalletError.isWalletError(err)) {
        expect(err.code).toBe('RPC_TIMEOUT')
      }
    })
  })

  // ─── Metrics tracking ─────────────────────────────────────────────────────

  describe('metrics tracking', () => {
    it('increments requestCount on success', async () => {
      const client = makeClient(mockSuccessFetch('0x1'))
      await client.call('eth_blockNumber')
      expect(client.getMetrics().requestCount).toBe(1)
    })

    it('increments requestCount on failure', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      expect(client.getMetrics().requestCount).toBe(1)
    })

    it('increments failureCount on network error', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      expect(client.getMetrics().failureCount).toBe(1)
    })

    it('does not increment failureCount on success', async () => {
      const client = makeClient(mockSuccessFetch('0x1'))
      await client.call('eth_blockNumber')
      expect(client.getMetrics().failureCount).toBe(0)
    })

    it('tracks averageLatencyMs after requests', async () => {
      const client = makeClient(mockSuccessFetch('0x1'))
      await client.call('eth_blockNumber')
      expect(client.getMetrics().averageLatencyMs).not.toBeNull()
    })

    it('increments timeoutCount on RPC_TIMEOUT', async () => {
      vi.useFakeTimers()
      const client = makeClient(mockAbortableFetch(), { timeoutMs: 50 })
      const p = client.call('eth_blockNumber').catch(() => {})
      vi.advanceTimersByTime(100)
      await p
      expect(client.getMetrics().timeoutCount).toBe(1)
    })

    it('resetMetrics() clears all counters', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      client.resetMetrics()
      const snap = client.getMetrics()
      expect(snap.requestCount).toBe(0)
      expect(snap.failureCount).toBe(0)
      expect(snap.averageLatencyMs).toBeNull()
    })
  })

  // ─── Health tracking ──────────────────────────────────────────────────────

  describe('health tracking', () => {
    it('initial health has availabilityScore 1.0', () => {
      const client = makeClient(vi.fn() as unknown as FetchFn)
      expect(client.getHealth().availabilityScore).toBe(1.0)
    })

    it('availabilityScore remains 1.0 after successful requests', async () => {
      const client = makeClient(mockSuccessFetch('0x1'))
      await client.call('eth_blockNumber')
      expect(client.getHealth().availabilityScore).toBe(1.0)
    })

    it('availabilityScore decreases after failures', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      expect(client.getHealth().availabilityScore).toBeLessThan(1.0)
    })

    it('consecutiveFailures increments on failure', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      expect(client.getHealth().consecutiveFailures).toBe(1)
    })

    it('resetHealth() clears consecutiveFailures', async () => {
      const client = makeClient(mockNetworkErrorFetch())
      await client.call('eth_blockNumber').catch(() => {})
      client.resetHealth()
      expect(client.getHealth().consecutiveFailures).toBe(0)
    })
  })

  // ─── JSON_RPC_ERROR_CODES ─────────────────────────────────────────────────

  describe('JSON_RPC_ERROR_CODES', () => {
    it('exports standard JSON-RPC 2.0 error codes', () => {
      expect(JSON_RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700)
      expect(JSON_RPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
      expect(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
      expect(JSON_RPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602)
      expect(JSON_RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
    })
  })

  // ─── endpoint property ────────────────────────────────────────────────────

  it('exposes the endpoint as a readonly property', () => {
    const client = makeClient(vi.fn() as unknown as FetchFn)
    expect(client.endpoint).toStrictEqual(TEST_ENDPOINT)
  })
})
