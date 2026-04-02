import type { InstallmentState } from '../../types/domain'
import { formatCurrency, formatDate, formatRelative, formatTxHash } from '../../lib/format'
import { Badge } from '../ui/Badge'

interface LoanScheduleProps {
  schedule: InstallmentState[]
}

const toneByStatus = {
  due: 'warning',
  paid: 'success',
  upcoming: 'neutral',
} as const

export function LoanSchedule({ schedule }: LoanScheduleProps) {
  return (
    <div className="schedule">
      {schedule.map((item) => (
        <div className="schedule__row" key={`${item.installmentNumber}-${item.dueAt}`}>
          <div className="schedule__left">
            <div className="schedule__index">{String(item.installmentNumber).padStart(2, '0')}</div>
            <div className="schedule__title">Payment #{item.installmentNumber}</div>
            <div className="schedule__meta">
              Due {formatDate(item.dueAt)} · {formatRelative(item.dueAt)}
            </div>
          </div>
          <div className="schedule__right">
            <div className="schedule__amount">{formatCurrency(item.amount)}</div>
            <Badge tone={toneByStatus[item.status]}>{item.status}</Badge>
            {item.txHash ? <span className="schedule__tx">{formatTxHash(item.txHash)}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
