import { Button } from '../ui/Button'

interface TopbarProps {
  aiSummary: string
  connected: boolean
  identityLabel: string
  modeLabel: string
  nextStep: string
  onConnect: () => void
  onOpenWallet: () => void
}

export function Topbar({
  aiSummary,
  connected,
  identityLabel,
  modeLabel,
  nextStep,
  onConnect,
  onOpenWallet,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__heading">
          <h1 className="topbar__title">LendPay AI Credit Desk</h1>
          <p className="topbar__subtitle">
            The agent reads identity, wallet balance, and repayment history before every loan.
          </p>
        </div>
        <div className="topbar__rail">
          <span className="meta-pill">AI underwriting</span>
          <span className="meta-pill">On-chain wallet</span>
          <span className="meta-pill">.init identity</span>
        </div>
      </div>

      <div className="topbar__intel">
        <div className="topbar__intel-head">
          <span className="topbar__intel-label">AI analyst</span>
          <span className="topbar__intel-badge">{connected ? 'Live signals' : 'Waiting for wallet'}</span>
        </div>
        <strong className="topbar__intel-value">{aiSummary}</strong>
        <div className="topbar__intel-grid">
          <div className="topbar__intel-item">
            <span>Next step</span>
            <strong>{nextStep}</strong>
          </div>
          <div className="topbar__intel-item">
            <span>Mode</span>
            <strong>{modeLabel}</strong>
          </div>
        </div>
      </div>

      <div className="topbar__actions">
        <div className={`topbar__status ${connected ? 'topbar__status--live' : ''}`}>
          <span className="topbar__status-dot" />
          {connected ? 'Wallet connected' : 'Wallet disconnected'}
        </div>

        {connected ? (
          <Button variant="secondary" onClick={onOpenWallet}>
            {identityLabel}
          </Button>
        ) : (
          <Button onClick={onConnect}>Connect Wallet</Button>
        )}
      </div>
    </header>
  )
}
