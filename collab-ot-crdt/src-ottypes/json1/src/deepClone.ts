import { type Doc } from './types';

export default function deepClone(old: Doc): Doc {
  if (old === null) return null;

  if (Array.isArray(old)) {
    return old.map(deepClone);
  } else if (typeof old === 'object') {
    const o: Doc = {};
    for (const k in old) o[k] = deepClone(old[k]);
    return o;
  } else {
    // Everything else in JS is immutable.
    return old;
  }
}
