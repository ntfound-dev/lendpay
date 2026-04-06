import type { TxExplorerState } from '../types/domain'

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1000 ? 2 : 0,
  }).format(value)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)

export const formatTokenAmount = (value: number, decimals = 0) => {
  const normalized = decimals > 0 ? value / 10 ** decimals : value
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: normalized < 10 && normalized !== 0 ? 2 : 0,
    maximumFractionDigits: decimals > 0 ? Math.min(6, decimals) : 2,
  }).format(normalized)
}

export const formatPoints = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))

export const formatRelative = (value: string) => {
  const diffMs = new Date(value).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'in 1 day'
  if (diffDays > 1) return `in ${diffDays} days`
  if (diffDays === -1) return '1 day ago'
  return `${Math.abs(diffDays)} days ago`
}

export const shortenAddress = (address?: string | null) => {
  if (!address) return 'Not connected'
  if (address.length <= 16) return address
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

export const formatTxHash = (value?: string) => {
  if (!value) return 'Pending'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map((entry) => asRecord(entry)) : []

const getString = (value: unknown) => (typeof value === 'string' ? value : '')

const getNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

const getEventAttributes = (event: Record<string, unknown>) => asArray(event.attributes)

const getAttr = (event: Record<string, unknown> | undefined, key: string) =>
  getString(getEventAttributes(event ?? {}).find((attribute) => getString(attribute.key) === key)?.value)

const findEvent = (
  events: Record<string, unknown>[],
  predicate: (event: Record<string, unknown>) => boolean,
) => events.find(predicate)

const normalizeFee = (amount?: string, denom?: string) => {
  if (amount && denom) {
    return `${formatNumber(getNumber(amount))} ${denom}`
  }

  if (!amount) return ''

  const match = amount.match(/^(\d+)([a-zA-Z][a-zA-Z0-9_-]*)$/)
  if (!match) return amount
  return `${formatNumber(getNumber(match[1]))} ${match[2]}`
}

export function parseRpcTx(raw: Record<string, unknown>): TxExplorerState {
  const result = asRecord(raw.result)
  const tx = asRecord(raw.tx ?? result.tx)
  const txResponse = asRecord(raw.tx_response ?? result.tx_response)
  const txResult = asRecord(result.tx_result)
  const txBody = asRecord(tx.body)
  const txAuthInfo = asRecord(tx.auth_info)
  const txFee = asRecord(txAuthInfo.fee)
  const firstMessage = asRecord(asArray(txBody.messages)[0])
  const feeEntry = asRecord(asArray(txFee.amount)[0])

  const events =
    asArray(txResponse.events).length > 0 ? asArray(txResponse.events) : asArray(txResult.events)

  const executeEvent = findEvent(
    events,
    (event) =>
      getString(event.type) === 'execute' &&
      getAttr(event, 'module_name') !== 'coin' &&
      Boolean(getAttr(event, 'module_name')),
  )

  const messageEvent = findEvent(events, (event) => getString(event.type) === 'message')
  const txFeeEvent = findEvent(
    events,
    (event) => getString(event.type) === 'tx' && Boolean(getAttr(event, 'fee')),
  )
  const transferEvent = findEvent(
    events,
    (event) => getString(event.type) === 'transfer' && Boolean(getAttr(event, 'recipient')),
  )
  const nftCreateEvent = findEvent(
    events,
    (event) =>
      getString(event.type) === 'move' &&
      getEventAttributes(event).some(
        (attribute) =>
          getString(attribute.key) === 'type_tag' &&
          getString(attribute.value).includes('::nft::CreateEvent'),
      ),
  )
  const collectionMintEvent = findEvent(
    events,
    (event) =>
      getString(event.type) === 'move' &&
      getEventAttributes(event).some(
        (attribute) =>
          getString(attribute.key) === 'type_tag' &&
          getString(attribute.value).includes('::collection::MintEvent'),
      ),
  )
  const purchaseEvent = findEvent(
    events,
    (event) =>
      getString(event.type) === 'move' &&
      getEventAttributes(event).some(
        (attribute) =>
          getString(attribute.key) === 'type_tag' &&
          getString(attribute.value).includes('DropPurchasedEvent'),
      ),
  )

  const nftData = parseJsonValue(getAttr(nftCreateEvent, 'data'))
  const mintData = parseJsonValue(getAttr(collectionMintEvent, 'data'))
  const purchaseData = parseJsonValue(getAttr(purchaseEvent, 'data'))
  const fee =
    normalizeFee(getString(feeEntry.amount), getString(feeEntry.denom)) ||
    normalizeFee(getAttr(txFeeEvent, 'fee'))

  const hash = getString(txResponse.txhash) || getString(result.hash)
  const height = getNumber(txResponse.height || result.height)
  const codeValue =
    txResponse.code !== undefined && txResponse.code !== null
      ? getNumber(txResponse.code)
      : getNumber(txResult.code)

  return {
    txHash: hash,
    height,
    status: codeValue === 0 ? 'success' : 'failed',
    code: codeValue,
    timestamp: getString(txResponse.timestamp),
    sender: getString(firstMessage.sender) || getAttr(messageEvent, 'sender'),
    recipient: getAttr(transferEvent, 'recipient'),
    moduleAddress: getString(firstMessage.module_address) || getAttr(executeEvent, 'module_addr'),
    moduleName: getString(firstMessage.module_name) || getAttr(executeEvent, 'module_name'),
    functionName: getString(firstMessage.function_name) || getAttr(executeEvent, 'function_name'),
    memo: getString(txBody.memo),
    gasUsed: getNumber(txResponse.gas_used || txResult.gas_used),
    gasWanted: getNumber(txResponse.gas_wanted || txResult.gas_wanted),
    fee: fee || undefined,
    nft: nftData || mintData
      ? {
          tokenId: getString(nftData?.token_id) || getString(mintData?.token_id),
          description: getString(nftData?.description),
          uri: getString(nftData?.uri),
          collection: getString(nftData?.collection) || getString(mintData?.collection),
          objectAddress: getString(mintData?.nft),
        }
      : null,
    purchase: purchaseData
      ? {
          purchaseId: getString(purchaseData.purchase_id),
          itemId: getString(purchaseData.item_id),
          amountPaid: getString(purchaseData.amount_paid),
          receiptObject: getString(purchaseData.receipt_object),
          merchantId: getString(purchaseData.merchant_id),
          buyer: getString(purchaseData.buyer),
        }
      : null,
  }
}
