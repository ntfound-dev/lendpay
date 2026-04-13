package app

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateLimitRule struct {
	Bucket      string
	Label       string
	MaxRequests int
	WindowMS    int
}

type rateLimitResult struct {
	Allowed   bool
	Limit     int
	Remaining int
	ResetAt   int64
}

type rateLimitBucket struct {
	Count   int
	ResetAt int64
}

type inMemoryRateLimiter struct {
	buckets map[string]rateLimitBucket
	hits    int
	mu      sync.Mutex
}

func newInMemoryRateLimiter() *inMemoryRateLimiter {
	return &inMemoryRateLimiter{
		buckets: map[string]rateLimitBucket{},
	}
}

func resolveRateLimitRule(method, rawURL string, cfg Config) rateLimitRule {
	path := rawURL
	if index := strings.Index(path, "?"); index >= 0 {
		path = path[:index]
	}

	if strings.HasPrefix(path, "/api/v1/auth/challenge") || strings.HasPrefix(path, "/api/v1/auth/verify") {
		return rateLimitRule{
			Bucket:      "auth",
			Label:       "authentication",
			MaxRequests: cfg.RateLimitAuthMaxRequests,
			WindowMS:    cfg.RateLimitWindowMS,
		}
	}

	if strings.HasPrefix(path, "/api/v1/score/analyze") || strings.HasPrefix(path, "/api/v1/meta/ai") {
		return rateLimitRule{
			Bucket:      "ai",
			Label:       "AI scoring",
			MaxRequests: cfg.RateLimitAIMaxRequests,
			WindowMS:    cfg.RateLimitWindowMS,
		}
	}

	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return rateLimitRule{
			Bucket:      "global",
			Label:       "API",
			MaxRequests: cfg.RateLimitGlobalMax,
			WindowMS:    cfg.RateLimitWindowMS,
		}
	default:
		return rateLimitRule{
			Bucket:      "mutation",
			Label:       "write",
			MaxRequests: cfg.RateLimitMutationMax,
			WindowMS:    cfg.RateLimitWindowMS,
		}
	}
}

func (l *inMemoryRateLimiter) check(key string, rule rateLimitRule, now int64) rateLimitResult {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.hits%256 == 0 {
		l.prune(now)
	}
	l.hits++

	bucketKey := rule.Bucket + ":" + key
	current, ok := l.buckets[bucketKey]
	if !ok || current.ResetAt <= now {
		next := rateLimitBucket{
			Count:   1,
			ResetAt: now + int64(rule.WindowMS),
		}
		l.buckets[bucketKey] = next
		return rateLimitResult{
			Allowed:   true,
			Limit:     rule.MaxRequests,
			Remaining: maxInt(0, rule.MaxRequests-next.Count),
			ResetAt:   next.ResetAt,
		}
	}

	current.Count++
	l.buckets[bucketKey] = current

	return rateLimitResult{
		Allowed:   current.Count <= rule.MaxRequests,
		Limit:     rule.MaxRequests,
		Remaining: maxInt(0, rule.MaxRequests-current.Count),
		ResetAt:   current.ResetAt,
	}
}

func (l *inMemoryRateLimiter) prune(now int64) {
	for key, bucket := range l.buckets {
		if bucket.ResetAt <= now {
			delete(l.buckets, key)
		}
	}
}

func clientAddress(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		if len(parts) > 0 {
			value := strings.TrimSpace(parts[0])
			if value != "" {
				return value
			}
		}
	}

	realIP := strings.TrimSpace(r.Header.Get("X-Real-IP"))
	if realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}

	return strings.TrimSpace(r.RemoteAddr)
}

func rateLimitMiddleware(cfg Config, limiter *inMemoryRateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			rule := resolveRateLimitRule(r.Method, r.URL.RequestURI(), cfg)
			result := limiter.check(clientAddress(r), rule, time.Now().UnixMilli())
			retryAfterSeconds := maxInt(1, int((result.ResetAt-time.Now().UnixMilli()+999)/1000))

			w.Header().Set("X-RateLimit-Limit", intToString(result.Limit))
			w.Header().Set("X-RateLimit-Remaining", intToString(result.Remaining))
			w.Header().Set("X-RateLimit-Reset", int64ToString(result.ResetAt))

			if !result.Allowed {
				w.Header().Set("Retry-After", intToString(retryAfterSeconds))
				writeAppError(w, &appError{
					Code:       "RATE_LIMITED",
					Message:    "Too many " + strings.ToLower(rule.Label) + " requests from this client. Please retry shortly.",
					StatusCode: http.StatusTooManyRequests,
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func intToString(value int) string {
	return strconv.Itoa(value)
}

func int64ToString(value int64) string {
	return strconv.FormatInt(value, 10)
}
