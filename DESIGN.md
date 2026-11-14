# locale-pref 设计白皮书

> 版本：1.0
> 状态：已实现
> 目标读者：实现该库的工程 Agent
> 包名：`locale-pref`

---

## 1. 项目概述

### 1.1 目标
`locale-pref` 是一个零运行时依赖的 JavaScript/TypeScript 语言偏好工具库，提供：

1. **获取当前语言**：按可配置的回退链读取用户语言偏好。
2. **设置当前语言**：将用户选择持久化到可插拔的存储后端。
3. **地区判断**：基于 `Intl.Locale` 判断语言标签是否属于某地区。

### 1.2 非目标
- 不实现翻译/消息格式化（不属于本库职责）。
- 不实现 UI 语言切换器。
- 不推断用户物理位置或区域偏好（如货币、时区），`isRegion` 仅做语言标签语义判断。

### 1.3 关键约束
- **纯 ESM 发布**，`"type": "module"`，零运行时依赖。
- 同时支持浏览器与 Node.js（SSR）环境。
- 存储后端通过适配器注入，核心逻辑不直接触碰 `document` 或 `window`。
- 所有语言标签处理遵循 BCP 47（RFC 5646）。

---

## 2. 术语

| 术语 | 含义 |
|---|---|
| locale tag | BCP 47 语言标签，如 `zh-CN`、`en-US`、`zh-Hans-CN` |
| region | 语言标签中的地区子标签，如 `CN`、`US` |
| 适配器 | 实现 `StorageAdapter` 接口的存储后端 |
| 回退链 | `getLocale()` 依次尝试的来源列表 |

---

## 3. 公共 API 规范

### 3.1 工厂函数

```typescript
function createLocalePref(options?: LocalePrefOptions): LocalePref;
```

```typescript
interface LocalePrefOptions {
  /** 存储适配器，默认 cookieAdapter() */
  storage?: StorageAdapter;
  /** 存储中使用的 key，默认 'user_locale' */
  storageKey?: string;
  /** 存储未命中时的回退来源，默认 ['navigator'] */
  fallback?: Array<'navigator' | string>;
  /** 最终兜底语言，默认 'en' */
  defaultLocale?: string;
  /** 写入存储时的默认参数 */
  storageSetOptions?: StorageSetOptions;
  /** 是否校验并规范化语言标签，默认 true */
  normalize?: boolean;
  /** 适配器或 navigator 读取异常时的回调，默认静默 */
  onError?: (error: unknown, context: 'storage' | 'navigator') => void;
}
```

**要求**：
- `fallback` 中 `'navigator'` 是保留字，表示读取 `navigator.languages`；其他字符串视为固定 locale 候选。
- 所有选项都有默认值，`createLocalePref()` 无参可调用。
- `fallback` 会被**复制**后再使用，创建后调用方对原数组的修改不影响该实例。
- 对非法选项值应抛出 `TypeError`，并在消息中指明字段名：
  - `storage` 不是对象，或不含 `get`/`set`/`remove` 三个方法。
  - `fallback` 不是数组，或数组元素不是字符串。
  - `storageKey` / `defaultLocale` 不是字符串，或为空字符串（空 key 会导致读写静默失效）。
  - `normalize` 不是布尔值、`storageSetOptions` 不是对象、`onError` 不是函数。

### 3.1.1 便捷默认实例
```typescript
function getDefaultLocalePref(): LocalePref;
```
- 返回**惰性创建、进程级共享**的实例，等价于无参 `createLocalePref()`。
- **不得**在模块顶层调用：那样会破坏 `sideEffects: false`。必须在首次调用函数时才创建并缓存。
- 用于默认配置够用的场景（典型为浏览器应用）。**多租户 SSR 服务端不得使用**：进程级共享 + 固定 `'user_locale'` key 会导致跨请求语言泄漏；服务端应按请求 `createLocalePref({ storage: cookieAdapter({ cookieString }) })`。
- README 必须写明上述限制。

### 3.2 实例接口

```typescript
interface LocalePref {
  getLocale(): Promise<string>;
  getLocaleSync(): string;
  setLocale(locale: string): Promise<void>;
  setLocaleSync(locale: string): void;
  clearLocale(): Promise<void>;
  clearLocaleSync(): void;
  isRegion(locale: string, region: string): boolean;
  isCurrentRegion(region: string): Promise<boolean>;
  isCurrentRegionSync(region: string): boolean;
  normalizeLocale(locale: string): string | null;
  readonly storage: StorageAdapter;
}
```

#### 3.2.1 `getLocale(): Promise<string>`
按回退链顺序返回第一个合法语言标签：

1. `storage.get(storageKey)` 的返回值，非空且合法（或可规范化）→ 返回。
2. 遍历 `fallback`：
   - `'navigator'`：读取 `navigator.languages`，返回第一个合法标签；环境无 `navigator` 或数组为空则跳过。
   - 其他字符串：若合法则返回。
3. 返回 `defaultLocale`。

**规范化规则**（当 `normalize: true`）：
- 对每个候选值调用 `normalizeLocale`，结果为 `null` 则视为不合法，继续回退。
- 最终 `defaultLocale` 若不合法，返回 `'en'`。

**异常要求**：
- 适配器 `get` 抛错时，**捕获并继续回退链**，不向上抛出（记录到 `onError` 回调，`context` 为 `'storage'`）。
- `normalize: true` 且运行时缺失 `Intl.Locale` 时抛错（见 §6.4），不静默降级。

#### 3.2.2 `getLocaleSync(): string`
- 仅当适配器是同步适配器时可用。
- 检测方式：适配器实例带 `isSync: true` 标志（内置同步适配器均设置此标志；自定义适配器可选实现）。
- 若适配器非同步，抛出 `Error`，消息为 `"getLocaleSync() requires a synchronous storage adapter"`。
- 回退逻辑与 `getLocale` 一致。

#### 3.2.3 `setLocale(locale: string): Promise<void>`
- 若 `locale` 不是字符串，抛出 `TypeError`（在 `normalize: false` 下同样生效，避免把非字符串写入后端）。
- 若 `normalize: true` 且 `normalizeLocale(locale)` 为 `null`，抛出 `RangeError`，消息包含非法标签。
- 写入 `storage.set(storageKey, normalizedLocale, storageSetOptions)`。
- 返回适配器的 Promise（或同步结果包装为 resolved Promise）。
- `normalize: true` 且运行时缺失 `Intl.Locale` 时抛错（见 §6.4）。

#### 3.2.3.1 `setLocaleSync(locale: string): void`
- 与 `setLocale` 同校验、同写入，但不返回 Promise；失败以 `throw` 传递。
- 仅当 `storage.isSync === true`；否则抛 `Error`，消息为 `"setLocaleSync() requires a synchronous storage adapter"`。

#### 3.2.4 `clearLocale(): Promise<void>`
- 调用 `storage.remove(storageKey, storageSetOptions)`，将写入时使用的属性（如 cookie 的 `path`/`domain`）一并传入，使按属性区分的后端能删除正确的条目。

#### 3.2.4.1 `clearLocaleSync(): void`
- 与 `clearLocale` 同行为，但不返回 Promise；失败以 `throw` 传递。
- 仅当 `storage.isSync === true`；否则抛 `Error`，消息为 `"clearLocaleSync() requires a synchronous storage adapter"`。

#### 3.2.5 `isRegion(locale: string, region: string): boolean`
- 实现见第 6 节。
- 非法 `locale` 或 `region` 返回 `false`，不抛错。
- 大小写不敏感比较。
- 运行时缺失 `Intl.Locale` 时抛错（见 §6.4）；这是“平台能力缺失”，与“输入非法”不同。

#### 3.2.5.1 `isLanguage(locale: string, language: string): boolean`
- 实现见第 6 节。
- 判断标签的主语言子标签是否等于 `language`（忽略地区、书写系统与扩展子标签）。
- 非法 `locale` 或 `language` 返回 `false`，不抛错。
- 大小写不敏感比较。
- 运行时缺失 `Intl.Locale` 时抛错（见 §6.4）。

#### 3.2.5.2 `isScript(locale: string, script: string): boolean`
- 实现见第 6 节。
- 先对标签执行 `Intl.Locale.prototype.maximize()`（CLDR likely subtags），再比较书写系统子标签。
- 因此仅有地区的标签也能解析：`zh-CN` → `Hans`，`zh-TW`/`zh-HK`/`zh-MO` → `Hant`。
- 非法 `locale` 或 `script` 返回 `false`，不抛错。
- 大小写不敏感比较。
- 运行时缺失 `Intl.Locale` 时抛错（见 §6.4）。

#### 3.2.6 `isCurrentRegion(region: string): Promise<boolean>`
- 等价于 `isRegion(await this.getLocale(), region)`。

#### 3.2.6.1 `isCurrentRegionSync(region: string): boolean`
- 等价于 `isRegion(this.getLocaleSync(), region)`。
- 仅当 `storage.isSync === true`；否则抛 `Error`，消息为 `"isCurrentRegionSync() requires a synchronous storage adapter"`。

#### 3.2.6.2 `isCurrentLanguage(language: string): Promise<boolean>`
- 等价于 `isLanguage(await this.getLocale(), language)`。

#### 3.2.6.3 `isCurrentLanguageSync(language: string): boolean`
- 等价于 `isLanguage(this.getLocaleSync(), language)`。
- 仅当 `storage.isSync === true`；否则抛 `Error`，消息为 `"isCurrentLanguageSync() requires a synchronous storage adapter"`。

#### 3.2.6.4 `isCurrentScript(script: string): Promise<boolean>`
- 等价于 `isScript(await this.getLocale(), script)`。

#### 3.2.6.5 `isCurrentScriptSync(script: string): boolean`
- 等价于 `isScript(this.getLocaleSync(), script)`。
- 仅当 `storage.isSync === true`；否则抛 `Error`，消息为 `"isCurrentScriptSync() requires a synchronous storage adapter"`。

#### 3.2.7 `normalizeLocale(locale: string): string | null`
- 实现见第 6 节。
- 运行时缺失 `Intl.Locale` 时抛错（见 §6.4）。

#### 3.2.8 `storage`
- 只读属性，返回创建实例时使用的适配器。

### 3.3 存储适配器接口

```typescript
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string, options?: StorageSetOptions): void | Promise<void>;
  remove(key: string, options?: StorageSetOptions): void | Promise<void>;
  /** 可选：标记为同步适配器，供 getLocaleSync 判断 */
  readonly isSync?: boolean;
}

interface StorageSetOptions {
  maxAge?: number;
  path?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
  domain?: string;
}
```

#### 3.3.1 同步与异步的判定

- 适配器 **`isSync === true`** → 同步适配器；否则为异步适配器（无论方法实际是否返回 Promise）。
- 异步适配器在 `getLocale` / `setLocale` / `clearLocale` / `isCurrentRegion` 中一律 `await`，语义与同步适配器一致。
- 异步适配器调用 `getLocaleSync()` 抛 `Error`，消息为 `"getLocaleSync() requires a synchronous storage adapter"`。
- 误把异步适配器标记为 `isSync: true` 时，`getLocaleSync()` 会把 `Promise` 当作 `string` 处理，`resolveCandidate` 因 `typeof value !== 'string'` 判为未命中，从而静默走回退链。文档需提示该陷阱。

#### 3.3.2 异步错误语义

- `storage.get` 抛错或 reject → 以 `context: 'storage'` 调用 `onError`，随后继续回退链（与同步抛错一致，**不**向上抛）。
- `storage.set` / `storage.remove` 抛错或 reject → 让 `setLocale` / `clearLocale` 返回的 Promise **reject**，由调用方处理。库不吞错，也不重试。

#### 3.3.3 为何提供同步方法（`setLocaleSync` / `clearLocaleSync` / `isCurrentRegionSync`）

内置适配器多数是同步的，因此提供同步变体，让整条同步流程保持同步。**不**提供「返回 Promise 但没有对应同步方法」的方案，原因：

- **悬空 Promise 触发类型/静态检查报错。** 同步流程里调用 `setLocale()` 会得到 `Promise<void>`；TypeScript 与 `@typescript-eslint/no-floating-promises`（`recommendedTypeChecked` 的一部分）要求 `await` 它或用 `void` 显式忽略。而写入其实已同步完成，`void` 只是噪音。
- **`await` 具有传染性。** `await setLocale()` 会把所在函数变成 `async`，同步回调无法保持同步。`*Sync` 方法返回 `void`，无需 `await`/`void`，失败是普通 `throw`，用 `try`/`catch` 处理。
- **与既有 `getLocaleSync()` 一致。** 读取侧早有同步逃生口；写入/判断侧补齐后 API 对称。

`Promise` 版本仍是默认，也是配合异步适配器时的唯一选择。所有 `*Sync` 方法仅在 `storage.isSync === true` 时可用，否则抛 `Error`（消息形如 `"<method>() requires a synchronous storage adapter"`）。契约由 `test/sync-writes.test.ts` 锁定。

---

## 4. 内置适配器

### 4.1 `cookieAdapter`

```typescript
function cookieAdapter(options?: {
  cookieString?: string;
  defaultPath?: string;   // 默认 '/'
  defaultMaxAge?: number; // 默认 31536000（一年）
}): StorageAdapter;
```

**行为**：
- **读取**：
  - 浏览器环境（`typeof document !== 'undefined'`）：解析 `document.cookie`。
  - Node 环境：解析 `options.cookieString`；未提供则返回 `null`。
  - 解析需处理 `encodeURIComponent` 编码的值，按 `; ` 分割，取第一个匹配 key。
- **写入**：
  - 浏览器环境：拼接 `key=encodeURIComponent(value); path=...; max-age=...; SameSite=...; Secure; Domain=...` 写入 `document.cookie`。
  - Node 环境：**抛出 Error**，消息为 `"cookieAdapter is read-only in Node.js environment"`。
- **删除**：写入同名 cookie，`max-age=0`，其余属性（path/domain）与写入一致。`remove` 忽略 `maxAge`：选项描述的是被删除的值，而非墓碑的有效期，因此删除永远立即过期。
- **`isSync`**：`true`。
- `sameSite` 默认 `'Lax'`；`secure` 仅当显式传入 `true` 时添加。

### 4.2 `localStorageAdapter`

```typescript
function localStorageAdapter(options?: {
  storage?: Storage;
}): StorageAdapter;
```

**行为**：
- 存储对象默认 `globalThis.localStorage`。
- 若环境无 `localStorage` 且未传 `storage`，**创建时抛错**，消息为 `"localStorage is not available in this environment"`。
- `get` 返回 `storage.getItem(key)`；`set` 调 `setItem` 并忽略 `StorageSetOptions`；`remove` 调 `removeItem`。
- `isSync`: `true`。
- 内部捕获 `localStorage` 的 `QuotaExceededError` 等异常并原样抛出（由上层 `onError` 处理）。

### 4.3 `sessionStorageAdapter`

```typescript
function sessionStorageAdapter(options?: {
  storage?: Storage;
}): StorageAdapter;
```

**行为**：
- 与 `localStorageAdapter` 同构，底层为 `globalThis.sessionStorage`。
- 若环境无 `sessionStorage` 且未传 `storage`，**创建时抛错**，消息为 `"sessionStorage is not available in this environment"`。
- 忽略 `StorageSetOptions`；异常原样抛出。
- `isSync`: `true`。
- 二者共用内部 `webStorageAdapter(storage)` 辅助函数（`src/adapters/webStorage.ts`），避免重复实现。

**语义**：`sessionStorage` 作用域为当前标签页，关闭即清空。适合「仅本次会话」的临时覆盖，不适合持久偏好。库**不会**自动把 session 值纳入回退链；如需「会话覆盖 + 持久兜底」，由使用方组合自定义适配器（见 README）。

### 4.4 `memoryAdapter`

```typescript
function memoryAdapter(initial?: Record<string, string>): StorageAdapter;
```

- 基于内部 `Map`。
- `isSync`: `true`。
- 用于测试和 Node 环境临时使用。

---

## 5. 独立工具函数

导出到 `locale-pref/utils` 子路径，可 tree-shaking，不依赖实例：

```typescript
function isRegion(locale: string, region: string): boolean;
function isLanguage(locale: string, language: string): boolean;
function isScript(locale: string, script: string): boolean;
function normalizeLocale(locale: string): string | null;
function detectNavigatorLocale(): string | null;
```

### 5.1 `detectNavigatorLocale`
- `navigator` 不存在或 `navigator.languages` 非数组/为空 → 返回 `null`。
- 遍历 `navigator.languages`，返回第一个 `normalizeLocale` 非 `null` 的值。
- 不读取 `navigator.language` 作为额外来源（`languages` 已覆盖，且 `language` 是 `languages[0]` 的历史别名）。
- 通过全局对象回退链读取 `navigator`（见 §6.4）。
- 运行时缺失 `Intl.Locale` 时抛错（见 §6.4）。

---

## 6. 地区判断与规范化实现

### 6.1 `isRegion`
```typescript
function isRegion(locale: string, region: string): boolean {
  if (typeof locale !== 'string' || typeof region !== 'string') return false;
  try {
    const l = new Intl.Locale(locale);
    return l.region?.toUpperCase() === region.toUpperCase();
  } catch {
    return false;
  }
}
```
- 无 `region` 子标签（如 `en`）→ 返回 `false`。
- 不抛错。

### 6.1.1 `isLanguage`
```typescript
function isLanguage(locale: string, language: string): boolean {
  if (typeof locale !== 'string' || typeof language !== 'string') return false;
  try {
    return new Intl.Locale(locale).language?.toLowerCase() === language.toLowerCase();
  } catch {
    return false;
  }
}
```
- 比较 `Intl.Locale.prototype.language`（主语言子标签），忽略 `region`、`script` 与扩展。
- `language` 应为裸语言子标签（如 `'zh'`、`'en'`），不是完整标签。
- `und`、空串或非法标签 → `language` 为 `undefined` 或解析失败 → 返回 `false`。
- 不抛错。

### 6.1.2 `isScript`
```typescript
function isScript(locale: string, script: string): boolean {
  if (typeof locale !== 'string' || typeof script !== 'string') return false;
  try {
    return new Intl.Locale(locale).maximize().script?.toLowerCase() === script.toLowerCase();
  } catch {
    return false;
  }
}
```
- 先 `maximize()` 补全 likely subtags，再比较 `script`（书写系统子标签）。
- `script` 应为四字母书写系统代码（如 `'Hans'`、`'Hant'`、`'Latn'`、`'Cyrl'`）。
- 关键：`zh-CN` 无显式 script，但 `maximize()` 按 CLDR likely subtags 得到 `Hans`；`zh-TW` 得到 `Hant`。若不 maximize，`zh-CN`/`zh-TW` 会因 `script === undefined` 而全部判 `false`。
- 简体/繁体是 **script**，不是语言子级：`zh-Hans` 与 `zh-Hant` 的 `language` 都是 `zh`。
- 空串、非法标签 → 返回 `false`。
- 不抛错。

### 6.2 `normalizeLocale`
```typescript
function normalizeLocale(locale: string): string | null {
  if (typeof locale !== 'string' || locale.trim() === '') return null;
  try {
    return new Intl.Locale(locale).toString();
  } catch {
    return null;
  }
}
```
- `Intl.Locale.prototype.toString()` 返回规范化后的 BCP 47 标签（如 `zh-hans-cn` → `zh-Hans-CN`）。
- 空串、纯空白、非法标签 → `null`。

### 6.3 语义约定（必须写入 README）
- `isRegion` 判断的是**语言标签本身是否携带该地区子标签**。
- 它**不用于推断用户物理位置**，也不等同于 `Accept-Language` 的地区含义。
- `en`、`zh` 这类无地区子标签的标签，对任何 `region` 都返回 `false`。
- `isLanguage` 判断的是**语言标签本身的主语言子标签**，忽略地区与书写系统：`zh-Hant-TW` 与 `zh-Hans-CN` 都属于 `zh`。
- 它同样**不用于推断用户**，只回答“这个标签是不是该语言”。
- `isScript` 判断的是**标签解析出的书写系统子标签**。简体/繁体是 `Hans`/`Hant` 两个**书写系统**，二者语言都是 `zh`，属平级子标签而非语言子级。
- `isScript` 会先 `maximize()`，所以只有地区的标签也能区分：`zh-CN`/`zh-SG` 视为简体，`zh-TW`/`zh-HK`/`zh-MO` 视为繁体。这是 CLDR likely subtags 推断，不是标签里显式写出的 script。
- 组合用法：先 `isLanguage('zh')` 判定是中文，再用 `isScript('Hans')` / `isScript('Hant')` 细分简繁。

### 6.4 平台能力要求（`Intl.Locale`）
- `isRegion` 与 `normalizeLocale` 依赖 `Intl.Locale`。该 API 的浏览器支持下限为
  Chrome 74 / Firefox 75 / Safari 14 / Edge 79，Node.js 20+ 原生支持。
- 库**不内置 polyfill**（保持零依赖与 `sideEffects: false`），由使用方按需引入，
  例如 `@formatjs/intl-locale`。
- 运行时缺失 `Intl.Locale` 时**必须快速失败**：抛出带修复指引的 `Error`，而不是
  退化为“恒 `false` / 恒 `null`”。静默降级会把用户语言判断错而不报错。
  - 非法输入（非字符串、畸形标签）仍按 §3.2.5 返回 `false` / `null`，不抛错；
    “平台能力缺失”与“输入非法”是两回事，前者抛错、后者不抛。
- `normalize: false` 是逃生口：`getLocale` / `setLocale` 可在无 `Intl.Locale` 时工作，
  但 `isRegion` / `isCurrentRegion` 仍依赖它。
- `globalThis`（Chrome 71 / Firefox 65 / Safari 12.1）通过 `globalThis` → `self` →
  `window` 回退链解析，其缺失不致命。

---

## 7. 目录结构与打包

### 7.1 建议目录
```
locale-pref/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # createLocalePref / getDefaultLocalePref + 适配器导出
│   ├── adapters/
│   │   ├── cookie.ts
│   │   ├── localStorage.ts
│   │   ├── sessionStorage.ts
│   │   ├── webStorage.ts      # localStorage/sessionStorage 共用的 Storage 适配
│   │   └── memory.ts
│   ├── utils.ts          # isRegion / normalizeLocale / detectNavigatorLocale
│   └── types.ts
├── test/
│   ├── utils.test.ts
│   ├── cookie.test.ts
│   ├── localStorage.test.ts
│   ├── sessionStorage.test.ts
│   ├── async-adapter.test.ts
│   ├── sync-writes.test.ts
│   ├── getLocale.test.ts
│   └── setLocale.test.ts
└── README.md
```

### 7.2 `package.json` 关键字段
```json
{
  "name": "locale-pref",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./utils": {
      "types": "./dist/utils.d.ts",
      "import": "./dist/utils.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "engines": { "node": ">=20.19.0" }
}
```
- 纯 ESM，不输出 CJS。
- `sideEffects: false` 保证 tree-shaking。
- `engines` 下限设为 20.19.0。

### 7.3 构建
- 使用 `tsc` 直接输出 `dist/`，或 `tsup`/`unbuild` 打包。
- 必须同时输出 `.d.ts`。
- 不得引入任何运行时依赖。

---

## 8. 测试要求

使用 Vitest 或 Node.js 内置 `node:test`，覆盖以下用例：

### 8.1 `utils`
- `isRegion('zh-CN', 'CN') === true`
- `isRegion('zh-Hans-CN', 'CN') === true`
- `isRegion('zh', 'CN') === false`
- `isRegion('en-US', 'cn') === false`（大小写不敏感但地区不同）
- `isRegion('', 'CN') === false`
- `isRegion('invalid_tag!!', 'CN') === false`
- `normalizeLocale('zh-hans-cn') === 'zh-Hans-CN'`
- `normalizeLocale('') === null`
- `normalizeLocale('!!') === null`
- 运行时缺失 `Intl.Locale` → `normalizeLocale` / `isRegion` / `detectNavigatorLocale` 抛错，消息含 `Intl.Locale`（见 §6.4）。
- 缺失 `globalThis` 时 `detectNavigatorLocale` 经 `self` / `window` 读取 `navigator`（见 §6.4）。

### 8.2 `getLocale` 回退链
- 存储命中合法值 → 返回该值，不回退。
- 存储为空 → 回退到 `navigator.languages[0]`（mock `globalThis.navigator`）。
- 存储值非法 + `normalize: true` → 跳过，继续回退。
- 存储值非法 + `normalize: false` → 原样返回（需测试此路径）。
- `navigator` 不存在 → 回退到 `fallback` 中的固定字符串。
- 全部失败 → 返回 `defaultLocale`。
- `defaultLocale` 非法 + `normalize: true` → 返回 `'en'`。
- 适配器 `get` 抛错 → 回退继续，`onError` 被调用一次，`context === 'storage'`。
- 运行时缺失 `Intl.Locale` + `normalize: true` → 抛错；+ `normalize: false` → 正常回退（见 §6.4）。

### 8.3 `getLocaleSync`
- 同步适配器 → 返回与 `getLocale` 一致的结果。
- 异步适配器（`isSync` 未设置）→ 抛 `Error`，消息匹配 `getLocaleSync() requires a synchronous storage adapter`。

### 8.4 `setLocale`
- 合法标签写入适配器，key 为 `storageKey`。
- `normalize: true` 时写入规范化后的值。
- 非法标签 → 抛 `RangeError`。
- `normalize: false` 时非法标签原样写入（需测试此路径）。

### 8.4.1 同步方法（`sync-writes`）
- `setLocaleSync` / `clearLocaleSync` / `isCurrentRegionSync` 返回 `void` / `boolean`，且立即生效。
- 与异步版本同校验（`RangeError`）、同写入（`storageSetOptions` 透传）。
- 同步适配器 `set` / `remove` 抛错 → 同步方法直接 `throw`。
- 非同步适配器 → 抛 `Error`，消息含对应方法名（`setLocaleSync()` / `clearLocaleSync()` / `isCurrentRegionSync()`）。
- 整条同步流程不产生任何 `Promise`。

### 8.5 `cookieAdapter`
- 浏览器环境（mock `document.cookie`）读写往返。
- Node 环境读取 `cookieString`。
- Node 环境写入抛错。
- 删除写入 `max-age=0`。
- 值包含特殊字符（`;`、`=`、中文）时编码正确。
- `sameSite`/`secure`/`domain` 按参数拼接。

### 8.6 `localStorageAdapter`
- 无 `localStorage` 且未传 `storage` → 创建时抛错。
- 传入 mock `Storage` → 读写往返。
- 忽略 `StorageSetOptions`。

### 8.7 `sessionStorageAdapter`
- 无 `sessionStorage` 且未传 `storage` → 创建时抛错（消息含 `sessionStorage`）。
- 传入 mock `Storage` → 读写往返。
- 忽略 `StorageSetOptions`；`isSync: true`；异常原样抛出。

### 8.8 异步适配器
- 全异步适配器（无 `isSync`）：`getLocale` 解析出存储值。
- `setLocale` 等待写入完成，后续 `getLocale` 能读到新值。
- `clearLocale` 等待删除完成。
- `isCurrentRegion` 基于异步 `getLocale` 正确判断。
- `storage.get` reject → 以 `'storage'` 调用 `onError` 并继续回退。
- `storage.set` / `storage.remove` reject → `setLocale` / `clearLocale` 的 Promise reject。
- 无 `isSync` 的适配器调用 `getLocaleSync()` → 抛错。

### 8.9 边界
- `createLocalePref({ fallback: [] })` 合法，回退直接到 `defaultLocale`。
- `createLocalePref({ storage: 'not-an-object' })` → `TypeError`；`storage` 为缺少 `get`/`set`/`remove` 的对象同样 → `TypeError`。
- `createLocalePref({ fallback: [123] })` → `TypeError`；`createLocalePref({ storageKey: '' })` / `{ defaultLocale: '' }` → `TypeError`。
- 创建后修改传入的 `fallback` 数组不影响实例行为。
- `storageKey` 含特殊字符（如 `a.b`）在 cookie 中正确存取。

---

## 9. README 必备内容

1. 安装与基本用法。**同步 API 优先**：开头与快速开始先用 `getLocaleSync()` / `setLocaleSync()`（内置适配器均为同步），再单列一节介绍异步后端（`await` 用法）。顺序为 Cookie / localStorage / 异步后端 / SSR 四个示例。
2. API 参考（本文档第 3 节精简版）。实例方法按「同步在前、异步在后」排列，并各自标注可用条件。
3. **`isRegion` 语义说明**（第 6.3 节内容，必须显式写出“不用于推断用户位置”）。
4. `getLocaleSync` / `setLocaleSync` / `clearLocaleSync` / `isCurrentRegionSync` 的限制说明（仅同步适配器，及为何提供同步方法）。
5. `cookieAdapter` 在 Node 环境只读的说明。
6. 自定义适配器示例（含**异步适配器**的完整语义：何时 `await`、`get` reject 不抛/`set`·`remove` reject 传播、`*Sync` 方法抛错，以及误标 `isSync` 的陷阱）。
7. 浏览器兼容性说明（依赖 `Intl.Locale`，列出精确版本下限、polyfill 名称与引入方式、缺失时的抛错行为，见 §6.4）。
8. `getDefaultLocalePref` 说明（惰性单例、等价于无参 `createLocalePref()`，并显式写出**多租户 SSR 不得使用**的理由，见 §3.1.1）。
9. 内置适配器一览：`cookieAdapter` / `localStorageAdapter` / `sessionStorageAdapter` / `memoryAdapter`，并说明 `sessionStorage` 为「仅本次会话」语义、不自动纳入回退链。

---

## 10. 验收标准

实现完成后需满足：

- [ ] `pnpm build` 产出 `dist/index.js`、`dist/utils.js` 及对应 `.d.ts`。
- [ ] `pnpm test` 全部通过，覆盖率 ≥ 90%（行覆盖）。
- [ ] 无任何 `dependencies`；`devDependencies` 仅含构建与测试工具。
- [ ] `package.json` 的 `exports` 字段正确，`import { createLocalePref } from 'locale-pref'` 与 `import { isRegion } from 'locale-pref/utils'` 均可解析。
- [ ] README 包含第 9 节全部内容。
- [ ] 在 Node 20.19 与 22.x 下 `node --test` 或 Vitest 均通过。
- [ ] `isRegion` 对非法输入不抛错。
- [ ] `getLocaleSync` 对异步适配器抛错且消息准确。
- [ ] 运行时缺失 `Intl.Locale` 时 `isRegion` / `normalizeLocale` / `detectNavigatorLocale` 抛错，消息含修复指引（见 §6.4）。
- [ ] 缺失 `globalThis` 时 `detectNavigatorLocale` / `localStorageAdapter` 仍可经 `self` / `window` 工作（见 §6.4）。
- [ ] 库产物不含任何 polyfill；`sideEffects: false` 保持不变。

---

## 11. 实现优先级建议

1. `utils.ts`（`isRegion` / `normalizeLocale` / `detectNavigatorLocale`）+ 单测。
2. `memoryAdapter` + `StorageAdapter` 类型。
3. `createLocalePref` 的 `getLocale` / `setLocale` / `clearLocale` + 单测。
4. `cookieAdapter`（浏览器 + Node 双路径）+ 单测。
5. `localStorageAdapter` + 单测。
6. `getLocaleSync` 与 `isCurrentRegion`。
7. 构建配置、`exports`、README。
8. 覆盖率补全与验收清单核对。

---
