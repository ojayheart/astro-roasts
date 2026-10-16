export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimiter({ limit, windowMs }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const bucket = buckets.get(key);

      if (!bucket || now > bucket.resetAt) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt };
      }

      if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
      }

      bucket.count += 1;
      return {
        allowed: true,
        remaining: Math.max(limit - bucket.count, 0),
        resetAt: bucket.resetAt,
      };
    },
  };
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export const generateRateLimiter = createMemoryRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export const shareUnlockRateLimiter = createMemoryRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

// Promo codes are a shared secret, so redemption is the one endpoint worth
// brute-forcing. Tighter than the others on purpose.
export const promoCodeRateLimiter = createMemoryRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
});
