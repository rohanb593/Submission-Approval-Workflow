package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math/big"
)

// GenerateOTP returns a random 6-digit numeric one-time code.
func GenerateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HashOTP returns a SHA-256 hex digest of the code, safe to store. Unlike
// passwords, OTP hashing doesn't need bcrypt's deliberate slowness: the
// codes are short-lived and attempt-limited, so a fast, constant-time
// comparison is what matters, not expensive key stretching.
func HashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// CheckOTP reports whether the plaintext code matches the stored hash.
func CheckOTP(hash, code string) bool {
	return subtle.ConstantTimeCompare([]byte(hash), []byte(HashOTP(code))) == 1
}
