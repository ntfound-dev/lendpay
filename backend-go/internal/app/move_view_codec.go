package app

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcutil/bech32"
)

func decodeInitiaAddressBytes(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, fmt.Errorf("empty address")
	}

	if strings.HasPrefix(strings.ToLower(trimmed), "0x") {
		decoded, err := hex.DecodeString(strings.TrimPrefix(strings.TrimPrefix(trimmed, "0x"), "0X"))
		if err != nil {
			return nil, err
		}

		switch len(decoded) {
		case 20:
			return decoded, nil
		case 32:
			if bytes.Equal(decoded[:12], make([]byte, 12)) {
				return decoded[12:], nil
			}
			return decoded, nil
		default:
			return nil, fmt.Errorf("unexpected hex address length: %d", len(decoded))
		}
	}

	_, words, err := bech32.Decode(trimmed)
	if err != nil {
		return nil, err
	}

	decoded, err := bech32.ConvertBits(words, 5, 8, false)
	if err != nil {
		return nil, err
	}

	switch len(decoded) {
	case 20:
		return decoded, nil
	case 32:
		if bytes.Equal(decoded[:12], make([]byte, 12)) {
			return decoded[12:], nil
		}
		return decoded, nil
	default:
		return nil, fmt.Errorf("unexpected bech32 address length: %d", len(decoded))
	}
}

func addressesMatch(left, right string) bool {
	leftBytes, leftErr := decodeInitiaAddressBytes(left)
	rightBytes, rightErr := decodeInitiaAddressBytes(right)
	if leftErr == nil && rightErr == nil {
		return bytes.Equal(leftBytes, rightBytes)
	}

	return strings.EqualFold(strings.TrimSpace(left), strings.TrimSpace(right))
}

func encodeMoveViewAddressArg(value string) (string, error) {
	addressBytes, err := decodeInitiaAddressBytes(value)
	if err != nil {
		return "", err
	}

	padded := make([]byte, 32)
	copy(padded[32-len(addressBytes):], addressBytes)
	return base64.StdEncoding.EncodeToString(padded), nil
}

func encodeMoveViewU64Arg(value string) (string, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return "", err
	}

	buffer := make([]byte, 8)
	binary.LittleEndian.PutUint64(buffer, parsed)
	return base64.StdEncoding.EncodeToString(buffer), nil
}

func encodeMoveViewU8Arg(value int) (string, error) {
	if value < 0 || value > 255 {
		return "", fmt.Errorf("u8 out of range: %d", value)
	}

	return base64.StdEncoding.EncodeToString([]byte{byte(value)}), nil
}
