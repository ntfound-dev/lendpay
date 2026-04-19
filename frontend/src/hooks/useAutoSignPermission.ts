import { useEffect, useRef } from 'react'
import type { EncodeObject } from '@cosmjs/proto-signing'
import type { TxPreviewContent } from '../components/shared/TxPreviewModal'
import { shortenAddress } from '../lib/format'
import type { ToastState } from '../types/domain'

const AUTO_SIGN_STATUS_WAIT_MS = 12_000
const AUTO_SIGN_STATUS_POLL_MS = 150
const AUTO_SIGN_FALLBACK_SESSION_MS = 10 * 60 * 1000
const AUTO_SIGN_STORAGE_PREFIX = 'lendpay.autosign:'

type AutoSignController = {
  disable: (chainId?: string) => Promise<unknown>
  enable: (chainId?: string) => Promise<unknown>
  expiredAtByChain: Record<string, Date | null | undefined>
  isEnabledByChain: Record<string, boolean>
  isLoading: boolean
}

type UseAutoSignPermissionInput = {
  autoSign: AutoSignController
  chainId: string
  confirmWalletAction: (messages: EncodeObject[], preview?: TxPreviewContent | false) => Promise<void>
  initiaAddress?: string | null
  isAllowedAutoSignMessage?: (message: EncodeObject) => boolean
  isUserRejectedWalletError: (error: unknown) => boolean
  showToast: (nextToast: ToastState) => void
}

const getAutoSignStorageKey = (address: string, chainId: string) =>
  `${AUTO_SIGN_STORAGE_PREFIX}${address.trim().toLowerCase()}:${chainId}`

const readStoredAutoSignExpiry = (address: string | null | undefined, chainId: string) => {
  if (typeof window === 'undefined' || !address) return null

  try {
    const rawValue = window.localStorage.getItem(getAutoSignStorageKey(address, chainId))
    if (!rawValue) return null

    const parsedValue = Number(rawValue)
    if (!Number.isFinite(parsedValue)) return null

    return parsedValue > Date.now() ? parsedValue : null
  } catch {
    return null
  }
}

const writeStoredAutoSignExpiry = (
  address: string | null | undefined,
  chainId: string,
  expiresAt: number,
) => {
  if (typeof window === 'undefined' || !address) return

  try {
    window.localStorage.setItem(getAutoSignStorageKey(address, chainId), String(expiresAt))
  } catch {
    // Ignore storage failures and continue with in-memory auto-sign state.
  }
}

const clearStoredAutoSignExpiry = (address: string | null | undefined, chainId: string) => {
  if (typeof window === 'undefined' || !address) return

  try {
    window.localStorage.removeItem(getAutoSignStorageKey(address, chainId))
  } catch {
    // Ignore storage failures and continue with in-memory auto-sign state.
  }
}

export function useAutoSignPermission({
  autoSign,
  chainId,
  confirmWalletAction,
  initiaAddress,
  isAllowedAutoSignMessage,
  isUserRejectedWalletError,
  showToast,
}: UseAutoSignPermissionInput) {
  const autoSignEnablePromiseRef = useRef<Promise<boolean> | null>(null)
  const autoSignExpiryByChainRef = useRef(autoSign.expiredAtByChain)
  const autoSignEnabledByChainRef = useRef(autoSign.isEnabledByChain)
  const autoSignLoadingRef = useRef(autoSign.isLoading)

  useEffect(() => {
    autoSignExpiryByChainRef.current = autoSign.expiredAtByChain

    const nextExpiration = autoSign.expiredAtByChain[chainId]
    const nextTimestamp = nextExpiration instanceof Date ? nextExpiration.getTime() : null
    const storedTimestamp = readStoredAutoSignExpiry(initiaAddress, chainId)

    if (nextTimestamp && nextTimestamp > Date.now()) {
      writeStoredAutoSignExpiry(initiaAddress, chainId, nextTimestamp)
      return
    }

    if (nextExpiration === null) {
      if (!storedTimestamp || storedTimestamp <= Date.now()) {
        clearStoredAutoSignExpiry(initiaAddress, chainId)
      }
      return
    }

    if (nextTimestamp && nextTimestamp <= Date.now()) {
      clearStoredAutoSignExpiry(initiaAddress, chainId)
    }
  }, [autoSign.expiredAtByChain, chainId, initiaAddress])

  useEffect(() => {
    autoSignEnabledByChainRef.current = autoSign.isEnabledByChain
  }, [autoSign.isEnabledByChain])

  useEffect(() => {
    autoSignLoadingRef.current = autoSign.isLoading
  }, [autoSign.isLoading])

  const getKnownAutoSignExpiry = (targetChainId: string) => {
    const providerExpiration = autoSignExpiryByChainRef.current[targetChainId]
    const providerTimestamp =
      providerExpiration instanceof Date ? providerExpiration.getTime() : null
    const storedTimestamp = readStoredAutoSignExpiry(initiaAddress, targetChainId)

    return Math.max(providerTimestamp ?? 0, storedTimestamp ?? 0)
  }

  const waitForAutoSignReady = async (
    targetChainId: string,
    timeoutMs = AUTO_SIGN_STATUS_WAIT_MS,
  ): Promise<boolean> => {
    if (
      autoSignEnabledByChainRef.current[targetChainId] ||
      getKnownAutoSignExpiry(targetChainId) > Date.now()
    ) {
      return true
    }

    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTO_SIGN_STATUS_POLL_MS))

      if (autoSignEnabledByChainRef.current[targetChainId]) {
        return true
      }

      if (getKnownAutoSignExpiry(targetChainId) > Date.now()) {
        return true
      }

      if (!autoSignEnablePromiseRef.current && !autoSignLoadingRef.current) {
        break
      }
    }

    return Boolean(
      autoSignEnabledByChainRef.current[targetChainId] ||
        getKnownAutoSignExpiry(targetChainId) > Date.now(),
    )
  }

  const supportsConfiguredAutoSignMessages = (messages: EncodeObject[]) =>
    Boolean(messages.length) &&
    messages.every((message) =>
      isAllowedAutoSignMessage ? isAllowedAutoSignMessage(message) : false,
    )

  const requestAutoSignPermission = async () => {
    if (
      autoSignEnabledByChainRef.current[chainId] ||
      getKnownAutoSignExpiry(chainId) > Date.now()
    ) {
      return true
    }

    if (autoSignEnablePromiseRef.current) {
      await autoSignEnablePromiseRef.current
      return waitForAutoSignReady(chainId, 5_000)
    }

    const origin =
      typeof window === 'undefined' ? 'Current site' : window.location.origin

    await confirmWalletAction([], {
      actionLabel: 'Continue to wallet',
      eyebrow: 'Auto-sign setup',
      title: 'Enable faster wallet approvals',
      subtitle:
        'LendPay is about to ask InterwovenKit for a temporary wallet session for supported Move actions on this chain.',
      rows: [
        { label: 'App', value: 'LendPay' },
        { label: 'Origin', value: origin },
        { label: 'Wallet', value: initiaAddress ? shortenAddress(initiaAddress) : 'Connected wallet' },
        { label: 'Chain', value: chainId },
        { label: 'Provider', value: 'InterwovenKit wallet session' },
        { label: 'LendPay usage', value: 'Supported Move actions' },
        { label: 'Session window', value: 'Temporary wallet-managed session (often 10 minutes)' },
      ],
      note:
        'InterwovenKit may open two prompts next: first a signature to create the helper signer, then a temporary grant/allowance for supported Move actions on this chain.',
    })

    const pendingAutoSignEnable = autoSign
      .enable(chainId)
      .then(() => {
        showToast({
          tone: 'success',
          title: 'Auto-sign ready',
          message: 'LendPay can now reuse this short wallet session for supported Move actions on this chain.',
        })
        return true
      })
      .catch((error) => {
        if (isUserRejectedWalletError(error)) {
          showToast({
            tone: 'info',
            title: 'Auto-sign skipped',
            message: 'Wallet auto-sign was not enabled. Approve the wallet prompt, then try again.',
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

    const knownExpiration = getKnownAutoSignExpiry(chainId)
    writeStoredAutoSignExpiry(
      initiaAddress,
      chainId,
      knownExpiration > Date.now()
        ? knownExpiration
        : Date.now() + AUTO_SIGN_FALLBACK_SESSION_MS,
    )

    const isReady = await waitForAutoSignReady(chainId)
    if (!isReady) {
      showToast({
        tone: 'info',
        title: 'Auto-sign still syncing',
        message:
          'Wallet permission was granted, but the extension is still refreshing. Wait for the session to finish syncing, then try again.',
      })
    }

    return isReady
  }

  const disableAutoSignPermission = async () => {
    const hadKnownAutoSignPermission =
      Boolean(autoSignEnabledByChainRef.current[chainId]) || getKnownAutoSignExpiry(chainId) > Date.now()

    clearStoredAutoSignExpiry(initiaAddress, chainId)

    if (!hadKnownAutoSignPermission) {
      return false
    }

    try {
      await autoSign.disable(chainId)
      return true
    } finally {
      clearStoredAutoSignExpiry(initiaAddress, chainId)
    }
  }

  const ensureAutoSignPermission = async (messages: EncodeObject[]) => {
    if (!supportsConfiguredAutoSignMessages(messages)) {
      return false
    }

    return requestAutoSignPermission()
  }

  const activeAutoSignExpiry = Math.max(
    autoSign.expiredAtByChain[chainId] instanceof Date
      ? autoSign.expiredAtByChain[chainId]!.getTime()
      : 0,
    readStoredAutoSignExpiry(initiaAddress, chainId) ?? 0,
  )
  const autoSignSessionExpiresAt =
    activeAutoSignExpiry > Date.now() ? new Date(activeAutoSignExpiry) : null
  const hasActiveAutoSignPermission =
    Boolean(autoSign.isEnabledByChain[chainId]) || autoSignSessionExpiresAt !== null

  return {
    autoSignSessionExpiresAt,
    disableAutoSignPermission,
    enableAutoSignPermission: requestAutoSignPermission,
    ensureAutoSignPermission,
    hasActiveAutoSignPermission,
  }
}
