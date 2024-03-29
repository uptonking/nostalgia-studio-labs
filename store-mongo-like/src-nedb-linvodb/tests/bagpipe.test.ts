import chai from 'chai';
import pedding from 'pedding';

import { Bagpipe } from '../src/utils/bagpipe';

const should = chai.should();

describe('✨ Bagpipe Utils', function () {
  const async = (ms, callback) => {
    setTimeout(() => callback(null, {}), ms);
  };

  it('constructor', function () {
    const bagpipe = new Bagpipe(10);
    bagpipe.limit.should.be.equal(10);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    bagpipe.options.disabled.should.be.equal(false);
  });

  it('constructor with async limit disabled option', function () {
    const bagpipe = new Bagpipe(10, true);
    bagpipe.limit.should.be.equal(10);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    bagpipe.options.disabled.should.be.equal(true);
  });

  it('constructor limit less than 1', function (done) {
    const bagpipe = new Bagpipe(0);
    bagpipe.push(async, 10, function () {
      bagpipe.active.should.be.equal(0);
      done();
    });
    // bagpipe.active.should.be.equal(0);
  });

  it('constructor limit less than 1 for nextTick', function (done) {
    const bagpipe = new Bagpipe(0);
    bagpipe.push(process.nextTick, function () {
      bagpipe.active.should.be.equal(0);
      done();
    });
    bagpipe.active.should.be.equal(0);
  });

  it('constructor disabled is true', function (done) {
    const bagpipe = new Bagpipe(10, true);
    bagpipe.push(async, 10, function () {
      bagpipe.active.should.be.equal(0);
      done();
    });
    bagpipe.active.should.be.equal(0);
  });

  it('push', function (done) {
    const bagpipe = new Bagpipe(5);
    bagpipe.limit.should.be.equal(5);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    bagpipe.push(async, 10, function () {
      bagpipe.active.should.be.equal(0);
      done();
    });
    bagpipe.active.should.be.equal(1);
  });

  it('push, async with this', function (done) {
    const bagpipe = new Bagpipe(5);
    bagpipe.limit.should.be.equal(5);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    const context: { value: number; async?: Function } = { value: 10 };
    context.async = function (callback) {
      this.value--;
      const that = this;
      process.nextTick(function () {
        callback(that.value);
      });
    };

    bagpipe.push(context.async.bind(context), function () {
      bagpipe.active.should.be.equal(0);
      done();
    });
    bagpipe.active.should.be.equal(1);
  });

  it('push, active should not be above limit', function (done) {
    const limit = 5;
    const bagpipe = new Bagpipe(limit);
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    let counter = 10;
    for (let i = 0; i < counter; i++) {
      bagpipe.push(async, 1 + Math.round(Math.random() * 10), function () {
        bagpipe.active.should.not.be.above(limit);
        counter--;
        if (counter === 0) {
          done();
        }
      });
      bagpipe.active.should.not.be.above(limit);
    }
  });

  it('push, disabled, active should not be above limit', function (done) {
    const limit = 5;
    const bagpipe = new Bagpipe(limit, true);
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    let counter = 10;
    for (let i = 0; i < counter; i++) {
      bagpipe.push(async, 10 + Math.round(Math.random() * 10), function () {
        bagpipe.active.should.be.equal(0);
        counter--;
        if (counter === 0) {
          done();
        }
      });
      bagpipe.active.should.be.equal(0);
    }
  });

  it('full event should fired when above limit', function (done) {
    const limit = 5;
    const bagpipe = new Bagpipe(limit);
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    let counter = 0;
    bagpipe.on('full', function (length) {
      length.should.above(1);
      counter++;
    });

    const noop = function () {};
    for (let i = 0; i < 100; i++) {
      bagpipe.push(async, 10, noop);
    }
    counter.should.above(0);
    done();
  });

  it('should support without callback', function (done) {
    const limit = 5;
    const bagpipe = new Bagpipe(limit);
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    bagpipe.push(async, 10);
    bagpipe.active.should.be.equal(1);
    done();
  });

  it('should get TooMuchAsyncCallError', function (done) {
    done = pedding(5, done);
    const limit = 2;
    const bagpipe = new Bagpipe(limit, {
      refuse: true,
    });
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    for (let i = 0; i < 4; i++) {
      bagpipe.push(async, 10, function (err) {
        should.not.exist(err);
        done();
      });
    }
    bagpipe.push(async, 10, function (err) {
      should.exist(err);
      done();
    });
    bagpipe.active.should.be.equal(2);
  });

  it('should get TooMuchAsyncCallError with ratio', function (done) {
    done = pedding(7, done);

    const limit = 2;
    const bagpipe = new Bagpipe(limit, {
      refuse: true,
      ratio: 2,
    });
    bagpipe.limit.should.be.equal(limit);
    bagpipe.queue.should.have.length(0);
    bagpipe.active.should.be.equal(0);
    for (let i = 0; i < 2; i++) {
      bagpipe.push(async, 10, (err) => {
        should.not.exist(err);
        done();
      });
    }
    bagpipe.queue.should.have.length(0);
    for (let i = 0; i < 4; i++) {
      bagpipe.push(async, 10, function (err) {
        should.not.exist(err);
        done();
      });
    }
    bagpipe.queue.should.have.length(4);
    bagpipe.push(async, 10, function (err) {
      should.exist(err);
      done();
    });
    bagpipe.active.should.be.equal(2);
    bagpipe.queue.should.have.length(4);
  });

  it('should get BagpipeTimeoutError', function (done) {
    done = pedding(3, done);
    const _async = function _async(ms, callback) {
      setTimeout(function () {
        callback(null, { ms: ms });
      }, ms);
    };
    const _async2 = function _async(ms, callback) {
      setTimeout(function () {
        callback(new Error('Timeout'));
      }, ms);
    };
    const bagpipe = new Bagpipe(10, {
      timeout: 10,
    });
    bagpipe.on('outdated', function (err) {
      should.exist(err);
      done();
    });

    bagpipe.push(_async, 5, function (err, data) {
      should.not.exist(err);
      should.exist(data);
      data.should.have.property('ms', 5);
      done();
    });

    bagpipe.push(_async2, 15, function (err) {
      should.exist(err);
      err.name.should.eql('BagpipeTimeoutError');
      err.message.should.eql('10ms timeout');
      err.data.should.have.property('name', '_async');
      err.data.should.have.property('method');
      err.data.args.should.eql([15]);
      done();
    });
  });
});
