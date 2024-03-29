/**
 * Isomorphic module for true random numbers / buffers / uuids.
 *
 * Attention: falls back to Math.random if the browser does not support crypto.
 *
 * @module random
 */

import * as binary from './binary';
import { cryptoRandomBuffer } from './isomorphic';
import * as math from './math';

export const rand = Math.random;

export const uint32 = () => new Uint32Array(cryptoRandomBuffer(4))[0];

export const uint53 = () => {
  const arr = new Uint32Array(cryptoRandomBuffer(8));
  return (arr[0] & binary.BITS21) * (binary.BITS32 + 1) + (arr[1] >>> 0);
};

/**
 * @template T
 * @param {Array<T>} arr
 * @return {T}
 */
export const oneOf = (arr) => arr[math.floor(rand() * arr.length)];

// @ts-ignore
const uuidv4Template = [1e7] + -1e3 + -4e3 + -8e3 + -1e11;
export const uuidv4 = () =>
  uuidv4Template.replace(
    /[018]/g,
    /** @param {number} c */ (c) =>
      (c ^ (uint32() & (15 >> (c / 4)))).toString(16),
  );
