// ---------------------------------------------------------------------------
// Tiny in-memory rate limiter.
//
// Used for the geocoding proxy so the QuickStay backend stays inside the
// public Nominatim usage policy (max 1 request per second, a descriptive
// User-Agent and a valid Referer). The limiter is per server instance which
// is good enough for a serverless deployment where instances are short lived.
// ---------------------------------------------------------------------------

const buckets = new Map();

const now = () => Date.now();

export const rateLimit = ({ windowMs = 1000, max = 1, keyPrefix = "default" } = {}) => {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || "unknown"}`;
    const timestamp = now();
    const bucket = buckets.get(key) || [];

    // Drop entries that fell out of the window.
    const recent = bucket.filter((t) => timestamp - t < windowMs);

    if (recent.length >= max) {
      const retryAfterMs = windowMs - (timestamp - recent[0]);
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please wait a moment and try again.",
      });
    }

    recent.push(timestamp);
    buckets.set(key, recent);

    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [bucketKey, timestamps] of buckets) {
        if (!timestamps.some((t) => timestamp - t < windowMs)) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
};
