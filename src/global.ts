/**
 * Ambient global object, narrowed to the members this library reads.
 */
export interface GlobalScope {
  navigator?: { languages?: unknown };
  localStorage?: Storage;
  sessionStorage?: Storage;
}

/**
 * Resolve the ambient global object.
 *
 * `globalThis` is the standard, but it only exists from Chrome 71 / Firefox 65 /
 * Safari 12.1 onward. Older engines expose `self` (browsers and workers) or
 * `window` (browsers) instead, so fall back through those before giving up.
 */
export function getGlobal(): GlobalScope | undefined {
  if (typeof globalThis !== 'undefined') return globalThis as GlobalScope;
  if (typeof self !== 'undefined') return self as unknown as GlobalScope;
  if (typeof window !== 'undefined') return window as unknown as GlobalScope;
  return undefined;
}
