# nedb-base

# overview

- this project is a fork of nedb
  - db core is zero-deps

- https://github.com/seald/nedb /MIT
  - Since v3, NeDB provides a Promise-based equivalent for each function suffixed with `Async`
- https://github.com/seald/node-binary-search-tree /MIT
  - a fork of node-binary-search-tree written by Louis Chatriot for storing indexes in nedb.

- https://github.com/louischatriot/nedb /MIT/201602/js
  - Embedded persistent or in memory database for Node.js, nw.js, Electron and browsers, 100% JavaScript, no binary dependency. 
  - API is a subset of MongoDB's and it's plenty fast.
# usage

# roadmap

- waterfall的异步逻辑暂不支持 同时执行多个任务、限制任务数量

## dev-to-list

- merge各个仓库的pr
# testing
- 迁移web版tests

## 待改进的测试

- setAutocompaction works if passed a number castable to a number below 5000ms
  - 耗时太长

## tests-failed

- model.test.ts
  - l378， Doesn't replace a falsy field by an object when recursively following dot notation
# more
- https://github.com/sindresorhus/p-waterfall
  - Run promise-returning & async functions in series, each passing its result to the next
  - pWaterfall(tasks, initialValue?)
