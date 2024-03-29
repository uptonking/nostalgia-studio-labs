import { type BaseServerOptions, type Logger } from '../base-server/index';
import { BaseServer } from '../base-server/index';

export interface LoggerOptions {
  /**
   * Logger message format.
   */
  type?: 'human' | 'json';

  /**
   * Stream to be used by logger to write log.
   */
  stream?: {
    write(str: string): void;

    /**
     * Used by pino to synchronously write log messages on application failure.
     */
    flushSync?(): void;
  };
}

export interface ServerOptions extends BaseServerOptions {
  /**
   * Logger with custom settings.
   *
   * You can either configure built-in logger or provide your own.
   * Custom logger example: pino logger that streams logs to
   * elasticsearch
   *
   * ```js
   * import pino from 'pino'
   * import pinoElastic from 'pino-elasticsearch'
   *
   * const streamToElastic = pinoElastic({
   *   consistency: 'one',
   *   node: 'http://localhost:9200',
   *   ecs: true
   * })
   *
   * const server = new Server(
   *   Server.loadOptions(process, {
   *     …,
   *     logger: pino({ level: 'info' }, streamToElastic)
   *   })
   * )
   * ```
   *
   * Other logger examples can be found here http://getpino.io/#/docs/ecosystem
   */
  logger?: Logger | LoggerOptions;
}

/**
 * End-user API to create Logux server.
 *
 * ```js
 * import { Server } from '@logux/server'
 *
 * const env = process.env.NODE_ENV || 'development'
 * const envOptions = {}
 * if (env === 'production') {
 *   envOptions.cert = 'cert.pem'
 *   envOptions.key = 'key.pem'
 * }
 *
 * const server = new Server(Object.assign({
 *   subprotocol: '1.0.0',
 *   supports: '1.x || 0.x',
 *   fileUrl: import.meta.url
 * }, envOptions))
 *
 * server.listen()
 * ```
 */
export class Server<Headers extends object = {}> extends BaseServer<Headers> {
  /**
   * Load options from command-line arguments and/or environment.
   *
   * ```js
   * const server = new Server(Server.loadOptions(process, {
   *   subprotocol: '1.0.0',
   *   supports: '1.x',
   *   fileUrl: import.meta.url,
   *   port: 31337
   * }))
   * ```
   *
   * @param process Current process object.
   * @param defaults Default server options. Arguments and environment
   *                 variables will override them.
   * @returns Parsed options object.
   */
  static loadOptions(
    process: NodeJS.Process,
    defaults: ServerOptions,
  ): ServerOptions;

  /**
   * @param opts Server options.
   */
  constructor(opts: ServerOptions);

  /**
   * Server options.
   *
   * ```js
   * console.log('Server options', server.options.subprotocol)
   * ```
   */
  options: ServerOptions;

  /**
   * Load module creators and apply to the server. By default, it will load
   * files from `modules/*`.
   *
   * ```js
   * await server.autoloadModules()
   * ```
   *
   * @param files Pattern for module files.
   */
  autoloadModules(files?: string[] | string): Promise<void>;
}
