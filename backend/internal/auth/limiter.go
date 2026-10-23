package auth

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type IPRateLimiter struct {
	ips map[string]*clientLimiter
	mu  sync.RWMutex
	r   rate.Limit
	b   int
}

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	i := &IPRateLimiter{
		ips: make(map[string]*clientLimiter),
		r:   r,
		b:   b,
	}

	// Cleanup old records periodically
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			i.mu.Lock()
			for ip, client := range i.ips {
				if time.Since(client.lastSeen) > 10*time.Minute {
					delete(i.ips, ip)
				}
			}
			i.mu.Unlock()
		}
	}()

	return i
}

func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter, exists := i.ips[ip]
	if !exists {
		limiter = &clientLimiter{
			limiter:  rate.NewLimiter(i.r, i.b),
			lastSeen: time.Now(),
		}
		i.ips[ip] = limiter
		return limiter.limiter
	}

	limiter.lastSeen = time.Now()
	return limiter.limiter
}
