import { store } from '../../data/store.js'
import { mapScore, serializeJson } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { ConnectOracleClient } from '../../integrations/connect/oracle.js'
import { createPrefixedId } from '../../lib/ids.js'
import { isPrismaRecoverableStorageError } from '../../lib/prisma-errors.js'
import type { AiProviderState } from '../../types/domain.js'
import type { ActivityService } from '../activity/service.js'
import { CreditScoringAgent } from './agent.js'
import type { UserService } from '../users/service.js'

export class ScoreService {
  private agent: CreditScoringAgent

  constructor(
    private oracleClient: ConnectOracleClient,
    private userService: UserService,
    private activityService: ActivityService,
    agent: CreditScoringAgent,
  ) {
    this.agent = agent
  }

  async getLatest(initiaAddress: string) {
    try {
      const current = await prisma.creditScore.findFirst({
        where: { initiaAddress },
        orderBy: { scannedAt: 'desc' },
      })
      if (current) {
        const mapped = mapScore(current)
        const existing = store.scores.get(initiaAddress) ?? []
        store.scores.set(initiaAddress, [mapped, ...existing].slice(0, 12))
        return mapped
      }
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.CreditScore'])) {
        throw error
      }

      const stored = store.scores.get(initiaAddress)?.[0]
      if (stored) {
        return stored
      }
    }

    return this.analyze(initiaAddress)
  }

  async providerState(): Promise<AiProviderState> {
    return this.agent.providerState()
  }

  async analyze(initiaAddress: string) {
    const user = await this.userService.ensureUser(initiaAddress)
    const snapshot = await this.oracleClient.getPrice()
    const next = await this.agent.analyze(initiaAddress, user, snapshot.price)

    const providerLabel =
      next.provider === 'ollama' ? `Ollama ${next.model ?? ''}`.trim() : 'local heuristic engine'

    try {
      const createdSnapshot = await prisma.oracleSnapshot.create({
        data: {
          id: snapshot.id,
          baseCurrency: snapshot.baseCurrency,
          quoteCurrency: snapshot.quoteCurrency,
          price: snapshot.price,
          sourcePath: snapshot.sourcePath,
          fetchedAt: new Date(snapshot.fetchedAt),
        },
      })

      const createdScore = await prisma.creditScore.create({
        data: {
          id: createPrefixedId('score'),
          initiaAddress,
          score: next.score,
          limitUsd: next.limitUsd,
          risk: next.risk,
          apr: next.apr,
          provider: next.provider,
          model: next.model,
          summary: next.summary,
          signalsJson: next.signals ? serializeJson(next.signals) : undefined,
          scannedAt: new Date(next.scannedAt),
          breakdownJson: serializeJson(next.breakdown),
          oracleSnapshotId: createdSnapshot.id,
        },
      })

      await this.activityService.push(initiaAddress, {
        kind: 'score',
        label: 'Score refreshed',
        detail: `Your wallet and identity were rechecked using ${providerLabel}. Updated pricing is now available.`,
      })

      const mapped = mapScore(createdScore)
      const existing = store.scores.get(initiaAddress) ?? []
      store.scores.set(initiaAddress, [mapped, ...existing].slice(0, 12))
      return mapped
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.CreditScore', 'public.OracleSnapshot', 'public.Activity'])) {
        throw error
      }

      await this.activityService.push(initiaAddress, {
        kind: 'score',
        label: 'Score refreshed',
        detail: `Your wallet and identity were rechecked using ${providerLabel}. Updated pricing is now available.`,
      })

      const existing = store.scores.get(initiaAddress) ?? []
      store.scores.set(initiaAddress, [next, ...existing].slice(0, 12))
      return next
    }
  }

  async history(initiaAddress: string) {
    try {
      const history = await prisma.creditScore.findMany({
        where: { initiaAddress },
        orderBy: { scannedAt: 'desc' },
        take: 12,
      })

      const mapped = history.map(mapScore)
      store.scores.set(initiaAddress, mapped)
      return mapped
    } catch (error) {
      if (!isPrismaRecoverableStorageError(error, ['public.CreditScore'])) {
        throw error
      }

      return store.scores.get(initiaAddress) ?? []
    }
  }
}
