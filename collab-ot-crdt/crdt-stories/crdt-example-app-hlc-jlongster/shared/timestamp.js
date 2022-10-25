const config = {
  // Maximum physical clock drift allowed, in ms. In other words, if we
  // receive a message from another node and that node's time differes from
  // ours by more than this many milliseconds, throw an error.
  maxDrift: 60000,
};

class Timestamp {
  constructor(millis, counter, node) {
    this._state = {
      millis: millis,
      counter: counter,
      node: node,
    };
  }

  valueOf() {
    return this.toString();
  }

  toString() {
    return [
      new Date(this.millis()).toISOString(),
      ('0000' + this.counter().toString(16).toUpperCase()).slice(-4),
      ('0000000000000000' + this.node()).slice(-16),
    ].join('-');
  }

  millis() {
    return this._state.millis;
  }

  counter() {
    return this._state.counter;
  }

  node() {
    return this._state.node;
  }

  hash() {
    return globalThis['murmur']
      ? globalThis['murmur'](this.toString()) // for browser
      : 'murmur_hash_error'; // for nodejs
  }
}

class MutableTimestamp extends Timestamp {
  setMillis(n) {
    this._state.millis = n;
  }

  setCounter(n) {
    this._state.counter = n;
  }

  setNode(n) {
    this._state.node = n;
  }
}

MutableTimestamp.from = (timestamp) => {
  return new MutableTimestamp(
    timestamp.millis(),
    timestamp.counter(),
    timestamp.node(),
  );
};

// Timestamp generator initialization
// * sets the node ID to an arbitrary value
// * useful for mocking/unit testing
Timestamp.init = function (options = {}) {
  if (options.maxDrift) {
    config.maxDrift = options.maxDrift;
  }
};

/**
 * Timestamp send. Generates a unique, monotonic timestamp suitable
 * for transmission to another system in string format
 */
Timestamp.send = function (clock) {
  // Retrieve the local wall time
  const phys = Date.now();

  // Unpack the clock.timestamp logical time and counter
  const lOld = clock.timestamp.millis();
  const cOld = clock.timestamp.counter();

  // Calculate the next logical time and counter
  // * ensure that the logical time never goes backward
  // * increment the counter if phys time does not advance
  const lNew = Math.max(lOld, phys);
  const cNew = lOld === lNew ? cOld + 1 : 0;

  // Check the result for drift and counter overflow
  if (lNew - phys > config.maxDrift) {
    throw new Timestamp.ClockDriftError(lNew, phys, config.maxDrift);
  }

  if (cNew > 65535) {
    // We don't support counters greater than 65535 because we need to ensure
    // that, when converted to a hex string, it doesn't use more than 4 chars
    // (see Timestamp.toString). For example:
    //   (65533).toString(16) -> fffd
    //   (65534).toString(16) -> fffe
    //   (65535).toString(16) -> ffff
    //   (65536).toString(16) -> 10000 -- oops, this is 5 chars
    // It's not that a larger counter couldn't be used--that would just mean
    // increasing the expected length of the counter part of the timestamp
    // and updating the code that parses/generates that string. Some sort of
    // length needs to be picked, and therefore there is going to be some sort
    // of limit to how big the counter can be.
    throw new Timestamp.OverflowError();
  }

  // Repack the logical time/counter
  clock.timestamp.setMillis(lNew);
  clock.timestamp.setCounter(cNew);

  return new Timestamp(
    clock.timestamp.millis(),
    clock.timestamp.counter(),
    clock.timestamp.node(),
  );
};

// Timestamp receive. Parses and merges a timestamp from a remote
// system with the local timeglobal uniqueness and monotonicity are
// preserved
Timestamp.recv = function (clock, msg) {
  const phys = Date.now();

  // Unpack the message wall time/counter
  const lMsg = msg.millis();
  const cMsg = msg.counter();

  // Assert the node id and remote clock drift
  if (msg.node() === clock.timestamp.node()) {
    // Whoops, looks like the message came from the same node ID as ours!
    throw new Timestamp.DuplicateNodeError(clock.timestamp.node());
  }

  if (lMsg - phys > config.maxDrift) {
    // Whoops, the other node's physical time differs from ours by more than
    // the configured limit (e.g., 1 minute).
    throw new Timestamp.ClockDriftError();
  }

  // Unpack the clock.timestamp logical time and counter
  const lOld = clock.timestamp.millis();
  const cOld = clock.timestamp.counter();

  // Calculate the next logical time and counter.
  // Ensure that the logical time never goes backward;
  // * if all logical clocks are equal, increment the max counter,
  // * if max = old > message, increment local counter,
  // * if max = messsage > old, increment message counter,
  // * otherwise, clocks are monotonic, reset counter
  const lNew = Math.max(Math.max(lOld, phys), lMsg);
  const cNew =
    lNew === lOld && lNew === lMsg
      ? Math.max(cOld, cMsg) + 1
      : lNew === lOld
      ? cOld + 1
      : lNew === lMsg
      ? cMsg + 1
      : 0;

  // Check the result for drift and counter overflow
  if (lNew - phys > config.maxDrift) {
    throw new Timestamp.ClockDriftError();
  }
  if (cNew > 65535) {
    throw new Timestamp.OverflowError();
  }

  // Repack the logical time/counter
  clock.timestamp.setMillis(lNew);
  clock.timestamp.setCounter(cNew);

  return new Timestamp(
    clock.timestamp.millis(),
    clock.timestamp.counter(),
    clock.timestamp.node(),
  );
};

/**
 * Converts a fixed-length string timestamp to the structured value
 */
Timestamp.parse = function (timestamp) {
  if (typeof timestamp === 'string') {
    const parts = timestamp.split('-');
    if (parts && parts.length === 5) {
      const millis = Date.parse(parts.slice(0, 3).join('-')).valueOf();
      const counter = parseInt(parts[3], 16);
      const node = parts[4];
      if (!isNaN(millis) && !isNaN(counter))
        return new Timestamp(millis, counter, node);
    }
  }
  return null;
};

Timestamp.since = (isoString) => {
  return isoString + '-0000-0000000000000000';
};

Timestamp.DuplicateNodeError = class extends Error {
  constructor(node) {
    super();
    this.type = 'DuplicateNodeError';
    this.message = 'duplicate node identifier ' + node;
  }
};

Timestamp.ClockDriftError = class extends Error {
  constructor(...args) {
    super();
    this.type = 'ClockDriftError';
    this.message = ['maximum clock drift exceeded'].concat(args).join(' ');
  }
};

Timestamp.OverflowError = class extends Error {
  constructor() {
    super();
    this.type = 'OverflowError';
    this.message = 'timestamp counter overflow';
  }
};

export { Timestamp, MutableTimestamp };

globalThis['Timestamp'] = Timestamp;
globalThis['MutableTimestamp'] = MutableTimestamp;

// console.log(';;murmur ', globalThis['murmur']);
// console.log(';;win ', window && window['Timestamp']);
