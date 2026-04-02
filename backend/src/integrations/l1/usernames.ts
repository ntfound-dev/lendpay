import { RESTClient } from '@initia/initia.js'
import { env } from '../../config/env.js'

const previewUsernames = new Map<string, string>()

const previewNameForAddress = (address: string) => {
  if (previewUsernames.has(address)) {
    return previewUsernames.get(address)
  }

  const suffix = address.slice(-6).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user'
  const username = `${suffix}.init`
  previewUsernames.set(address, username)
  return username
}

const extractString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value

  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractString(entry)
      if (extracted) return extracted
    }
  }

  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) {
      const extracted = extractString(nested)
      if (extracted) return extracted
    }
  }

  return undefined
}

export class UsernamesClient {
  private rest = new RESTClient(env.INITIA_L1_REST_URL)

  async resolveName(address: string): Promise<string | undefined> {
    if (!env.ENABLE_LIVE_INITIA_READS) {
      return previewNameForAddress(address)
    }

    try {
      const result = await this.rest.move.viewFunction<unknown>(
        env.USERNAMES_MODULE_ADDRESS,
        env.USERNAMES_MODULE_NAME,
        'get_name_from_address',
        [],
        [address],
      )

      return extractString(result) ?? previewNameForAddress(address)
    } catch {
      return previewNameForAddress(address)
    }
  }
}
