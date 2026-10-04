/**
 * Caches the result of `load` for `ttlMs`.
 * - Concurrent callers share one in-flight load, so a cold cache under heavy traffic
 *   still costs the database a single query (no stampede).
 * - Once warm, an expired value is served immediately while it refreshes in the background.
 * - If a refresh fails, the last good value keeps being served for a few seconds.
 */
export function cached(load, ttlMs) {
  let value, expiresAt = 0, inflight = null;

  function refresh() {
    inflight ??= load()
      .then(v => {
        value = v;
        expiresAt = Date.now() + ttlMs;
        return v;
      })
      .catch(err => {
        if (value === undefined) throw err;
        expiresAt = Date.now() + 5000;
        return value;
      })
      .finally(() => { inflight = null; });
    return inflight;
  }

  function get() {
    if (Date.now() < expiresAt) return Promise.resolve(value);
    const pending = refresh();
    return value === undefined ? pending : Promise.resolve(value);
  }

  /** Drop the value so the next caller gets fresh data (used after admin edits). */
  get.invalidate = () => {
    value = undefined;
    expiresAt = 0;
  };
  return get;
}

/** Caps concurrent work. Beyond `max`, callers are turned away at once instead of queueing without limit. */
export function concurrencyLimit(max) {
  let active = 0;
  return {
    tryAcquire() {
      if (active >= max) return false;
      active++;
      return true;
    },
    release() { active--; }
  };
}
