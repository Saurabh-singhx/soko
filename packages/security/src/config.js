/**
 * Configuration and path resolution for Soko Security subsystem.
 * Follows standard OS directory specifications:
 * - Linux: $XDG_CONFIG_HOME/soko (fallback ~/.config/soko)
 * - Windows: %APPDATA%\soko (fallback ~/.config/soko or ~/AppData/Roaming/soko)
 * - macOS: ~/Library/Application Support/soko
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_PORT = 8766;

// Rate limiting thresholds
const RATE_LIMIT_CONFIG = {
  STAGE_1_ATTEMPTS: 3,       // After 3 failed attempts: 15s delay
  STAGE_1_DELAY_MS: 15000,
  STAGE_2_ATTEMPTS: 5,       // After 5 failed attempts: 60s cooldown
  STAGE_2_DELAY_MS: 60000,
  STAGE_3_ATTEMPTS: 10,      // After 10 failed attempts: 10 min IP block & regenerate PIN
  STAGE_3_BLOCK_MS: 600000,
  CLEANUP_INTERVAL_MS: 300000, // Clean stale records every 5 mins
  RECORD_TTL_MS: 3600000,      // Prune inactive records after 1 hour
};

/**
 * Resolves the root configuration directory for Soko according to OS conventions.
 * If SOKO_CONFIG_DIR environment variable is set, it takes precedence.
 */
function resolveConfigDir() {
  if (process.env.SOKO_CONFIG_DIR) {
    return path.resolve(process.env.SOKO_CONFIG_DIR);
  }

  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'soko');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'soko');
  }

  // Linux and other POSIX systems (XDG Base Directory specification)
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdgConfig, 'soko');
}

/**
 * Ensures the configuration directory exists with strict permissions (0700 on POSIX).
 */
function ensureConfigDir(customDir) {
  const dir = customDir || resolveConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else if (os.platform() !== 'win32') {
    try {
      fs.chmodSync(dir, 0o700);
    } catch {}
  }
  return dir;
}

/**
 * Returns canonical file paths for security artifacts.
 */
function getSecurityPaths(customConfigDir) {
  const configDir = customConfigDir || resolveConfigDir();
  return {
    configDir,
    trustStorePath: path.join(configDir, 'trust_store.json'),
    certsDir: path.join(configDir, 'certs'),
    certPath: path.join(configDir, 'certs', 'bridge_cert.pem'),
    keyPath: path.join(configDir, 'certs', 'bridge_key.pem'),
  };
}

module.exports = {
  DEFAULT_TOKEN_TTL_MS,
  DEFAULT_PORT,
  RATE_LIMIT_CONFIG,
  resolveConfigDir,
  ensureConfigDir,
  getSecurityPaths,
};
