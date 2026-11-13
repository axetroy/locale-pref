# locale-pref 设计白皮书

> 版本：1.0
> 状态：待实现
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
- 对非法选项值（如 `storage` 不是对象、`fallback` 不是数组）应抛出 `TypeError`，并在消息中指明字段名。

### 3.2 实例接口

```typescript
interface LocalePref {
  getLocale(): Promise<string>;
  getLocaleSync(): string;
  setLocale(locale: string): Promise<void>;
  clearLocale(): Promise<void>;
  isRegion(locale: string, region: string): boolean;
  isCurrentRegion(region: string): Promise<boolean>;
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

#### 3.2.2 `getLocaleSync(): string`
- 仅当适配器是同步适配器时可用。
- 检测方式：适配器实例带 `isSync: true` 标志（内置同步适配器均设置此标志；自定义适配器可选实现）。
- 若适配器非同步，抛出 `Error`，消息为 `"getLocaleSync() requires a synchronous storage adapter"`。
- 回退逻辑与 `getLocale` 一致。

#### 3.2.3 `setLocale(locale: string): Promise<void>`
- 若 `normalize: true` 且 `normalizeLocale(locale)` 为 `null`，抛出 `RangeError`，消息包含非法标签。
- 写入 `storage.set(storageKey, normalizedLocale, storageSetOptions)`。
- 返回适配器的 Promise（或同步结果包装为 resolved Promise）。

#### 3.2.4 `clearLocale(): Promise<void>`
- 调用 `storage.remove(storageKey)`。

#### 3.2.5 `isRegion(locale: string, region: string): boolean`
- 实现见第 6 节。
- 非法 `locale` 或 `region` 返回 `false`，不抛错。
- 大小写不敏感比较。

#### 3.2.6 `isCurrentRegion(region: string): Promise<boolean>`
- 等价于 `isRegion(await this.getLocale(), region)`。

#### 3.2.7 `normalizeLocale(locale: string): string | null`
- 实现见第 6 节。

#### 3.2.8 `storage`
- 只读属性，返回创建实例时使用的适配器。

### 3.3 存储适配器接口

```typescript
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string, options?: StorageSetOptions): void | Promise<void>;
  remove(key: string): void | Promise<void>;
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
- **删除**：写入同名 cookie，`max-age=0`，其余属性（path/domain）与写入一致。
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

### 4.3 `memoryAdapter`

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
function normalizeLocale(locale: string): string | null;
function detectNavigatorLocale(): string | null;
```

### 5.1 `detectNavigatorLocale`
- `navigator` 不存在或 `navigator.languages` 非数组/为空 → 返回 `null`。
- 遍历 `navigator.languages`，返回第一个 `normalizeLocale` 非 `null` 的值。
- 不读取 `navigator.language` 作为额外来源（`languages` 已覆盖，且 `language` 是 `languages[0]` 的历史别名）。

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

---

## 7. 目录结构与打包

### 7.1 建议目录
```
locale-pref/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # createLocalePref + 适配器导出
│   ├── adapters/
│   │   ├── cookie.ts
│   │   ├── localStorage.ts
│   │   └── memory.ts
│   ├── utils.ts          # isRegion / normalizeLocale / detectNavigatorLocale
│   └── types.ts
├── test/
│   ├── utils.test.ts
│   ├── cookie.test.ts
│   ├── localStorage.test.ts
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

### 8.2 `getLocale` 回退链
- 存储命中合法值 → 返回该值，不回退。
- 存储为空 → 回退到 `navigator.languages[0]`（mock `globalThis.navigator`）。
- 存储值非法 + `normalize: true` → 跳过，继续回退。
- 存储值非法 + `normalize: false` → 原样返回（需测试此路径）。
- `navigator` 不存在 → 回退到 `fallback` 中的固定字符串。
- 全部失败 → 返回 `defaultLocale`。
- `defaultLocale` 非法 + `normalize: true` → 返回 `'en'`。
- 适配器 `get` 抛错 → 回退继续，`onError` 被调用一次，`context === 'storage'`。

### 8.3 `getLocaleSync`
- 同步适配器 → 返回与 `getLocale` 一致的结果。
- 异步适配器（`isSync` 未设置）→ 抛 `Error`，消息匹配 `getLocaleSync() requires a synchronous storage adapter`。

### 8.4 `setLocale`
- 合法标签写入适配器，key 为 `storageKey`。
- `normalize: true` 时写入规范化后的值。
- 非法标签 → 抛 `RangeError`。
- `normalize: false` 时非法标签原样写入（需测试此路径）。

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

### 8.7 边界
- `createLocalePref({ fallback: [] })` 合法，回退直接到 `defaultLocale`。
- `createLocalePref({ storage: 'not-an-object' })` → `TypeError`。
- `storageKey` 含特殊字符（如 `a.b`）在 cookie 中正确存取。

---

## 9. README 必备内容

1. 安装与基本用法（Cookie / localStorage / SSR 三个示例）。
2. API 参考（本文档第 3 节精简版）。
3. **`isRegion` 语义说明**（第 6.3 节内容，必须显式写出“不用于推断用户位置”）。
4. `getLocaleSync` 的限制说明。
5. `cookieAdapter` 在 Node 环境只读的说明。
6. 自定义适配器示例。
7. 浏览器兼容性说明（依赖 `Intl.Locale`，现代浏览器与 Node 20+ 原生支持）。

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
