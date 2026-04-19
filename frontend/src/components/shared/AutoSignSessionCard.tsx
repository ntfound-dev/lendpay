import { Button } from '../ui/Button'

type AutoSignSessionCardProps = {
  autoSignPreferenceEnabled: boolean
  autoSignSessionExpiresAt: Date | null
  hasActiveAutoSignPermission: boolean
  isBusy?: boolean
  onDisableAutoSignPreference: () => void | Promise<void>
  onEnableAutoSign: () => void | Promise<void>
}

export function AutoSignSessionCard({
  autoSignPreferenceEnabled,
  hasActiveAutoSignPermission,
  isBusy = false,
  onDisableAutoSignPreference,
  onEnableAutoSign,
}: AutoSignSessionCardProps) {
  return (
    <div className="section-stack">
      {hasActiveAutoSignPermission && autoSignPreferenceEnabled ? (
        <Button variant="ghost" onClick={onDisableAutoSignPreference}>
          Use manual approvals
        </Button>
      ) : (
        <Button variant="secondary" onClick={onEnableAutoSign} disabled={isBusy}>
          {isBusy ? 'Opening InterwovenKit...' : 'Enable auto-sign'}
        </Button>
      )}
    </div>
  )
}
