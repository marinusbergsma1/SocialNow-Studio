
/**
 * Generates a unique ID using crypto.randomUUID when available,
 * falling back to a timestamp + random string.
 */
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch { /* fallback */ }
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
