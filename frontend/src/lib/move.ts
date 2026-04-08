import type { EncodeObject } from '@cosmjs/proto-signing'
import { MsgExecute, bcs } from '@initia/initia.js'

const toEncodeObject = (message: MsgExecute): EncodeObject => ({
  typeUrl: '/initia.move.v1.MsgExecute',
  value: message.toProto(),
})

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
