// Exercises the built package the way a consumer would, through the real
// `exports` map, so a broken build or entry point fails CI rather than a
// downstream user.
import assert from 'node:assert/strict';
import { createLocalePref, cookieAdapter, getDefaultLocalePref, localStorageAdapter, memoryAdapter } from 'locale-pref';
import { detectNavigatorLocale, isRegion, normalizeLocale } from 'locale-pref/utils';

const pref = createLocalePref({ storage: memoryAdapter(), fallback: ['en'], defaultLocale: 'en-US' });

assert.equal(await pref.getLocale(), 'en', 'getLocale resolves the fallback source');
assert.equal(pref.getLocaleSync(), 'en', 'getLocaleSync matches getLocale for a sync adapter');
assert.equal(isRegion('zh-Hans-CN', 'cn'), true, 'isRegion matches a region subtag');
assert.equal(isRegion('zh', 'CN'), false, 'isRegion rejects a tag without a region');
assert.equal(normalizeLocale('zh-hans-cn'), 'zh-Hans-CN', 'normalizeLocale canonicalizes');
assert.equal(normalizeLocale('!!'), null, 'normalizeLocale rejects a malformed tag');
assert.equal(cookieAdapter({ cookieString: 'a=b' }).isSync, true, 'cookieAdapter is synchronous');
assert.equal(memoryAdapter({ k: 'v' }).get('k'), 'v', 'memoryAdapter round-trips');
assert.equal(typeof localStorageAdapter, 'function', 'localStorageAdapter is exported');

// The lazy default instance is created on first call and then reused.
assert.equal(getDefaultLocalePref(), getDefaultLocalePref(), 'getDefaultLocalePref caches one instance');
assert.equal(getDefaultLocalePref().storage.isSync, true, 'the default instance uses a sync adapter');

// detectNavigatorLocale must never throw regardless of environment.
const detected = detectNavigatorLocale();
assert.ok(detected === null || typeof detected === 'string', 'detectNavigatorLocale returns string | null');

// A write must land in the injected backend and survive a read.
await pref.setLocale('zh-hans-cn');
assert.equal(await pref.getLocale(), 'zh-Hans-CN', 'setLocale persists a normalized tag');
assert.equal(await pref.isCurrentRegion('CN'), true, 'isCurrentRegion reflects the stored tag');

await pref.clearLocale();
assert.equal(await pref.getLocale(), 'en', 'clearLocale falls back again');

console.log('Smoke test passed for both entry points.');
