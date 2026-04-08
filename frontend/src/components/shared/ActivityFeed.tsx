import type { ActivityItem } from '../../types/domain'
import { formatRelative } from '../../lib/format'

interface ActivityFeedProps {
  items: ActivityItem[]
  limit?: number
}

const toneForItem = (item: ActivityItem) => {
  switch (item.kind) {
    case 'score':
      return 'blue'
    case 'repayment':
      return 'green'
    case 'loan':
      return 'amber'
    default:
      return 'slate'
  }
}

type ActivityFeedRow = {
  count: number
  item: ActivityItem
}

const isSameDay = (left: string, right: string) =>
  new Date(left).toDateString() === new Date(right).toDateString()

const collapseConsecutiveItems = (items: ActivityItem[]) =>
  items.reduce<ActivityFeedRow[]>((rows, item) => {
    const previous = rows[rows.length - 1]

    if (
      previous &&
      previous.item.label === item.label &&
      isSameDay(previous.item.timestamp, item.timestamp)
    ) {
      previous.count += 1
      return rows
    }

    rows.push({ count: 1, item })
    return rows
  }, [])

export function ActivityFeed({ items, limit = 3 }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="muted-copy">
        No account activity yet. Refresh your profile, use credit once, and your history will start here.
      </div>
    )
  }

  const rows = collapseConsecutiveItems(items).slice(0, limit)

  return (
    <div className="activity-feed">
      {rows.map(({ count, item }) => (
        <div className="activity-feed__item" key={`${item.id}-${count}`}>
          <div className={`activity-feed__dot activity-feed__dot--${toneForItem(item)}`} />
          <div className="activity-feed__copy">
            <div className="activity-feed__label-row">
              <div className="activity-feed__label">{item.label}</div>
              {count > 1 ? <span className="activity-feed__count">× {count}</span> : null}
            </div>
            <div className="activity-feed__detail">{item.detail}</div>
          </div>
          <div className="activity-feed__time">{formatRelative(item.timestamp)}</div>
        </div>
      ))}
    </div>
  )
}
