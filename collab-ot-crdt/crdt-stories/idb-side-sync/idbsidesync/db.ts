import { type OpLogEntry, type Settings } from '../types/main';
import { HLClock } from './HLClock';
import { HLTime } from './HLTime';
import {
  LIB_NAME,
  debug,
  isEventWithTargetError,
  isValidSideSyncSettings,
  log,
  makeClientId,
  throwIfInvalidOpLogEntry,
} from './utils';

export const STORE_NAME = {
  META: 'IDBSideSync_MetaStore',
  OPLOG: 'IDBSideSync_OpLogStore',
} as const;
export const OPLOG_STORE = STORE_NAME.OPLOG;
export const META_STORE = STORE_NAME.META;
export const OPLOG_INDEX_BY_STORE_OBJKEY_PROP_TIME =
  'Indexed by: store, objectKey, prop, hlcTime';
export const OPLOG_INDEX_BY_CLIENTID_TIME = 'Indexed by: client ID, hlcTime';
export const CACHED_SETTINGS_OBJ_KEY = 'settings';
export const DEFAULT_ENTRY_PAGE_SIZE = 100;

// This is technically unnecessary, but a nice way to help make sure we're always referencing a valid OpLogEntry
// property name when defining a `keyPath` for the object store.
const OPLOG_ENTRY_HLC_TIME_PROP_NAME: keyof OpLogEntry = 'hlcTime';

/** 全局单例idb对象，从业务应用层直接传过来 */
let cachedDb: IDBDatabase;
/** 缓存idb中常访问且变化不多的设置项，避免多次读取idb数据库 */
let cachedSettings: Settings;

/** Allow IDBSideSync to initialize itself with the provided IndexedDB database.
 * - 将idb缓存到变量cachedDb
 * - 向idb写入全局设置信息，如clientId;
 * - 初始化逻辑时钟hlc
 */
export async function init(db: IDBDatabase): Promise<void> {
  debug && log.debug('init()');
  if (!db || !db.createObjectStore) {
    throw new TypeError(
      `${LIB_NAME}.init(): 'db' arg must be an instance of IDBDatabase.`,
    );
  }
  cachedDb = db;
  const settings = await initSettings(); // 向idb写入全局设置信息，如clientId
  HLClock.setTime(new HLTime(0, 0, settings.nodeId));
}

export function getSettings(): Settings {
  if (!cachedSettings) {
    throw new Error(
      `${LIB_NAME} hasn't been initialized. Please call init() first.`,
    );
  }
  return cachedSettings;
}

/** Ensures that IDBSideSync has required settings in its own IndexedDB store
 * (e.g., a unique node ID that identifies all the oplog entries created by the application instance).
 * - 向idb写入全局设置信息，如clientId
 */
export function initSettings(): Promise<typeof cachedSettings> {
  return new Promise((resolve, reject) => {
    const txReq = cachedDb.transaction([STORE_NAME.META], 'readwrite');
    txReq.onabort = () => reject(new TransactionAbortedError(txReq.error));
    txReq.onerror = (event) => {
      const error = isEventWithTargetError(event)
        ? event.target.error
        : txReq.error;
      log.error('Failed to init settings:', error);
      reject(new Error(`${LIB_NAME} Failed to init settings`));
    };

    const metaStore = txReq.objectStore(STORE_NAME.META);
    const getReq = metaStore.get(CACHED_SETTINGS_OBJ_KEY);

    getReq.onsuccess = () => {
      const result = getReq.result;
      if (result && isValidSideSyncSettings(result)) {
        debug &&
          log.debug(
            `Skipping settings initialization; existing settings found.`,
            result,
          );
        cachedSettings = result;
        resolve(cachedSettings);
      } else {
        debug &&
          log.debug(
            'No valid settings found in database; initializing new settings...',
          );
        // 👇🏻 初始化客户端id
        cachedSettings = { nodeId: makeClientId(), syncProfiles: [] };
        const putReq = metaStore.put(cachedSettings, CACHED_SETTINGS_OBJ_KEY);
        putReq.onsuccess = () => {
          debug &&
            log.debug('Successfully saved initial settings:', cachedSettings);
          resolve(cachedSettings);
        };
      }
    };
  });
}

export function saveSettings(newSettings: Settings): Promise<Settings> {
  return new Promise((resolve, reject) => {
    const txReq = cachedDb.transaction([STORE_NAME.META], 'readwrite');
    txReq.onabort = () => reject(new TransactionAbortedError(txReq.error));
    txReq.onerror = (event) => {
      const error = isEventWithTargetError(event)
        ? event.target.error
        : txReq.error;
      log.error('Failed to save settings:', error);
      reject(new Error(`${LIB_NAME} Failed to save settings`));
    };

    const metaStore = txReq.objectStore(STORE_NAME.META);
    const putReq = metaStore.put(newSettings, CACHED_SETTINGS_OBJ_KEY);
    putReq.onsuccess = () => {
      cachedSettings = newSettings;
      debug && log.debug('Successfully saved settings:', cachedSettings);
      resolve(cachedSettings);
    };
  });
}

/** 获取本地最新的一条op记录 */
export async function getMostRecentEntryForClient(
  clientId: string,
): Promise<OpLogEntry | null> {
  const entries = await getEntriesByClientPage(clientId, {
    newestFirst: true,
    page: 0,
    pageSize: 1,
  });
  return Promise.resolve(entries.length > 0 ? entries[0] : null);
}

/** 查询本地db中的clientId的op，每次查询N=100条
 * - ❓ 为什么用yield，让方法的返回值可迭代
 */
export async function* getEntriesByClient(
  clientId: string,
  options: { afterTime?: Date | null } = {},
): AsyncGenerator<OpLogEntry, void, void> {
  let page = 0;
  while (page >= 0) {
    // 普通循环体内await会等待后顺序执行
    const entries = await getEntriesByClientPage(clientId, {
      afterTime: options.afterTime,
      page,
      pageSize: DEFAULT_ENTRY_PAGE_SIZE,
    });
    page = entries.length ? page + 1 : -1;
    for (const entry of entries) {
      yield entry;
    }
  }
}

/** 在idb上索引+游标分页查询出符合条件的op
 *
 */
export function getEntriesByClientPage(
  clientId: string,
  options: {
    afterTime?: Date | null;
    newestFirst?: boolean;
    page: number;
    pageSize: number;
  } = {
    page: 0,
    pageSize: DEFAULT_ENTRY_PAGE_SIZE,
  },
): Promise<OpLogEntry[]> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const txReq = cachedDb.transaction([STORE_NAME.OPLOG], 'readonly');
    // txReq.oncomplete = () => resolve(txReq);
    txReq.onabort = () => reject(new TransactionAbortedError(txReq.error));
    txReq.onerror = (event) =>
      reject(isEventWithTargetError(event) ? event.target.error : txReq.error);

    const oplogStore = txReq.objectStore(STORE_NAME.OPLOG);
    const oplogIndex = oplogStore.index(OPLOG_INDEX_BY_CLIENTID_TIME);

    // Each key in the index (an array) must be "greater than or equal to" the "lower bounds" array (which, in effect,
    // means each element of the key array needs to be >= the corresponding element in the lower bounds array).
    const lowerBound = [
      clientId,
      options.afterTime instanceof Date ? options.afterTime.toISOString() : '',
    ];
    // Each key in the index must be "less than or equal to" the following upper bounds key. We're using '9' for the
    // upper bound of the `hlcTime` key element because we want to include all possible hlcTime values (i.e., we want
    // all possible hlcTime values to be LESS THAN OR EQUAL TO this string), and the string '9' should always be >= any
    // hlcTime value (e.g., '9' >= '2021-01-01...', etc.).
    const upperBound = [clientId, '9'];
    const idxCursorReq = oplogIndex.openCursor(
      IDBKeyRange.bound(lowerBound, upperBound),
      options.newestFirst ? 'prev' : 'next',
    );

    const entries: OpLogEntry[] = [];
    let cursorWasAdvanced = false;

    idxCursorReq.onsuccess = function (event) {
      // const cursor = idxCursorReq.result;
      // @ts-expect-error native types missing
      const cursor = event.target.result;
      if (!cursor) {
        resolve(entries);
        return;
      }

      if (!cursorWasAdvanced && options.page > 0) {
        cursorWasAdvanced = true;
        cursor.advance(options.page * options.pageSize);
        return; // cursor的请求是遍历，不符合条件时要结束
      }

      entries.push(cursor.value);

      if (entries.length < options.pageSize) {
        cursor.continue();
      } else {
        const stopTime = performance.now();
        log.debug(
          `⏱ Took ${stopTime - startTime}msec to get ${
            options.pageSize
          } entries at page ${options.page}.`,
        );
        resolve(entries);
      }
    };
  });
}

/** @unused
 * A convenience function for iterating over local oplog entries in order of their HLTime, oldest first, and optionally
 * including criteria for starting where the HLTime is >= some value. This function wraps the paginated results of
 * `getEntriesByTimePage()` and returns an async iteraterable iterator so that you can do something like the following:
 *
 * @example
 * ```
 * for await (let entry of getEntriesByTime()) {
 *   await doSomethingAsyncWith(entry)
 * }
 * ```
 *
 * For more info on async generators, etc., see https://javascript.info/async-iterators-generators.
 */
export async function* getEntriesByTime(
  params: { afterTime?: Date | null } = {},
): AsyncGenerator<OpLogEntry, void, void> {
  let page = 0;
  while (page >= 0) {
    const entries = await getEntriesByTimePage({
      afterTime: params.afterTime,
      page,
      pageSize: DEFAULT_ENTRY_PAGE_SIZE,
    });
    page = entries.length ? page + 1 : -1;
    for (const entry of entries) {
      yield entry;
    }
  }
}

/**
 * Use this function to retrieve paginated oplog entries from the IndexedDB object store in order of HLTime value.
 *
 * Pagination is used to eliminate the possibility of async operations being attempted during the IndexedDB transaction
 * used to retrieve the entries. Some number of objects are read from the database, the transaction finishes, and the
 * caller can take as much time as desired working on the returned set of entries before requesting another page.
 *
 * Note that the pagination algorithm is a modified version of an example shared by Raymond Camden at
 * https://www.raymondcamden.com/2016/09/02/pagination-and-indexeddb/.
 */
export function getEntriesByTimePage(
  params: { afterTime?: Date | null; page: number; pageSize: number } = {
    page: 0,
    pageSize: DEFAULT_ENTRY_PAGE_SIZE,
  },
): Promise<OpLogEntry[]> {
  const startTime = performance.now();
  let query: IDBKeyRange | null = null;
  if (params?.afterTime instanceof Date) {
    // Set a lower bound for the cursor (e.g., "2021-03-01T20:33:14.080Z"). Keep in mind that the OpLogEntry store uses
    // each object's `.hlcTime` prop as the keyPath (e.g., "2021-02-08T11:01:15.142Z-0000-afd67a3799189eaa"). This means
    // that the objects are sorted by those strings. By specifying an ISO-formatted date string as the lower bound for
    // the cursor we are saying "move the cursor to the first key that is >= this string".
    query = IDBKeyRange.lowerBound(params.afterTime.toISOString());
  }

  return new Promise(function (resolve, reject) {
    const txReq = cachedDb.transaction([STORE_NAME.OPLOG], 'readonly');
    txReq.onabort = () => reject(new TransactionAbortedError(txReq.error));
    txReq.onerror = (event) =>
      reject(isEventWithTargetError(event) ? event.target.error : txReq.error);

    const store = txReq.objectStore(STORE_NAME.OPLOG);

    if (store.keyPath !== OPLOG_ENTRY_HLC_TIME_PROP_NAME) {
      throw new Error(
        `${LIB_NAME} getEntries() can't return oplog entries in reliable order; ${OPLOG_STORE} isn't using ` +
          `${OPLOG_ENTRY_HLC_TIME_PROP_NAME} as its keyPath and therefore entries aren't sorted by HLC time.`,
      );
    }

    const cursorReq = store.openCursor(query);

    const entries: OpLogEntry[] = [];
    let cursorWasAdvanced = false;

    cursorReq.onsuccess = function () {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(entries);
        return;
      }

      if (!cursorWasAdvanced && params.page > 0) {
        cursorWasAdvanced = true;
        cursor.advance(params.page * params.pageSize);
        return;
      }

      entries.push(cursor.value);

      if (entries.length < params.pageSize) {
        cursor.continue();
      } else {
        const stopTime = performance.now();
        log.debug(
          `⏱ Took ${stopTime - startTime}msec to get ${
            params.pageSize
          } entries at page ${params.page}.`,
        );
        resolve(entries);
      }
    };
  });
}

export async function applyOplogEntries(candidates: OpLogEntry[]) {
  for (const candidate of candidates) {
    await applyOplogEntry(candidate);
  }
}

/** 根据op记录在对应的idb业务表上执行crud操作。
 * - 会根据hlc逻辑时钟丢弃过期操作，并更新本地hlc
 * - 先保存op到op记录表，再判断是更新值、还是添加新属性和值
 * - Attempt to apply an oplog entry to a specified store + objectKey + prop. In other words, update an existing object in
 * the appropriate object store, or create a new one, per the _operation_ represented by an oplog entry object. Then add
 * the entry to the local oplog entries store.
 *
 * If the referenced objectKey + prop already exists, it will only be updated if the oplog entry is the most recent one
 * we know about for that store + objectKey + prop. If an oplog entry with a more recent `hlcTime` is found in the local
 * oplog store, the passed-in entry will not be applied or added to the local oplog store.
 *
 * Important: all of the IndexedDB operations performed by this function should happen in the same transaction. This
 * ensures that, if any one of those operations fails, the transaction can be aborted and none of the operations will
 * persist.
 */
export function applyOplogEntry(candidate: OpLogEntry) {
  return new Promise((resolve, reject) => {
    try {
      throwIfInvalidOpLogEntry(candidate);
    } catch (error) {
      reject(new InvalidOpLogEntryError(candidate, error.message));
    }

    let candidateHLTime;
    try {
      candidateHLTime = HLTime.parse(candidate.hlcTime);
    } catch (error) {
      reject(new InvalidOpLogEntryError(candidate, error.message));
    }

    // This logic is redundant since throwIfInvalidOpLogEntry() validates the hlcTime, but necessary to prove to the
    // Typescript compiler that candidateHLTime is set to a value.
    if (!candidateHLTime) {
      return;
    } else if (candidateHLTime.node() === HLClock.time().node()) {
      log.warn(
        `Encountered oplog entry with the same node ID:`,
        candidateHLTime.node(),
      );
    }

    // Ensure that our HLClock is set to a time that occurs after any other time we encounter (even if we end up not
    // applying the oplog entry).
    const currentHLTime = HLClock.time().toString();
    if (candidateHLTime.toString() > currentHLTime) {
      debug &&
        log.debug(
          `Encountered oplog entry with more recent HLTime; updating time.`,
          {
            currentTime: currentHLTime,
            oplogEntryTime: candidate.hlcTime,
          },
        );

      // 👉🏻 Note that this will throw if the oplog entry's time is too far in the future...
      HLClock.tickPast(candidateHLTime);

      debug &&
        log.debug(`Updated local HL time.`, {
          previousTime: currentHLTime,
          currentTime: HLClock.time().toString(),
        });
    }

    const txReq = cachedDb.transaction(
      [STORE_NAME.OPLOG, candidate.store],
      'readwrite',
    );
    txReq.oncomplete = () => resolve(txReq);
    txReq.onabort = () => reject(new TransactionAbortedError(txReq.error));
    txReq.onerror = (event) =>
      reject(isEventWithTargetError(event) ? event.target.error : txReq.error);

    const oplogStore = txReq.objectStore(STORE_NAME.OPLOG);
    const targetStore = txReq.objectStore(candidate.store);
    const oplogIndex = oplogStore.index(OPLOG_INDEX_BY_STORE_OBJKEY_PROP_TIME);

    // Each key in the index (an array) must be "greater than or equal to" the "lower bounds" array (which, in effect,
    // means each element of the key array needs to be >= the corresponding element in the lower bounds array). Given
    // the following example bounds and keys, BOTH keys are >= the lower bounds:
    //
    //  - Lower bounds key: ['todo_items', '123', 'name', '']
    //
    //  - Key 1: ['todo_items', '123', 'name', '2021-01-12...'] is included because:
    //    - 'todo_items' >= 'todo_items' and '123' >= '123' and 'name' >= 'name' and '2021-01-12...' >= ''
    //
    //  - Key 2: ['todo_types', '456', 'name', '2021-01-12...'] is included because:
    //    - 'todo_types' >= 'todo_items' and '456' >= '123' and 'name' >= 'name' and '2021-01-12...' >= ''
    //
    // Note that we're using '' for the lower bound of the `hlcTime` key element. This is because we want to include all
    // possible hlcTime values (i.e., we want all possible hlcTime values to be >= this value), and '' is <= all other
    // strings.
    const lowerBound = [
      candidate.store,
      candidate.objectKey,
      candidate.prop,
      '',
    ];

    // Each key in the index must be "less than or equal to" the following upper bounds key. We're using '9' for the
    // upper bound of the `hlcTime` key element because we want to include all possible hlcTime values (i.e., we want
    // all possible hlcTime values to be LESS THAN OR EQUAL TO this string), and the string '9' should always be >= any
    // hlcTime value (e.g., '9' >= '2021-01-01...', etc.).
    const upperBound = [
      candidate.store,
      candidate.objectKey,
      candidate.prop,
      '9',
    ];

    // Things to keep in mind when grokking how the oplog index, cursor range, and cursor will work here:
    // 1. The index as a big list, sorted by its `keyPath`, with "smaller" keys at the top.
    //   - The keys are arrays; IndexedDB compares arrays by comparing corresponding array elements
    //   - Full sorting algo: https://www.w3.org/TR/IndexedDB/#key-construct. You can test with `indexedDB.cmp(a,b)`
    // 2. A cursor iterates over some range of that list.
    // 3. The direction param (prev, next) determines if the cursor starts at the "top" or bottom of the range.
    //   - 'next' (default) = start at lower bound, 'prev' = start at upper bound and iterate backwards.
    // 4. IDBKeyRange determines the range of the list over which the cursor will iterate.
    //   - Lower bound: range begins at first key that is >= x.
    //   - Upper bound: range ends at first key that is <= y.
    //   - If no upper bound is specified, cursor can continue to end of index.
    // 5. It may seem like we don't need to use a lower bound (i.e., "if we're just getting the last item from the list,
    //    as determined by the upper bound, so why bother with a lower bound?"). It's important to remember, however,
    //    that the cursor isn't checking for equality--it's only checking for "greater/less than or equal to". So if no
    //    lower bound is specified, and no existing oplog entry exists for this store/key/prop, the first record the
    //    cursor encounters could be for for a DIFFERENT store/key/prop! In other words, it's critical that we use a
    //    lower bound to effectively limit the cursor to entries with matching store/objectKey/prop values. We're
    //    basically doing something like "where x >= 2 and x <= 2 and y >= 7 and y <= 7" to ensure that the cursor only
    //    includes objects where x = 2 and y = 7.
    const idxCursorReq = oplogIndex.openCursor(
      IDBKeyRange.bound(lowerBound, upperBound),
      'prev',
    );

    // 剩下的逻辑全在这里，遍历op表寻找符合条件的op，更新业务表
    idxCursorReq.onsuccess = () => {
      const cursor = idxCursorReq.result;

      // to see if an existing oplog entry exists that is "newer" than the candidate entry.
      // 丢弃无效或过期op
      if (cursor && cursor.value) {
        try {
          throwIfInvalidOpLogEntry(cursor.value);
        } catch (error) {
          log.warn(
            `encountered an invalid oplog entry in "${OPLOG_STORE}" store. This might mean that an oplog entry` +
              `was manually edited or created in an invalid way somewhere. The entry will be ignored.`,
            JSON.stringify(error.message),
          );
          cursor.continue();
          return;
        }

        const existingCursor = cursor.value;

        const expectedObjectKey = JSON.stringify(candidate.objectKey);
        const actualObjectKey = JSON.stringify(existingCursor.objectKey);

        // In theory, the cursor range should prevent us from encountering oplog entries that don't match the candidate
        // store/objectKey/prop values. That said, doing some extra checks can't hurt--especially while the code hasn't
        // been thoroughly tested in more than one "production" environment.
        if (existingCursor.store !== candidate.store) {
          txReq.abort();
          // By calling reject() here we are preventing txReq.onabort or txReq.onerror from rejecting; this allows
          // the calling code to catch our custom error vs. a generic the DOMException from IDB
          reject(
            new UnexpectedOpLogEntryError(
              'store',
              candidate.store,
              existingCursor.store,
            ),
          );
        } else if (expectedObjectKey !== actualObjectKey) {
          txReq.abort();
          reject(
            new UnexpectedOpLogEntryError(
              'objectKey',
              expectedObjectKey,
              actualObjectKey,
            ),
          );
        } else if (existingCursor.prop !== candidate.prop) {
          txReq.abort();
          reject(
            new UnexpectedOpLogEntryError(
              'prop',
              candidate.prop,
              cursor.value.prop,
            ),
          );
        }

        // If we found an existing entry whose HLC timestamp is more recent than the candidate's, then the candidate
        // entry is obsolete and we'll ignore it.
        if (candidate.hlcTime < existingCursor.hlcTime) {
          debug &&
            log.debug(`WON'T apply oplog entry; found existing that's newer:`, {
              candidate,
              existing: existingCursor,
            });
          return; // 丢弃过期op
        }
      }

      // If the thread of execution makes it this far, it means we didn't find an existing entry with a newer timestamp.
      log.debug(
        `applying oplog entry; didn't find a newer one with matching store/key/prop.`,
      );

      // Add the entry to the oplog store. Note that, in theory, it may already exist there (e.g., it's possible for a
      // sync to happen in which known oplog entries received again). Instead of attempting to check first, we'll just
      // use `put()` to "upsert"--less code and avoids an extra IndexedDB operation.
      // 👉🏻 先更新op记录表
      const oplogPutReq = oplogStore.put(candidate);

      if (process.env.NODE_ENV !== 'production') {
        oplogPutReq.onsuccess = () => {
          debug &&
            log.debug(
              `successfully added oplog entry to "${OPLOG_STORE}".`,
              candidate,
            );
        };
      }

      oplogPutReq.onerror = (event) => {
        const errMsg = `${LIB_NAME} encountered an error while attempting to add an object to "${OPLOG_STORE}".`;
        log.error(errMsg, event);
        // By calling reject() here we are preventing txReq.onabort or txReq.onerror from rejecting; this allows
        // the calling code to catch our custom error vs. a generic the DOMException from IDB
        reject(new Error(errMsg));
      };

      const existingObjReq = targetStore.get(candidate.objectKey);

      existingObjReq.onsuccess = () => {
        const existingValue = existingObjReq.result;

        if (existingValue) {
          debug &&
            log.debug(
              `retrieved existing object from "${candidate.store}":`,
              existingValue,
            );
        } else {
          debug &&
            log.debug(
              `no existing object found in "${candidate.store}" with key: ${candidate.objectKey}`,
            );
        }

        /** 先确定新的值 */
        let newValue: any;

        if (candidate.prop === '') {
          // If the OpLogEntry doesn't reference an _object property_, then we're not setting a prop on an object; the
          // candidate value _is_ the new value.
          newValue = candidate.value;
        } else if (existingValue && typeof existingValue === 'object') {
          // "Merge" the existing object with the new object.
          newValue = { ...existingValue, [candidate.prop]: candidate.value };
        } else {
          // 👉🏻 No existing value exists. Since the oplog entry specifies an _object property_ (i.e., candidate.prop), we
          // know that the final value needs to be an object.
          newValue = { [candidate.prop]: candidate.value };

          // Ensure that the new value object we just created has the required keyPath props if necessary
          if (targetStore.keyPath) {
            if (Array.isArray(targetStore.keyPath)) {
              if (Array.isArray(candidate.objectKey)) {
                for (let i = 0; i < targetStore.keyPath.length; i++) {
                  const keyProp = targetStore.keyPath[i];
                  newValue[keyProp] = candidate.objectKey[i];
                }
              } else {
                const putError = new ApplyPutError(
                  targetStore.name,
                  `The oplog entry's ".objectKey" property should be an array but isn't: ` +
                    JSON.stringify(candidate),
                );
                log.error(putError);
                txReq.abort();
                // By calling reject() here we are preventing txReq.onabort or txReq.onerror from rejecting; this allows
                // the calling code to catch our custom error vs. a generic the DOMException from IDB
                reject(putError);
                return;
              }
            } else {
              // keyPath为非数组时
              newValue[targetStore.keyPath] = candidate.objectKey;
            }
          }
        }

        let mergedPutReq: IDBRequest;

        try {
          // When calling the target object store's `put()` method it's important to NOT include a `key` param if that
          // store has a `keyPath`. Doing this causes an error (e.g., "[...] object store uses in-line keys and the key
          // parameter was provided" in Chrome).
          // 👉🏻 更新业务员表
          mergedPutReq = targetStore.keyPath
            ? targetStore.put(newValue)
            : targetStore.put(newValue, candidate.objectKey);
        } catch (error) {
          const putError = new ApplyPutError(targetStore.name, error);
          log.error(putError, error);
          txReq.abort();
          // By calling reject() here we are preventing txReq.onabort or txReq.onerror from rejecting; this allows
          // the calling code to catch our custom error vs. a generic the DOMException from IDB
          reject(putError);
          return;
        }

        mergedPutReq.onerror = (event) => {
          const error = isEventWithTargetError(event)
            ? event.target.error
            : mergedPutReq.error;
          const putError = new ApplyPutError(targetStore.name, error);
          log.error(putError);
          // By calling reject() here we are preventing txReq.onabort or txReq.onerror from rejecting; this allows
          // the calling code to catch our custom error vs. a generic the DOMException from IDB
          reject(putError);
        };

        if (debug) {
          mergedPutReq.onsuccess = () => {
            log.debug(
              `successfully applied oplog entry to ${targetStore.name}.`,
              {
                existingValue,
                newValue,
              },
            );
          };
        }
      };

      existingObjReq.onerror = (event) => {
        const errMsg =
          `${LIB_NAME} encountered an error while trying to retrieve an object from "${targetStore.name}"  as part ` +
          `of applying an oplog entry change to that object.`;
        log.error(errMsg, event);
        reject(new Error(errMsg));
      };
    };

    idxCursorReq.onerror = (event) => {
      const errMsg = `${LIB_NAME} encountered an error while trying to open a cursor on the "${OPLOG_INDEX_BY_STORE_OBJKEY_PROP_TIME}" index.`;
      log.error(errMsg, event);
      reject(new Error(errMsg));
    };
  });
}

/** 创建op记录表和基本元信息表，并创建相关索引
 * - This should be called as part of the upstream library handling an onupgradeneeded event (i.e., this won't be called
 * every time an app starts up--only when the database version changes).
 */
export function opIndexForOnupgradeneeded(event: IDBVersionChangeEvent): void {
  debug && log.debug('onupgradeneeded()');

  const db = (event.target as IDBOpenDBRequest).result;

  // Create an object store where we can put IDBSideSync settings that won't be sync'ed. Note the lack of a keypath.
  // This means that a "key" arg will need to be specified when calling `add()` or `put()`.
  db.createObjectStore(STORE_NAME.META);
  const oplogStore = db.createObjectStore(STORE_NAME.OPLOG, {
    keyPath: OPLOG_ENTRY_HLC_TIME_PROP_NAME,
  });

  // Create an index tailored to finding the most recent oplog entry for a given store + object key + prop. Note:
  //
  //  1. The index will have an entry for each object in the object store that has a "non-empty" value for EVERY prop
  //     (i.e., the object needs to have the prop defined and the value is not null, undefined, or a boolean).
  //  2. The index key for the object will be an array consisting of the values for the corresponding prop values.
  //  3. The index is sorted by the keys. In this case, each key is an array; the IndexedDB spec defines an algo for how
  //     arrays are compared and sorted (see https://www.w3.org/TR/IndexedDB/#key-construct).
  //  4. This basically amounts comparing each element of both arrays, using the same comparison algo.
  //  5. Note that the IndexedDB comparison algo sometimes determines order based on the TYPE of a thing, not its value
  //     (e.g., an array is considered "greater than" a string). This matters for the 'objectKey' prop since that prop
  //     value could be a string, number, Date, or array of those things.
  //
  // Since our only use case will be searching for entries that have a matching store + objectKey + prop (and needing
  // those to be sorted by hlcTime so we can get the most recent), we aren't concerned with how the index entries
  // initially sorted based on 'store' and 'objectKey' (i.e., we don't care if the index key for Object A comes before
  // the one for Object B because of their 'objectKey' values). We only care that all of oplog entries for a specific
  // object and prop are grouped together AND sorted by `hlcTime`.
  //
  // Note that while we are not going to use this index to SEARCH by `hlcTime`, we do want the index keys to be SORTED
  // based on `hlcTime` (after first being sorted by store, objectKey, and prop). In other words, the only reason
  // `hlcTime` is included in the index `keyPath` is to affect the sorting.
  //
  // For more info see https://stackoverflow.com/a/15625231/62694.
  const indexByStoreObjKeyPropTimeKeyPath: Array<keyof OpLogEntry> = [
    'store',
    'objectKey',
    'prop',
    'hlcTime',
  ];
  oplogStore.createIndex(
    OPLOG_INDEX_BY_STORE_OBJKEY_PROP_TIME,
    indexByStoreObjKeyPropTimeKeyPath,
  );

  // Create an index tailored to finding oplog entries by clientId
  const indexbyClientIdTimeKeyPath: Array<keyof OpLogEntry> = [
    'clientId',
    'hlcTime',
  ];
  oplogStore.createIndex(
    OPLOG_INDEX_BY_CLIENTID_TIME,
    indexbyClientIdTimeKeyPath,
  );
}

class UnexpectedOpLogEntryError extends Error {
  constructor(noun: keyof OpLogEntry, expected: string, actual: string) {
    super(
      `${LIB_NAME}: invalid "most recent oplog entry"; expected '${noun}' value of '${expected}' but got ` +
        `'${actual}'. (This might mean there's a problem with the IDBKeyRange used to iterate over ${OPLOG_INDEX_BY_STORE_OBJKEY_PROP_TIME}.)`,
    );
    Object.setPrototypeOf(this, UnexpectedOpLogEntryError.prototype); // https://git.io/vHLlu
  }
}

export class ApplyPutError extends Error {
  constructor(storeName: string, error: unknown) {
    super(
      `${LIB_NAME}: error on attempt to apply oplog entry that adds/updates object in "${storeName}": ` +
        error,
    );
    Object.setPrototypeOf(this, ApplyPutError.prototype); // https://git.io/vHLlu
  }
}

export class TransactionAbortedError extends Error {
  constructor(error: unknown) {
    super(`${LIB_NAME}: transaction aborted with error: ` + error);
    Object.setPrototypeOf(this, TransactionAbortedError.prototype); // https://git.io/vHLlu
  }
}

export class InvalidOpLogEntryError extends Error {
  constructor(object: unknown, message = '') {
    super(
      `Object is not a valid OpLogEntry; ${message}: ` + JSON.stringify(object),
    );
    Object.setPrototypeOf(this, InvalidOpLogEntryError.prototype); // https://git.io/vHLlu
  }
}
