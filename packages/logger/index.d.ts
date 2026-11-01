export interface RollingFileLoggerOptions {
  appName?: string;
  filename?: string;
  logDir?: string;
  maxFileSizeBytes?: number;
  maxHistoryFiles?: number;
  minFreeDiskSpaceMb?: number;
}

export declare class RollingFileLogger {
  constructor(options?: RollingFileLoggerOptions);
  getLogPath(): string;
  getLogDir(): string;
  rotateSync(): void;
  writeEntry(level: 'INFO' | 'WARN' | 'ERROR', message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  flushSync(): void;
  flush(): Promise<void>;
  attachConsole(): void;
  detachConsole(): void;
  close(): void;
}

export declare function resolveStandardLogDir(appName?: string): string;
