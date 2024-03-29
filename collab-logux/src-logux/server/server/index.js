import glob from 'fast-glob';
import { join, relative } from 'path';
import pico from 'picocolors';

import { BaseServer } from '../base-server/index';
import { createReporter } from '../create-reporter/index';
import { loadOptions, number, oneOf } from '../options-loader/index';

const cliOptionsSpec = {
  options: {
    host: {
      alias: 'h',
      description: 'Host to bind server',
    },
    port: {
      alias: 'p',
      description: 'Port to bind server',
      parse: number,
    },
    key: {
      description: 'Path to SSL key',
    },
    cert: {
      description: 'Path to SSL certificate',
    },
    supports: {
      description: 'Range of supported client subprotocols',
    },
    subprotocol: {
      description: 'Server subprotocol',
    },
    logger: {
      alias: 'l',
      description: 'Logger type',
      parse: (value) => oneOf(['human', 'json'], value),
    },
    backend: {
      description: 'Backend to process actions',
    },
    controlSecret: {
      description: 'Secret to control Logux server',
    },
    controlMask: {
      description: 'CIDR masks of control servers',
    },
    redis: {
      description: 'Redis URL for Logux Server Pro scaling',
    },
  },
  envPrefix: 'LOGUX',
  examples: [
    '$0 --port 31337 --host 127.0.0.1',
    'LOGUX_PORT=1337 LOGUX_HOST=127.0.0.1 $0',
  ],
};

export class Server extends BaseServer {
  static loadOptions(process, defaults) {
    const [help, options] = loadOptions(
      cliOptionsSpec,
      process,
      defaults.root ? { path: join(defaults.root, '.env') } : undefined,
    );
    if (help) {
      process.stdout.write(help + '\n');
      return process.exit(0);
    }
    try {
      return Object.assign(defaults, options);
    } catch (e) {
      process.stderr.write(
        `${pico.bgRed(pico.black(' FATAL '))} ${e.message}\n`,
      );
      return process.exit(1);
    }
  }

  constructor(opts = {}) {
    if (!opts.logger) {
      opts.logger = 'human';
    }

    const reporter = createReporter(opts);

    let initialized = false;
    const onError = (err) => {
      if (initialized) {
        this.emitter.emit('fatal', err);
      } else {
        reporter('error', { err, fatal: true });
        process.exit(1);
      }
    };
    process.on('uncaughtException', onError);
    process.on('unhandledRejection', onError);

    super(opts);

    this.logger = reporter.logger;
    this.on('report', reporter);
    this.on('fatal', async () => {
      if (initialized) {
        if (!this.destroying) {
          await this.destroy();
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    });

    initialized = true;

    const onExit = async () => {
      await this.destroy();
      process.exit(0);
    };
    process.on('SIGINT', onExit);

    this.unbind.push(() => {
      process.removeListener('SIGINT', onExit);
    });
  }

  async listen(...args) {
    try {
      return BaseServer.prototype.listen.apply(this, args);
    } catch (err) {
      this.emitter.emit('report', 'error', { err });
      return process.exit(1);
    }
  }

  async autoloadModules(
    files = ['modules/*/index.js', 'modules/*.js', '!**/*.{test,spec}.js'],
  ) {
    const matches = await glob(files, {
      cwd: this.options.root,
      absolute: true,
      onlyFiles: true,
    });

    await Promise.all(
      matches.map(async (file) => {
        const serverModule = (await import(file)).default;
        if (typeof serverModule === 'function') {
          await serverModule(this);
        } else {
          const name = relative(this.options.root, file);
          const error = new Error(
            'Server module should has default export with function ' +
              'that accepts a server',
          );
          error.logux = true;
          error.note = `${name} default export is ${typeof serverModule}`;
          throw error;
        }
      }),
    );
  }
}
