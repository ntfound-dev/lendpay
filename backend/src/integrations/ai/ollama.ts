import { env } from '../../config/env.js'
import type {
  CreditScoreSignals,
  CreditScoreState,
  ScoreBreakdownItem,
} from '../../types/domain.js'

const BREAKDOWN_LABELS = [
  'Wallet age',
  'Transaction activity',
  'Average balance',
  'Repayment behavior',
  'Cross-app behavior',
] as const

type BreakdownLabel = (typeof BREAKDOWN_LABELS)[number]

interface OllamaChatResponse {
  model?: string
  message?: {
    content?: string
  }
  total_duration?: number
  prompt_eval_count?: number
  eval_count?: number
}

interface RawScoreSuggestion {
  score?: unknown
  limitUsd?: unknown
  limit_usd?: unknown
  apr?: unknown
  summary?: unknown
  breakdown?: unknown
}

export interface OllamaScoreContext {
  signals: CreditScoreSignals
  fallback: CreditScoreState
}

export interface OllamaScoreResult {
  provider: 'ollama'
  model: string
  score: number
  limitUsd: number
  apr: number
  summary: string
  breakdown: ScoreBreakdownItem[]
  usage: {
    totalDurationNs?: number
    promptEvalCount?: number
    evalCount?: number
  }
}

export interface AiEngineStatus {
  configuredProvider: 'heuristic' | 'ollama'
  activeProvider: 'heuristic' | 'ollama'
  available: boolean
  model?: string
  baseUrl?: string
  reason?: string
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const normalizeLabel = (value: string): BreakdownLabel => {
  const match = BREAKDOWN_LABELS.find((label) => label.toLowerCase() === value.trim().toLowerCase())
  return match ?? 'Cross-app behavior'
}

const normalizeBreakdown = (
  raw: unknown,
  fallback: ScoreBreakdownItem[],
): ScoreBreakdownItem[] => {
  if (!Array.isArray(raw) || raw.length === 0) return fallback

  type NormalizedBreakdownItem = {
    label: BreakdownLabel
    points: number
    detail: string
  }

  const items = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null

      const record = entry as Record<string, unknown>
      const label = typeof record.label === 'string' ? normalizeLabel(record.label) : null
      const points = asFiniteNumber(record.points)
      const detail =
        typeof record.detail === 'string' && record.detail.trim().length > 0 ? record.detail.trim() : null

      if (!label || points === null || !detail) return null

      return {
        label,
        points: Math.round(clamp(points, 0, 260)),
        detail,
      }
    })
    .filter((entry): entry is NormalizedBreakdownItem => entry !== null)

  if (items.length !== BREAKDOWN_LABELS.length) return fallback

  const unique = new Set(items.map((item) => item.label))
  if (unique.size !== BREAKDOWN_LABELS.length) return fallback

  return BREAKDOWN_LABELS.map((label) => items.find((item) => item.label === label) ?? fallback[0]!)
}

const SYSTEM_PROMPT = [
  'You are a conservative credit scoring agent for an Initia-native BNPL product.',
  'Return strict JSON only.',
  'Do not include markdown fences.',
  'Use exactly these breakdown labels in this order:',
  BREAKDOWN_LABELS.join(', '),
  'Output schema:',
  '{"score": number, "limitUsd": number, "apr": number, "summary": string, "breakdown":[{"label": string, "points": number, "detail": string}]}',
  'Scoring boundaries:',
  '- score must be an integer between 620 and 835',
  '- limitUsd must be an integer between 250 and 5000',
  '- apr must be a number between 5.5 and 18.0',
  '- summary must be one short paragraph about wallet, identity, and repayment posture',
  '- breakdown must contain exactly 5 items',
  'Be slightly conservative and avoid over-lending.',
].join('\n')

export class OllamaScoringClient {
  private statusCache?: { expiresAt: number; value: AiEngineStatus }

  isConfigured() {
    return env.AI_PROVIDER === 'ollama'
  }

  async getStatus(force = false): Promise<AiEngineStatus> {
    if (!this.isConfigured()) {
      return {
        configuredProvider: env.AI_PROVIDER,
        activeProvider: 'heuristic',
        available: true,
        reason: 'Heuristic provider configured.',
      }
    }

    if (!force && this.statusCache && this.statusCache.expiresAt > Date.now()) {
      return this.statusCache.value
    }

    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(Math.min(env.OLLAMA_TIMEOUT_MS, 3000)),
      })

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`)
      }

      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> }
      const modelNames = new Set((data.models ?? []).flatMap((item) => [item.name, item.model].filter(Boolean)))
      const available = modelNames.size === 0 || modelNames.has(env.OLLAMA_MODEL)

      const value: AiEngineStatus = {
        configuredProvider: 'ollama',
        activeProvider: available ? 'ollama' : 'heuristic',
        available,
        model: env.OLLAMA_MODEL,
        baseUrl: env.OLLAMA_BASE_URL,
        reason: available ? 'Ollama is reachable.' : `Model ${env.OLLAMA_MODEL} is not pulled yet.`,
      }

      this.statusCache = {
        expiresAt: Date.now() + 15_000,
        value,
      }

      return value
    } catch (error) {
      const value: AiEngineStatus = {
        configuredProvider: 'ollama',
        activeProvider: 'heuristic',
        available: false,
        model: env.OLLAMA_MODEL,
        baseUrl: env.OLLAMA_BASE_URL,
        reason: error instanceof Error ? error.message : 'Ollama is unreachable.',
      }

      this.statusCache = {
        expiresAt: Date.now() + 5_000,
        value,
      }

      return value
    }
  }

  async score(context: OllamaScoreContext): Promise<OllamaScoreResult | null> {
    if (!this.isConfigured()) return null

    const prompt = [
      'Input signals:',
      JSON.stringify(
        {
          signals: context.signals,
          fallback: {
            score: context.fallback.score,
            limitUsd: context.fallback.limitUsd,
            apr: context.fallback.apr,
            risk: context.fallback.risk,
            breakdown: context.fallback.breakdown,
            summary: context.fallback.summary,
          },
        },
        null,
        2,
      ),
      'Return only JSON matching the schema.',
    ].join('\n')

    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          stream: false,
          format: 'json',
          options: {
            temperature: env.OLLAMA_TEMPERATURE,
          },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`)
      }

      const payload = (await response.json()) as OllamaChatResponse
      const content = payload.message?.content

      if (!content) {
        throw new Error('Ollama returned an empty message.')
      }

      const parsed = JSON.parse(content) as RawScoreSuggestion
      const score = asFiniteNumber(parsed.score)
      const limitUsd = asFiniteNumber(parsed.limitUsd ?? parsed.limit_usd)
      const apr = asFiniteNumber(parsed.apr)

      if (score === null || limitUsd === null || apr === null) {
        throw new Error('Ollama returned incomplete score fields.')
      }

      return {
        provider: 'ollama',
        model: payload.model ?? env.OLLAMA_MODEL,
        score: Math.round(clamp(score, 620, 835)),
        limitUsd: Math.round(clamp(limitUsd, 250, 5000)),
        apr: Number(clamp(apr, 5.5, 18).toFixed(2)),
        summary:
          typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
            ? parsed.summary.trim()
            : 'Local Ollama agent analyzed borrower wallet, identity, and onchain reputation.',
        breakdown: normalizeBreakdown(parsed.breakdown, context.fallback.breakdown),
        usage: {
          totalDurationNs: payload.total_duration,
          promptEvalCount: payload.prompt_eval_count,
          evalCount: payload.eval_count,
        },
      }
    } catch {
      this.statusCache = undefined
      return null
    }
  }
}
