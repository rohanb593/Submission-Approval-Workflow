// Package redis manages the connection to Redis, used for ephemeral state
// that benefits from native key expiry: 2FA challenges and login
// rate-limiting counters.
package redis

import (
	"context"
	"fmt"

	goredis "github.com/redis/go-redis/v9"
)

// Connect opens a client connection to Redis and verifies it's reachable.
func Connect(redisURL string) (*goredis.Client, error) {
	opts, err := goredis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing redis url: %w", err)
	}

	client := goredis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("pinging redis: %w", err)
	}
	return client, nil
}
