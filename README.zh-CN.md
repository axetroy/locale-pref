# locale-pref

[English](./README.md) | **简体中文**

零依赖的语言偏好工具库，适用于 JavaScript 与 TypeScript。

`locale-pref` 只回答三个问题，不多做任何事：

1. **用户想要什么语言？** 从可插拔的存储后端读取，并按可配置的回退链依次尝试。
2. **记住用户的选择。** 将语言标签持久化到 cookie、`localStorage` 或自定义后端。
3. **这个标签属于某个地区吗？** 使用 `Intl.Locale` 匹配 BCP 47 标签中的地区子标签。

它是纯 ESM、零运行时依赖，同时支持浏览器与 Node.js（含 SSR）。

## 安装

```sh
npm install locale-pref
# pnpm add locale-pref
# yarn add locale-pref
```

## 快速开始

### 浏览器 + Cookie

```ts
import { createLocalePref } from 'locale-pref';

const pref = createLocalePref();

const locale = await pref.getLocale(); // 例如 'zh-CN'
await pref.setLocale('en-US'); // 写入 cookie，下次请求即可读取
```

默认适配器是 `cookieAdapter()`，当服务端在渲染时需要知道语言时，这是最合适的选择。

### 浏览器 + `localStorage`

```ts
import { createLocalePref, localStorageAdapter } from 'locale-pref';

const pref = createLocalePref({
  storage: localStorageAdapter(),
  storageKey: 'lang',
  fallback: ['navigator', 'en'],
  defaultLocale: 'en',
});

const locale = await pref.getLocale();
await pref.setLocale('fr-CA');
```

### 服务端渲染（SSR）

服务端没有 `document`，也没有 `navigator`，因此把请求头中的 `Cookie` 传给只读适配器。先解析出语言，再渲染。

```ts
import { createLocalePref, cookieAdapter } from 'locale-pref';

// Express：`req.headers.cookie` 存放原始 Cookie 请求头。
export function resolveRequestLocale(cookieHeader: string | undefined): string {
  const pref = createLocalePref({
    storage: cookieAdapter({ cookieString: cookieHeader }),
    fallback: ['en'],
    defaultLocale: 'en',
  });
  return pref.getLocaleSync(); // 同步读取，无需 await
}
```

要修改语言，请在你自己的响应处理中写入 cookie（`Set-Cookie`）——该适配器在服务端是只读的。参见
[`cookieAdapter` 在 Node.js 中只读](#cookieadapter-在-nodejs-中只读)。

## API 参考

### `createLocalePref(options?): LocalePref`

创建一个语言偏好实例。所有选项都有默认值，因此可以不传参数直接调用。

| 选项                | 类型                           | 默认值            | 说明                                |
| ------------------- | ------------------------------ | ----------------- | ----------------------------------- |
| `storage`           | `StorageAdapter`               | `cookieAdapter()` | 语言存储的位置。                    |
| `storageKey`        | `string`                       | `'user_locale'`   | 存储后端中使用的 key。              |
| `fallback`          | `Array<'navigator' \| string>` | `['navigator']`   | 存储未命中时依次尝试的来源。        |
| `defaultLocale`     | `string`                       | `'en'`            | 最终兜底语言。                      |
| `storageSetOptions` | `StorageSetOptions`            | —                 | 传给 `storage.set` 的默认参数。     |
| `normalize`         | `boolean`                      | `true`            | 是否校验并规范化语言标签。          |
| `onError`           | `(error, context) => void`     | 静默              | 存储或 `navigator` 读取异常时触发。 |

`fallback` 中的 `'navigator'` 是保留字：它读取 `navigator.languages`。其他字符串视为固定的 locale 候选。非法的选项值会抛出 `TypeError`，并在消息中指明字段名。

### `getDefaultLocalePref(): LocalePref`

返回一个**惰性创建、进程级共享**的实例，等价于无参的 `createLocalePref()`（Cookie 存储、`'navigator'` 回退、默认 `'en'`、key 为 `'user_locale'`）。它在首次调用时才创建，因此单纯 `import` 本包没有副作用。

```ts
import { getDefaultLocalePref } from 'locale-pref';

const pref = getDefaultLocalePref(); // 每次调用都是同一个实例
await pref.setLocale('zh-CN');
```

当默认配置就够用、且你希望全应用共享一个实例时（例如只在浏览器里读写语言 Cookie 的应用），可以用它。

**多租户 SSR 服务端不要用它。** 该实例的生命周期是整个进程，且始终读取 `'user_locale'` 这个 Cookie，某个请求读到的语言会泄漏到其他所有请求。服务端请改用按请求创建的实例：`createLocalePref({ storage: cookieAdapter({ cookieString }) })`（见 [服务端渲染（SSR）](#服务端渲染ssr)）。同理，当应用中有两处会争抢同一个 `'user_locale'` key 时，也应避免使用它。

### `LocalePref` 实例

```ts
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

#### `getLocale(): Promise<string>`

按回退链顺序返回第一个合法的语言标签：

1. `storage.get(storageKey)`，若非空且合法（或可规范化）则返回。
2. 依次遍历 `fallback`：
   - `'navigator'` 读取 `navigator.languages`，返回第一个合法标签。
   - 其他字符串若合法则返回。
3. `defaultLocale`。

当 `normalize` 为 `true` 时，每个候选值都会经过 `normalizeLocale`；返回 `null` 视为未命中，继续回退。若最终的 `defaultLocale` 非法，则返回 `'en'`。若适配器的 `get` 抛错，错误会被捕获，并以 `context === 'storage'` 上报给 `onError`，然后继续回退。

#### `getLocaleSync(): string`

解析逻辑与 `getLocale` 相同，只是不带 `Promise`。仅可用于同步适配器。参见[限制说明](#getlocalesync-需要同步适配器)。

#### `setLocale(locale: string): Promise<void>`

持久化语言。当 `normalize` 为 `true` 时，标签会先被规范化，非法标签会抛出 `RangeError`。写入方式为
`storage.set(storageKey, value, storageSetOptions)`。

#### `setLocaleSync(locale: string): void`

`setLocale` 的同步版本：校验与 `storage.set(...)` 调用完全相同，但不返回任何值，失败时直接抛错而非 reject。仅可用于同步适配器。参见[同步适配器的写入](#同步适配器会让写入也变同步吗)。

#### `clearLocale(): Promise<void>`

移除已存储的语言（`storage.remove(storageKey)`），因此下一次 `getLocale()` 会重新走一遍回退链。

#### `clearLocaleSync(): void`

`clearLocale` 的同步版本。仅可用于同步适配器。

#### `isRegion(locale: string, region: string): boolean`

返回语言标签是否携带指定的地区子标签。永不抛错：非法输入返回 `false`。比较不区分大小写。参见 [`isRegion` 语义](#isregion-语义)。

#### `isCurrentRegion(region: string): Promise<boolean>`

等价于 `isRegion(await getLocale(), region)`。

#### `isCurrentRegionSync(region: string): boolean`

等价于 `isRegion(getLocaleSync(), region)`。仅可用于同步适配器。

#### `normalizeLocale(locale: string): string | null`

规范化语言标签（见[工具函数](#工具函数)）。非法输入返回 `null`。

#### `storage`

实例创建时使用的只读适配器。

### 工具函数

这些函数同样从 `locale-pref/utils` 子路径导出，可以单独导入而不引入工厂函数，从而保持包体积精简：

```ts
import { detectNavigatorLocale, isRegion, normalizeLocale } from 'locale-pref/utils';
```

- **`normalizeLocale(locale)`** — 通过 `Intl.Locale.prototype.toString()` 返回规范的 BCP 47 标签
  （`'zh-hans-cn'` → `'zh-Hans-CN'`），空串、纯空白或非法输入返回 `null`。
- **`isRegion(locale, region)`** — 见[下文](#isregion-语义)。
- **`detectNavigatorLocale()`** — 返回 `navigator.languages` 中第一个合法项，当 `navigator` 不存在、`languages` 不是非空数组、或没有合法项时返回 `null`。它刻意不读取
  `navigator.language`，后者是 `navigator.languages[0]` 的历史别名。

### `isRegion` 语义

`isRegion` 判断的是**语言标签本身是否携带该地区子标签**。它**不用于推断用户物理位置**，也不等同于 `Accept-Language` 的地区含义。请勿用它做位置判断、货币或时区决策。

没有地区子标签的标签对任何 `region` 都返回 `false`：

```ts
import { isRegion } from 'locale-pref';

isRegion('zh-CN', 'CN'); // true
isRegion('zh-Hans-CN', 'CN'); // true
isRegion('zh', 'CN'); // false —— 没有地区子标签
isRegion('en-US', 'CN'); // false
isRegion('en-US', 'us'); // true —— 不区分大小写
isRegion('not a tag!!', 'CN'); // false —— 永不抛错
```

### `getLocaleSync` 需要同步适配器

`getLocaleSync` 只能用于设置了 `isSync: true` 的适配器。内置的 `cookieAdapter`、`localStorageAdapter`、`sessionStorageAdapter` 和 `memoryAdapter` 都满足该条件。对异步适配器（未设置 `isSync`）调用它会抛出：

```
Error: getLocaleSync() requires a synchronous storage adapter
```

如果你的适配器可以同步实现，请设置 `isSync: true`；否则请使用 `getLocale()`。

### 同步适配器会让写入也变同步吗？

会——正因为好几个内置适配器是同步的，库提供了对应的同步方法，让整条同步流程保持同步：`getLocaleSync()` 读取，`setLocaleSync()` 与 `clearLocaleSync()` 写入，`isCurrentRegionSync()` 判断当前地区：

```ts
const pref = createLocalePref({ storage: memoryAdapter() });

pref.setLocaleSync('zh-CN'); // 返回 void，失败时抛错
pref.getLocaleSync(); // 'zh-CN'
pref.isCurrentRegionSync('CN'); // true
pref.clearLocaleSync();
```

每个 `*Sync` 方法都要求同步适配器（`isSync: true`），否则抛错，与 `getLocaleSync` 一致：

```
Error: setLocaleSync() requires a synchronous storage adapter
```

**为什么需要这些同步方法。** 返回 `Promise` 的方法仍是默认选择，配合异步适配器时也仍然正确。但当整条流程本就是同步的时候，悬空的 `Promise` 就是噪音：TypeScript 和 `@typescript-eslint/no-floating-promises`（`recommendedTypeChecked` 的一部分）会要求你 `await` 它，或用 `void` 显式忽略——尽管写入其实早已完成。而且 `await` 具有传染性——它会把所在函数变成 `async`——于是调用 `setLocale()` 的同步回调无法保持同步。`*Sync` 方法返回 `void`，无需 `await` 也无需 `void`，失败就是普通的 `throw`，用 `try`/`catch` 即可。

配合异步适配器、或希望同步/异步适配器共用同一条代码路径时，请用 `setLocale()` / `clearLocale()`；当适配器与周边代码都是同步的时候，请用 `*Sync` 方法。

### `cookieAdapter` 在 Node.js 中只读

在浏览器中，`cookieAdapter` 读写 `document.cookie`。在服务端，它读取你传入的 `cookieString`，并在写入时**抛错**：

```
Error: cookieAdapter is read-only in Node.js environment
```

这是有意为之：cookie 属于 HTTP 响应，服务端应自行设置。请用解析出的语言进行渲染，并在你的框架中输出 `Set-Cookie`。

## 存储适配器

### `cookieAdapter(options?)`

| 选项            | 默认值     | 说明                                   |
| --------------- | ---------- | -------------------------------------- |
| `cookieString`  | —          | 在浏览器之外用于读取的 Cookie 请求头。 |
| `defaultPath`   | `'/'`      | 默认 cookie 路径。                     |
| `defaultMaxAge` | `31536000` | 默认 cookie 有效期（秒，即一年）。     |

写入格式为 `key=encodeURIComponent(value); path=…; max-age=…; SameSite=…`，仅当传入 `secure: true` 时才添加 `Secure`。`remove` 会写入同样的 cookie，但 `max-age=0`。`isSync: true`。

### `localStorageAdapter(options?)`

默认使用 `globalThis.localStorage`。若未传入存储对象且环境没有 `localStorage`，则在创建时抛错。`set` 会忽略 `StorageSetOptions`。`isSync: true`。

### `sessionStorageAdapter(options?)`

形态与 `localStorageAdapter` 相同，默认基于 `globalThis.sessionStorage`（也可传入自己的 `storage`）。不可用时在创建时抛错。`isSync: true`。

`sessionStorage` 的作用域是当前标签页，关闭标签页即清空：适合「仅本次会话生效」的临时覆盖，但**不适合**作为用户的持久偏好。该适配器只是普通的同步适配器，回退链**不会**自动去读它，因此要显式选择行为。常见做法是在持久 Cookie 之上叠加会话覆盖，用一个小型自定义适配器实现：

```ts
import { createLocalePref, cookieAdapter, sessionStorageAdapter, type StorageAdapter } from 'locale-pref';

const durable = cookieAdapter();
const session = sessionStorageAdapter();

// 会话值优先；标签页内没有时回退到持久 Cookie。
const storage: StorageAdapter = {
  isSync: true,
  get: (key) => session.get(key) ?? durable.get(key),
  set: (key, value, options) => {
    session.set(key, value);
    durable.set(key, value, options);
  },
  remove: (key) => {
    session.remove(key);
    durable.remove(key);
  },
};

const pref = createLocalePref({ storage, fallback: ['en'], defaultLocale: 'en' });
```

### `memoryAdapter(initial?)`

基于 `Map` 的适配器，用于测试和短生命周期 Node 进程。可用 `memoryAdapter({ user_locale: 'zh-CN' })` 预置数据。`isSync: true`。

### 编写自定义适配器

实现 `StorageAdapter` 即可。方法可以是同步或异步的。

```ts
import { createLocalePref, type StorageAdapter } from 'locale-pref';

const redisAdapter: StorageAdapter = {
  async get(key) {
    return (await client.get(key)) ?? null;
  },
  async set(key, value) {
    await client.set(key, value);
  },
  async remove(key) {
    await client.del(key);
  },
};

const pref = createLocalePref({ storage: redisAdapter, storageKey: 'locale' });
```

对于同步后端（例如服务端框架中的 cookie），加上 `isSync: true` 即可启用 `getLocaleSync`。

### 异步适配器的处理方式

异步是一等公民，而非事后补丁。当适配器**未设置 `isSync`**（或设为 `false`）且方法返回 Promise 时，它就是异步适配器。

| 调用                | 异步适配器下的行为                                                         |
| ------------------- | -------------------------------------------------------------------------- |
| `getLocale()`       | 等待 `storage.get`。                                                       |
| `setLocale()`       | 等待 `storage.set` 完成后才 resolve。                                      |
| `clearLocale()`     | 等待 `storage.remove` 完成后才 resolve。                                   |
| `isCurrentRegion()` | 等待内部的 `getLocale()`。                                                 |
| `getLocaleSync()`   | **抛错** `Error: getLocaleSync() requires a synchronous storage adapter`。 |

可依赖的三条规则：

- **`get` 的 reject 不会向上抛。** `storage.get` 抛错或被 reject 时，会以 `context: 'storage'` 传给 `onError`，并继续回退链，行为与同步适配器抛错一致。
- **`set` / `remove` 的 reject 会向上传播。** 写入或删除失败会让返回的 Promise reject，便于重试或上报；库不会吞掉它。
- **`getLocaleSync()` 不可用。** 异步后端没有同步逃生口，请改用 `getLocale()` 并 `await`。只有当方法确实同步返回时才设 `isSync: true`；若给异步适配器设了它，`getLocaleSync()` 会把 `Promise` 当成 `string` 处理，结果把存储值判为未命中，静默回退到回退链，而不是返回已存的语言。

```ts
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string, options?: StorageSetOptions): void | Promise<void>;
  remove(key: string): void | Promise<void>;
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

## 浏览器与运行时兼容性

`locale-pref` 是纯 ESM、零运行时依赖，只依赖一个平台 API：`Intl.Locale`。

| 运行时   | 支持情况                       |
| -------- | ------------------------------ |
| Node.js  | 20.19.0 及以上                 |
| Chrome   | 74 及以上                      |
| Firefox  | 75 及以上                      |
| Safari   | 14 及以上                      |
| Edge     | 79 及以上                      |
| 模块格式 | 仅 ESM（不提供 CommonJS 构建） |

CommonJS 使用方仍可通过动态 `import()` 加载本包。

库用到的其他 API 都比 `Intl.Locale` 老得多，不会成为限制：`navigator.languages`（Chrome 37 / Firefox 32 / Safari 10.1）、`Map`（Chrome 38）、`Promise`（Chrome 32）、`Object.entries`（Chrome 54），以及 `document.cookie` / `localStorage` / `sessionStorage`（所有浏览器）。`globalThis`（Chrome 71 / Firefox 65 / Safari 12.1）通过回退链解析（`globalThis` → `self` → `window`），因此即使缺失也不会致命。

### 用 polyfill 兼容更老的浏览器

要支持上表版本更低的浏览器，请引入 `Intl.Locale` polyfill。`locale-pref` **刻意不内置** polyfill：它本身是运行时依赖（会破坏零依赖承诺）、对多数用户并不需要，并且与 `sideEffects: false` 冲突。正确做法是在你自己的应用中、任何 `locale-pref` 调用之前加载它：

```js
// 应用入口，需早于任何 locale-pref 调用。
import '@formatjs/intl-locale/polyfill.js';
```

几个要点：

- **用真正的 polyfill，而不是简单的 shim。** [`@formatjs/intl-locale`](https://formatjs.github.io/docs/polyfills/intl-locale) 实现了完整的 `Intl.Locale`，本文示例即使用它。它是 polyfill/ponyfill，即使 API 已存在也可安全引入。
- **在每个环境中都先于 `locale-pref` 加载。** SSR 场景下服务端入口也要引入；否则服务端的 `getLocaleSync()` 会静默回退到 `defaultLocale`。
- **按你的目标浏览器降级。** 发布的 polyfill 与 `locale-pref` 产物都面向现代 JavaScript。请用你自己的 `browserslist` 通过打包器 / Babel 处理，使语法匹配目标浏览器。
- **`Intl.Locale` 是必需的。** 运行时若缺失，库会显式抛错，而不是静默降级。见下一节。

### 缺少 `Intl.Locale` 时会抛错

`locale-pref` 会检测 `Intl.Locale`，缺失时抛出带修复指引的 `Error`，而不是退化成错误结果：

```js
// 浏览器既没有 Intl.Locale 也没有 polyfill：
isRegion('zh-CN', 'CN');
// Error: locale-pref requires Intl.Locale, ... Add a polyfill such as
// @formatjs/intl-locale ..., or pass { normalize: false } ...
```

如果没有这层保护，`isRegion()` 会对任何输入都返回 `false`、`normalizeLocale()` 都返回 `null`，从而静默地把用户语言判断错。错误信息直接给出了修复方式。

在默认 `normalize: true` 下受影响的入口：

| 调用                              | 缺少 `Intl.Locale` 时    |
| --------------------------------- | ------------------------ |
| `normalizeLocale()`               | 抛错                     |
| `isRegion()`                      | 抛错                     |
| `getLocale()` / `getLocaleSync()` | 抛错（需要规范化标签）   |
| `setLocale()`                     | reject（需要规范化标签） |
| `clearLocale()`                   | 正常工作                 |

唯一的逃生口是 `normalize: false`。此时 `getLocale()` 与 `setLocale()` 可在没有 `Intl.Locale` 的情况下工作（跳过校验与规范化），但 `isRegion()` / `isCurrentRegion()` 仍然依赖它。

## 开发

```sh
pnpm install
pnpm run verify   # 格式化、lint、类型检查、带覆盖率的测试、构建、包校验
pnpm run test     # 运行一次测试
pnpm run test:watch
pnpm run build
```

项目使用 [Changesets](https://github.com/changesets/changesets) 管理版本。运行 `pnpm changeset` 描述变更；CI 会把待发布的 changeset 转成发布 PR，并在合并时通过
[可信发布](https://docs.npmjs.com/trusted-publishers) 发布到 npm。

## 许可证

[MIT](./LICENSE)
