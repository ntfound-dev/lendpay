import {
  makeSignDoc,
  serializeSignDoc,
  type AminoMsg,
  type AminoSignResponse,
  type StdSignDoc,
} from '@cosmjs/amino'
import {
  ExtendedSecp256k1Signature,
  Secp256k1,
  Secp256k1Signature,
  sha256,
} from '@cosmjs/crypto'
import { fromBase64, toBase64 } from '@cosmjs/encoding'
import { EthPublicKey, PublicKey, keccak256 } from '@initia/initia.js'

export type PersonalSignChallengeResponse = {
  mode: 'personal_sign'
  message: string
  signature: string
}

const toBase64Utf8 = (value: string) => Buffer.from(value, 'utf8').toString('base64')

export const buildChallengeSignDoc = (address: string, message: string): StdSignDoc => {
  const msg: AminoMsg = {
    type: 'sign/MsgSignData',
    value: {
      signer: address,
      data: toBase64Utf8(message),
    },
  }

  return makeSignDoc([msg], { amount: [], gas: '0' }, '', '', 0, 0)
}

export const verifyChallengeSignDocShape = (address: string, message: string, signDoc: StdSignDoc) => {
  const expected = serializeSignDoc(buildChallengeSignDoc(address, message))
  const actual = serializeSignDoc(signDoc)

  return Buffer.from(expected).equals(Buffer.from(actual))
}

export const verifyAminoChallengeSignature = async (
  address: string,
  signResponse: AminoSignResponse,
) => {
  const pubKeyRecord = signResponse.signature.pub_key

  if (
    pubKeyRecord.type !== 'tendermint/PubKeySecp256k1' &&
    pubKeyRecord.type !== 'initia/PubKeyEthSecp256k1'
  ) {
    return false
  }

  const pubkey = fromBase64(pubKeyRecord.value)
  const signature = fromBase64(signResponse.signature.signature)
  const derivedAddress = PublicKey.fromAmino({
    type: pubKeyRecord.type,
    value: pubKeyRecord.value,
  }).address()

  if (derivedAddress !== address) {
    return false
  }

  const signBytes = serializeSignDoc(signResponse.signed)
  const digest =
    pubKeyRecord.type === 'initia/PubKeyEthSecp256k1' ? keccak256(signBytes) : sha256(signBytes)
  const parsedSignature = Secp256k1Signature.fromFixedLength(signature)

  return Secp256k1.verifySignature(parsedSignature, digest, pubkey)
}

const normalizeRecoveryParam = (value: number) => {
  if (value >= 35) {
    return (value - 35) % 2
  }

  if (value >= 27) {
    return value - 27
  }

  return value
}

const hashPersonalSignMessage = (message: string) => {
  const messageBytes = Buffer.from(message, 'utf8')
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${messageBytes.length}`, 'utf8')
  return keccak256(Buffer.concat([prefix, messageBytes]))
}

export const verifyPersonalMessageSignature = async (
  address: string,
  message: string,
  signatureHex: string,
) => {
  const normalizedHex = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex
  const signatureBytes = Buffer.from(normalizedHex, 'hex')

  if (signatureBytes.length !== 65) {
    return false
  }

  const recovery = normalizeRecoveryParam(signatureBytes[64] ?? -1)
  if (recovery < 0 || recovery > 3) {
    return false
  }

  const signature = new ExtendedSecp256k1Signature(
    signatureBytes.subarray(0, 32),
    signatureBytes.subarray(32, 64),
    recovery,
  )
  const digest = hashPersonalSignMessage(message)
  const recoveredPubkey = Secp256k1.compressPubkey(Secp256k1.recoverPubkey(signature, digest))
  const derivedAddress = new EthPublicKey(toBase64(recoveredPubkey)).address()

  return derivedAddress === address
}

export const normalizeAminoSignResponse = (payload: unknown): AminoSignResponse | null => {
  if (typeof payload !== 'object' || payload === null) return null

  const record = payload as Record<string, unknown>
  const signed = record.signed
  const signature = record.signature

  if (typeof signed !== 'object' || signed === null) return null
  if (typeof signature !== 'object' || signature === null) return null

  const signatureRecord = signature as Record<string, unknown>
  const pubKey = signatureRecord.pub_key

  if (
    typeof signatureRecord.signature !== 'string' ||
    typeof pubKey !== 'object' ||
    pubKey === null
  ) {
    return null
  }

  const pubKeyRecord = pubKey as Record<string, unknown>

  if (typeof pubKeyRecord.type !== 'string' || typeof pubKeyRecord.value !== 'string') {
    return null
  }

  return {
    signed: signed as StdSignDoc,
    signature: {
      pub_key: {
        type: pubKeyRecord.type,
        value: pubKeyRecord.value,
      },
      signature: signatureRecord.signature,
    },
  }
}

export const normalizePersonalSignResponse = (payload: unknown): PersonalSignChallengeResponse | null => {
  if (typeof payload !== 'object' || payload === null) return null

  const record = payload as Record<string, unknown>

  if (typeof record.message !== 'string' || typeof record.signature !== 'string') {
    return null
  }

  return {
    mode: 'personal_sign',
    message: record.message,
    signature: record.signature,
  }
}
