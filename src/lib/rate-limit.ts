type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function consumeRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const existingBucket = buckets.get(key);

  if (!existingBucket || existingBucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      retryAfterMs: windowMs,
    };
  }

  if (existingBucket.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(existingBucket.resetAt - now, 0),
    };
  }

  existingBucket.count += 1;

  return {
    allowed: true,
    retryAfterMs: Math.max(existingBucket.resetAt - now, 0),
  };
}
