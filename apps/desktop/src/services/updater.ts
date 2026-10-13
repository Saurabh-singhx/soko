/**
 * Soko Client Auto-Update Service
 * Checks for updates via GitHub Gist raw feed and GitHub Releases.
 */

export interface UpdatePlatformDownloads {
  linuxAppImage?: string;
  linuxDeb?: string;
  linuxTar?: string;
  windowsExe?: string;
  windowsZip?: string;
  androidApk?: string;
  androidLiteApk?: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTag?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  downloads?: UpdatePlatformDownloads;
  recommendedDownloadUrl?: string;
}

export const CURRENT_VERSION = '1.0.0';
const DEFAULT_REPO = 'Saurabh-singhx/soko';

// Helper to compare semver versions (returns 1 if a > b, -1 if a < b, 0 if equal)
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

class AutoUpdateService {
  private feedUrl: string = '';
  private currentVersion: string = CURRENT_VERSION;
  private lastUpdateInfo: UpdateInfo | null = null;
  private listeners: ((info: UpdateInfo) => void)[] = [];

  constructor() {
    this.feedUrl = localStorage.getItem('soko_update_feed_url') || '';
  }

  public getFeedUrl(): string {
    return this.feedUrl;
  }

  public setFeedUrl(url: string) {
    this.feedUrl = url.trim();
    if (this.feedUrl) {
      localStorage.setItem('soko_update_feed_url', this.feedUrl);
    } else {
      localStorage.removeItem('soko_update_feed_url');
    }
  }

  public getCachedUpdateInfo(): UpdateInfo | null {
    return this.lastUpdateInfo;
  }

  public subscribe(fn: (info: UpdateInfo) => void): () => void {
    this.listeners.push(fn);
    if (this.lastUpdateInfo) {
      fn(this.lastUpdateInfo);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public async checkForUpdates(): Promise<UpdateInfo> {
    let latestVersion = this.currentVersion;
    let releaseNotes = '';
    let releaseUrl = `https://github.com/${DEFAULT_REPO}/releases/latest`;
    let releaseTag = `v${this.currentVersion}`;
    let releaseDate = new Date().toISOString();
    let downloads: UpdatePlatformDownloads = {};

    // 1. Try Gist feed first if configured
    if (this.feedUrl) {
      try {
        const res = await fetch(this.feedUrl, { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          latestVersion = data.version || latestVersion;
          releaseNotes = data.releaseNotes || '';
          releaseUrl = data.releaseUrl || releaseUrl;
          releaseTag = data.releaseTag || `v${latestVersion}`;
          releaseDate = data.releaseDate || releaseDate;
          downloads = data.downloads || {};
        }
      } catch (e) {
        console.warn('[AutoUpdate] Could not fetch Gist feed:', e);
      }
    }

    // 2. Fallback to GitHub Releases API if no update found or Gist failed
    if (latestVersion === this.currentVersion) {
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${DEFAULT_REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          cache: 'no-cache',
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const tag = ghData.tag_name || '';
          const cleanTag = tag.replace(/^v/, '');
          if (cleanTag) {
            latestVersion = cleanTag;
            releaseTag = tag;
            releaseNotes = ghData.body || '';
            releaseUrl = ghData.html_url || releaseUrl;
            releaseDate = ghData.published_at || releaseDate;

            // Extract assets
            if (Array.isArray(ghData.assets)) {
              ghData.assets.forEach((asset: any) => {
                const name: string = asset.name || '';
                const url: string = asset.browser_download_url || '';
                if (name.endsWith('.AppImage')) downloads.linuxAppImage = url;
                else if (name.endsWith('.deb')) downloads.linuxDeb = url;
                else if (name.endsWith('.tar.gz')) downloads.linuxTar = url;
                else if (name.endsWith('.exe')) downloads.windowsExe = url;
                else if (name.endsWith('.zip')) downloads.windowsZip = url;
                else if (name === 'soko-mobile.apk') downloads.androidApk = url;
                else if (name === 'soko-mobile-lite.apk') downloads.androidLiteApk = url;
              });
            }
          }
        }
      } catch (e) {
        console.warn('[AutoUpdate] Could not fetch GitHub Releases API:', e);
      }
    }

    // Determine platform-specific recommended download link
    const isWindows = navigator.userAgent.includes('Windows');
    let recommendedUrl = releaseUrl;

    if (isWindows) {
      recommendedUrl = downloads.windowsExe || downloads.windowsZip || releaseUrl;
    } else {
      recommendedUrl = downloads.linuxAppImage || downloads.linuxDeb || releaseUrl;
    }

    const hasUpdate = compareVersions(latestVersion, this.currentVersion) > 0;

    const info: UpdateInfo = {
      hasUpdate,
      currentVersion: this.currentVersion,
      latestVersion,
      releaseTag,
      releaseDate,
      releaseNotes,
      releaseUrl,
      downloads,
      recommendedDownloadUrl: recommendedUrl,
    };

    this.lastUpdateInfo = info;
    this.listeners.forEach((l) => l(info));
    return info;
  }

  public openUrl(url: string) {
    if (!url) return;
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }
}

export const autoUpdateService = new AutoUpdateService();
