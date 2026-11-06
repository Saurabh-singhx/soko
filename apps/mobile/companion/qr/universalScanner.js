/**
 * @file universalScanner.js
 * Universal QR Scanner & Handshake Engine for Soko Mobile Web Companion.
 *
 * Implements Option 3 (Hybrid Universal Model):
 * 1. Automatic Handshake on Universal URL query parameters (?pair=1&pin=...).
 * 2. Token expiration check ('exp' timestamp) with friendly retry instructions.
 * 3. Multi-Interface candidate IP probing ('alts' list fallback).
 * 4. Dual-Engine Scanner:
 *    - Hardware-accelerated BarcodeDetector (Chromium / Android).
 *    - Pure JavaScript jsQR canvas decoder fallback (100% offline, works on all browsers).
 * 5. Secure-Context & Camera Resilience:
 *    - Detects HTTP vs HTTPS restrictions on mobile browsers.
 *    - Decodes photos snapped from native camera (<input capture="environment">) on HTTP origins.
 * 6. 1-Tap Deep Link integration to launch native Soko Android app if installed.
 */

(function (window) {
  'use strict';

  const SokoUniversalScanner = {
    mediaStream: null,
    scanTimer: null,
    canvasEl: null,
    canvasCtx: null,

    /**
     * Checks if current browser context is secure (HTTPS or localhost).
     * Mobile browsers strictly restrict navigator.mediaDevices.getUserMedia in insecure HTTP.
     * @returns {boolean}
     */
    isSecureContext() {
      if (typeof window === 'undefined') return true;
      if (typeof window.isSecureContext === 'boolean') {
        return window.isSecureContext;
      }
      const host = window.location.hostname;
      return (
        window.location.protocol === 'https:' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1'
      );
    },

    /**
     * Checks if live camera video stream is supported in the current environment.
     * @returns {boolean}
     */
    isLiveCameraSupported() {
      if (typeof navigator === 'undefined') return false;
      const hasMediaDevices = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
      return hasMediaDevices && this.isSecureContext();
    },

    /**
     * Decodes a QR code from a File or Blob object (e.g. from camera capture or gallery picker).
     * Uses native BarcodeDetector if available, falling back to jsQR canvas processing.
     * @param {File|Blob} file
     * @returns {Promise<string|null>}
     */
    async decodeImageFile(file) {
      if (!file) throw new Error('No image file selected');

      // Engine 1: Native BarcodeDetector (Chromium / Android Webview)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          let source = null;
          if (typeof createImageBitmap === 'function') {
            source = await createImageBitmap(file);
          } else {
            source = await this._fileToImage(file);
          }
          const barcodes = await detector.detect(source);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            return barcodes[0].rawValue;
          }
        } catch (e) {
          console.warn('[UniversalScanner] BarcodeDetector file decode failed, trying jsQR:', e);
        }
      }

      // Engine 2: Pure JS jsQR offline canvas decoder
      if (typeof window.jsQR === 'function') {
        try {
          const img = await this._fileToImage(file);
          const canvas = document.createElement('canvas');
          const maxDim = 1200; // Optimal resolution for fast & accurate QR decoding
          let width = img.naturalWidth || img.width || 640;
          let height = img.naturalHeight || img.height || 480;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, width, height);

          const imgData = ctx.getImageData(0, 0, width, height);
          const code = window.jsQR(imgData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            return code.data;
          }
        } catch (e) {
          console.warn('[UniversalScanner] jsQR file decode failed:', e);
        }
      }

      return null;
    },

    /**
     * Helper to load File/Blob into an HTMLImageElement.
     * @private
     */
    _fileToImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load image from file data'));
          img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },

    /**
     * Decodes a video element frame using jsQR fallback when BarcodeDetector is unavailable.
     * @param {HTMLVideoElement} video
     * @returns {string|null}
     */
    decodeVideoFrame(video) {
      if (!video || !video.videoWidth || !video.videoHeight) return null;
      if (typeof window.jsQR === 'function') {
        if (!this.canvasEl) {
          this.canvasEl = document.createElement('canvas');
          this.canvasCtx = this.canvasEl.getContext('2d', { willReadFrequently: true });
        }
        this.canvasEl.width = video.videoWidth;
        this.canvasEl.height = video.videoHeight;
        this.canvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const imgData = this.canvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
        const code = window.jsQR(imgData.data, video.videoWidth, video.videoHeight, {
          inversionAttempts: 'dontInvert',
        });
        return code ? code.data : null;
      }
      return null;
    },

    /**
     * Parses a scanned QR payload or URL search string into pairing parameters.
     * @param {string} input
     * @returns {Object|null}
     */
    parsePayload(input) {
      if (!input) return null;
      const str = String(input).trim();
      const nowSec = Math.floor(Date.now() / 1000);

      let host = null;
      let port = 8766;
      let pin = null;
      let fp = null;
      let exp = null;
      let alts = [];
      let name = null;
      let isExpired = false;

      try {
        if (str.startsWith('soko://pair')) {
          const url = new URL(str);
          host = url.searchParams.get('host');
          if (url.searchParams.has('port')) port = parseInt(url.searchParams.get('port'), 10) || 8766;
          pin = url.searchParams.get('pin');
          fp = url.searchParams.get('fp') || url.searchParams.get('fingerprint');
          name = url.searchParams.get('name');
          if (url.searchParams.has('exp')) exp = parseInt(url.searchParams.get('exp'), 10);
          if (url.searchParams.has('alts')) alts = url.searchParams.get('alts').split(',').map((s) => s.trim()).filter(Boolean);
        } else if (str.startsWith('http://') || str.startsWith('https://')) {
          const url = new URL(str);
          host = url.searchParams.get('host') || url.hostname;
          port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
          pin = url.searchParams.get('pin');
          fp = url.searchParams.get('fp') || url.searchParams.get('fingerprint');
          name = url.searchParams.get('name');
          if (url.searchParams.has('exp')) exp = parseInt(url.searchParams.get('exp'), 10);
          if (url.searchParams.has('alts')) alts = url.searchParams.get('alts').split(',').map((s) => s.trim()).filter(Boolean);
        } else if (str.includes('pin=') || str.includes('pair=')) {
          const params = new URLSearchParams(str.startsWith('?') ? str.slice(1) : str);
          host = params.get('host');
          if (params.has('port')) port = parseInt(params.get('port'), 10) || 8766;
          pin = params.get('pin');
          fp = params.get('fp');
          name = params.get('name');
          if (params.has('exp')) exp = parseInt(params.get('exp'), 10);
          if (params.has('alts')) alts = params.get('alts').split(',').map((s) => s.trim()).filter(Boolean);
        } else if (/^\d{3}\s?\d{3}$/.test(str)) {
          pin = str.replace(/\s+/g, '');
        }
      } catch (e) {
        console.warn('[UniversalScanner] Failed to parse QR string:', e);
      }

      if (pin) pin = pin.replace(/\D/g, '');
      if (pin && pin.length !== 6) pin = null;

      if (exp && !isNaN(exp)) {
        isExpired = (nowSec - 30) > exp; // 30s clock-skew grace
      }

      if (!pin) return null;

      const candidateIps = host ? [host, ...alts] : alts;

      return {
        host,
        port,
        pin,
        formattedPin: `${pin.slice(0, 3)} ${pin.slice(3, 6)}`,
        fp,
        name: name ? decodeURIComponent(name) : null,
        exp,
        isExpired,
        alts,
        candidateIps,
        raw: str,
      };
    },

    /**
     * Probes candidate fallback IP addresses if the primary host is unreachable.
     * @param {string[]} candidateIps
     * @param {number} port
     * @returns {Promise<string|null>}
     */
    async probeReachableHost(candidateIps, port = 8766) {
      if (!Array.isArray(candidateIps) || candidateIps.length === 0) return null;
      const cleanPort = parseInt(String(port), 10);
      if (isNaN(cleanPort) || cleanPort < 1 || cleanPort > 65535) return null;

      for (const ip of candidateIps) {
        const cleanIp = String(ip || '').trim();
        // Ensure IP is a valid IPv4 address or safe alphanumeric hostname
        if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9\.\-]+$/.test(cleanIp)) continue;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(`http://${cleanIp}:${cleanPort}/api/discovery`, {
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (res.ok) {
            console.log(`[UniversalScanner] Verified reachable Soko host: ${cleanIp}:${cleanPort}`);
            return cleanIp;
          }
        } catch {
          // Continue to next alternative IP
        }
      }
      return null;
    },

    /**
     * Attempts to trigger the native Soko Android app if installed via soko:// deep link.
     * @param {Object} payload
     */
    launchNativeAppIntent(payload) {
      if (!payload || !payload.pin) return;
      const params = new URLSearchParams();
      if (payload.host) params.set('host', payload.host);
      if (payload.port) params.set('port', String(payload.port));
      params.set('pin', payload.pin);
      if (payload.fp) params.set('fp', payload.fp);
      if (payload.name) params.set('name', payload.name);
      if (payload.exp) params.set('exp', String(payload.exp));
      if (payload.alts && payload.alts.length > 0) params.set('alts', payload.alts.join(','));

      const intentUrl = `soko://pair?${params.toString()}`;
      window.location.href = intentUrl;
    },
  };

  window.SokoUniversalScanner = SokoUniversalScanner;
})(typeof window !== 'undefined' ? window : this);
