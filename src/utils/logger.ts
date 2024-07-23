enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

class Logger {
  private formatMessage(level: LogLevel, message: string): string {
    return `[Imagekit] [${level.toUpperCase()}]: ${message}`;
  }

  info(message: string): void {
    console.info(this.formatMessage(LogLevel.INFO, message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage(LogLevel.WARN, message));
  }

  error(message: string): void {
    console.error(this.formatMessage(LogLevel.ERROR, message));
  }
}

export default new Logger();
