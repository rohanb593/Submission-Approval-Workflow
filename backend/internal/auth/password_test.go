package auth

import "testing"

func TestHashAndCheckPassword(t *testing.T) {
	hash, err := HashPassword("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	if !CheckPassword(hash, "correct-horse-battery-staple") {
		t.Error("CheckPassword should return true for the correct password")
	}

	if CheckPassword(hash, "wrong-password") {
		t.Error("CheckPassword should return false for an incorrect password")
	}
}

func TestHashPasswordProducesDifferentHashesForSameInput(t *testing.T) {
	hash1, _ := HashPassword("same-password")
	hash2, _ := HashPassword("same-password")

	if hash1 == hash2 {
		t.Error("bcrypt should salt each hash, expected different output for repeated calls")
	}
}
