import { type Action, type TestLog, type TestPair } from '@logux/core';

import { type ClientMeta } from '../client/index';
import { Client } from '../client/index';
import { type TestServer } from '../test-server/index';

export interface TestClientOptions<Headers extends object> {
  subprotocol?: string;
  headers?: Headers;
  server?: TestServer;
}

/**
 * Virtual client to test client-side code end store extnesions.
 *
 * ```js
 * import { TestClient } from '@logux/client'
 *
 * it('connects and sends actions', async () => {
 *   let client = new TestClient()
 *   let user = new UserStore(client, '10')
 *
 *   client.server.onChannel('users/10', [
 *     { type: 'users/name', userId: 10, value: 'New name' }
 *   ])
 *   await client.connect()
 *   await delay(10)
 *
 *   expect(user.name).toEqual('New name')
 * })
 * ```
 */
export class TestClient<Headers extends object = {}> extends Client<
  Headers,
  TestLog<ClientMeta>
> {
  /**
   * Virtual server to test client.
   *
   * ```js
   * expect(client.server.log.actions()).toEqual([
   *   { type: 'logux/subscribe', channel: 'users/10' }
   * ])
   * ```
   */
  readonly server: TestServer;

  /**
   * Connection between client and server.
   */
  readonly pair: TestPair;

  /**
   * @param userId User ID.
   * @param opts Other options.
   */
  constructor(userId: string, opts?: TestClientOptions<Headers>);

  /**
   * Connect to virtual server.
   *
   * ```js
   * await client.connect()
   * ```
   *
   * @returns Promise until connection will be established.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from virtual server.
   *
   * ```js
   * client.disconnect()
   * ```
   */
  disconnect(): void;

  /**
   * Does client subscribed to specific channel.
   *
   * ```js
   * let user = new UserStore(client, '10')
   * await delay(10)
   * expect(client.subscribed('users/10')).toBe(true)
   * ```
   *
   * @param channel Channel name.
   * @returns Does client has an active subscription.
   */
  subscribed(channel: string): boolean;

  /**
   * Collect actions sent by client during the `test` call.
   *
   * ```js
   * let answers = await client.sent(async () => {
   *   client.log.add({ type: 'local' })
   * })
   * expect(actions).toEqual([{ type: 'local' }])
   * ```
   *
   * @param test Function, where do you expect action will be received
   * @returns Promise with all received actions
   */
  sent(test: () => Promise<void> | void): Promise<Action[]>;
}
