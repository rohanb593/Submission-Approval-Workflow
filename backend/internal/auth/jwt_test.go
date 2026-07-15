package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const testSecret = "test-secret"

func TestGenerateAndParseToken(t *testing.T) {
	userID := uuid.New()

	tokenString, err := GenerateToken(userID, "reviewer", testSecret, time.Hour)
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	claims, err := ParseToken(tokenString, testSecret)
	if err != nil {
		t.Fatalf("ParseToken returned error: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("UserID = %v, want %v", claims.UserID, userID)
	}
	if claims.Role != "reviewer" {
		t.Errorf("Role = %q, want %q", claims.Role, "reviewer")
	}
}

func TestParseToken_Expired(t *testing.T) {
	tokenString, err := GenerateToken(uuid.New(), "requester", testSecret, -time.Hour)
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	if _, err := ParseToken(tokenString, testSecret); err == nil {
		t.Error("ParseToken should reject an expired token")
	}
}

func TestParseToken_WrongSecret(t *testing.T) {
	tokenString, err := GenerateToken(uuid.New(), "requester", testSecret, time.Hour)
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	if _, err := ParseToken(tokenString, "a-different-secret"); err == nil {
		t.Error("ParseToken should reject a token signed with a different secret")
	}
}

func TestParseToken_Malformed(t *testing.T) {
	if _, err := ParseToken("not-a-real-token", testSecret); err == nil {
		t.Error("ParseToken should reject a malformed token string")
	}
}

func TestParseToken_RejectsNoneAlgorithm(t *testing.T) {
	claims := Claims{
		UserID: uuid.New(),
		Role:   "reviewer",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}

	// Craft a token signed with "none" to simulate an algorithm-confusion
	// attack, where an attacker forges a token without knowing the secret.
	forged := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, err := forged.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to craft forged token: %v", err)
	}

	if _, err := ParseToken(tokenString, testSecret); err == nil {
		t.Error("ParseToken should reject a token signed with alg \"none\"")
	}
}
