import { type Id } from 'tinybase/src/common-d';
import { type CellOrUndefined, type Store } from 'tinybase/src/store-d';

const MASK6 = 63;

export const stringSplit = (value: string, separator = '', limit?: number) =>
  value.split(separator, limit);

export const stringHash = (value: string): number =>
  arrayReduce(
    stringSplit(value),
    (hash: number, char: string): number =>
      ((hash << 5) + hash) ^ char.charCodeAt(0),
    5381,
  ) >>> 0;

export const toB64 = (num: number): string =>
  String.fromCharCode(48 + (num & MASK6));

export const fromB64 = (str: string, pos: number): number =>
  str.charCodeAt(pos) - 48;

// Temporarily ripped from the TinyBase common library:
export const mapNew = <Key, Value>(entries?: [Key, Value][]): Map<Key, Value> =>
  new Map(entries);
export const mapGet = <Key, Value>(
  map: Map<Key, Value> | undefined,
  key: Key,
): Value | undefined => map?.get(key);
/** if key exists, return value; if not, createDefaultValue and return it */
export const mapEnsure = <Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  getDefaultValue: () => Value,
): Value => {
  if (!map.has(key)) {
    map.set(key, getDefaultValue());
  }
  return map.get(key) as Value;
};
export const mapSet = <Key, Value>(
  map: Map<Key, Value> | undefined,
  key: Key,
  value?: Value,
): Map<Key, Value> | undefined =>
  isUndefined(value) ? (collDel(map, key), map) : map?.set(key, value);
export const mapKeys = <Key>(map: Map<Key, unknown> | undefined): Key[] => [
  ...(map?.keys() ?? []),
];
export const mapForEach = <Key, Value>(
  map: Map<Key, Value> | undefined,
  cb: (key: Key, value: Value) => void,
): void => collForEach(map, (value, key) => cb(key, value));
export const collForEach = <Value>(
  coll: Coll<Value> | undefined,
  cb: (value: Value, key: any) => void,
): void => coll?.forEach(cb);
export const collDel = (
  coll: Coll<unknown> | undefined,
  keyOrValue: unknown,
): boolean | undefined => coll?.delete(keyOrValue);
export const collIsEmpty = (coll: Coll<unknown> | undefined): boolean =>
  isUndefined(coll) || collSize(coll) === 0;
export const collSize = (coll: Coll<unknown>): number => coll.size;
export const isUndefined = (thing: unknown): thing is undefined | null =>
  thing == undefined;

export const setOrDelCell = (
  store: Store,
  tableId: Id,
  rowId: Id,
  cellId: Id,
  cell: CellOrUndefined,
) =>
  isUndefined(cell)
    ? store.delCell(tableId, rowId, cellId, true)
    : store.setCell(tableId, rowId, cellId, cell);
export const jsonString = (obj: unknown): string =>
  JSON.stringify(obj, (_key, value) =>
    isInstanceOf(value, Map)
      ? arrayReduce(
          [...value],
          (obj: { [key: string]: unknown }, [key, value]) => {
            obj[key] = value;
            return obj;
          },
          {},
        )
      : value,
  );

const object = Object;
export const isObject = (obj: unknown): boolean =>
  isInstanceOf(obj, object) && (obj as any).constructor == object;
export const isInstanceOf = (
  thing: unknown,
  cls: MapConstructor | SetConstructor | ObjectConstructor,
): boolean => thing instanceof cls;
export const arrayReduce = <Value, Result>(
  array: Value[],
  cb: (previous: Result, current: Value, index: number) => Result,
  initial: Result,
): Result => array.reduce(cb, initial);
export const arrayMap = <Value, Return>(
  array: Value[],
  cb: (value: Value, index: number, array: Value[]) => Return,
): Return[] => array.map(cb);
export const arrayForEach = <Value>(
  array: Value[],
  cb: (value: Value, index: number) => void,
): void => array.forEach(cb);
export const ifNotUndefined = <Value, Return>(
  value: Value | undefined,
  then: (value: Value) => Return,
  otherwise?: () => Return,
): Return | undefined => (isUndefined(value) ? otherwise?.() : then(value));
/** remove all items from input collection */
export const collClear = (coll: Coll<unknown>): void => coll.clear();
export const arrayPush = <Value>(array: Value[], ...values: Value[]): number =>
  array.push(...values);

export type Coll<Value> = Map<unknown, Value> | Set<Value>;
/** { string: val } */
export type IdMap<Value> = Map<Id, Value>;
/** { string: { string: val } } */
export type IdMap2<Value> = IdMap<IdMap<Value>>;
/** { string: { string: { string: val } } } */
export type IdMap3<Value> = IdMap<IdMap2<Value>>;
