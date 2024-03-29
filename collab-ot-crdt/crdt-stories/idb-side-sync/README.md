## Overview

> forked from https://github.com/clintharris/IDBSideSync /MIT

IDBSideSync is an experimental JavaScript library that makes it possible to sync browser-based IndexedDB databases using [CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) concepts.

You could use this library to, for example, build an HTML/JavaScript app that allows users to sync their data across the browsers they use on different devices while allowing them to decide where their data is stored. In other words, instead of users sending their data to a service that you (the app developer) manages, you allow them to choose where their data is stored remotely to support syncing--preferably, a place where they already keep their stuff, such as Google Drive, GitHub, or another browser-accessible data store they trust.

The concept that IDBSideSync is attempting to prove is: local-first, browser-based apps can be built with support for sync and collaboration using CRDTs and remote stores that users have more control over--especially ones that can be managed via a user-friendly, file-system-like interface. An app that needs to handle a ton of data or support real-time collaboration among many users probably needs a more traditional backend or [DBaaS](https://en.wikipedia.org/wiki/Cloud_database). But there's a [category of end-user software](https://www.inkandswitch.com/local-first.html) where things can work primarily offline, without real-time sync, that might be improved by allowing users to "keep" their own data--that's probably a better fit for for something like IDBSideSync.

### 🚨 使用注意

- google-drive中刚删除文件时，文件仍在回收站，此时同步会把回收站的数据也拉取到本地
  - 拉取远程变更数据时，要过滤掉回收站的，但可保留已删除的，因为拉回本地也无影响

### codebase

- src-code
  - 先看 ./types/main.ts 分析应用表结构的设计
  - 业务系统很难把代码写得有条理

- hlc逻辑时钟
  - add/put > recordOp > HLClock.tick，每次crud操作对应的op都会带有一个新时间戳，一般+1
  - applyOplogEntry > HLClock.tickPast, 每次执行op都会检查并尝试更新本地hlc

- 同步逻辑
  - 需要手动触发同步，基于google-drive，这里可参考remoteStorage；也可改为定时触发
  - 同步在应用层的实现基于plugin
    - 在应用首次初始化时，创建插件对象，尝试触发自动登录之前登录过的帐号

- 同步接口设计
  - 获取本地最新上传时间Date对象 `getMostRecentUploadedEntryTime(): Promise<Date>`; 
    - 每次上传云端都会更新本地 mostRecentUploadedEntryTimeMsec
  - 上传本地op记录数据到云端 `saveRemoteEntry(entry)`; 
  - 从云端请求非本地clientId的其他设备的afterTime时间之后的op记录及内容 
    - `getRemoteEntries: (params: { clientId: string; afterTime?: Date | null; })`;
    - 查询 clientIdX 在本地的最新op的时间T
    - 从云端获取clientIdX在T时间之后的op记录及内容
    - 将clientIdX的云端op应用在本地

- roadmap
  - 自动定期清理无用的op，以减少存储空间
  - render方法中存在大量异步计算，当在1个frame的计算量过大时，如何优化
  - 迁移原仓库的cypress测试
  - 支持可插拔的协作，如何去掉op记录表
    - 去掉idb操作相关的代理逻辑

- google-drive保存数据的格式
  - 文件名以日期开头的原因是，方便利用google drive api搜索能容易找到多个设备总体的最新op记录
  - `clientId:8127f91c2048654b.clientinfo.json` 内容为字符串 {}
  - `2022-11-22T09:45:49.536Z 0000 clientId:8127f91c2048654b.oplogmsg.json` 文件名+内容 对应OpLogObjectStore中一个记录的key和value

```JSON
{
  "key": "2022-11-22T09:45:49.538Z_0001_8127f91c2048654b",
  "value": {
    "clientId": "8127f91c2048654b",
    "hlcTime": "2022-11-22T09:45:49.538Z_0001_8127f91c2048654b",
    "store": "todo_types",
    "objectKey": "04f96261-cec7-4675-9713-e549ae2b7e86",
    "prop": "name",
    "value": "Important"
  }
}
```

- 在修改view层数据(不一定在内存)的同时，创建修改操作op并保存到idb，这一逻辑基于proxy代理模式实现
  - dom的更新 ~~通过轮询新数据然后rerender实现~~
    - 通过在触发更新的事件中，先更新idb数据，然后从idb读取最新数据执行rerender来更新dom

- ❓ 系统预置数据如待办类型合并时可能出现名称相同的情况，用户添加数据时也可能出现
  - 对于__同一个用户__的__同属性名数据__，按最新时间合并属性值是可行的

- ❓❓ 如何使web应用在 纯内存数据源(如redux单例状态) 和 外部数据源(如idb/sqlite) 间切换
  - 首先获取view层数据的逻辑改成async
  - 将获取数据的逻辑，从取 state.prop1 改为 idb.tr.objectStore1
  - 可参考 stoxy-js(内置数据源切换)
  - 可参考 crdt-hlc(纯内存) 和 idbsidesync(纯外部数据源)

- ✅ 本地触发的op，对应的hlc是否会在recordOp和applyOplogEntry2处各增加一次
  - 对于本地的op，applyOplogEntry会比较op和本地的hlc，并不会更新本地hlc

- ✅ 为什么更新idb数据的proxiedPut方法中，要执行2次put
  - 只是因为代理put方法需要立即返回一个IDBRequest，
  - 若不在后面添加一个临时的put，因为前面一个put需要在onsuccess中操作数据，则代理方法就没有一个合法的返回值

## How it works

- You have an HTML/JavaScript app that uses IndexedDB.
- We'll call each "user + browser + app" instance of your app a _client_.
- As your app makes [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) calls to its IndexedDB database, IDBSideSync proxies/intercepts those calls and records the operations to a log (the "oplog").
- Your app registers a "sync plugin" (some JavaScript) with IDBSideSync; a plugin implements a standard interface and knows how to perform certain operations with that store (e.g., knows how to store and retrieve data using Google Drive's API).
- At some point, your app asks IDBSideSync to _sync_--maybe your app offers a "Sync" button or schedules it to happen automatically.
- IDBSideSync will upload the client's oplog entries (CRDT state mutation messages) to the remote data store using the registered plugins, and also download _other client's_ oplog entries--which then get applied to your app's database.
- A [hybrid logical clock](https://jaredforsyth.com/posts/hybrid-logical-clocks/) (i.e., time + counter) is maintained among the clients to help figure out which operations "win" if more than one exists for the same database store/record/property.

## Motivation, prior art

The idea for the library comes from wanting a way to build a browser-based app that can sync while allowing users to keep their data--no developer-managed backend needed--and from learning about CRDTs from [James Long](https://twitter.com/jlongster)'s
[crdt-example-app](https://github.com/jlongster/crdt-example-app). In fact, IDBSideSync forks from crdt-example-app and in some cases still uses modified versions of James' code. 

The decision to focus on using IndexedDB comes from wanting to be pragmmatic. Instead of needing to invent a whole new database API, why not just piggy back on one that already exists in every browser and try to add the ability for it to sync using CRDTs?

## Demo

You can check out the "to-dos" app used for dev/testing that syncs with Google Drive at [https://idbsidesync-todo-demo.vercel.app](https://idbsidesync-todo-demo.vercel.app).

Try opening the site in a couple of browsers and creating some tasks. Then, in each browser, click the "Sync Settings" button to grant (limited) access to Google Drive--this will create a new folder in your Google Drive called `IDBSideSync ToDo App` where app data will be copied and sync'ed across browsers.

> ⚠️ The demo app cannot access _all_ of your Google Drive data--just the files/folders that it creates (and your name and email address, which can't be avoided due to how Google OAuth works), as indicated by Google's authorization pop-up.

> ⚠️ You might need to disable some browser privacy features that prevent the Google Drive setup from working, such as pop-up and/or cookie blockers. The Google OAuth process involves displaying a pop-up and using local storage to remember who you are when the app tries to sync with Google Drive.

After clicking the "Sync" button in both browsers, you'll see a folder in your Google Drive called `IDBSideSync ToDo App` where you can access all the oplog entries and other sync-related files. Each time you click "Sync", the browser will upload any new changes to this folder, and download any new changes made from other browsers.

The demo source can be found in [ `app_demos/plainjs_todos` ](./app_demos/plainjs_todos). Take a look at `main.js` and `db.js` , in particular, to see how things work.

Lastly, note that the goal of the "plain JS" app is to provide a "framework agnostic" testing and development tool, and an example of how to use IDBSideSync, without requiring prior understanding of other libraries like React. It's not meant to be efficient or very pretty--but hopefully it's easy for other developers to understand and modify (and credit for the super-simple approach goes to James).

## Usage

### Setup

First, you'll need to add a few lines to your existing IndexedDB setup code for initializing `IDBSideSync` :

```javascript
const openRequest = indexedDB.open("todo-app", 1);

openRequest.onupgradeneeded = (event) => {
  const db = event.target.result;

  // ⛔️ Note that IDBSideSync does NOT support object stores with the autoIncrement option. This
  // is because if IndexedDB were allowed to auto-assign the "keys" for objects, there would be
  // no guarantee of uniqueness.
  //
  // ⛔️ IDBSideSync doesn't currently support "nested" keyPath values (e.g., `keyPath: 'foo.bar'`).
  const todosStore = db.createObjectStore("todos", { keyPath: "id" });

  // Give IDBSideSync a chance to create its own object stores and indices.
  IDBSideSync.onupgradeneeded(event);
};

openRequest.onsuccess = () => {
  // Now that the object stores exist, allow IDBSideSync to initiailize itself before using it.
  IDBSideSync.init(openreq.result);
};
```

### Adding objects

Now just make sure to use an "IDBSideSync wrapped" version of the IndexedDB object store so that data mutations can be intercepted and recorded in the background as you perform CRUD operations on your data:

```javascript
// Make sure to include IDBSideSync's OPLOG_STORE in the transaction (otherwise it won't be able
// to commit/rollback its own operation log changes as part of the same transaction).
const txRequest = db.transaction(
  ["todos", IDBSideSync.OPLOG_STORE],
  "readwrite"
);
const todoStore = IDBSideSync.proxyStore(txRequest.objectStore("todos"));

// You need to ensure that object keys are unqiue. One option is to use  IDBSideSync's `uuid()`
// convenience function.
const todoId = IDBSideSync.uuid(); // 123
todoStore.add({ id: todoId, title: "Buy milk" }); // { id: 123, title: "Buy milk" }
```

### Updating objects

IDBSideSync, acting as a [JavaScript proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to the standard [ `IDBObjectStore.put()` ](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/put) function, modifies the default behavior of `put()` so that it no longer completely replaces any existing object with the value you pass to it. Instead, you now have the ability to pass in "partial updates"--objects with only a subset of properties--that will be applied to any existing object. (You can still pass in complete objects with all properties if you want, of course.)

```javascript
// Given a "full" todo object of `{ id: 123, title: "Buy cookies", priority: "low", done: false }`,
// let's say the user just changed its priority from "low" to "high"...
todoStore.put({ priority: "high" }, todoId); // 👍 Only update the prop that was changed: GOOD.

// In a separate transaction...
todoStore.get(todoId).onsuccess = (event) => {
  console.log(event.target.result); // { id: 123, title: "Buy cookies", priority: "high", done: false }
};
```

Only pass in an object with props/values that you have actually changed. This helps ensure that your changes, and the changes that might be made to the same object somewhere else, are _merged_.

If, instead, if you pass in a "complete" version of an object with all the properties--including ones you didn't modify--you may end up overwriting changes that were made to a specific prop somewhere else.

```javascript
// 👎 User only changed priority, but let's update all the props anyways: BAD
todoStore.put({ title: "Buy cookies", priority: "high", done: false }, todoId);

// In a separate transaction...
todoStore.get(todoId).onsuccess = (event) => {
  // 😭 If someone else had previously marked this todo as "done", their change will be lost once
  // they receive these changes since an operation log entry was just created that overwrites all
  // props on the todo--including the "done" property.
  console.log(event.target.result); //{id: 123, title: "Buy cookies", priority: "high", done: false}
};
```

### Deleting objects

For now, IDBSideSync doesn't support the deletion of things (although this might be a feature in the future). Don't do the following things, for example:

```javascript
const todoStore = IDBSideSync.proxyStore(txRequest.objectStore("todos"));

// Don't do this...
todoStore.delete(todoId); // ❌

// ...or this
todoStore.openCursor().onsuccess = function(event) {
  const cursor = event.target.result;
  cursor.delete(); // ❌
};

// ...or this
const todoIndex = todoStore.index("todos_indxed_by_title");
todoIndex.openCursor().onsuccess = function(event) {
  const cursor = event.target.result;
  cursor.delete(); // ❌
};
```

In fact, IDBSideSync might be modified at some point to throw errors if you do any of the stuff shown above to help prevent problems.

As a recommended alternative, do "soft" deletion of objects instead. In other words, update them with some sort of property that indicates they should be _treated_ as if they were deleted (e.g., `{ name: 'foo', deleted: 1 }` ). Note that a nice benefit of this approach is that it's easy to support undo when objecs are "deleted".

### Syncing

As described in the "How it works" section above, the idea with syncing is to copy oplog entries from one client to some other place where those entries can be downloaded by another client that would then apply the CRDT state changes to its own IndexedDB object stores. For example, a user might log in to your app on their phone's browser, upload their oplog entries to Google Drive, and then download and "replay" those changes from Google Drive when they use your app in a browser on their laptop.

The core IDBSideSync library doesn't know how to copy the oplog entries around; it relies on one or more plugins--separate JavaScript objects that implement a standard interface--to handle things like uploading/downloading oplog entries. For an example, see the Google Drive plugin in [ `plugins/googledrive/` ](./plugins/googledrive).

> Interested in adding plugins to support additional remote stores? Please take a look through the "Issues" section (e.g., [Dropbox support](https://github.com/clintharris/IDBSideSync/issues/6)) or submit a pull request! While adding support for "more common" storage services (i.e., places where more users may already have an account) may be prioritized, there's also potential to develop plugins that sync with more interesting data stores, such as IPFS, [HTTP-accessible email](https://github.com/clintharris/IDBSideSync/issues/13), or even file import/export. The main limitation is that the data store be accessible via browser APIs.

Your app is responsible for registering sync plugins. Here's an example, copied from [ `main.js` ](app_demos/plainjs_todos/main.js) in the "ToDo" demo app:

```javascript
// Instantiate and register the Google Drive plugin
const googleDrivePlugin = new IDBSideSync.plugins.googledrive.GoogleDrivePlugin({
  googleAppClientId: '1004853515655-8qhi3kf64cllut2no4trescfq3p6jknm.apps.googleusercontent.com',
  defaultFolderName: 'IDBSideSync ToDo App',
  onSignInChange: onGoogleSignInChange,
});
await IDBSideSync.registerSyncPlugin(googleDrivePlugin);

// Sync with remote storage services using whatever plugins are registered
await IDBSideSync.sync();
```

Although a plugin doesn't have to be implemented in TypeScript, the `SyncPlugin` interface in [ `main.d.ts` ](types/common/main.d.ts) defines the functions that a plugin needs to implement. For example, a plugin needs to implement a `getRemoteEntriesForClient()` function, which is used as follows in the `sync()` function of the core library's [ `sync.ts` ](lib/src/sync.ts) file:

```javascript
let downloadCounter = 0;
for await (const remoteEntry of plugin.getRemoteEntries({
  clientId: remoteClientId,
  afterTime: mostRecentKnownOplogTimeForRemoteClient,
})) {
  db.applyOplogEntry(remoteEntry);
  downloadCounter++;
}
log.debug(`Downloaded ${downloadCounter} oplog entries for remote client '${remoteClientId}'.`);
```

## FAQ

### Q: How is this different from Firebase?

IDBSideSync isn't trying to compete with Firebase. It's trying to demonstrate a different approach to how apps can store user's data. Instead of an app coupling itself to Firebase--a place where a user can't really access or assert control over their own data--IDBSideSync is asking the question: what if the app lets the user choose where their data is kept, and what if they can easily manage the data while it's there?

Also, Firebase might be better suited for "temporarily offline" vs. "offline first" apps, with a focus on keeping most data remote and minimizing a local cache to only what is necessary. Although not officially documented, it seems that its offline cache is not intended to be used exclusively for long periods and will become less efficient as time passes (as suggested by one of the Firebase engineers [here](https://stackoverflow.com/a/38790754/62694).

The concept that IDBSideSync is trying to prove won't work for many apps. An app that needs to handle a ton of data and support real-time collaboration among many users might need to use a DBaaS like Firebase. But there's also a category of software where things can work primarily offline without real-time sync, that might be improved by allowing users to "keep" their own data without giving up sync or using a public ledger. 

### Q: How is this different from CouchDB/PouchDB/Couchbase?

Similar to Firebase, an app that uses a "Couch" database will probably only sync with servers/peers that support that protocol/API. IDBSideSync's goal, however, is to allow users to pick and choose where their data is stored remotely and to support remote storage options that they already use and can easily manage themselves (i.e., a Google Drive folder instead of figuring out how to manage their own data on Couchbase).

### Q: I really dislike the IndexedDB API...do I have to use it?

Yes, IDBSideSync only works with IndexedDB. It's a pragmatic choice if you want a persistent data store API that is ubiquitous across most browsers.

That said, agreed: the IndexedDB's API isn't nearly as convenient as many popular databases. Take a look at Jake Archibald's [idb](https://github.com/jakearchibald/idb) library--it makes using IndexedDB a bit easier.

### Q: What types of object stores does it work with?

IDBSideSync does not support object stores that use `autoIncrement` . If IndexedDB is auto-assigning the object IDs, then it's possible for two separate clients to create an object with the same key/ID. In that scenario, there's no safe way to share and apply oplog entries (i.e., CRDT messages) since they might describe mutations that _appear_ to be relevant to the same object but actually could refer to different objects that have the same key/ID.

Also, IDBSideSync currently doesn't support `add(value, key)` or `put(value, key)` calls when `key` is of type `ArrayBuffer` or `DataView` .

### Q: What happens if the same oplog/change message is "ingested" more than once?

It will have no effect on the data store. Message values are only applied to the data store if the message's HLC time is more recent than the current value.

### Q: Why does it add `IDBSideSync_*` object stores to my app's IndexedDB database?

IDBSideSync uses these stores to record all of the change operations ("oplog" entries) and keep track of internal things like information that registered sync plugins use with remote storage services.

Also, IDBSideSync's object stores need to be "co-located" your app's stores so that both sets of stores can be included in the same transactions. If your app's attempt to write data to its own store fails, then IDBSideSync's attempt to record the operation as an oplog entry should also fail.

### Q: Is the remote syncing mechanism resilient to tampering?

Any entity that has access to the oplog entry data while stored on a remote file system has the ability to alter those CRDT messages. Granting an entity access to a data store used for remote sync implies trusting that entity. In other words, the remote store--usually something like a shared folder within Dropbox or Google Drive--should only be shared with people you trust.

That said, it would be nice to detect (and possibly fix) accidental deletion or alteration of oplog entry data. Adding data integrety checks is on the roadmap (see [issue #4](https://github.com/clintharris/IDBSideSync/issues/4)).
