package app

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/btcsuite/btcd/btcutil/bech32"
	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/ripemd160"
)

type aminoPublicKeyRecord struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type aminoSignatureRecord struct {
	PubKey    aminoPublicKeyRecord `json:"pub_key"`
	Signature string               `json:"signature"`
}

func buildChallengeSignDoc(address, message string) map[string]any {
	return map[string]any{
		"chain_id":       "",
		"account_number": "0",
		"sequence":       "0",
		"fee": map[string]any{
			"amount": []any{},
			"gas":    "0",
		},
		"msgs": []any{
			map[string]any{
				"type": "sign/MsgSignData",
				"value": map[string]any{
					"signer": address,
					"data":   base64.StdEncoding.EncodeToString([]byte(message)),
				},
			},
		},
		"memo": "",
	}
}

func parseAminoSignPayload(request verifySessionRequest) (map[string]any, aminoSignatureRecord, error) {
	if len(request.Signed) == 0 || len(request.Signature) == 0 {
		return nil, aminoSignatureRecord{}, fmt.Errorf("signed payload is required")
	}

	signed := map[string]any{}
	if err := json.Unmarshal(request.Signed, &signed); err != nil {
		return nil, aminoSignatureRecord{}, err
	}

	signature := aminoSignatureRecord{}
	if err := json.Unmarshal(request.Signature, &signature); err != nil {
		return nil, aminoSignatureRecord{}, err
	}

	if strings.TrimSpace(signature.PubKey.Type) == "" || strings.TrimSpace(signature.PubKey.Value) == "" || strings.TrimSpace(signature.Signature) == "" {
		return nil, aminoSignatureRecord{}, fmt.Errorf("signature is incomplete")
	}

	return signed, signature, nil
}

func verifyChallengeSignDocShape(address, message string, signed map[string]any) bool {
	expectedBytes, expectedErr := json.Marshal(buildChallengeSignDoc(address, message))
	actualBytes, actualErr := json.Marshal(signed)
	if expectedErr != nil || actualErr != nil {
		return false
	}

	return string(expectedBytes) == string(actualBytes)
}

func verifyAminoChallengeSignature(address string, signed map[string]any, signature aminoSignatureRecord) (bool, error) {
	pubKeyType := strings.TrimSpace(signature.PubKey.Type)
	if pubKeyType != "tendermint/PubKeySecp256k1" && pubKeyType != "initia/PubKeyEthSecp256k1" {
		return false, fmt.Errorf("unsupported amino public key type")
	}

	pubKeyBytes, err := base64.StdEncoding.DecodeString(signature.PubKey.Value)
	if err != nil {
		return false, err
	}

	signatureBytes, err := base64.StdEncoding.DecodeString(signature.Signature)
	if err != nil {
		return false, err
	}
	if len(signatureBytes) < 64 {
		return false, fmt.Errorf("invalid amino signature length")
	}
	signatureBytes = signatureBytes[:64]

	pubKey, err := crypto.DecompressPubkey(pubKeyBytes)
	if err != nil {
		return false, err
	}

	derivedAddress, err := initiaAddressFromAminoPubKey(pubKeyType, pubKeyBytes, pubKey)
	if err != nil {
		return false, err
	}
	if !strings.EqualFold(strings.TrimSpace(derivedAddress), strings.TrimSpace(address)) {
		return false, nil
	}

	signBytes, err := json.Marshal(signed)
	if err != nil {
		return false, err
	}

	var digest []byte
	if pubKeyType == "initia/PubKeyEthSecp256k1" {
		digest = crypto.Keccak256(signBytes)
	} else {
		sum := sha256.Sum256(signBytes)
		digest = sum[:]
	}

	return crypto.VerifySignature(crypto.FromECDSAPub(pubKey), digest, signatureBytes), nil
}

func initiaAddressFromAminoPubKey(pubKeyType string, compressedBytes []byte, pubKey *ecdsa.PublicKey) (string, error) {
	if pubKeyType == "initia/PubKeyEthSecp256k1" {
		return initiaAddressFromPubKey(pubKey)
	}

	sum := sha256.Sum256(compressedBytes)
	ripemd := ripemd160.New()
	if _, err := ripemd.Write(sum[:]); err != nil {
		return "", err
	}

	fiveBitWords, err := bech32.ConvertBits(ripemd.Sum(nil), 8, 5, true)
	if err != nil {
		return "", err
	}

	return bech32.Encode("init", fiveBitWords)
}
