// Exercises the built package the way a consumer would, through the real
// `exports` map, so a broken build or entry point fails CI rather than a
// downstream user.
import assert from 'node:assert/strict';
import {
  createLocalePref,
  cookieAdapter,
  getDefaultLocalePref,
  localStorageAdapter,
  memoryAdapter,
  sessionStorageAdapter,
} from 'locale-pref';
import { detectNavigatorLocale, isLanguage, isRegion, isScript, normalizeLocale } from 'locale-pref/utils';

const pref = createLocalePref({ storage: memoryAdapter(), fallback: ['en'], defaultLocale: 'en-US' });

assert.equal(await pref.getLocale(), 'en', 'getLocale resolves the fallback source');
assert.equal(pref.getLocaleSync(), 'en', 'getLocaleSync matches getLocale for a sync adapter');
assert.equal(isRegion('zh-Hans-CN', 'cn'), true, 'isRegion matches a region subtag');
assert.equal(isRegion('zh', 'CN'), false, 'isRegion rejects a tag without a region');
assert.equal(isLanguage('zh-Hans-CN', 'zh'), true, 'isLanguage matches a primary language subtag');
assert.equal(isLanguage('en-US', 'zh'), false, 'isLanguage rejects a different language');
assert.equal(isScript('zh-Hans-CN', 'Hans'), true, 'isScript matches an explicit script');
assert.equal(isScript('zh-CN', 'Hans'), true, 'isScript resolves the likely script of zh-CN');
assert.equal(isScript('zh-TW', 'Hant'), true, 'isScript resolves the likely script of zh-TW');
assert.equal(isScript('zh-TW', 'Hans'), false, 'isScript distinguishes Traditional from Simplified');
assert.equal(normalizeLocale('zh-hans-cn'), 'zh-Hans-CN', 'normalizeLocale canonicalizes');
assert.equal(normalizeLocale('!!'), null, 'normalizeLocale rejects a malformed tag');
assert.equal(cookieAdapter({ cookieString: 'a=b' }).isSync, true, 'cookieAdapter is synchronous');
assert.equal(memoryAdapter({ k: 'v' }).get('k'), 'v', 'memoryAdapter round-trips');
assert.equal(typeof localStorageAdapter, 'function', 'localStorageAdapter is exported');
assert.equal(typeof sessionStorageAdapter, 'function', 'sessionStorageAdapter is exported');

// The lazy default instance is created on first call and then reused.
assert.equal(getDefaultLocalePref(), getDefaultLocalePref(), 'getDefaultLocalePref caches one instance');
assert.equal(getDefaultLocalePref().storage.isSync, true, 'the default instance uses a sync adapter');

// A fully asynchronous backend flows through getLocale/setLocale/clearLocale.
{
  const store = new Map([['user_locale', 'nl-NL']]);
  const asyncPref = createLocalePref({
    storage: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => void store.set(key, value),
      remove: async (key) => void store.delete(key),
    },
  });
  assert.equal(await asyncPref.getLocale(), 'nl-NL', 'getLocale awaits an async adapter');
  await asyncPref.setLocale('de-DE');
  assert.equal(store.get('user_locale'), 'de-DE', 'setLocale awaits an async adapter');
  assert.throws(() => asyncPref.getLocaleSync(), /synchronous storage adapter/, 'getLocaleSync rejects async adapters');
}

// detectNavigatorLocale must never throw regardless of environment.
const detected = detectNavigatorLocale();
assert.ok(detected === null || typeof detected === 'string', 'detectNavigatorLocale returns string | null');

// A write must land in the injected backend and survive a read.
await pref.setLocale('zh-hans-cn');
assert.equal(await pref.getLocale(), 'zh-Hans-CN', 'setLocale persists a normalized tag');
assert.equal(await pref.isRegion('CN'), true, 'isRegion reflects the stored tag');
assert.equal(await pref.isLanguage('zh'), true, 'isLanguage reflects the stored tag');
assert.equal(await pref.isScript('Hans'), true, 'isScript reflects the stored tag');

await pref.clearLocale();
assert.equal(await pref.getLocale(), 'en', 'clearLocale falls back again');

// The synchronous twins keep a fully synchronous flow free of promises.
assert.equal(pref.setLocaleSync('ja-JP'), undefined, 'setLocaleSync returns nothing');
assert.equal(pref.getLocaleSync(), 'ja-JP', 'setLocaleSync writes synchronously');
assert.equal(pref.isRegionSync('JP'), true, 'isRegionSync reads synchronously');
assert.equal(pref.isLanguageSync('ja'), true, 'isLanguageSync reads synchronously');
assert.equal(pref.isScriptSync('Jpan'), true, 'isScriptSync reads synchronously');
assert.equal(pref.clearLocaleSync(), undefined, 'clearLocaleSync returns nothing');
assert.equal(pref.getLocaleSync(), 'en', 'clearLocaleSync clears synchronously');

console.log('Smoke test passed for both entry points.');
