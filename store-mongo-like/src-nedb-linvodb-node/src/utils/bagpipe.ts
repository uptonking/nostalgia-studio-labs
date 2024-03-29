import events from 'events';
import inherits from 'inherits';

/**
 * 构造器，传入限流值，设置异步调用最大并发数
 * Examples:
 * ```
 * var bagpipe = new Bagpipe(100);
 * bagpipe.push(fs.readFile, 'path', 'utf-8', function (err, data) {
 *   // TODO
 * });
 * ```
 * Events:
 * - `full`, 当活动异步达到限制值时，后续异步调用将被暂存于队列中。当队列的长度大于限制值的2倍或100的时候时候，触发`full`事件。事件传递队列长度值。
 * - `outdated`, 超时后的异步调用异常返回。
 * Options:
 * - `disabled`, 禁用限流，测试时用
 * - `refuse`, 拒绝模式，排队超过限制值时，新来的调用将会得到`TooMuchAsyncCallError`异常
 * - `timeout`, 设置异步调用的时间上线，保证异步调用能够恒定的结束，不至于花费太长时间
 * @param {Number} limit 并发数限制值
 * @param {Object} options Options
 */
export const Bagpipe = function (this: any, limit, options = {}) {
  events.EventEmitter.call(this);
  this.limit = limit;
  this.active = 0;
  this.paused = false;
  this.stopped = false;
  this.queue = [];
  this.options = {
    disabled: false,
    refuse: false,
    ratio: 1,
    timeout: null,
  };
  if (typeof options === 'boolean') {
    options = {
      disabled: options,
    };
  }
  options = options || {};
  for (const key in this.options) {
    if (options.hasOwnProperty(key)) {
      this.options[key] = options[key];
    }
  }
  // queue length
  this.queueLength = Math.round(this.limit * (this.options.ratio || 1));
};
inherits(Bagpipe, events.EventEmitter);

/**
 * 推入方法，参数。最后一个参数为回调函数
 * @param {Function} method 异步方法
 * @param {Mix} args 参数列表，最后一个参数为回调函数。
 */
const addToQueue = function (unshift) {
  return function (method) {
    // @ts-expect-error fix-types
    if (this.stopped) return this;

    const args = [].slice.call(arguments, 1);
    const callback = args[args.length - 1];
    if (typeof callback !== 'function') {
      args.push(function () {});
    }
    // @ts-expect-error fix-types
    if (this.options.disabled || this.limit < 1) {
      method.apply(null, args);
      // @ts-expect-error fix-types
      return this;
    }

    // @ts-expect-error fix-types队列长度也超过限制值时
    if (this.queue.length < this.queueLength || !this.options.refuse) {
      // @ts-expect-error fix-types
      this.queue[unshift ? 'unshift' : 'push']({
        method: method,
        args: args,
      });
    } else {
      const err = new Error('Too much async call in queue');
      err.name = 'TooMuchAsyncCallError';
      callback(err);
    }

    // @ts-expect-error fix-types
    if (this.queue.length > 1) {
      // @ts-expect-error fix-types
      this.emit('full', this.queue.length);
    }

    // @ts-expect-error fix-types
    this.next();
    // @ts-expect-error fix-types
    return this;
  };
};
Bagpipe.prototype.push = addToQueue(0);
Bagpipe.prototype.unshift = addToQueue(1);

Bagpipe.prototype.pause = function () {
  this.paused = true;
};
Bagpipe.prototype.resume = function () {
  this.paused = false;
  if (!this.stopped) this.next();
};

Bagpipe.prototype.stop = function () {
  this.stopped = true;
  this.queue = [];
  this.active = 0;
  this.pause();
};
Bagpipe.prototype.start = function () {
  this.stopped = false;
  this.resume();
};

/*!
 * 继续执行队列中的后续动作
 */
Bagpipe.prototype.next = function () {
  if (this.paused) return;
  if (this.stopped) return;

  const that = this;
  if (that.active < that.limit && that.queue.length) {
    const req = that.queue.shift();
    that.run(req.method, req.args);
  }
};

Bagpipe.prototype._next = function () {
  if (this.stopped) return;
  this.active--;
  this.next();
};

/*!
 * 执行队列中的方法
 */
Bagpipe.prototype.run = function (method, args) {
  if (this.stopped) return;

  const that = this;
  that.active++;
  const callback = args[args.length - 1];
  let timer = null;
  let called = false;

  // inject logic
  args[args.length - 1] = function (err) {
    if (that.stopped) return;

    // anyway, clear the timer
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // if timeout, don't execute
    if (!called) {
      that._next();
      callback.apply(null, arguments);
    } else {
      // pass the outdated error
      if (err) {
        that.emit('outdated', err);
      }
    }
  };

  const timeout = that.options.timeout;
  if (that.stopped) return;

  if (timeout) {
    timer = setTimeout(function () {
      if (that.stopped) return callback();

      // set called as true
      called = true;
      that._next();
      // pass the exception
      const err = new Error(timeout + 'ms timeout');
      err['name'] = 'BagpipeTimeoutError';
      err['data'] = {
        name: method.name,
        method: method.toString(),
        args: args.slice(0, -1),
      };
      callback(err);
    }, timeout);
  }
  setTimeout(function () {
    method.apply(null, args);
  }, 0);
};
