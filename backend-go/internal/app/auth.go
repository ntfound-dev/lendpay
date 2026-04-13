package app

import (
	"crypto/ecdsa"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/btcsuite/btcd/btcutil/bech32"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/google/uuid"
)

type challengeRecord struct {
	Address   string
	ExpiresAt time.Time
	ID        string
	Message   string
}

type challengeStore struct {
	items map[string]challengeRecord
	mu    sync.RWMutex
}

type sessionClaims struct {
	ExpiresAt     time.Time
	InitiaAddress string
	IssuedAt      time.Time
	JTI           string
	Token         string
}

type personalSignPayload struct {
	Message   string `json:"message"`
	Signature string `json:"signature"`
}

type verifySessionRequest struct {
	Address     string          `json:"address"`
	ChallengeID string          `json:"challengeId"`
	Message     string          `json:"message"`
	Mode        string          `json:"mode"`
	Signature   json.RawMessage `json:"signature"`
	Signed      json.RawMessage `json:"signed"`
}

func newChallengeStore() *challengeStore {
	return &challengeStore{
		items: map[string]challengeRecord{},
	}
}

func (s *challengeStore) put(value challengeRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[value.ID] = value
}

func (s *challengeStore) get(id string) (challengeRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	value, ok := s.items[id]
	return value, ok
}

func (s *challengeStore) delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, id)
}

func (s *Server) createChallenge(address string) map[string]any {
	id := uuid.NewString()
	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	message := strings.Join([]string{
		"LendPay Login",
		"",
		"Sign this message to verify your wallet and start a secure session.",
		"No gas fee or blockchain transaction will occur.",
		"",
		fmt.Sprintf("Address: %s", address),
		fmt.Sprintf("Nonce: %s", id),
		fmt.Sprintf("Expires: %s", isoTime(expiresAt)),
	}, "\n")

	s.challenges.put(challengeRecord{
		Address:   address,
		ExpiresAt: expiresAt,
		ID:        id,
		Message:   message,
	})

	return map[string]any{
		"challengeId": id,
		"expiresAt":   isoTime(expiresAt),
		"message":     message,
	}
}

func (s *Server) verifyChallenge(request verifySessionRequest) (sessionClaims, *appError) {
	challenge, ok := s.challenges.get(request.ChallengeID)
	if !ok || challenge.Address != request.Address {
		return sessionClaims{}, &appError{
			Code:       "INVALID_CHALLENGE",
			Message:    "Challenge is missing or does not match the address.",
			StatusCode: http.StatusBadRequest,
		}
	}

	if challenge.ExpiresAt.Before(time.Now().UTC()) {
		s.challenges.delete(request.ChallengeID)
		return sessionClaims{}, &appError{
			Code:       "EXPIRED_CHALLENGE",
			Message:    "Challenge has expired.",
			StatusCode: http.StatusBadRequest,
		}
	}

	if !s.cfg.AuthAcceptAnySignature {
		switch request.Mode {
		case "", "personal_sign":
			payload, err := parsePersonalSignPayload(request)
			if err != nil {
				return sessionClaims{}, &appError{
					Code:       "MISSING_SIGNATURE",
					Message:    "A signed challenge payload is required.",
					StatusCode: http.StatusBadRequest,
				}
			}
			if payload.Message == "" {
				payload.Message = request.Message
			}

			if payload.Message != challenge.Message {
				return sessionClaims{}, &appError{
					Code:       "INVALID_SIGN_DOC",
					Message:    "Signed challenge document does not match the issued challenge.",
					StatusCode: http.StatusUnauthorized,
				}
			}

			valid, err := verifyPersonalMessageSignature(request.Address, payload.Message, payload.Signature)
			if err != nil || !valid {
				return sessionClaims{}, &appError{
					Code:       "INVALID_SIGNATURE",
					Message:    "Signature verification failed.",
					StatusCode: http.StatusUnauthorized,
				}
			}
		case "amino":
			signed, signature, err := parseAminoSignPayload(request)
			if err != nil {
				return sessionClaims{}, &appError{
					Code:       "MISSING_SIGNATURE",
					Message:    "A signed challenge payload is required.",
					StatusCode: http.StatusBadRequest,
				}
			}

			if !verifyChallengeSignDocShape(request.Address, challenge.Message, signed) {
				return sessionClaims{}, &appError{
					Code:       "INVALID_SIGN_DOC",
					Message:    "Signed challenge document does not match the issued challenge.",
					StatusCode: http.StatusUnauthorized,
				}
			}

			valid, err := verifyAminoChallengeSignature(request.Address, signed, signature)
			if err != nil || !valid {
				return sessionClaims{}, &appError{
					Code:       "INVALID_SIGNATURE",
					Message:    "Signature verification failed.",
					StatusCode: http.StatusUnauthorized,
				}
			}
		default:
			return sessionClaims{}, &appError{
				Code:       "MISSING_SIGNATURE",
				Message:    "A signed challenge payload is required.",
				StatusCode: http.StatusBadRequest,
			}
		}
	}

	s.challenges.delete(request.ChallengeID)
	return s.createSessionToken(request.Address)
}

func (s *Server) createSessionToken(address string) (sessionClaims, *appError) {
	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(s.cfg.JWTTTLSeconds) * time.Second)
	jti := uuid.NewString()

	headerBytes, _ := json.Marshal(map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	})
	payloadBytes, _ := json.Marshal(map[string]any{
		"exp": expiresAt.Unix(),
		"iat": now.Unix(),
		"jti": jti,
		"sub": address,
		"typ": "lendpay_session",
		"v":   1,
	})

	headerPart := base64.RawURLEncoding.EncodeToString(headerBytes)
	payloadPart := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signaturePart := createSessionSignature(s.cfg.JWTSecret, headerPart, payloadPart)
	token := fmt.Sprintf("%s.%s.%s", headerPart, payloadPart, signaturePart)

	return sessionClaims{
		ExpiresAt:     expiresAt,
		InitiaAddress: address,
		IssuedAt:      now,
		JTI:           jti,
		Token:         token,
	}, nil
}

func (s *Server) requireSession(r *http.Request) (sessionClaims, *appError) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if header == "" {
		return sessionClaims{}, &appError{
			Code:       "UNAUTHORIZED",
			Message:    "Missing bearer token.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
	if token == "" {
		return sessionClaims{}, &appError{
			Code:       "UNAUTHORIZED",
			Message:    "Missing bearer token.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	claims, err := parseSessionToken(s.cfg.JWTSecret, token)
	if err != nil {
		return sessionClaims{}, &appError{
			Code:       "INVALID_SESSION_TOKEN",
			Message:    "Session token is invalid.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	if !claims.ExpiresAt.After(time.Now().UTC()) {
		return sessionClaims{}, &appError{
			Code:       "SESSION_EXPIRED",
			Message:    "Session expired.",
			StatusCode: http.StatusUnauthorized,
		}
	}

	return claims, nil
}

func parseSessionToken(secret, token string) (sessionClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return sessionClaims{}, fmt.Errorf("invalid token parts")
	}

	expectedSignature := createSessionSignature(secret, parts[0], parts[1])
	if !hmac.Equal([]byte(expectedSignature), []byte(parts[2])) {
		return sessionClaims{}, fmt.Errorf("invalid token signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return sessionClaims{}, err
	}

	payload := struct {
		Exp int64  `json:"exp"`
		Iat int64  `json:"iat"`
		JTI string `json:"jti"`
		Sub string `json:"sub"`
		Typ string `json:"typ"`
		V   int    `json:"v"`
	}{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return sessionClaims{}, err
	}

	if payload.Sub == "" || payload.Typ != "lendpay_session" || payload.V != 1 {
		return sessionClaims{}, fmt.Errorf("invalid token payload")
	}

	return sessionClaims{
		ExpiresAt:     time.Unix(payload.Exp, 0).UTC(),
		InitiaAddress: payload.Sub,
		IssuedAt:      time.Unix(payload.Iat, 0).UTC(),
		JTI:           payload.JTI,
		Token:         token,
	}, nil
}

func createSessionSignature(secret, headerPart, payloadPart string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(headerPart))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write([]byte(payloadPart))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func parsePersonalSignPayload(request verifySessionRequest) (personalSignPayload, error) {
	payload := personalSignPayload{
		Message: request.Message,
	}

	if len(request.Signature) == 0 {
		return payload, fmt.Errorf("signature is missing")
	}

	if err := json.Unmarshal(request.Signature, &payload); err == nil && payload.Signature != "" {
		return payload, nil
	}

	if err := json.Unmarshal(request.Signature, &payload.Signature); err != nil {
		return personalSignPayload{}, err
	}

	return payload, nil
}

func verifyPersonalMessageSignature(address, message, signatureHex string) (bool, error) {
	normalizedHex := strings.TrimPrefix(strings.TrimSpace(signatureHex), "0x")
	signatureBytes, err := hex.DecodeString(normalizedHex)
	if err != nil {
		return false, err
	}

	if len(signatureBytes) != 65 {
		return false, fmt.Errorf("invalid signature length")
	}

	recovery := normalizeRecoveryParam(int(signatureBytes[64]))
	if recovery < 0 || recovery > 3 {
		return false, fmt.Errorf("invalid signature recovery param")
	}

	signatureBytes[64] = byte(recovery)
	digest := hashPersonalSignMessage(message)
	pubKey, err := crypto.SigToPub(digest, signatureBytes)
	if err != nil {
		return false, err
	}

	derivedAddress, err := initiaAddressFromPubKey(pubKey)
	if err != nil {
		return false, err
	}

	return strings.EqualFold(strings.TrimSpace(derivedAddress), strings.TrimSpace(address)), nil
}

func normalizeRecoveryParam(value int) int {
	switch {
	case value >= 35:
		return (value - 35) % 2
	case value >= 27:
		return value - 27
	default:
		return value
	}
}

func hashPersonalSignMessage(message string) []byte {
	messageBytes := []byte(message)
	prefix := []byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(messageBytes)))
	return crypto.Keccak256(prefix, messageBytes)
}

func initiaAddressFromPubKey(pubKey *ecdsa.PublicKey) (string, error) {
	if pubKey == nil {
		return "", fmt.Errorf("unexpected public key type")
	}

	uncompressed := crypto.FromECDSAPub(pubKey)
	if len(uncompressed) != 65 {
		return "", fmt.Errorf("unexpected public key size")
	}

	addressBytes := crypto.Keccak256(uncompressed[1:])[12:]
	fiveBitWords, err := bech32.ConvertBits(addressBytes, 8, 5, true)
	if err != nil {
		return "", err
	}

	return bech32.Encode("init", fiveBitWords)
}
