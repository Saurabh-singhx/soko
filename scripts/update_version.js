#!/usr/bin/env node
/**
 * Soko Universal Version Manager
 * Updates version across root package.json, apps/desktop/package.json,
 * and tauri.conf.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ROOT_PKG = path.join(ROOT_DIR, 'package.json');
const DESKTOP_PKG = path.join(ROOT_DIR, 'apps/desktop/package.json');
const TAURI_CONF = path.join(ROOT_DIR, 'apps/desktop/src-tauri/tauri.conf.json');

const rootData = JSON.parse(fs.readFileSync(ROOT_PKG, 'utf8'));
const currentVersion = rootData.version || '1.0.0';

let newVersion = process.argv[2];

if (!newVersion) {
  // Bump patch version automatically
  const parts = currentVersion.split('.').map((n) => parseInt(n, 10) || 0);
  parts[2] = (parts[2] || 0) + 1;
  newVersion = parts.join('.');
} else {
  // Clean 'v' prefix if provided (e.g., v1.0.5 -> 1.0.5)
  newVersion = newVersion.replace(/^v/, '');
}

console.log(`[Version Manager] Bumping version: ${currentVersion} -> ${newVersion}`);

// 1. Root package.json
rootData.version = newVersion;
fs.writeFileSync(ROOT_PKG, JSON.stringify(rootData, null, 2) + '\n');

// 2. Desktop package.json
if (fs.existsSync(DESKTOP_PKG)) {
  const desktopData = JSON.parse(fs.readFileSync(DESKTOP_PKG, 'utf8'));
  desktopData.version = newVersion;
  fs.writeFileSync(DESKTOP_PKG, JSON.stringify(desktopData, null, 2) + '\n');
}

// 3. Tauri configuration
if (fs.existsSync(TAURI_CONF)) {
  try {
    const tauriData = JSON.parse(fs.readFileSync(TAURI_CONF, 'utf8'));
    tauriData.version = newVersion;
    fs.writeFileSync(TAURI_CONF, JSON.stringify(tauriData, null, 2) + '\n');
  } catch (e) {
    console.warn('[Version Manager] Could not update tauri.conf.json:', e.message);
  }
}

// 4. Desktop auto-updater CURRENT_VERSION constant
const UPDATER_TS = path.join(ROOT_DIR, 'apps/desktop/src/services/updater.ts');
if (fs.existsSync(UPDATER_TS)) {
  try {
    let updaterContent = fs.readFileSync(UPDATER_TS, 'utf8');
    updaterContent = updaterContent.replace(
      /export const CURRENT_VERSION = ['"][^'"]+['"];/,
      `export const CURRENT_VERSION = '${newVersion}';`
    );
    fs.writeFileSync(UPDATER_TS, updaterContent, 'utf8');
    console.log(`[Version Manager] Synchronized updater.ts CURRENT_VERSION to ${newVersion}`);
  } catch (e) {
    console.warn('[Version Manager] Could not update updater.ts:', e.message);
  }
}

console.log(`[Version Manager] Successfully updated all packages to ${newVersion}`);
console.log(newVersion);
