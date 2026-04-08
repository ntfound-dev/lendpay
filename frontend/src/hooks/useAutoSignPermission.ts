import { useEffect, useRef } from 'react'
import type { EncodeObject } from '@cosmjs/proto-signing'
import type { ToastState } from '../types/domain'

const AUTO_SIGN_STATUS_WAIT_MS = 12_000
const AUTO_SIGN_STATUS_POLL_MS = 150

type AutoSignController = {
  enable: (chainId?: string) => Promise<unknown>
  isEnabledByChain: Record<string, boolean>
  isLoading: boolean
}

type UseAutoSignPermissionInput = {
  autoSign: AutoSignController
  chainId: string
  isUserRejectedWalletError: (error: unknown) => boolean
  showToast: (nextToast: ToastState) => void
}

const supportsConfiguredAutoSignMessages = (messages: EncodeObject[]) =>
  Boolean(messages.length) &&
  messages.every((message) => message.typeUrl === '/initia.move.v1.MsgExecute')

export function useAutoSignPermission({
  autoSign,
  chainId,
  isUserRejectedWalletError,
  showToast,
}: UseAutoSignPermissionInput) {
  const autoSignEnablePromiseRef = useRef<Promise<boolean> | null>(null)
  const autoSignEnabledByChainRef = useRef(autoSign.isEnabledByChain)
  const autoSignLoadingRef = useRef(autoSign.isLoading)

  useEffect(() => {
    autoSignEnabledByChainRef.current = autoSign.isEnabledByChain
  }, [autoSign.isEnabledByChain])

  useEffect(() => {
    autoSignLoadingRef.current = autoSign.isLoading
  }, [autoSign.isLoading])

  const waitForAutoSignReady = async (
    targetChainId: string,
    timeoutMs = AUTO_SIGN_STATUS_WAIT_MS,
  ): Promise<boolean> => {
    if (autoSignEnabledByChainRef.current[targetChainId]) {
      return true
    }

    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTO_SIGN_STATUS_POLL_MS))

      if (autoSignEnabledByChainRef.current[targetChainId]) {
        return true
      }

      if (!autoSignEnablePromiseRef.current && !autoSignLoadingRef.current) {
        break
      }
    }

    return Boolean(autoSignEnabledByChainRef.current[targetChainId])
  }

  const ensureAutoSignPermission = async (messages: EncodeObject[]) => {
    if (!supportsConfiguredAutoSignMessages(messages)) {
      return false
    }

    if (autoSignEnabledByChainRef.current[chainId]) {
      return true
    }

    if (autoSignEnablePromiseRef.current) {
      await autoSignEnablePromiseRef.current
      return waitForAutoSignReady(chainId, 5_000)
    }

    const pendingAutoSignEnable = autoSign
      .enable(chainId)
      .then(() => {
        showToast({
          tone: 'success',
          title: 'Auto-sign ready',
          message: 'LendPay now has wallet auto-sign permission for supported Move actions on this chain.',
        })
        return true
      })
      .catch((error) => {
        if (isUserRejectedWalletError(error)) {
          showToast({
            tone: 'info',
            title: 'Auto-sign skipped',
            message: 'Wallet auto-sign was not enabled. LendPay will continue with the normal approval flow.',
          })
          return false
        }

        console.warn('Auto-sign enable flow failed, continuing with standard approvals', error)
        return false
      })
      .finally(() => {
        autoSignEnablePromiseRef.current = null
      })

    autoSignEnablePromiseRef.current = pendingAutoSignEnable
    const didEnable = await pendingAutoSignEnable
    if (!didEnable) {
      return false
    }

    const isReady = await waitForAutoSignReady(chainId)
    if (!isReady) {
      showToast({
        tone: 'info',
        title: 'Auto-sign still syncing',
        message:
          'Wallet permission was granted, but the extension is still refreshing. LendPay will use the normal approval flow for this transaction.',
      })
    }

    return isReady
  }

  return { ensureAutoSignPermission }
}
