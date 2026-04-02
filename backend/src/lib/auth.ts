import {
  makeSignDoc,
  serializeSignDoc,
  type AminoMsg,
  type AminoSignResponse,
  type StdSignDoc,
} from '@cosmjs/amino'
import { Secp256k1, Secp256k1Signature, sha256 } from '@cosmjs/crypto'
import { fromBase64 } from '@cosmjs/encoding'
import { PublicKey, keccak256 } from '@initia/initia.js'

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
