import { useRef, useState } from 'react'
import type { OfflineAminoSigner } from '@cosmjs/amino'
import { lendpayApi } from '../lib/api'
import { signBackendChallenge, signBackendChallengeMessage } from '../lib/auth'
import {
  getErrorMessage,
  isWalletSignInCancelledMessage,
  WALLET_SIGN_IN_CANCELLED_MESSAGE,
} from '../lib/appHelpers'
import type { UserProfile } from '../types/domain'

const SESSION_STORAGE_PREFIX = 'lendpay.session:'

const getSessionStorageKey = (address: string) =>
  `${SESSION_STORAGE_PREFIX}${address.trim().toLowerCase()}`

const readStoredSessionToken = (address?: string | null) => {
  if (typeof window === 'undefined' || !address) return null

  try {
    return window.localStorage.getItem(getSessionStorageKey(address))
  } catch {
    return null
  }
}

const writeStoredSessionToken = (address: string, token: string) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getSessionStorageKey(address), token)
  } catch {
    // Ignore storage failures and continue with in-memory auth.
  }
}

const clearStoredSessionToken = (address?: string | null) => {
  if (typeof window === 'undefined' || !address) return

  try {
    window.localStorage.removeItem(getSessionStorageKey(address))
  } catch {
    // Ignore storage failures and continue with in-memory auth.
  }
}

type UseBackendSessionInput = {
  apiEnabled: boolean
  initiaAddress?: string | null
  isAbortError: (error: unknown) => boolean
  isUserRejectedWalletError: (error: unknown) => boolean
  offlineSigner?: OfflineAminoSigner | null
  onAuthenticated: (user: UserProfile) => void
  setLoadError: (next: string | null) => void
  setWalletPubKeyType: (next: string | null) => void
  signMessageAsync: (input: { message: string }) => Promise<string>
  throwIfAborted: (signal?: AbortSignal) => void
}

export function useBackendSession({
  apiEnabled,
  initiaAddress,
  isAbortError,
  isUserRejectedWalletError,
  offlineSigner,
  onAuthenticated,
  setLoadError,
  setWalletPubKeyType,
  signMessageAsync,
  throwIfAborted,
}: UseBackendSessionInput) {
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const sessionTokenRef = useRef<string | null>(null)
  const sessionPromiseRef = useRef<Promise<string> | null>(null)

  const assignSessionToken = (nextToken: string | null) => {
    sessionTokenRef.current = nextToken
    setSessionToken(nextToken)

    if (!initiaAddress) {
      return
    }

    if (nextToken) {
      writeStoredSessionToken(initiaAddress, nextToken)
      return
    }

    clearStoredSessionToken(initiaAddress)
  }

  const resetBackendSession = () => {
    setSessionToken(null)
    sessionTokenRef.current = null
    sessionPromiseRef.current = null
    clearStoredSessionToken(initiaAddress)
  }

  const ensureBackendSession = async (signal?: AbortSignal) => {
    if (!apiEnabled) {
      throw new Error('API base URL is not configured.')
    }

    throwIfAborted(signal)

    if (!initiaAddress || !offlineSigner) {
      throw new Error('Connect your wallet before starting a backend session.')
    }

    if (sessionTokenRef.current) {
      return sessionTokenRef.current
    }

    if (sessionPromiseRef.current) {
      return sessionPromiseRef.current
    }

    const authenticate = async () => {
      const challenge = await lendpayApi.getChallenge(initiaAddress, signal)
      throwIfAborted(signal)

      let personalSignedChallenge:
        | Awaited<ReturnType<typeof signBackendChallengeMessage>>
        | null = null

      try {
        personalSignedChallenge = await signBackendChallengeMessage(
          signMessageAsync,
          challenge.message,
        )
      } catch (signMessageError) {
        if (isUserRejectedWalletError(signMessageError)) {
          throw signMessageError
        }

        console.warn(
          'Plain-text wallet signing failed, falling back to Amino login challenge',
          signMessageError,
        )
      }

      let auth
      if (personalSignedChallenge) {
        setWalletPubKeyType('initia/PubKeyEthSecp256k1')

        try {
          auth = await lendpayApi.verifySession(
            initiaAddress,
            challenge.challengeId,
            personalSignedChallenge,
            signal,
          )
        } catch (verificationError) {
          const verificationMessage = getErrorMessage(
            verificationError,
            'Wallet login could not be verified.',
          )

          if (
            verificationMessage.includes('signed challenge payload') ||
            verificationMessage.includes('Signed challenge document does not match') ||
            verificationMessage.includes('Signature verification failed')
          ) {
            throw new Error(
              'The wallet signed the login message, but the backend rejected the signature. Refresh the page and retry. If you are running the local stack, restart the backend server first.',
            )
          }

          throw verificationError
        }
      } else {
        const signedChallenge = await signBackendChallenge(
          offlineSigner,
          initiaAddress,
          challenge.message,
        )
        setWalletPubKeyType(signedChallenge.signature.pub_key.type)
        auth = await lendpayApi.verifySession(
          initiaAddress,
          challenge.challengeId,
          signedChallenge,
          signal,
        )
      }

      throwIfAborted(signal)
      assignSessionToken(auth.token)
      onAuthenticated(auth.user)
      setLoadError(null)
      return auth.token
    }

    const pendingSession = authenticate()
      .catch((error) => {
        if (isAbortError(error)) {
          throw error
        }

        if (isUserRejectedWalletError(error)) {
          assignSessionToken(null)
          throw new Error(WALLET_SIGN_IN_CANCELLED_MESSAGE)
        }

        const message = getErrorMessage(error, 'Backend session could not be created.')
        if (isWalletSignInCancelledMessage(message)) {
          assignSessionToken(null)
          throw new Error(WALLET_SIGN_IN_CANCELLED_MESSAGE)
        }

        assignSessionToken(null)
        throw new Error(message)
      })
      .finally(() => {
        sessionPromiseRef.current = null
      })

    sessionPromiseRef.current = pendingSession
    return pendingSession
  }

  return {
    assignSessionToken,
    ensureBackendSession,
    readPersistedSessionToken: readStoredSessionToken,
    resetBackendSession,
    sessionToken,
    sessionTokenRef,
  }
}
