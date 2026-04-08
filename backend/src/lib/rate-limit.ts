type RateLimitRule = {
  bucket: string
  label: string
  maxRequests: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

const normalizePath = (value: string) => value.split('?')[0] || value

export const resolveRateLimitRule = (
  method: string,
  url: string,
  config: {
    aiMaxRequests: number
    authMaxRequests: number
    globalMaxRequests: number
    mutationMaxRequests: number
    windowMs: number
  },
): RateLimitRule => {
  const path = normalizePath(url)

  if (path.startsWith('/api/v1/auth/challenge') || path.startsWith('/api/v1/auth/verify')) {
    return {
      bucket: 'auth',
      label: 'authentication',
      maxRequests: config.authMaxRequests,
      windowMs: config.windowMs,
    }
  }

  if (path.startsWith('/api/v1/score/analyze') || path.startsWith('/api/v1/meta/ai')) {
    return {
      bucket: 'ai',
      label: 'AI scoring',
      maxRequests: config.aiMaxRequests,
      windowMs: config.windowMs,
    }
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return {
      bucket: 'mutation',
      label: 'write',
      maxRequests: config.mutationMaxRequests,
      windowMs: config.windowMs,
    }
  }

  return {
    bucket: 'global',
    label: 'API',
    maxRequests: config.globalMaxRequests,
    windowMs: config.windowMs,
  }
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>()
  private hits = 0

  check(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    if (this.hits % 256 === 0) {
      this.prune(now)
    }
    this.hits += 1

    const bucketKey = `${rule.bucket}:${key}`
    const current = this.buckets.get(bucketKey)

    if (!current || current.resetAt <= now) {
      const next = {
        count: 1,
        resetAt: now + rule.windowMs,
      }
      this.buckets.set(bucketKey, next)
      return {
        allowed: true,
        limit: rule.maxRequests,
        remaining: Math.max(0, rule.maxRequests - next.count),
        resetAt: next.resetAt,
      }
    }

    current.count += 1
    this.buckets.set(bucketKey, current)

    return {
      allowed: current.count <= rule.maxRequests,
      limit: rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - current.count),
      resetAt: current.resetAt,
    }
  }

  private prune(now: number) {
    for (const [key, entry] of this.buckets.entries()) {
      if (entry.resetAt <= now) {
        this.buckets.delete(key)
      }
    }
  }
}
