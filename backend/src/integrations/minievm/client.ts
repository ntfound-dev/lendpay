import { env } from '../../config/env.js'
import { AppError, isRecord } from '../../lib/errors.js'

const asString = (value: unknown) => (typeof value === 'string' ? value : '')

export class MiniEvmClient {
  private buildUrl(path: string) {
    return `${env.MINIEVM_REST_URL.replace(/\/$/, '')}${path}`
  }

  async getErc20FactoryAddress(): Promise<string | null> {
    try {
      const response = await fetch(this.buildUrl('/minievm/evm/v1/contracts/erc20_factory'), {
        signal: AbortSignal.timeout(3500),
      })

      if (!response.ok) {
        throw new AppError(
          response.status,
          'MINIEVM_FACTORY_ERROR',
          'Failed to fetch MiniEVM ERC20 factory.',
        )
      }

      const data = (await response.json()) as unknown
      return this.extractAddress(data)
    } catch {
      return null
    }
  }

  async getContractByDenom(denom: string): Promise<string | null> {
    if (!denom.trim()) {
      return null
    }

    const url = new URL(this.buildUrl('/minievm/evm/v1/contracts/by_denom'))
    url.searchParams.set('denom', denom)

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new AppError(
          response.status,
          'MINIEVM_DENOM_LOOKUP_ERROR',
          'Failed to fetch MiniEVM denom mapping.',
        )
      }

      const data = (await response.json()) as unknown
      return this.extractAddress(data)
    } catch {
      return null
    }
  }

  private extractAddress(data: unknown): string | null {
    if (!isRecord(data)) {
      return null
    }

    const direct = asString(data.address)
    if (direct) {
      return direct
    }

    const contract = isRecord(data.contract) ? data.contract : null
    const nested = asString(contract?.address)
    return nested || null
  }
}
