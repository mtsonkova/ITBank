// In-memory blacklist keyed by jti. TTL = token's remaining expiry.
// Cleared on server restart — acceptable per spec.
const store = new Map<string, number>(); // jti → expiry ms timestamp

export const jwtBlacklist = {
  add(jti: string, expiresAtMs: number): void {
    store.set(jti, expiresAtMs);
  },

  has(jti: string): boolean {
    const exp = store.get(jti);
    if (exp === undefined) return false;
    if (Date.now() >= exp) {
      store.delete(jti);
      return false;
    }
    return true;
  },
};
