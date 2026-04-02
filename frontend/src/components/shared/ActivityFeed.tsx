import type { ActivityItem } from '../../types/domain'

interface ActivityFeedProps {
  items: ActivityItem[]
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return <div className="muted-copy">No borrower updates yet. New score, request, and repayment events will appear here.</div>
  }

  return (
    <div className="activity-feed">
      {items.map((item) => (
        <div className="activity-feed__item" key={item.id}>
          <div className={`activity-feed__dot activity-feed__dot--${item.kind}`} />
          <div>
            <div className="activity-feed__label">{item.label}</div>
            <div className="activity-feed__detail">{item.detail}</div>
          </div>
          <div className="activity-feed__time">{item.timestamp}</div>
        </div>
      ))}
    </div>
  )
}
