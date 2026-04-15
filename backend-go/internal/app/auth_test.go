package app

import (
	"testing"

	"github.com/btcsuite/btcd/btcutil/bech32"
)

func TestIsValidChallengeAddress(t *testing.T) {
	words, err := bech32.ConvertBits(make([]byte, 20), 8, 5, true)
	if err != nil {
		t.Fatalf("ConvertBits() error = %v", err)
	}

	validAddress, err := bech32.Encode("init", words)
	if err != nil {
		t.Fatalf("Encode() error = %v", err)
	}

	if !isValidChallengeAddress(validAddress) {
		t.Fatal("expected valid init address to pass challenge validation")
	}

	if isValidChallengeAddress("abcdefghij") {
		t.Fatal("expected invalid address string to fail challenge validation")
	}

	if isValidChallengeAddress("0x5972A1C7118A8977852DC3307621535D5C1CDA63") {
		t.Fatal("expected non-init bech32 address to fail challenge validation")
	}
}
