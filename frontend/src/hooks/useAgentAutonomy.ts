import { useEffect, useState } from 'react'

const AGENT_AUTONOMY_STORAGE_PREFIX = 'lendpay.agent-autonomy:'

const getStorageKey = (
  capability: 'auto-repay' | 'autosign-preference',
  address: string,
  chainId: string,
) => `${AGENT_AUTONOMY_STORAGE_PREFIX}${capability}:${address.trim().toLowerCase()}:${chainId}`

const readStoredBoolean = (
  capability: 'auto-repay' | 'autosign-preference',
  address: string | null | undefined,
  chainId: string,
  fallbackValue: boolean,
) => {
  if (typeof window === 'undefined' || !address) return fallbackValue

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(capability, address, chainId))
    if (rawValue === 'true') return true
    if (rawValue === 'false') return false
  } catch {
    // Ignore storage failures and keep the in-memory fallback.
  }

  return fallbackValue
}

const writeStoredBoolean = (
  capability: 'auto-repay' | 'autosign-preference',
  address: string | null | undefined,
  chainId: string,
  nextValue: boolean,
) => {
  if (typeof window === 'undefined' || !address) return

  try {
    window.localStorage.setItem(getStorageKey(capability, address, chainId), String(nextValue))
  } catch {
    // Ignore storage failures and keep the in-memory value.
  }
}

type UseAgentAutonomyInput = {
  chainId: string
  initiaAddress?: string | null
}

export function useAgentAutonomy({ chainId, initiaAddress }: UseAgentAutonomyInput) {
  const [autoSignPreferenceEnabled, setAutoSignPreferenceEnabledState] = useState(true)
  const [autonomousRepayEnabled, setAutonomousRepayEnabledState] = useState(false)

  useEffect(() => {
    setAutoSignPreferenceEnabledState(
      readStoredBoolean('autosign-preference', initiaAddress, chainId, true),
    )
    setAutonomousRepayEnabledState(readStoredBoolean('auto-repay', initiaAddress, chainId, false))
  }, [chainId, initiaAddress])

  const setAutoSignPreferenceEnabled = (nextValue: boolean) => {
    setAutoSignPreferenceEnabledState(nextValue)
    writeStoredBoolean('autosign-preference', initiaAddress, chainId, nextValue)
  }

  const setAutonomousRepayEnabled = (nextValue: boolean) => {
    setAutonomousRepayEnabledState(nextValue)
    writeStoredBoolean('auto-repay', initiaAddress, chainId, nextValue)
  }

  return {
    autoSignPreferenceEnabled,
    autonomousRepayEnabled,
    setAutoSignPreferenceEnabled,
    setAutonomousRepayEnabled,
  }
}
