// Production-ready logging utility for Cloudflare Workers
export class Logger {
  constructor(env) {
    this.logLevel = env.LOG_LEVEL || 'info';
    this.levels = {
      'error': 0,
      'warn': 1,
      'info': 2,
      'debug': 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(message, data || '');
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(message, data || '');
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(message, data || '');
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }
}