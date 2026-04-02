import { env } from '../../config/env.js'
import { AppError, isRecord } from '../../lib/errors.js'
import type { OracleSnapshot } from '../../types/domain.js'

const FALLBACK_FEEDS = ['INIT/USD', 'BTC/USD', 'ETH/USD']
const FALLBACK_PRICE = 0.62

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
      const price = this.extractPrice(data)

      return this.buildSnapshot(baseCurrency, quoteCurrency, Number.isFinite(price) ? price : FALLBACK_PRICE)
    } catch {
      return this.buildSnapshot(baseCurrency, quoteCurrency, FALLBACK_PRICE)
    }
  }

  private buildSnapshot(baseCurrency: string, quoteCurrency: string, price: number): OracleSnapshot {
    return {
      id: `oracle-${Date.now()}`,
      baseCurrency,
      quoteCurrency,
      price,
      sourcePath: `/connect/oracle/v2/get_price?currency_pair=${baseCurrency}/${quoteCurrency}`,
      fetchedAt: new Date().toISOString(),
    }
  }

  private extractFeeds(data: unknown): string[] {
    if (Array.isArray(data)) {
      return data.map((entry) => String(entry))
    }

    if (!isRecord(data)) {
      return []
    }

    const candidates = ['tickers', 'supported_tickers', 'pairs', 'data']

    for (const key of candidates) {
      const value = data[key]

      if (Array.isArray(value)) {
        return value.map((entry) => String(entry))
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
