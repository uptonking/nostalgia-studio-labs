/**
 * Objects with this shape respresent a recorded data mutation that took place at some time, on some node, as specified
 * by the Hybrid Logical Clock timestamp (`hlcTime`). When shared with another node, it should be possible to identify
 * the affected object store (and object if it exists), and apply the same mutation (i.e., re-create the operation).
 *
 * The value of the `objectKey` prop should include everything needed to create a minimal version of the object (i.e.,
 * it should be possible to call `store.add(objectKey)` without an error). This is because the first time Node A
 * encounters an oplog entry received from Node B, Node A needs to be able to call `store.add({ ...objectKey, [prop]:
 * value }`.
 * Do really understand why oplog entries are shaped the way they are, it's helpful to walk through an example of how
 * they would be used to re-create objects in a store.
 *
 * Assume the following stores exist in an app:
 *
 * @example
 * ```
 * db.createStore('books', { keyPath ['author', 'title'] }
 * db.createStore('orders') // NO keyPath!
 * db.createStore('settings') // NO keyPath!
 * ```
 *
 * Then say we have the following oplog entries:
 *
 * @example
 * ```
 * const oplogEntries = [{
 *   hlcTime: ...,
 *   store: 'books',
 *   objectKey: ['Gary Squarepants', 'In a Pineapple: a Meowmoir'],
 *   prop: 'priceUSD',
 *   value: '8.50'
 * }, {
 *   hlcTime: ...,
 *   store: 'books',
 *   objectKey: ['Gary Squarepants', 'In a Pineapple: a Meowmoir'],
 *   prop: 'type',
 *   value: 'paperback'
 * }, {
 *   hlcTime: ...,
 *   store: 'orders',
 *   objectKey: 'order123',
 *   prop: 'customer',
 *   value: 'S. Robert Squarepants'
 * }, {
 *   hlcTime: ...,
 *   store: 'orders',
 *   objectKey: 'order123',
 *   prop: 'book',
 *   value: ['Gary Squarepants', 'In a Pineapple: a Meowmoir']
 * }, {
 *   hlcTime: ...,
 *   store: 'settings',
 *   objectKey: 'appBackgroundColor',
 *   prop: '',
 *   value: 'rebeccapurple'
 * }, {
 *   hlcTime: ...,
 *   store: 'settings',
 *   objectKey: 'appBaseFontSize',
 *   prop: '',
 *   value: 12
 * }];
 * ```
 *
 * We need to be able to use these oplog entries to rebuild stores that end up looking (conceptually) like this:
 *
 * @example
 * ```
 * // Remember: keyPath = ['author', 'title']
 * const bookStore = [{
 *   author: 'Gary Squarepants',
 *   title: 'In a Pineapple: a Meowmoir',
 *   type: 'paperback',
 *   priceUSD: '8.50'
 * }]
 *
 * // Remember: NO keyPath
 * const ordersStore = {
 *   order123: {
 *     customer: 'S. Robert Squarepants',
 *     book: ['Gary Squarepants', 'In a Pineapple: a Meowmoir']
 *   }
 * }
 *
 * // Remember: NO keyPath
 * const settingsStore = {
 *   appBackgroundColor: 'rebeccapurple',
 *   appBaseFontSize: 12
 * }
 * ```
 *
 * Then we might use a (pseudo-code-ish) process like the following to rebuild the stores from the oplog entries:
 *
 * @example
 * ```
 * for (const operation in opLogEntries) {
 *   store = getStore(operation.store);
 *
 *   if (prop === '') {
 *     // If the prop is an empty string it means that, even if there's an existing value, it's not an object so we
 *     // don't need to A) worry about merging the new prop/value with an existing object, or B) worry about needing
 *     // to make sure the object we pass to `store.put()` has the key props set--we can assume that we'll need to pass
 *     // in a key parameter.
 *     store.put(operation.value, operation.objectKey);
 *   } else if (store.keyPath) {
 *     // We're setting a property on an object and the store has a keyPath so we're going to be calling store.put(obj)
 *     // where `obj` will need to include A) all the props specified by the keyPath, and B) be merged with any existing
 *     // object.
 *     let objKeys = {};
 *     if (Array.isArray(store.keyPath)) {
 *       for (let i = 0; i < store.keyPath.length; i++) {
 *         const keyName = store.keyPath[i];
 *         const keyValue = operation.objectKey[i];
 *         objKeys[keyName] = keyValue;
 *       }
 *     } else {
 *       objKeys[store.keyPath] = operation.objectKey;
 *     }
 *     const existingObj = store.get(objectKey) || {}; // Definitely pseduo-code for getting the existing object here.
 *     store.put({ ...existingObj, ...objKeys, [operation.prop]: operation.value })
 *   } else {
 *     // We're setting a prop on an object, and the store does NOT have a keyPath, so we'll need to call
 *     // `put(obj, keyPath)` where `obj` has merged the new prop/value with any existing object.
 *     const existingObj = store.get(objectKey) || {}; // Definitely pseduo-code for getting the existing object here.
 *     store.put({ ...existingObj, [operation.prop]: operation.value }, operation.objectKey)
 *   }
 *
 * }
 * ```
 */

/** data operation log，用来更新本地业务数据对象，也可用来同步恢复 */
export interface OpLogEntry {
  clientId: string;
  hlcTime: string;
  /** 类似关系数据库的表名 */
  store: string;
  /** objectStore的keyPath的值作为key，OpLogEntry的objectKey值的各项作为对应的value */
  objectKey: number | string | Date | Array<number | string | Date>;
  /** 属性名称 */
  prop: string;
  /** 属性值 */
  value: unknown;
}

export interface UserProfile {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
}

// export type SyncProfileSettings = Record<string, unknown>;
/** 云端同步相关元数据 */
export type SyncProfileSettings = {
  remoteFolderName?: string;
  remoteFolderId?: string;
  remoteFolderLink?: string;
  mostRecentUploadedEntryTime?: number;
};

export type SignInChangeHandler = (
  userProfile: UserProfile | null,
  settings: SyncProfileSettings,
) => void;

export interface ClientRecord {
  clientId: string;
  data: unknown;
}

export interface SyncProfile {
  pluginId: string;
  userProfile: UserProfile;
  settings: SyncProfileSettings;
}

export interface Settings {
  nodeId: string;
  syncProfiles: SyncProfile[];
}

/** 同步数据插件需要的功能，插件会在首次render后执行，触发在setupSync() */
export interface SyncPlugin {
  getPluginId(): string;

  /** 引入云端账户登录相关sdk，可通过动态创建script标签来实现，此处不触发登录 */
  load(): Promise<void>;
  isLoaded(): boolean;

  /** 触发用户登录插件帐号 */
  signIn(): Promise<void>;
  signOut(): void;
  isSignedIn(): boolean;

  /** 暴露给外部注册监听器，让外部能拿到插件账户相关信息 */
  addSignInChangeListener(handlerFcn: SignInChangeHandler): void;

  /** 云端同步相关元数据 */
  getSettings(): SyncProfileSettings;
  setSettings(settings: SyncProfileSettings): void;

  /** 获取本地最新上传时间，更好的方式是通过查询云端得到，是物理时间的Date对象 */
  getMostRecentUploadedEntryTime(): Promise<Date>;

  /** 从云端获取afterTime时间之后的op记录及内容*/
  getRemoteEntries: (params: {
    clientId: string;
    afterTime?: Date | null;
  }) => AsyncGenerator<OpLogEntry, void, void>;

  /** 上传本地op记录数据到云端的入口，可定制实现细节 */
  saveRemoteEntry: (params: {
    time: Date;
    counter: number;
    clientId: string;
    entry: OpLogEntry;
    overwriteExisting?: boolean;
  }) => Promise<{ numUploaded: number }>;

  /** 从云端查询符合clientId的记录列表，然后获取各记录内容 */
  getRemoteClientRecords: (filter: {
    includeClientIds?: string[];
    excludeClientIds?: string[];
  }) => AsyncGenerator<ClientRecord, void, void>;

  /** 根据名称检查云端是否存在客户端id文件，若不存在或强制覆盖就创建该文件，本方法并未实际上传数据 */
  saveRemoteClientRecord(
    clientId: string,
    options?: { overwriteIfExists?: boolean },
  ): Promise<void>;
}
