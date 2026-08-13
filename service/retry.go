package service

import (
	"fmt"
	"time"
)

func Retry(maxAttempts int, baseDelay time.Duration, fn func(attempt int) error) error {
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * baseDelay)
		}
		err := fn(attempt)
		if err == nil {
			return nil
		}
		lastErr = err
	}
	return fmt.Errorf("retry exhausted after %d attempts: %w", maxAttempts, lastErr)
}
