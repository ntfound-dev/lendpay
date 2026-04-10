import { store } from '../../data/store.js'
import { mapActivity } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import { createPrefixedId } from '../../lib/ids.js'
import { isPrismaMissingTableError } from '../../lib/prisma-errors.js'
import type { ActivityItem } from '../../types/domain.js'

export class ActivityService {
  async list(initiaAddress: string) {
    try {
      const activities = await prisma.activity.findMany({
        where: { initiaAddress },
        orderBy: { timestamp: 'desc' },
        take: 20,
      })

      const mapped = activities.map(mapActivity)
      store.activities.set(initiaAddress, mapped)
      return mapped
    } catch (error) {
      if (!isPrismaMissingTableError(error, ['public.Activity'])) {
        throw error
      }

      return store.activities.get(initiaAddress) ?? []
    }
  }

  async push(
    initiaAddress: string,
    item: Omit<ActivityItem, 'id' | 'timestamp'> & Partial<Pick<ActivityItem, 'id' | 'timestamp'>>,
  ) {
    const next: ActivityItem = {
      id: item.id ?? createPrefixedId('activity'),
      timestamp: item.timestamp ?? new Date().toISOString(),
      ...item,
    }

    try {
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
    } catch (error) {
      if (!isPrismaMissingTableError(error, ['public.Activity'])) {
        throw error
      }
    }

    const existing = store.activities.get(initiaAddress) ?? []
    store.activities.set(initiaAddress, [next, ...existing].slice(0, 20))

    return next
  }
}
