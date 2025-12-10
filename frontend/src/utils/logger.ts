/**
 * 日志工具 - 根据环境变量控制日志输出
 */

const isDevelopment = import.meta.env.DEV
const isProduction = import.meta.env.PROD

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel

  constructor() {
    // 生产环境只显示WARN和ERROR，开发环境显示所有日志
    this.level = isProduction ? LogLevel.WARN : LogLevel.DEBUG
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level
  }

  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug('[DEBUG]', ...args)
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info('[INFO]', ...args)
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn('[WARN]', ...args)
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error('[ERROR]', ...args)
      // 生产环境可以将错误发送到错误追踪服务
      if (isProduction) {
        // TODO: 集成错误追踪服务（如Sentry）
        // Sentry.captureException(new Error(args.join(' ')))
      }
    }
  }
}

// 导出单例
export const logger = new Logger()

// 默认导出
export default logger









