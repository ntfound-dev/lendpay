import { motion } from 'framer-motion'
import { appEnv } from '../../config/env'
import {
  buildRestTxInfoUrl,
  buildRpcTxUrl,
  formatNativeDisplay,
} from '../../lib/appHelpers'
import {
  formatDate,
  formatNumber,
  formatTxHash,
  shortenAddress,
} from '../../lib/format'
import { getErrorMessage } from '../../lib/appHelpers'
import type { MerchantState, ToastState, TxExplorerState } from '../../types/domain'

type ProofModalProps = {
  interactionTxDetails: TxExplorerState | null
  isProofLoading: boolean
  onClose: () => void
  onToast: (toast: ToastState) => void
  registrationTxDetails: TxExplorerState | null
  selectedAppProof: MerchantState
}

export function ProofModal({
  interactionTxDetails,
  isProofLoading,
  onClose,
  onToast,
  registrationTxDetails,
  selectedAppProof,
}: ProofModalProps) {
  const proofRegistrationUrl = buildRpcTxUrl(selectedAppProof.proof?.registrationTxHash)
  const proofInteractionUrl = buildRpcTxUrl(selectedAppProof.proof?.interactionTxHash)
  const proofChainId = selectedAppProof.proof?.chainId ?? appEnv.appchainId
  const proofRouteId = selectedAppProof.proof?.merchantId ?? selectedAppProof.id ?? '—'
  const primaryProofTx = interactionTxDetails ?? registrationTxDetails
  const proofPackageAddress =
    primaryProofTx?.moduleAddress ?? selectedAppProof.proof?.packageAddress ?? appEnv.packageAddress
  const proofModuleName = interactionTxDetails?.moduleName ?? registrationTxDetails?.moduleName ?? ''
  const proofFunctionName =
    interactionTxDetails?.functionName ?? registrationTxDetails?.functionName ?? ''
  const proofModuleRoute =
    selectedAppProof.contract ?? (proofModuleName ? `lendpay::${proofModuleName}` : 'Not available')
  const proofRecipient = selectedAppProof.merchantAddress ?? ''
  const proofStatus = primaryProofTx?.status === 'failed' ? 'failed' : 'success'
  const proofStatusLabel = proofStatus === 'failed' ? 'Failed' : 'Confirmed'
  const proofSender = interactionTxDetails?.sender ?? registrationTxDetails?.sender ?? ''
  const proofNft = interactionTxDetails?.nft ?? registrationTxDetails?.nft ?? null
  const proofPurchase = interactionTxDetails?.purchase ?? registrationTxDetails?.purchase ?? null
  const proofNftUri = proofNft?.uri ?? ''
  const proofPrimaryHash =
    primaryProofTx?.txHash ??
    selectedAppProof.proof?.interactionTxHash ??
    selectedAppProof.proof?.registrationTxHash ??
    ''
  const proofPrimaryJsonUrl = buildRestTxInfoUrl(proofPrimaryHash)

  const proofNftUriNeedsHostingNote = (() => {
    if (!proofNftUri) return false

    try {
      return new URL(proofNftUri).host === 'lendpay.app'
    } catch {
      return false
    }
  })()

  const proofCopySummary = [
    'LendPay Testnet Proof',
    `Chain: ${proofChainId}`,
    `Hash: ${proofPrimaryHash || 'Not available'}`,
    `Block: ${primaryProofTx ? `#${formatNumber(primaryProofTx.height)}` : 'Not available'}`,
    `Module: ${[proofModuleName, proofFunctionName].filter(Boolean).join('::') || 'Not available'}`,
    `Status: ${proofStatusLabel}`,
    `Fee: ${formatNativeDisplay(primaryProofTx?.fee)}`,
    `Verified: ${primaryProofTx?.timestamp ? formatDate(primaryProofTx.timestamp) : 'Not available'}`,
  ].join('\n')

  const handleCopyValue = async (label: string, value?: string | null) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      onToast({
        tone: 'success',
        title: `${label} copied`,
        message: `${label} is ready to paste.`,
      })
    } catch (error) {
      onToast({
        tone: 'danger',
        title: 'Copy failed',
        message: getErrorMessage(error, `${label} could not be copied.`),
      })
    }
  }

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(proofCopySummary)
      onToast({
        tone: 'success',
        title: 'Proof summary copied',
        message: 'The full explorer summary is ready to paste.',
      })
    } catch (error) {
      onToast({
        tone: 'danger',
        title: 'Copy failed',
        message: getErrorMessage(error, 'The proof summary could not be copied.'),
      })
    }
  }

  const renderExplorerTxCard = (
    label: string,
    details: TxExplorerState | null,
    rpcUrl?: string,
  ) => {
    if (!details) return null

    const isSuccess = details.status === 'success'
    const moduleCall =
      [details.moduleName, details.functionName].filter(Boolean).join('::') || 'Unknown module'

    return (
      <div className="explorer-tx-card">
        <div className="explorer-tx-card__top">
          <div className="explorer-tx-card__label">
            <span className={`explorer-tx-success ${isSuccess ? '' : 'explorer-tx-success--failed'}`} />
            {label}
          </div>
          <div className="explorer-tx-card__time">
            {details.timestamp ? formatDate(details.timestamp) : 'Confirmed'}
          </div>
        </div>
        {rpcUrl ? (
          <a className="explorer-tx-card__hash" href={rpcUrl} target="_blank" rel="noreferrer">
            {formatTxHash(details.txHash)}
          </a>
        ) : (
          <div className="explorer-tx-card__hash">{formatTxHash(details.txHash)}</div>
        )}
        <div className="explorer-tx-card__module">{moduleCall}</div>
        <div className="explorer-tx-card__meta">
          <div className="explorer-tx-meta-item">
            <span>Block</span>
            <strong>#{formatNumber(details.height)}</strong>
          </div>
          <div className="explorer-tx-meta-item">
            <span>Gas</span>
            <strong>
              {formatNumber(details.gasUsed)} / {formatNumber(details.gasWanted)}
            </strong>
          </div>
          <div className="explorer-tx-meta-item">
            <span>Fee</span>
            <strong>{details.fee ?? '—'}</strong>
          </div>
        </div>
        <div className="explorer-tx-card__footer">
          {rpcUrl ? (
            <a className="explorer-rpc-link" href={rpcUrl} target="_blank" rel="noreferrer">
              Open raw RPC ↗
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="explorer-modal-overlay" role="presentation">
      <button
        type="button"
        className="proof-drawer-backdrop"
        aria-label="Close testnet proof"
        onClick={onClose}
      />
      <motion.aside
        className="explorer-modal"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className="explorer-modal__header">
          <div className="explorer-modal__header-copy">
            <div className="explorer-modal__title">
              <span>Testnet Proof</span>
              <span className="explorer-chain-badge">{proofChainId}</span>
            </div>
            <div className="explorer-modal__subtitle">Verified on-chain · Route #{proofRouteId}</div>
            <div className={`explorer-status ${proofStatus === 'failed' ? 'explorer-status--failed' : ''}`}>
              <span className="explorer-status-dot" />
              {proofStatusLabel}
            </div>
          </div>
          <button type="button" className="explorer-close" onClick={onClose} aria-label="Close testnet proof">
            ×
          </button>
        </div>

        <div className="explorer-stats-grid">
          <div className="explorer-stat">
            <span className="explorer-stat__label">Chain</span>
            <strong className="explorer-stat__value">{proofChainId}</strong>
          </div>
          <div className="explorer-stat">
            <span className="explorer-stat__label">Block</span>
            <strong className="explorer-stat__value">
              {primaryProofTx ? `#${formatNumber(primaryProofTx.height)}` : '—'}
            </strong>
          </div>
          <div className="explorer-stat">
            <span className="explorer-stat__label">Gas</span>
            <strong className="explorer-stat__value">
              {primaryProofTx
                ? `${formatNumber(primaryProofTx.gasUsed)} / ${formatNumber(primaryProofTx.gasWanted)}`
                : '—'}
            </strong>
          </div>
          <div className="explorer-stat">
            <span className="explorer-stat__label">Fee</span>
            <strong className="explorer-stat__value">{formatNativeDisplay(primaryProofTx?.fee)}</strong>
          </div>
        </div>

        <div className="explorer-section">
          <div className="explorer-section__title">Contract Info</div>
          <div className="explorer-row">
            <div className="explorer-row__label">Package</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">{proofPackageAddress}</div>
              <button
                type="button"
                className="explorer-copy-btn"
                aria-label="Copy package address"
                onClick={() => void handleCopyValue('Package address', proofPackageAddress)}
              >
                ⧉
              </button>
            </div>
          </div>
          <div className="explorer-row">
            <div className="explorer-row__label">Module</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">{proofModuleName || proofModuleRoute}</div>
              <button
                type="button"
                className="explorer-copy-btn"
                aria-label="Copy module name"
                onClick={() => void handleCopyValue('Module name', proofModuleName || proofModuleRoute)}
              >
                ⧉
              </button>
            </div>
          </div>
          <div className="explorer-row">
            <div className="explorer-row__label">Function</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">{proofFunctionName || '—'}</div>
              {proofFunctionName ? (
                <button
                  type="button"
                  className="explorer-copy-btn"
                  aria-label="Copy function name"
                  onClick={() => void handleCopyValue('Function name', proofFunctionName)}
                >
                  ⧉
                </button>
              ) : null}
            </div>
          </div>
          <div className="explorer-row">
            <div className="explorer-row__label">Sender</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">{proofSender || '—'}</div>
              {proofSender ? (
                <button
                  type="button"
                  className="explorer-copy-btn"
                  aria-label="Copy sender address"
                  onClick={() => void handleCopyValue('Sender', proofSender)}
                >
                  ⧉
                </button>
              ) : null}
            </div>
          </div>
          <div className="explorer-row">
            <div className="explorer-row__label">Recipient</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">{proofRecipient || '—'}</div>
              {proofRecipient ? (
                <button
                  type="button"
                  className="explorer-copy-btn"
                  aria-label="Copy recipient address"
                  onClick={() => void handleCopyValue('Recipient', proofRecipient)}
                >
                  ⧉
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="explorer-result-banner">
          <div className="explorer-result-banner__main">
            {proofPurchase?.purchaseId
              ? `Purchase #${proofPurchase.purchaseId} · Amount paid: ${formatNumber(Number(proofPurchase.amountPaid ?? 0))} ${appEnv.nativeSymbol}`
              : selectedAppProof.proof?.resultLabel
                ? `${selectedAppProof.proof.resultLabel} · Payout balance: ${formatNumber(selectedAppProof.proof?.payoutBalance ?? 0)} ${appEnv.nativeSymbol}`
                : `Payout balance: ${formatNumber(selectedAppProof.proof?.payoutBalance ?? 0)} ${appEnv.nativeSymbol}`}
          </div>
          <div className="explorer-result-banner__sub">
            {proofNft?.description ??
              selectedAppProof.proof?.interactionLabel ??
              'Verified onchain action available for this route.'}
          </div>
        </div>

        {proofNft ? (
          <div className="explorer-nft-result">
            <div className="explorer-nft-result__title">NFT Result</div>
            <div className="explorer-nft-token">{proofNft.tokenId || 'Receipt NFT'}</div>
            <div className="explorer-nft-desc">{proofNft.description || 'NFT receipt minted onchain.'}</div>
            {proofNft.objectAddress ? (
              <div className="explorer-result-line">
                <span>Receipt object</span>
                <div className="explorer-result-line__actions">
                  <span className="explorer-nft-object">{shortenAddress(proofNft.objectAddress)}</span>
                  <button
                    type="button"
                    className="explorer-copy-btn"
                    aria-label="Copy NFT object address"
                    onClick={() => void handleCopyValue('NFT object', proofNft.objectAddress)}
                  >
                    ⧉
                  </button>
                </div>
              </div>
            ) : null}
            {proofNftUri ? (
              <>
                <div className="explorer-result-line">
                  <span>Metadata URI</span>
                  <div className="explorer-result-line__actions">
                    <span className="explorer-nft-object">{shortenAddress(proofNftUri)}</span>
                    <button
                      type="button"
                      className="explorer-copy-btn"
                      aria-label="Copy NFT metadata URI"
                      onClick={() => void handleCopyValue('NFT metadata URI', proofNftUri)}
                    >
                      ⧉
                    </button>
                  </div>
                </div>
                {proofNftUriNeedsHostingNote ? (
                  <div className="explorer-uri-note">
                    Metadata URI is stored onchain, but the public site for this URI is not hosted yet.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {proofPurchase ? (
          <div className="explorer-nft-result">
            <div className="explorer-nft-result__title">Purchase Result</div>
            <div className="explorer-result-grid">
              <div className="explorer-result-item">
                <span>Purchase ID</span>
                <strong>#{proofPurchase.purchaseId || '—'}</strong>
              </div>
              <div className="explorer-result-item">
                <span>Item ID</span>
                <strong>#{proofPurchase.itemId || '—'}</strong>
              </div>
              <div className="explorer-result-item">
                <span>Amount paid</span>
                <strong>
                  {formatNumber(Number(proofPurchase.amountPaid ?? 0))} {appEnv.nativeSymbol}
                </strong>
              </div>
              <div className="explorer-result-item">
                <span>Receipt NFT</span>
                <strong>
                  {proofPurchase.receiptObject ? shortenAddress(proofPurchase.receiptObject) : '—'}
                </strong>
              </div>
            </div>
          </div>
        ) : null}

        <div className="explorer-section">
          <div className="explorer-section__title">Tx Hash</div>
          <div className="explorer-row">
            <div className="explorer-row__label">Primary tx</div>
            <div className="explorer-row__value-group">
              <div className="explorer-row__value">
                {proofPrimaryHash ? formatTxHash(proofPrimaryHash) : '—'}
              </div>
              {proofPrimaryHash ? (
                <>
                  <button
                    type="button"
                    className="explorer-copy-btn"
                    aria-label="Copy tx hash"
                    onClick={() => void handleCopyValue('Tx hash', proofPrimaryHash)}
                  >
                    ⧉
                  </button>
                  {proofPrimaryJsonUrl ? (
                    <a className="explorer-rpc-link" href={proofPrimaryJsonUrl} target="_blank" rel="noreferrer">
                      Open tx JSON ↗
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <button type="button" className="explorer-copy-all" onClick={() => void handleCopyAll()}>
          ⧉ Copy all proof details
        </button>

        <div className="explorer-section">
          <div className="explorer-section__title">Transactions</div>
          {isProofLoading ? (
            <div className="explorer-loading">
              Loading confirmed testnet transactions...
              <div className="explorer-loading-bar" />
              <div className="explorer-loading-bar" />
              <div className="explorer-loading-bar" />
            </div>
          ) : (
            <div className="proof-explorer-stack">
              {renderExplorerTxCard('Registration tx', registrationTxDetails, proofRegistrationUrl ?? undefined)}
              {renderExplorerTxCard('Proof tx', interactionTxDetails, proofInteractionUrl ?? undefined)}
            </div>
          )}
        </div>
        <div className="explorer-modal__footer">
          Hashes verified from the <strong>{appEnv.appchainId}</strong> artifact set.
        </div>
      </motion.aside>
    </div>
  )
}
