/**
 * JsonRpcClient.ts — Generic JSON-RPC 2.0 / HTTP transport client.
 *
 * Responsibilities:
 *   - Serialise requests to JSON-RPC 2.0 wire format.
 *   - Transport via HTTP POST (JSON-RPC) or GET (REST health / metadata).
 *   - Enforce per-request timeouts via AbortController.
 *   - Validate and parse JSON-RPC 2.0 responses.
 *   - Map transport and protocol errors to WalletError codes.
 *   - Record health metrics (RpcHealthMonitor) and request metrics
 *     (RpcMetricsCollector) for every request.
 *
 * Intentionally blockchain-agnostic — no eth_, solana_, or qore_ logic here.
 * Concrete provider implementations (IEvmRpcProvider, ISolanaRpcProvider,
 * IQoreRpcProvider) wrap this client and add chain-specific method helpers.
 *
 * Architecture: ARCHITECTURE.md §5.7 — RPC Foundation (Day 11)
 */

import { WalletError } from '@/domain/errors'
import type {
  RpcId,
  RpcRequest,
  RpcResponse,
  RpcSuccessResponse,
  RpcEndpointMetadata,
  RpcHealthMetrics,
  RpcMetricsSnapshot,
} from '@/domain/rpc'
import { RpcHealthMonitor } from './RpcHealthMonitor'
import { RpcMetricsCollector } from './RpcMetricsCollector'
import type { RecordRequestOptions } from './RpcMetricsCollector'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal fetch-compatible signature accepted by JsonRpcClient.
 *
 * Identical to typeof globalThis.fetch. Expressed as a named alias so test
 * mocks can reference it without repeating the complex built-in type.
 */
export type FetchFn = typeof globalThis.fetch

/** A single batch request entry (method + optional params). */
export interface BatchEntry {
  readonly method: string
  readonly params?: readonly unknown[]
}

// ─── Standard JSON-RPC 2.0 Error Codes ───────────────────────────────────────

/** Standard JSON-RPC 2.0 protocol-level error codes (not HTTP codes). */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

// ─── JsonRpcClient ────────────────────────────────────────────────────────────

/**
 * Generic HTTP + JSON-RPC 2.0 client with integrated health and metrics tracking.
 *
 * Usage:
 * ```ts
 * const client = new JsonRpcClient({
 *   url: 'https://rpc.example.com',
 *   chainId: 'ethereum-sepolia',
 *   providerName: 'MyProvider',
 *   priority: 1,
 *   timeoutMs: 10_000,
 *   weight: 1,
 * })
 *
 * const blockNumber = await client.call<string>('eth_blockNumber')
 * ```
 *
 * @param endpoint  Static configuration for the target RPC endpoint.
 * @param _fetch    Injectable fetch function (defaults to globalThis.fetch).
 *                  Override in tests to avoid real network calls.
 * @param _now      Injectable clock function (defaults to Date.now).
 *                  Override in tests for deterministic latency measurements
 *                  and health timestamps.
 */
export class JsonRpcClient {
  /** Monotonically incrementing counter used as the JSON-RPC 2.0 request id. */
  private _idCounter = 0

  private readonly _health: RpcHealthMonitor
  private readonly _metrics: RpcMetricsCollector

  constructor(
    /** Static configuration for the RPC endpoint this client talks to. */
    readonly endpoint: RpcEndpointMetadata,
    private readonly _fetch: FetchFn = globalThis.fetch,
    private readonly _now: () => number = () => Date.now(),
  ) {
    this._health = new RpcHealthMonitor(_now)
    this._metrics = new RpcMetricsCollector()
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Send a single JSON-RPC 2.0 method call and return the typed result.
   *
   * @param method  JSON-RPC method name (e.g. 'eth_blockNumber').
   * @param params  Positional or named parameters. Omit for param-free methods.
   * @returns       The 'result' field from the JSON-RPC 2.0 success response.
   * @throws        WalletError with one of: RPC_TIMEOUT, RPC_NOT_CONNECTED,
   *                RPC_RATE_LIMITED, RPC_INVALID_RESPONSE.
   */
  async call<TResult>(method: string, params?: readonly unknown[]): Promise<TResult> {
    const id = ++this._idCounter
    const request: RpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    }

    const startTime = this._now()
    let success = false
    let timedOut = false

    try {
      const raw = await this._post(request)
      const response = this._validateSingleResponse<TResult>(raw, id)

      if ('error' in response) {
        const { code, message } = response.error
        throw new WalletError('RPC_INVALID_RESPONSE', `JSON-RPC error ${code}: ${message}`)
      }

      success = true
      return (response as RpcSuccessResponse<TResult>).result
    } catch (err) {
      timedOut = WalletError.isWalletError(err) && err.code === 'RPC_TIMEOUT'
      throw err
    } finally {
      const latency = this._now() - startTime
      const options: RecordRequestOptions = timedOut ? { timedOut: true } : {}
      this._health.record(success, latency)
      this._metrics.recordRequest(latency, success, options)
    }
  }

  /**
   * Send a JSON-RPC 2.0 batch request.
   *
   * Returns an array of raw RpcResponse objects in the same order as the
   * input entries. Each item in the result may be a success or error response;
   * callers must check 'error' in response[i] for each item.
   *
   * Returns an empty array immediately for an empty input (no network call).
   *
   * @param entries  Array of method + params pairs to batch.
   */
  async batch(entries: BatchEntry[]): Promise<RpcResponse[]> {
    if (entries.length === 0) return []

    const requests: RpcRequest[] = entries.map((entry) => ({
      jsonrpc: '2.0' as const,
      id: ++this._idCounter,
      method: entry.method,
      ...(entry.params !== undefined ? { params: entry.params } : {}),
    }))

    const startTime = this._now()
    let success = false
    let timedOut = false

    try {
      const raw = await this._post(requests)

      if (!Array.isArray(raw)) {
        throw new WalletError(
          'RPC_INVALID_RESPONSE',
          `Batch RPC response from '${this.endpoint.url}' is not an array.`,
        )
      }

      const results: RpcResponse[] = raw.map((item: unknown, idx: number) => {
        if (typeof item !== 'object' || item === null) {
          throw new WalletError(
            'RPC_INVALID_RESPONSE',
            `Batch response item ${idx} from '${this.endpoint.url}' is not an object.`,
          )
        }
        const obj = item as Record<string, unknown>
        if (obj['jsonrpc'] !== '2.0') {
          throw new WalletError(
            'RPC_INVALID_RESPONSE',
            `Batch response item ${idx} from '${this.endpoint.url}' has invalid jsonrpc version.`,
          )
        }
        return item as RpcResponse
      })

      success = true
      return results
    } catch (err) {
      timedOut = WalletError.isWalletError(err) && err.code === 'RPC_TIMEOUT'
      throw err
    } finally {
      const latency = this._now() - startTime
      const options: RecordRequestOptions = timedOut ? { timedOut: true } : {}
      this._health.record(success, latency)
      this._metrics.recordRequest(latency, success, options)
    }
  }

  /**
   * Perform an HTTP GET request to the given path appended to the endpoint URL.
   *
   * Intended for lightweight REST-style health endpoints and metadata queries
   * that do not use the JSON-RPC 2.0 envelope.
   *
   * @param path  URL path to append (e.g. '/health', '/version').
   * @returns     Parsed JSON response body.
   * @throws      WalletError(RPC_TIMEOUT | RPC_NOT_CONNECTED | RPC_INVALID_RESPONSE)
   */
  async get<TResult>(path: string): Promise<TResult> {
    const base = this.endpoint.url.replace(/\/+$/, '')
    const url = `${base}${path}`

    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), this.endpoint.timeoutMs)

    const startTime = this._now()
    let success = false
    let timedOut = false

    try {
      let response: Response
      try {
        response = await this._fetch(url, { method: 'GET', signal: controller.signal })
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          timedOut = true
          throw new WalletError(
            'RPC_TIMEOUT',
            `GET request to '${url}' timed out after ${this.endpoint.timeoutMs}ms.`,
          )
        }
        throw new WalletError('RPC_NOT_CONNECTED', `Failed to reach '${url}'.`, err)
      }

      if (!response.ok) {
        throw new WalletError(
          'RPC_INVALID_RESPONSE',
          `GET '${url}' returned HTTP ${response.status}.`,
        )
      }

      let parsed: unknown
      try {
        parsed = await response.json()
      } catch (err) {
        throw new WalletError(
          'RPC_INVALID_RESPONSE',
          `GET '${url}' returned non-JSON response.`,
          err,
        )
      }

      success = true
      return parsed as TResult
    } finally {
      clearTimeout(timeoutHandle)
      const latency = this._now() - startTime
      const options: RecordRequestOptions = timedOut ? { timedOut: true } : {}
      this._health.record(success, latency)
      this._metrics.recordRequest(latency, success, options)
    }
  }

  // ─── Observability ────────────────────────────────────────────────────────

  /** Returns an immutable snapshot of the current health metrics. */
  getHealth(): RpcHealthMetrics {
    return this._health.getSnapshot()
  }

  /** Returns an immutable snapshot of the current request metrics. */
  getMetrics(): RpcMetricsSnapshot {
    return this._metrics.getSnapshot()
  }

  /** Reset all request metrics to zero (does not reset health). */
  resetMetrics(): void {
    this._metrics.reset()
  }

  /** Reset health metrics (does not reset request counters). */
  resetHealth(): void {
    this._health.reset()
  }

  // ─── Private Transport ────────────────────────────────────────────────────

  /**
   * Execute an HTTP POST with the JSON-serialised body and the configured
   * timeout. Returns the parsed JSON response body.
   *
   * Maps transport-level errors to WalletError:
   *   - AbortError (timeout)  → RPC_TIMEOUT
   *   - Network/DNS failure   → RPC_NOT_CONNECTED
   *   - HTTP 429              → RPC_RATE_LIMITED
   *   - HTTP 4xx/5xx          → RPC_INVALID_RESPONSE
   *   - Non-JSON body         → RPC_INVALID_RESPONSE
   *
   * Sprint 3 NOTE: AbortController.abort() prevents new connections but
   * does not immediately cancel in-flight requests on all runtimes. This
   * is acceptable for the Sprint 2 architecture; Sprint 3 will add proper
   * streaming cancellation where needed.
   */
  private async _post(body: unknown): Promise<unknown> {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), this.endpoint.timeoutMs)

    let response: Response
    try {
      response = await this._fetch(this.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new WalletError(
          'RPC_TIMEOUT',
          `RPC request to '${this.endpoint.url}' timed out after ${this.endpoint.timeoutMs}ms.`,
        )
      }
      throw new WalletError(
        'RPC_NOT_CONNECTED',
        `Failed to reach RPC endpoint '${this.endpoint.url}'.`,
        err,
      )
    } finally {
      clearTimeout(timeoutHandle)
    }

    if (response.status === 429) {
      throw new WalletError(
        'RPC_RATE_LIMITED',
        `RPC endpoint '${this.endpoint.url}' is rate-limiting requests (HTTP 429).`,
      )
    }

    if (!response.ok) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC endpoint '${this.endpoint.url}' returned HTTP ${response.status}.`,
      )
    }

    try {
      return await response.json()
    } catch (err) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC endpoint '${this.endpoint.url}' returned non-JSON response.`,
        err,
      )
    }
  }

  // ─── Private Validation ───────────────────────────────────────────────────

  /**
   * Validates the structure of a single JSON-RPC 2.0 response against the
   * JSON-RPC 2.0 specification and the expected request id.
   *
   * Rules enforced:
   *   1. Response must be a non-null object.
   *   2. 'jsonrpc' field must equal '2.0'.
   *   3. Must contain exactly one of 'result' or 'error' (not both, not neither).
   *   4. Response id must match the expected id, OR be null (permitted for
   *      error responses where the server could not determine the request id).
   *   5. If 'error' is present, it must be an object with numeric 'code' and
   *      string 'message'.
   *
   * @throws WalletError(RPC_INVALID_RESPONSE) for any violation.
   */
  private _validateSingleResponse<TResult>(raw: unknown, expectedId: RpcId): RpcResponse<TResult> {
    if (typeof raw !== 'object' || raw === null) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC response from '${this.endpoint.url}' is not an object.`,
      )
    }

    const obj = raw as Record<string, unknown>

    if (obj['jsonrpc'] !== '2.0') {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC response from '${this.endpoint.url}' has invalid jsonrpc version: ` +
          `'${String(obj['jsonrpc'])}'. Expected '2.0'.`,
      )
    }

    const hasResult = 'result' in obj
    const hasError = 'error' in obj

    if (hasResult && hasError) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC response from '${this.endpoint.url}' contains both 'result' and 'error' fields.`,
      )
    }

    if (!hasResult && !hasError) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC response from '${this.endpoint.url}' contains neither 'result' nor 'error' field.`,
      )
    }

    // Per JSON-RPC 2.0 spec, error responses may have null id when the server
    // could not determine the request id (e.g. parse error).
    const responseId = obj['id']
    if (responseId !== null && responseId !== expectedId) {
      throw new WalletError(
        'RPC_INVALID_RESPONSE',
        `RPC response id mismatch from '${this.endpoint.url}': ` +
          `expected ${String(expectedId)}, got ${String(responseId)}.`,
      )
    }

    if (hasError) {
      const error = obj['error']
      if (typeof error !== 'object' || error === null) {
        throw new WalletError(
          'RPC_INVALID_RESPONSE',
          `RPC error field from '${this.endpoint.url}' is not an object.`,
        )
      }
      const errObj = error as Record<string, unknown>
      if (typeof errObj['code'] !== 'number' || typeof errObj['message'] !== 'string') {
        throw new WalletError(
          'RPC_INVALID_RESPONSE',
          `RPC error from '${this.endpoint.url}' is missing required 'code' (number) or 'message' (string).`,
        )
      }
    }

    return raw as RpcResponse<TResult>
  }
}
