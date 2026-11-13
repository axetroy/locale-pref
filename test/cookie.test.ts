import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookieAdapter } from '../src/adapters/cookie.js';

interface DocumentMock {
  cookie: string;
  writes: string[];
}

/**
 * Minimal `document` stand-in. Assigning `cookie` records the write and mirrors
 * the browser behaviour of appending a new pair.
 */
function createDocumentMock(initial = ''): DocumentMock {
  const mock: DocumentMock = { cookie: initial, writes: [] };
  let value = initial;
  Object.defineProperty(mock, 'cookie', {
    configurable: true,
    get: () => value,
    set: (next: string) => {
      mock.writes.push(next);
      value = value === '' ? next : `${value}; ${next}`;
    },
  });
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cookieAdapter in the browser', () => {
  it('reads a value written through the adapter', () => {
    vi.stubGlobal('document', createDocumentMock());
    const adapter = cookieAdapter();
    adapter.set('user_locale', 'zh-CN');
    expect(adapter.get('user_locale')).toBe('zh-CN');
  });

  it('exposes isSync', () => {
    vi.stubGlobal('document', createDocumentMock());
    expect(cookieAdapter().isSync).toBe(true);
  });

  it('writes path, max-age and SameSite with defaults', () => {
    const documentMock = createDocumentMock();
    vi.stubGlobal('document', documentMock);
    cookieAdapter().set('user_locale', 'en');
    expect(documentMock.writes[0]).toBe('user_locale=en; path=/; max-age=31536000; SameSite=Lax');
  });

  it('honours defaultPath and defaultMaxAge', () => {
    const documentMock = createDocumentMock();
    vi.stubGlobal('document', documentMock);
    cookieAdapter({ defaultPath: '/app', defaultMaxAge: 60 }).set('user_locale', 'en');
    expect(documentMock.writes[0]).toContain('path=/app');
    expect(documentMock.writes[0]).toContain('max-age=60');
  });

  it('adds Secure and domain only when requested', () => {
    const documentMock = createDocumentMock();
    vi.stubGlobal('document', documentMock);
    cookieAdapter().set('user_locale', 'en', { secure: true, domain: 'example.com', sameSite: 'Strict' });
    const written = documentMock.writes[0];
    expect(written).toContain('SameSite=Strict');
    expect(written).toContain('Secure');
    expect(written).toContain('domain=example.com');
  });

  it('does not add Secure when false', () => {
    const documentMock = createDocumentMock();
    vi.stubGlobal('document', documentMock);
    cookieAdapter().set('user_locale', 'en', { secure: false });
    expect(documentMock.writes[0]).not.toContain('Secure');
  });

  it('encodes special characters on write and decodes on read', () => {
    vi.stubGlobal('document', createDocumentMock());
    const adapter = cookieAdapter();
    const value = 'zh-CN;=中文';
    adapter.set('user_locale', value);
    expect(adapter.get('user_locale')).toBe(value);
  });

  it('stores a key containing a dot', () => {
    vi.stubGlobal('document', createDocumentMock());
    const adapter = cookieAdapter();
    adapter.set('a.b', 'zh-CN');
    expect(adapter.get('a.b')).toBe('zh-CN');
  });

  it('reads the first matching key among several cookies', () => {
    vi.stubGlobal('document', createDocumentMock('other=1; user_locale=ja-JP; tail=2'));
    expect(cookieAdapter().get('user_locale')).toBe('ja-JP');
  });

  it('returns null when the key is absent', () => {
    vi.stubGlobal('document', createDocumentMock('other=1'));
    expect(cookieAdapter().get('user_locale')).toBe(null);
  });

  it('skips malformed pairs without an equals sign', () => {
    vi.stubGlobal('document', createDocumentMock('broken; user_locale=fr-FR'));
    expect(cookieAdapter().get('user_locale')).toBe('fr-FR');
  });

  it('deletes by writing max-age=0 and keeps path and domain', () => {
    const documentMock = createDocumentMock();
    vi.stubGlobal('document', documentMock);
    cookieAdapter().remove('user_locale', { domain: 'example.com' });
    const written = documentMock.writes[0];
    expect(written).toContain('max-age=0');
    expect(written).toContain('path=/');
    expect(written).toContain('domain=example.com');
  });

  it('returns the raw value when it is not URI encoded', () => {
    vi.stubGlobal('document', createDocumentMock('user_locale=%E0%A4%A'));
    expect(cookieAdapter().get('user_locale')).toBe('%E0%A4%A');
  });
});

describe('cookieAdapter in Node.js', () => {
  it('reads from the provided cookieString', () => {
    const adapter = cookieAdapter({ cookieString: 'user_locale=de-DE; theme=dark' });
    expect(adapter.get('user_locale')).toBe('de-DE');
  });

  it('returns null without a cookieString', () => {
    expect(cookieAdapter().get('user_locale')).toBe(null);
  });

  it('throws on write', () => {
    expect(() => cookieAdapter().set('user_locale', 'en')).toThrow('cookieAdapter is read-only in Node.js environment');
  });

  it('throws on remove', () => {
    expect(() => cookieAdapter().remove('user_locale')).toThrow('cookieAdapter is read-only in Node.js environment');
  });
});
