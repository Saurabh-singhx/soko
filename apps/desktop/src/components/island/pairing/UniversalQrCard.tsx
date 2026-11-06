import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Copy,
  Check,
  Globe,
  Wifi,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Clock,
  Radio,
} from 'lucide-react';
import { generateQrSvg } from '../../../utils/qrCode.ts';

export type PairingTabMode = 'web' | 'native' | 'wifi';

interface UniversalQrCardProps {
  sasPin: string;
  localIps: string[];
  port?: number;
  certFingerprint?: string | null;
  workstationName?: string;
  tlsEnabled?: boolean;
  onRegeneratePin: () => void;
  onClose?: () => void;
}

/**
 * UniversalQrCard (Option 3 Dedicated Hybrid QR Pairing Component)
 *
 * Provides a multi-mode, time-sensitive pairing interface:
 * 1. Phone Camera (Universal Web): Scanned by default iOS Camera, Android Google Lens,
 *    or Samsung Camera to immediately launch Soko Web Companion and auto-pair.
 * 2. Soko App (Native URI): Direct deep link for the native Flutter companion app.
 * 3. Hotspot Wi-Fi: Standard WIFI:S:... schema to bridge devices on isolated networks.
 *
 * Edge cases handled:
 * - Multi-interface selection (Wi-Fi vs Ethernet).
 * - 5-minute countdown expiration with auto-refresh to thwart replay attacks.
 * - Alternative candidate IP addresses ('alts') passed for fallback routing.
 * - One-click clipboard copy with animated visual feedback.
 */
export const UniversalQrCard: React.FC<UniversalQrCardProps> = ({
  sasPin,
  localIps,
  port = 8766,
  certFingerprint = null,
  workstationName = 'Soko Workstation',
  tlsEnabled = false,
  onRegeneratePin,
}) => {
  const [mode, setMode] = useState<PairingTabMode>('web');
  const [selectedIp, setSelectedIp] = useState<string>(() => localIps[0] || '192.168.31.210');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300); // 5 minutes TTL
  const wifiSsid = 'Soko-Hotspot';
  const wifiPassword = 'soko-connect-123';

  // Keep selectedIp synced if localIps array updates
  useEffect(() => {
    if (localIps.length > 0 && !localIps.includes(selectedIp)) {
      setSelectedIp(localIps[0]);
    }
  }, [localIps, selectedIp]);

  // 5-minute expiration timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onRegeneratePin();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRegeneratePin]);

  // Reset timer whenever PIN changes
  useEffect(() => {
    setSecondsRemaining(300);
  }, [sasPin]);

  const cleanPin = useMemo(() => sasPin.replace(/\s+/g, ''), [sasPin]);
  const formattedPin = useMemo(() => {
    if (cleanPin.length === 6) {
      return `${cleanPin.slice(0, 3)} ${cleanPin.slice(3, 6)}`;
    }
    return sasPin;
  }, [cleanPin, sasPin]);

  // Candidate alternative IPs (all interfaces except the currently selected one)
  const alts = useMemo(() => {
    return localIps.filter((ip) => ip !== selectedIp).join(',');
  }, [localIps, selectedIp]);

  const expirationTimestamp = useMemo(() => {
    return Math.floor(Date.now() / 1000) + secondsRemaining;
  }, [secondsRemaining]);

  // Build payloads for each mode
  const { webUrl, nativeUri, wifiString, activePayload } = useMemo(() => {
    const scheme = tlsEnabled ? 'https' : 'http';
    const params = new URLSearchParams();
    params.set('pair', '1');
    params.set('pin', cleanPin);
    if (certFingerprint) params.set('fp', certFingerprint);
    if (workstationName) params.set('name', workstationName);
    params.set('exp', String(expirationTimestamp));
    if (alts) params.set('alts', alts);
    params.set('v', '1');

    const web = `${scheme}://${selectedIp}:${port}/?${params.toString()}`;

    const nParams = new URLSearchParams();
    nParams.set('host', selectedIp);
    nParams.set('port', String(port));
    nParams.set('pin', cleanPin);
    if (certFingerprint) nParams.set('fp', certFingerprint);
    if (workstationName) nParams.set('name', workstationName);
    nParams.set('tls', tlsEnabled ? '1' : '0');
    nParams.set('exp', String(expirationTimestamp));
    if (alts) nParams.set('alts', alts);
    nParams.set('v', '1');

    const native = `soko://pair?${nParams.toString()}`;

    const escapedSsid = wifiSsid.replace(/([\\;,":])/g, '\\$1');
    const escapedPass = wifiPassword.replace(/([\\;,":])/g, '\\$1');
    const wifi = `WIFI:S:${escapedSsid};T:WPA;P:${escapedPass};;`;

    let active = web;
    if (mode === 'native') active = native;
    if (mode === 'wifi') active = wifi;

    return {
      webUrl: web,
      nativeUri: native,
      wifiString: wifi,
      activePayload: active,
    };
  }, [selectedIp, port, cleanPin, certFingerprint, workstationName, tlsEnabled, alts, expirationTimestamp, mode, wifiSsid, wifiPassword]);

  // Generate SVG QR matrix
  const qrSvg = useMemo(() => {
    try {
      return generateQrSvg(activePayload, {
        size: 156,
        margin: 2,
        darkColor: '#07080D',
        lightColor: '#FFFFFF',
        ecLevel: activePayload.length > 200 ? 'L' : 'M',
      });
    } catch (e) {
      console.warn('[UniversalQrCard] Failed to generate QR SVG:', e);
      return '';
    }
  }, [activePayload]);

  const copyLinkToClipboard = async () => {
    try {
      const textToCopy = mode === 'native' ? nativeUri : (mode === 'wifi' ? wifiString : webUrl);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const copyPinToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(cleanPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {}
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center p-3 rounded-xl bg-black/75 border border-[#5E6AD2]/35 shadow-[0_12px_32px_rgba(0,0,0,0.6)] gap-2.5 text-center w-full"
    >
      {/* Header with Title and Mode Badges */}
      <div className="flex items-center justify-between w-full pb-1.5 border-b border-white/[0.08]">
        <span className="text-[11px] font-semibold text-white/95 flex items-center gap-1.5">
          <QrCode size={13} className="text-[#818cf8]" />
          Instant QR Pairing
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
          <Clock size={10} />
          <span>{timeFormatted}</span>
        </div>
      </div>

      {/* Mode Selector Tabs (Option 3 Universal Hybrid) */}
      <div className="grid grid-cols-3 gap-1 w-full bg-white/[0.04] p-1 rounded-lg border border-white/[0.06]">
        <button
          onClick={() => setMode('web')}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
            mode === 'web'
              ? 'bg-[#5E6AD2] text-white shadow-[0_0_8px_rgba(94,106,210,0.5)] font-semibold'
              : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Scan with default phone camera (iOS / Android)"
        >
          <Smartphone size={11} />
          <span>Phone Cam</span>
        </button>

        <button
          onClick={() => setMode('native')}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
            mode === 'native'
              ? 'bg-[#5E6AD2] text-white shadow-[0_0_8px_rgba(94,106,210,0.5)] font-semibold'
              : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Scan with Soko Mobile Companion App"
        >
          <Radio size={11} />
          <span>Soko App</span>
        </button>

        <button
          onClick={() => setMode('wifi')}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-all ${
            mode === 'wifi'
              ? 'bg-[#5E6AD2] text-white shadow-[0_0_8px_rgba(94,106,210,0.5)] font-semibold'
              : 'text-linear-text-secondary hover:text-white hover:bg-white/[0.05]'
          }`}
          title="Direct Hotspot connection (bypasses isolated Wi-Fi)"
        >
          <Wifi size={11} />
          <span>Hotspot</span>
        </button>
      </div>

      {/* Multi-Interface Dropdown (Edge Case: Multi-Homed Workstation) */}
      {localIps.length > 1 && mode !== 'wifi' && (
        <div className="flex items-center justify-between w-full text-[10px] px-1 text-linear-text-secondary">
          <span className="flex items-center gap-1">
            <Globe size={10} className="text-[#818cf8]" />
            <span>Interface:</span>
          </span>
          <select
            value={selectedIp}
            onChange={(e) => setSelectedIp(e.target.value)}
            className="bg-black/60 text-white/90 border border-white/[0.12] rounded px-1.5 py-0.5 text-[10px] font-mono outline-none cursor-pointer hover:border-[#5E6AD2]"
          >
            {localIps.map((ip) => (
              <option key={ip} value={ip} className="bg-[#12131A] text-white">
                {ip}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rendered SVG QR code with visual container */}
      <div
        className="p-2.5 bg-white rounded-xl shadow-[0_0_24px_rgba(255,255,255,0.18)] flex items-center justify-center cursor-pointer hover:scale-[1.02] active:scale-[0.99] transition-transform"
        title="Scan with phone camera or companion app"
        onClick={copyLinkToClipboard}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      {/* Mode Description & Instruction */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-white/90 font-medium">
          {mode === 'web' && 'Point phone camera at screen to open & auto-pair'}
          {mode === 'native' && 'Scan from Soko Mobile Companion scanner tab'}
          {mode === 'wifi' && 'Join workstation hotspot directly without typing password'}
        </span>
        <span className="text-[9px] text-linear-text-tertiary">
          {mode === 'web' && 'No app installation required • Instant browser companion'}
          {mode === 'native' && 'Native soko://pair cryptographic deep link handshake'}
          {mode === 'wifi' && 'Guaranteed 1-to-1 link when router blocks peer-to-peer'}
        </span>
      </div>

      {/* Bottom Action Row: SAS PIN + Copy Controls */}
      <div className="flex items-center justify-between w-full pt-1.5 border-t border-white/[0.08] text-[10px]">
        <button
          onClick={copyPinToClipboard}
          className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/25 transition-colors"
          title="Click to copy PIN"
        >
          <ShieldCheck size={11} />
          <span>PIN: {formattedPin}</span>
          {copiedPin && <Check size={10} className="text-emerald-300 ml-0.5" />}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={copyLinkToClipboard}
            className="flex items-center gap-1 text-[10px] text-[#818cf8] hover:text-white bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/30 px-2 py-0.5 rounded border border-[#5E6AD2]/30 transition-colors"
            title="Copy payload link to clipboard"
          >
            {copiedLink ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copiedLink ? 'Copied!' : (mode === 'native' ? 'Copy URI' : 'Copy Link')}</span>
          </button>

          <button
            onClick={onRegeneratePin}
            className="p-1 rounded hover:bg-white/10 text-linear-text-secondary hover:text-white transition-colors"
            title="Refresh PIN & QR Code"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
