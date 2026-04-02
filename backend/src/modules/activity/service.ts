import { mapActivity } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import type { ActivityItem } from '../../types/domain.js'

export class ActivityService {
  async list(initiaAddress: string) {
    const activities = await prisma.activity.findMany({
      where: { initiaAddress },
      orderBy: { timestamp: 'desc' },
      take: 20,
    })

    return activities.map(mapActivity)
  }

  async push(
    initiaAddress: string,
    item: Omit<ActivityItem, 'id' | 'timestamp'> & Partial<Pick<ActivityItem, 'id' | 'timestamp'>>,
  ) {
    const next: ActivityItem = {
      id: item.id ?? `activity-${Date.now()}`,
      timestamp: item.timestamp ?? new Date().toISOString(),
      ...item,
    }

    await prisma.activity.create({
      data: {
        id: next.id,
        initiaAddress,
        kind: next.kind,
        label: next.label,
        detail: next.detail,
        timestamp: new Date(next.timestamp),
      },
    })

    return next
  }
}
