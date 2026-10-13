#!/usr/bin/env node
/**
 * Soko Auto-Update Gist Publisher
 * Updates (or creates) a GitHub Gist holding the latest version metadata
 * and direct asset download links for Soko clients.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT_PKG = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(ROOT_PKG, 'utf8'));

const version = (process.env.SOKO_VERSION || pkg.version || '1.0.0').replace(/^v/, '');
const repo = process.env.GITHUB_REPOSITORY || 'Saurabh-singhx/soko';
const tag = `v${version}`;
const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`;
const downloadBase = `https://github.com/${repo}/releases/download/${tag}`;

const gistToken = process.env.GIST_SECRET || process.env.GIST_TOKEN || process.env.GH_TOKEN;
const gistId = process.env.GIST_ID;

const updatePayload = {
  version,
  buildNumber: parseInt(process.env.SOKO_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '1', 10),
  releaseTag: tag,
  releaseDate: new Date().toISOString(),
  releaseUrl,
  releaseNotes: `Soko version ${version} release build.`,
  downloads: {
    linuxAppImage: `${downloadBase}/soko-linux-x86_64.AppImage`,
    linuxDeb: `${downloadBase}/soko-linux-amd64.deb`,
    linuxTar: `${downloadBase}/soko-linux-x64.tar.gz`,
    windowsExe: `${downloadBase}/soko-win-x64.exe`,
    windowsZip: `${downloadBase}/soko-win-x64.zip`,
    androidApk: `${downloadBase}/soko-mobile.apk`,
    androidLiteApk: `${downloadBase}/soko-mobile-lite.apk`,
  },
};

const fileContent = JSON.stringify(updatePayload, null, 2);

console.log('====================================================');
console.log(' Soko Auto-Update Gist Publisher');
console.log(' Version:', version);
console.log(' Tag:    ', tag);
console.log(' Repo:   ', repo);
console.log('====================================================');

if (!gistToken) {
  console.log('[Notice] GIST_SECRET / GIST_TOKEN not set.');
  console.log('[Notice] To enable automated Gist updates:');
  console.log('  1. Create a GitHub Personal Access Token with "gist" scope: https://github.com/settings/tokens');
  console.log('  2. Add it to repo Settings > Secrets and variables > Actions > Secrets as "GIST_SECRET"');
  console.log('  3. (Optional) Add your Gist ID as "GIST_ID"');
  console.log('Skipping Gist synchronization (release files are still available on GitHub Releases).');
  process.exit(0);
}

function httpsRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const gistBody = {
    description: 'Soko Auto-Update Feed (Dynamic Island HUD & Android Companion)',
    public: true,
    files: {
      'soko-version.json': {
        content: fileContent,
      },
    },
  };

  try {
    if (gistId) {
      console.log(`[Gist] Updating existing Gist ID: ${gistId}...`);
      const options = {
        hostname: 'api.github.com',
        path: `/gists/${gistId}`,
        method: 'PATCH',
        headers: {
          'User-Agent': 'Soko-Release-Agent',
          Authorization: `Bearer ${gistToken}`,
          'Content-Type': 'application/json',
        },
      };
      const result = await httpsRequest(options, JSON.stringify(gistBody));
      const rawUrl = result.files?.['soko-version.json']?.raw_url;
      console.log('✓ Successfully updated Gist:', result.html_url);
      if (rawUrl) console.log('  Raw Feed URL:', rawUrl);
    } else {
      console.log('[Gist] No GIST_ID provided. Creating a new public Gist for Soko updates...');
      const options = {
        hostname: 'api.github.com',
        path: '/gists',
        method: 'POST',
        headers: {
          'User-Agent': 'Soko-Release-Agent',
          Authorization: `Bearer ${gistToken}`,
          'Content-Type': 'application/json',
        },
      };
      const result = await httpsRequest(options, JSON.stringify(gistBody));
      const rawUrl = result.files?.['soko-version.json']?.raw_url;
      console.log('✓ Successfully created Gist!');
      console.log('  Gist URL:     ', result.html_url);
      console.log('  Gist ID:      ', result.id);
      if (rawUrl) console.log('  Raw Feed URL: ', rawUrl);
      console.log('\nTIP: Save this Gist ID as secret or variable "GIST_ID" in your repository settings!');
    }

    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `\n### 🚀 Soko Auto-Update Feed Synchronized\n- **Release Version**: \`${version}\`\n- **Gist Release URL**: [${result.html_url}](${result.html_url})\n- **Gist ID**: \`${result.id}\`\n- **Raw Feed URL**: [${rawUrl}](${rawUrl})\n`
        );
      } catch (e) {}
    }
  } catch (err) {
    console.error('✗ Failed to update Gist:', err.message);
    // Don't fail the entire workflow if Gist patch fails
    process.exit(0);
  }
}

run();
