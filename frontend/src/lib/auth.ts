import { makeSignDoc, type AminoSignResponse, type OfflineAminoSigner } from '@cosmjs/amino'

const toBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

export const buildChallengeSignDoc = (address: string, message: string) =>
  makeSignDoc(
    [
      {
        type: 'sign/MsgSignData',
        value: {
          signer: address,
          data: toBase64Utf8(message),
        },
      },
    ],
    { amount: [], gas: '0' },
    '',
    '',
    0,
    0,
  )

export const signBackendChallenge = async (
  signer: OfflineAminoSigner,
  address: string,
  message: string,
): Promise<AminoSignResponse> => signer.signAmino(address, buildChallengeSignDoc(address, message))
