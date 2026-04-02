import { mapScore, serializeJson } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { ConnectOracleClient } from '../../integrations/connect/oracle.js'
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
    const current = await prisma.creditScore.findFirst({
      where: { initiaAddress },
      orderBy: { scannedAt: 'desc' },
    })
    if (current) return mapScore(current)

    return this.analyze(initiaAddress)
  }

  async providerState(): Promise<AiProviderState> {
    return this.agent.providerState()
  }

  async analyze(initiaAddress: string) {
    const user = await this.userService.ensureUser(initiaAddress)
    const snapshot = await this.oracleClient.getPrice()

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

    const next = await this.agent.analyze(initiaAddress, user, snapshot.price)
    const createdScore = await prisma.creditScore.create({
      data: {
        id: `score-${Date.now()}`,
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

    const providerLabel =
      next.provider === 'ollama' ? `Ollama ${next.model ?? ''}`.trim() : 'local heuristic engine'

    await this.activityService.push(initiaAddress, {
      kind: 'score',
      label: 'Score refreshed',
      detail: `Agent analyzed wallet and identity using ${providerLabel} with ${snapshot.baseCurrency}/${snapshot.quoteCurrency} normalization.`,
    })

    return mapScore(createdScore)
  }

  async history(initiaAddress: string) {
    const history = await prisma.creditScore.findMany({
      where: { initiaAddress },
      orderBy: { scannedAt: 'desc' },
      take: 12,
    })

    return history.map(mapScore)
  }
}
