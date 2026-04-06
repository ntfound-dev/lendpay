import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MerchantProofState } from '../../types/domain.js'

type RouteSummary = {
  chainId: string
  packageAddress: string
  proofs?: {
    cabal?: { txHash?: string; positionId?: number; payoutBalance?: string }
    yominet?: { txHash?: string; purchaseId?: number; payoutBalance?: string }
    intergaze?: { txHash?: string; purchaseId?: number; payoutBalance?: string }
    viralDrops?: { txHash?: string; purchaseId?: number; payoutBalance?: string }
  }
}

type EmbeddedDataJson = {
  data?: string
}

const moduleDir = dirname(fileURLToPath(import.meta.url))

const artifactCandidates = (chainId: string) => [
  resolve(process.cwd(), '..', 'smarcontract', 'artifacts', 'testnet', chainId),
  resolve(process.cwd(), 'smarcontract', 'artifacts', 'testnet', chainId),
  resolve(moduleDir, '../../../../smarcontract/artifacts/testnet', chainId),
]

const routeIdsByChain = (chainId: string) =>
  chainId === 'lendpay-4'
    ? {
        viralDrops: '1',
        cabal: '2',
        yominet: '3',
        intergaze: '4',
      }
    : {
        viralDrops: '2',
        cabal: '3',
        yominet: '4',
        intergaze: '5',
      }

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const readFirstJsonFile = async <T>(filePaths: string[]): Promise<T | null> => {
  for (const filePath of filePaths) {
    const parsed = await readJsonFile<T>(filePath)
    if (parsed) {
      return parsed
    }
  }

  return null
}

const readEmbeddedData = async <T>(filePath: string): Promise<T | null> => {
  const payload = await readJsonFile<EmbeddedDataJson>(filePath)
  if (!payload?.data) return null

  try {
    return JSON.parse(payload.data) as T
  } catch {
    return null
  }
}

const resolveArtifactsDir = async (chainId: string) => {
  for (const candidate of artifactCandidates(chainId)) {
    const summary = await readJsonFile<RouteSummary>(resolve(candidate, 'app-route-proof', 'summary.json'))
    if (summary) {
      return candidate
    }
  }

  return null
}

type PurchaseProof = {
  id: string
  receipt_object?: string
}

type CabalPositionProof = {
  id: string
}

export const loadMerchantProofMap = async (chainId: string) => {
  const artifactsDir = await resolveArtifactsDir(chainId)
  if (!artifactsDir) {
    return new Map<string, MerchantProofState>()
  }

  const [summary, viralDropRegistration, cabalRegistration, yominetRegistration, intergazeRegistration] =
    await Promise.all([
      readJsonFile<RouteSummary>(resolve(artifactsDir, 'app-route-proof', 'summary.json')),
      readFirstJsonFile<{ txhash?: string }>([
        resolve(artifactsDir, 'register-viral-drops.json'),
        resolve(artifactsDir, 'register-partner-app.json'),
      ]),
      readJsonFile<{ txhash?: string }>(resolve(artifactsDir, 'register-mock-cabal.json')),
      readJsonFile<{ txhash?: string }>(resolve(artifactsDir, 'register-mock-yominet.json')),
      readJsonFile<{ txhash?: string }>(resolve(artifactsDir, 'register-mock-intergaze.json')),
    ])

  if (!summary) {
    return new Map<string, MerchantProofState>()
  }

  const [cabalPosition, yominetPurchase, intergazePurchase, viralDropPurchase] = await Promise.all([
    readEmbeddedData<CabalPositionProof>(resolve(artifactsDir, 'app-route-proof', 'mock-cabal-position.json')),
    readEmbeddedData<PurchaseProof>(resolve(artifactsDir, 'app-route-proof', 'mock-yominet-purchase.json')),
    readEmbeddedData<PurchaseProof>(resolve(artifactsDir, 'app-route-proof', 'mock-intergaze-purchase.json')),
    readEmbeddedData<PurchaseProof>(resolve(artifactsDir, 'app-route-proof', 'viral-drop-purchase.json')),
  ])

  const chain = summary.chainId
  const packageAddress = summary.packageAddress
  const routeIds = routeIdsByChain(chain)
  const proofs: Array<[string, MerchantProofState]> = []

  const pushProof = (key: string, value: MerchantProofState, alias?: string) => {
    proofs.push([key, value])
    if (alias) {
      proofs.push([alias, value])
    }
  }

  pushProof(
    routeIds.viralDrops,
    {
      chainId: chain,
      packageAddress,
      merchantId: routeIds.viralDrops,
      registrationTxHash: viralDropRegistration?.txhash,
      interactionTxHash: summary.proofs?.viralDrops?.txHash,
      interactionLabel: 'Minted a live drop with approved credit',
      resultLabel: summary.proofs?.viralDrops?.purchaseId
        ? `Purchase #${summary.proofs.viralDrops.purchaseId}`
        : undefined,
      payoutBalance: Number(summary.proofs?.viralDrops?.payoutBalance ?? 0),
      receiptAddress: viralDropPurchase?.receipt_object,
    },
    'lendpay::viral_drop',
  )

  pushProof(
    routeIds.cabal,
    {
      chainId: chain,
      packageAddress,
      merchantId: routeIds.cabal,
      registrationTxHash: cabalRegistration?.txhash,
      interactionTxHash: summary.proofs?.cabal?.txHash,
      interactionLabel: 'Deposited loan funds into a Cabal-style vault',
      resultLabel: summary.proofs?.cabal?.positionId ? `Position #${summary.proofs.cabal.positionId}` : undefined,
      payoutBalance: Number(summary.proofs?.cabal?.payoutBalance ?? 0),
      receiptAddress: cabalPosition?.id ? undefined : undefined,
    },
    'lendpay::mock_cabal',
  )

  pushProof(
    routeIds.yominet,
    {
      chainId: chain,
      packageAddress,
      merchantId: routeIds.yominet,
      registrationTxHash: yominetRegistration?.txhash,
      interactionTxHash: summary.proofs?.yominet?.txHash,
      interactionLabel: 'Bought a game item with approved credit',
      resultLabel: summary.proofs?.yominet?.purchaseId
        ? `Purchase #${summary.proofs.yominet.purchaseId}`
        : undefined,
      payoutBalance: Number(summary.proofs?.yominet?.payoutBalance ?? 0),
      receiptAddress: yominetPurchase?.receipt_object,
    },
    'lendpay::mock_yominet',
  )

  pushProof(
    routeIds.intergaze,
    {
      chainId: chain,
      packageAddress,
      merchantId: routeIds.intergaze,
      registrationTxHash: intergazeRegistration?.txhash,
      interactionTxHash: summary.proofs?.intergaze?.txHash,
      interactionLabel: 'Minted an NFT pass with approved credit',
      resultLabel: summary.proofs?.intergaze?.purchaseId
        ? `Purchase #${summary.proofs.intergaze.purchaseId}`
        : undefined,
      payoutBalance: Number(summary.proofs?.intergaze?.payoutBalance ?? 0),
      receiptAddress: intergazePurchase?.receipt_object,
    },
    'lendpay::mock_intergaze',
  )

  return new Map<string, MerchantProofState>(proofs)
}
