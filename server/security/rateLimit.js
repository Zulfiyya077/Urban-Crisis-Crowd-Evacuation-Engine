export function createRateLimiter({ limit, windowMs, now = Date.now } = {}) {
  const buckets = new Map();
  return {
    hit(key) {
      const stamp = now();
      let bucket = buckets.get(key);
      if (!bucket || stamp - bucket.start >= windowMs) {
        bucket = { start: stamp, count: 0 };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (buckets.size > 4000) {
        for (const [id, item] of buckets) {
          if (stamp - item.start >= windowMs) buckets.delete(id);
        }
      }
      if (bucket.count > limit) {
        return { ok: false, retryAfterMs: Math.max(0, windowMs - (stamp - bucket.start)) };
      }
      return { ok: true, remaining: limit - bucket.count };
    },
  };
}
