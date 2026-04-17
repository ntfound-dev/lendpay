import type { EncodeObject } from '@cosmjs/proto-signing'
import { MsgExecute, bcs } from '@initia/initia.js'

type MoveExecuteProtoValue = {
  args: unknown[]
  functionName: string
  moduleAddress: string
  moduleName: string
  sender: string
  typeArgs: unknown[]
}

type MoveExecuteValueRecord = Record<string, unknown>

const toEncodeObject = (message: MsgExecute): EncodeObject => ({
  typeUrl: '/initia.move.v1.MsgExecute',
  value: message.toProto(),
})

const isRecord = (value: unknown): value is MoveExecuteValueRecord =>
  typeof value === 'object' && value !== null

const readStringField = (value: MoveExecuteValueRecord, ...keys: string[]) => {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string') {
      return candidate
    }
  }

  return null
}

const readArrayField = (value: MoveExecuteValueRecord, ...keys: string[]) => {
  for (const key of keys) {
    const candidate = value[key]
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return null
}

const normalizeAddress = (value: string) => value.trim().toLowerCase()

export const getMoveExecuteValue = (message: EncodeObject): MoveExecuteProtoValue | null => {
  if (message.typeUrl !== '/initia.move.v1.MsgExecute' || !isRecord(message.value)) {
    return null
  }

  const sender = readStringField(message.value, 'sender')
  const moduleAddress = readStringField(message.value, 'moduleAddress', 'module_address')
  const moduleName = readStringField(message.value, 'moduleName', 'module_name')
  const functionName = readStringField(message.value, 'functionName', 'function_name')
  const typeArgs = readArrayField(message.value, 'typeArgs', 'type_args')
  const args = readArrayField(message.value, 'args')

  if (!sender || !moduleAddress || !moduleName || !functionName || !typeArgs || !args) {
    return null
  }

  return {
    sender,
    moduleAddress,
    moduleName,
    functionName,
    typeArgs,
    args,
  }
}

export const isRepayInstallmentMoveExecuteMessage = (
  message: EncodeObject,
  {
    functionName,
    moduleAddress,
    moduleName,
    sender,
  }: {
    functionName: string
    moduleAddress: string
    moduleName: string
    sender?: string | null
  },
) => {
  const moveValue = getMoveExecuteValue(message)
  if (!moveValue) {
    return false
  }

  if (normalizeAddress(moveValue.moduleAddress) !== normalizeAddress(moduleAddress)) {
    return false
  }

  if (moveValue.moduleName !== moduleName || moveValue.functionName !== functionName) {
    return false
  }

  if (sender && normalizeAddress(moveValue.sender) !== normalizeAddress(sender)) {
    return false
  }

  return moveValue.typeArgs.length === 0 && moveValue.args.length === 1
}

const encodeBytes = (value: string) => {
  const bytes = Array.from(new TextEncoder().encode(value))
  return bcs.vector(bcs.u8()).serialize(bytes).toBase64()
}

export const createRequestLoanMessage = ({
  amount,
  moduleAddress,
  moduleName,
  sender,
  tenorMonths,
  functionName,
  profileId,
}: {
  amount: number
  moduleAddress: string
  moduleName: string
  sender: string
  tenorMonths: number
  functionName: string
  profileId?: number
}) =>
  toEncodeObject(
    new MsgExecute(
      sender,
      moduleAddress,
      moduleName,
      functionName,
      [],
      typeof profileId === 'number'
        ? [
            bcs.u8().serialize(profileId).toBase64(),
            bcs.u64().serialize(amount).toBase64(),
            bcs.u8().serialize(tenorMonths).toBase64(),
          ]
        : [
            bcs.u64().serialize(amount).toBase64(),
            bcs.u8().serialize(tenorMonths).toBase64(),
          ],
    ),
  )

export const createRequestCollateralizedLoanMessage = ({
  amount,
  collateralAmount,
  moduleAddress,
  moduleName,
  sender,
  tenorMonths,
  functionName,
  profileId,
}: {
  amount: number
  collateralAmount: number
  moduleAddress: string
  moduleName: string
  sender: string
  tenorMonths: number
  functionName: string
  profileId: number
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u8().serialize(profileId).toBase64(),
      bcs.u64().serialize(amount).toBase64(),
      bcs.u64().serialize(collateralAmount).toBase64(),
      bcs.u8().serialize(tenorMonths).toBase64(),
    ]),
  )

export const createRepayInstallmentMessage = ({
  loanId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  loanId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(loanId).toBase64(),
    ]),
  )

export const createCancelLoanRequestMessage = ({
  requestId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  requestId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(requestId).toBase64(),
    ]),
  )

export const createBuyViralDropMessage = ({
  itemId,
  merchantId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  itemId: number
  merchantId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(merchantId).toBase64(),
      bcs.u64().serialize(itemId).toBase64(),
    ]),
  )

export const createClaimViralDropCollectibleMessage = ({
  purchaseId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  purchaseId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(purchaseId).toBase64(),
    ]),
  )

export const createClaimLendMessage = ({
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) => toEncodeObject(new MsgExecute(sender, moduleAddress, moduleName, functionName, [], []))

export const createStakeMessage = ({
  amount,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  amount: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(amount).toBase64(),
    ]),
  )

export const createSpendPointsMessage = ({
  amount,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  amount: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(amount).toBase64(),
    ]),
  )

export const createClaimCampaignMessage = ({
  campaignId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  campaignId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(campaignId).toBase64(),
    ]),
  )

export const createOpenBridgeIntentMessage = ({
  amount,
  recipient,
  routeId,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  amount: number
  recipient: string
  routeId: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(routeId).toBase64(),
      bcs.u64().serialize(amount).toBase64(),
      encodeBytes(recipient),
    ]),
  )

export const createGovernanceVoteMessage = ({
  proposalId,
  support,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  proposalId: number
  support: boolean
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(proposalId).toBase64(),
      bcs.bool().serialize(support).toBase64(),
    ]),
  )

export const createGovernanceProposeMessage = ({
  proposalType,
  title,
  body,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  proposalType: number
  title: string
  body: string
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u8().serialize(proposalType).toBase64(),
      encodeBytes(title),
      encodeBytes(body),
    ]),
  )

export const createCampaignMessage = ({
  phase,
  totalAllocation,
  requiresUsername,
  minimumPlatformActions,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  phase: number
  totalAllocation: number
  requiresUsername: boolean
  minimumPlatformActions: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u8().serialize(phase).toBase64(),
      bcs.u64().serialize(totalAllocation).toBase64(),
      bcs.bool().serialize(requiresUsername).toBase64(),
      bcs.u64().serialize(minimumPlatformActions).toBase64(),
    ]),
  )

export const createCampaignAllocationMessage = ({
  campaignId,
  userAddress,
  amount,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  campaignId: number
  userAddress: string
  amount: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(campaignId).toBase64(),
      bcs.address().serialize(userAddress).toBase64(),
      bcs.u64().serialize(amount).toBase64(),
    ]),
  )

export const createMerchantMessage = ({
  merchantAddress,
  category,
  listingFeeBps,
  partnerFeeBps,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  merchantAddress: string
  category: string
  listingFeeBps: number
  partnerFeeBps: number
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.address().serialize(merchantAddress).toBase64(),
      encodeBytes(category),
      bcs.u64().serialize(listingFeeBps).toBase64(),
      bcs.u64().serialize(partnerFeeBps).toBase64(),
    ]),
  )

export const createMerchantActiveMessage = ({
  merchantId,
  active,
  moduleAddress,
  moduleName,
  sender,
  functionName,
}: {
  merchantId: number
  active: boolean
  moduleAddress: string
  moduleName: string
  sender: string
  functionName: string
}) =>
  toEncodeObject(
    new MsgExecute(sender, moduleAddress, moduleName, functionName, [], [
      bcs.u64().serialize(merchantId).toBase64(),
      bcs.bool().serialize(active).toBase64(),
    ]),
  )
