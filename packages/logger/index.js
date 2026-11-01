const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

/**
 * Resolves standard OS log directory according to XDG/Windows/macOS conventions
 */
function resolveStandardLogDir(appName = 'soko') {
  if (process.env.SOKO_LOG_DIR) {
    return path.resolve(process.env.SOKO_LOG_DIR);
  }

  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(localAppData, appName, 'logs');
  }

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Logs', appName);
  }

  // Linux / POSIX: Follow XDG State or Data convention
  const xdgState = process.env.XDG_STATE_HOME || path.join(home, '.local', 'state');
  return path.join(xdgState, appName, 'logs');
}

/**
 * Production Rolling File Logger
 * Enforces file size bounds (default 10MB) and retains historical files (.1, .2, .3)
 */
class RollingFileLogger {
  constructor(options = {}) {
    this.appName = options.appName || 'soko';
    this.filename = options.filename || 'soko_bridge.log';
    this.logDir = options.logDir || resolveStandardLogDir(this.appName);
    this.maxFileSizeBytes = options.maxFileSizeBytes || 10 * 1024 * 1024; // 10 MB
    this.maxHistoryFiles = typeof options.maxHistoryFiles === 'number' ? options.maxHistoryFiles : 3;
    this.minFreeDiskSpaceMb = options.minFreeDiskSpaceMb || 25; // 25 MB safety limit
    this.logPath = path.join(this.logDir, this.filename);

    this.currentSizeBytes = 0;
    this.isRotating = false;
    this.writeBuffer = [];
    this.drainTimer = null;
    this.isAttached = false;
    this.originalConsole = null;

    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (fs.existsSync(this.logPath)) {
        const stat = fs.statSync(this.logPath);
        this.currentSizeBytes = stat.size;
      } else {
        this.currentSizeBytes = 0;
        fs.writeFileSync(this.logPath, '', { mode: 0o644 });
      }
    } catch (err) {
      process.stderr.write(`[RollingFileLogger] Failed to initialize log directory: ${err.message}\n`);
    }

    // Safety flush on process termination
    this.cleanupHandler = () => {
      this.flushSync();
    };
    process.once('exit', this.cleanupHandler);
  }

  getLogPath() {
    return this.logPath;
  }

  getLogDir() {
    return this.logDir;
  }

  rotateSync() {
    if (this.isRotating) return;
    this.isRotating = true;

    try {
      // 1. Remove oldest historical file if present
      const oldestFile = `${this.logPath}.${this.maxHistoryFiles}`;
      if (fs.existsSync(oldestFile)) {
        try { fs.unlinkSync(oldestFile); } catch {}
      }

      // 2. Shift existing files: .2 -> .3, .1 -> .2
      for (let i = this.maxHistoryFiles - 1; i >= 1; i--) {
        const src = `${this.logPath}.${i}`;
        const dest = `${this.logPath}.${i + 1}`;
        if (fs.existsSync(src)) {
          try { fs.renameSync(src, dest); } catch {}
        }
      }

      // 3. Rename current log file to .1
      if (fs.existsSync(this.logPath)) {
        try { fs.renameSync(this.logPath, `${this.logPath}.1`); } catch {}
      }

      // 4. Create clean new log file
      fs.writeFileSync(this.logPath, '', { mode: 0o644 });
      this.currentSizeBytes = 0;
    } catch (err) {
      process.stderr.write(`[RollingFileLogger] Rotation error: ${err.message}\n`);
    } finally {
      this.isRotating = false;
    }
  }

  writeEntry(level, message) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    const byteLength = Buffer.byteLength(formatted, 'utf8');

    if (this.currentSizeBytes + byteLength >= this.maxFileSizeBytes) {
      this.rotateSync();
    }

    try {
      fs.appendFileSync(this.logPath, formatted, 'utf8');
      this.currentSizeBytes += byteLength;
    } catch (err) {
      // Non-fatal write error (e.g. disk full)
    }
  }

  info(message) {
    this.writeEntry('INFO', message);
  }

  warn(message) {
    this.writeEntry('WARN', message);
  }

  error(message) {
    this.writeEntry('ERROR', message);
  }

  flush() {
    this.flushSync();
    return Promise.resolve();
  }

  flushSync() {
    if (this.writeBuffer.length > 0) {
      const data = this.writeBuffer.join('');
      this.writeBuffer = [];
      try {
        fs.appendFileSync(this.logPath, data, 'utf8');
      } catch {}
    }
  }

  attachConsole() {
    if (this.isAttached) return;
    this.isAttached = true;

    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const self = this;

    console.log = function (...args) {
      self.originalConsole.log.apply(console, args);
      self.writeEntry('INFO', util.format(...args));
    };

    console.info = function (...args) {
      self.originalConsole.info.apply(console, args);
      self.writeEntry('INFO', util.format(...args));
    };

    console.warn = function (...args) {
      self.originalConsole.warn.apply(console, args);
      self.writeEntry('WARN', util.format(...args));
    };

    console.error = function (...args) {
      self.originalConsole.error.apply(console, args);
      self.writeEntry('ERROR', util.format(...args));
    };
  }

  detachConsole() {
    if (!this.isAttached || !this.originalConsole) return;
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    this.isAttached = false;
    this.originalConsole = null;
  }

  close() {
    this.detachConsole();
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
  }
}

module.exports = {
  RollingFileLogger,
  resolveStandardLogDir,
};
