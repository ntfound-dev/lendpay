import { env } from '../../config/env.js'
import { AppError, isRecord } from '../../lib/errors.js'
import { createPrefixedId } from '../../lib/ids.js'
import type { OracleSnapshot } from '../../types/domain.js'

const FALLBACK_FEEDS = ['INIT/USD', 'BTC/USD', 'ETH/USD']
const FALLBACK_PRICE = 0.62
const asString = (value: unknown) => (typeof value === 'string' ? value : '')
const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export class ConnectOracleClient {
  private feedCache?: { expiresAt: number; feeds: string[] }

  async getSupportedFeeds(): Promise<string[]> {
    if (this.feedCache && this.feedCache.expiresAt > Date.now()) {
      return this.feedCache.feeds
    }

    try {
      const response = await fetch(`${env.CONNECT_REST_URL}/connect/oracle/v2/get_all_tickers`, {
        signal: AbortSignal.timeout(3500),
      })

      if (!response.ok) {
        throw new AppError(response.status, 'CONNECT_FEEDS_ERROR', 'Failed to fetch supported feeds.')
      }

      const data = (await response.json()) as unknown
      const feeds = this.extractFeeds(data)

      this.feedCache = {
        expiresAt: Date.now() + 5 * 60 * 1000,
        feeds: feeds.length > 0 ? feeds : FALLBACK_FEEDS,
      }

      return this.feedCache.feeds
    } catch {
      this.feedCache = {
        expiresAt: Date.now() + 60 * 1000,
        feeds: FALLBACK_FEEDS,
      }

      return FALLBACK_FEEDS
    }
  }

  async getPrice(baseCurrency = env.CONNECT_BASE_CURRENCY, quoteCurrency = env.CONNECT_QUOTE_CURRENCY) {
    const pair = `${baseCurrency}/${quoteCurrency}`
    const endpoint = `${env.CONNECT_REST_URL}/connect/oracle/v2/get_price?currency_pair=${encodeURIComponent(pair)}`

    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(3500) })

      if (!response.ok) {
        throw new AppError(response.status, 'CONNECT_PRICE_ERROR', 'Failed to fetch price feed.')
      }

      const data = (await response.json()) as unknown
      return this.buildSnapshotFromApi(baseCurrency, quoteCurrency, data)
    } catch {
      return this.buildSnapshot(baseCurrency, quoteCurrency, FALLBACK_PRICE)
    }
  }

  private buildSnapshot(baseCurrency: string, quoteCurrency: string, price: number): OracleSnapshot {
    return {
      id: createPrefixedId('oracle'),
      baseCurrency,
      quoteCurrency,
      price,
      sourcePath: `/connect/oracle/v2/get_price?currency_pair=${baseCurrency}/${quoteCurrency}`,
      fetchedAt: new Date().toISOString(),
    }
  }

  private buildSnapshotFromApi(
    baseCurrency: string,
    quoteCurrency: string,
    data: unknown,
  ): OracleSnapshot {
    const payload = isRecord(data) ? data : {}
    const priceNode = isRecord(payload.price) ? payload.price : isRecord(payload.data) ? payload.data : null
    const rawPrice =
      asString(priceNode?.price) ||
      asString(payload.price) ||
      asString(payload.result) ||
      undefined
    const decimalsValue = payload.decimals !== undefined ? asNumber(payload.decimals) : undefined
    const normalizedPrice =
      rawPrice && typeof decimalsValue === 'number' && decimalsValue > 0
        ? Number(rawPrice) / 10 ** decimalsValue
        : this.extractPrice(data)
    const blockTimestamp =
      asString(priceNode?.block_timestamp) || asString(payload.block_timestamp) || undefined
    const blockHeightValue = asNumber(priceNode?.block_height ?? payload.block_height)

    return {
      ...this.buildSnapshot(
        baseCurrency,
        quoteCurrency,
        Number.isFinite(normalizedPrice) && normalizedPrice > 0 ? normalizedPrice : FALLBACK_PRICE,
      ),
      rawPrice,
      decimals: decimalsValue,
      blockTimestamp,
      blockHeight: blockHeightValue > 0 ? blockHeightValue : undefined,
    }
  }

  private extractFeeds(data: unknown): string[] {
    if (Array.isArray(data)) {
      return data.map((entry) => String(entry)).filter(Boolean)
    }

    if (!isRecord(data)) {
      return []
    }

    const currencyPairs = data.currency_pairs
    if (Array.isArray(currencyPairs)) {
      return currencyPairs
        .map((entry) => {
          if (!isRecord(entry)) return ''
          const base = asString(entry.Base || entry.base)
          const quote = asString(entry.Quote || entry.quote)
          return base && quote ? `${base}/${quote}` : ''
        })
        .filter(Boolean)
    }

    const candidates = ['tickers', 'supported_tickers', 'pairs', 'data']

    for (const key of candidates) {
      const value = data[key]

      if (Array.isArray(value)) {
        return value.map((entry) => String(entry)).filter(Boolean)
      }
    }

    return []
  }

  private extractPrice(data: unknown): number {
    if (typeof data === 'number') return data
    if (typeof data === 'string') return Number(data)

    if (!isRecord(data)) {
      return FALLBACK_PRICE
    }

    const candidates = ['price', 'data', 'result']

    for (const key of candidates) {
      const value = data[key]

      if (typeof value === 'number') return value
      if (typeof value === 'string') return Number(value)

      if (isRecord(value)) {
        const nested = value.price
        if (typeof nested === 'number') return nested
        if (typeof nested === 'string') return Number(nested)
      }
    }

    return FALLBACK_PRICE
  }
}
