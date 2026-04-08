import { useEffect, useRef, useState } from 'react'
import type { EncodeObject } from '@cosmjs/proto-signing'
import { shortenAddress } from '../lib/format'
import { titleCase } from '../lib/appHelpers'
import type { TxPreviewContent } from '../components/shared/TxPreviewModal'

const TX_PREVIEW_CANCELLED_MESSAGE = 'Transaction preview cancelled'

const getRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const getStringValue = (...values: unknown[]) =>
  values.find((value) => typeof value === 'string' && value.trim()) as string | undefined

type UseTxPreviewInput = {
  chainId: string
  initiaAddress?: string | null
}

export function useTxPreview({ chainId, initiaAddress }: UseTxPreviewInput) {
  const [txPreview, setTxPreview] = useState<TxPreviewContent | null>(null)
  const txPreviewResolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const resolveTxPreview = (confirmed: boolean) => {
    const resolve = txPreviewResolverRef.current
    txPreviewResolverRef.current = null
    setTxPreview(null)
    resolve?.(confirmed)
  }

  useEffect(() => {
    return () => {
      resolveTxPreview(false)
    }
  }, [])

  const requestTxPreview = (preview: TxPreviewContent) =>
    new Promise<boolean>((resolve) => {
      txPreviewResolverRef.current = resolve
      setTxPreview(preview)
    })

  const buildTxPreview = (
    messages: EncodeObject[],
    preview?: TxPreviewContent | false,
  ): TxPreviewContent | null => {
    if (preview === false) {
      return null
    }

    if (preview) {
      return preview
    }

    const firstMessage = messages[0]
    const messageValue = getRecord(firstMessage?.value)
    const moduleName = getStringValue(messageValue.module_name, messageValue.moduleName) ?? 'move'
    const functionName = getStringValue(messageValue.function_name, messageValue.functionName) ?? ''
    const sender = getStringValue(messageValue.sender) ?? initiaAddress ?? ''
    const actionLabel = functionName ? titleCase(functionName.replace(/_/g, ' ')) : 'Review transaction'
    const moduleCall = [moduleName, functionName].filter(Boolean).join('::') || 'Move action'

    return {
      actionLabel: 'Open wallet signer',
      eyebrow: 'Wallet approval',
      title: actionLabel,
      subtitle:
        messages.length > 1
          ? 'LendPay is about to send multiple onchain actions. Review the summary below before the wallet opens.'
          : 'Review this onchain action before the wallet signer opens.',
      rows: [
        { label: 'Action', value: actionLabel },
        { label: 'Module', value: moduleCall },
        { label: 'Signer', value: sender ? shortenAddress(sender) : 'Connected wallet' },
        { label: 'Network', value: chainId },
      ],
    }
  }

  const confirmWalletAction = async (
    messages: EncodeObject[],
    preview?: TxPreviewContent | false,
  ) => {
    const nextPreview = buildTxPreview(messages, preview)
    if (!nextPreview) {
      return
    }

    const confirmed = await requestTxPreview(nextPreview)
    if (!confirmed) {
      throw new Error(TX_PREVIEW_CANCELLED_MESSAGE)
    }
  }

  const isTransactionPreviewCancelled = (error: unknown) =>
    error instanceof Error && error.message === TX_PREVIEW_CANCELLED_MESSAGE

  return {
    confirmWalletAction,
    isTransactionPreviewCancelled,
    resolveTxPreview,
    txPreview,
  }
}
