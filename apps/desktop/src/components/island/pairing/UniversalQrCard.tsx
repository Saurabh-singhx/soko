import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Copy,
  Check,
  Globe,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Clock,
  Radio,
} from 'lucide-react';
import { generateQrSvg } from '../../../utils/qrCode.ts';

export type PairingTabMode = 'web' | 'native';

interface UniversalQrCardProps {
  sasPin: string;
  localIps: string[];
  port?: number;
  onRegeneratePin: () => void;
  onClose?: () => void;
}

/**
 * Pairing QR for the Soko mobile scanner or the phone camera. The user approves
 * the resulting request on desktop before the link is established.
 */
export const UniversalQrCard: React.FC<UniversalQrCardProps> = ({
  sasPin,
  localIps,
  port = 8766,
  onRegeneratePin,
}) => {
  const [mode, setMode] = useState<PairingTabMode>('native');
  const [selectedIp, setSelectedIp] = useState<string>(() => localIps[0] || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + 300000);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const refreshRequestedRef = React.useRef(false);

  // Keep selectedIp synced if localIps array updates
  useEffect(() => {
    if (localIps.length > 0 && !localIps.includes(selectedIp)) {
      setSelectedIp(localIps[0]);
    }
  }, [localIps, selectedIp]);

  // Keep the QR payload fixed while the visible countdown updates.
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (secondsRemaining === 0 && !refreshRequestedRef.current) {
      refreshRequestedRef.current = true;
      onRegeneratePin();
    }
  }, [secondsRemaining, onRegeneratePin]);

  // Reset timer whenever PIN changes
  useEffect(() => {
    refreshRequestedRef.current = false;
    setExpiresAt(Date.now() + 300000);
    setSecondsRemaining(300);
  }, [sasPin]);

  const cleanPin = useMemo(() => sasPin.replace(/\s+/g, ''), [sasPin]);
  const formattedPin = useMemo(() => {
    if (cleanPin.length === 6) {
      return `${cleanPin.slice(0, 3)} ${cleanPin.slice(3, 6)}`;
    }
    return sasPin;
  }, [cleanPin, sasPin]);

  const expirationTimestamp = Math.floor(expiresAt / 1000);

  // Build payloads for each mode
  const { webUrl, nativeUri, activePayload } = useMemo(() => {
    // First pairing must use the bridge's HTTP listener: the phone has not yet
    // stored the desktop's self-signed certificate fingerprint.
    const scheme = 'http';
    const params = new URLSearchParams();
    params.set('pair', '1');
    params.set('pin', cleanPin);
    params.set('exp', String(expirationTimestamp));

    const web = `${scheme}://${selectedIp}:${port}/?${params.toString()}`;

    const nParams = new URLSearchParams();
    nParams.set('host', selectedIp);
    nParams.set('port', String(port));
    nParams.set('pin', cleanPin);
    nParams.set('tls', '0');
    nParams.set('exp', String(expirationTimestamp));

    const native = `soko://pair?${nParams.toString()}`;

    return {
      webUrl: web,
      nativeUri: native,
      activePayload: mode === 'native' ? native : web,
    };
  }, [selectedIp, port, cleanPin, expirationTimestamp, mode]);

  // Generate SVG QR matrix
  const qrSvg = useMemo(() => {
    if (!selectedIp || cleanPin.length !== 6) return '';
    try {
      return generateQrSvg(activePayload, {
        size: 232,
        margin: 4,
        darkColor: '#07080D',
        lightColor: '#FFFFFF',
        ecLevel: activePayload.length > 200 ? 'L' : 'M',
      });
    } catch (e) {
      console.warn('[UniversalQrCard] Failed to generate QR SVG:', e);
      return '';
    }
  }, [activePayload, selectedIp, cleanPin]);

  const copyLinkToClipboard = async () => {
    try {
      if (!selectedIp) return;
      const textToCopy = mode === 'native' ? nativeUri : webUrl;
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
          Pair with QR code
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
          <Clock size={10} />
          <span>{timeFormatted}</span>
        </div>
      </div>

      {/* Mode Selector Tabs (Option 3 Universal Hybrid) */}
      <div className="grid grid-cols-2 gap-1 w-full bg-white/[0.04] p-1 rounded-lg border border-white/[0.06]">
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
          <span>Phone camera</span>
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
          <span>Soko app scanner</span>
        </button>
      </div>

      {/* Multi-Interface Dropdown (Edge Case: Multi-Homed Workstation) */}
      {localIps.length > 1 && (
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
      {qrSvg ? (
        <div
          className="p-2 bg-white rounded-xl flex items-center justify-center"
          role="img"
          aria-label="Soko pairing QR code"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      ) : (
        <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-4 text-[11px] text-amber-200">
          Waiting for this desktop's local network address. Connect to Wi-Fi, then reopen pairing.
        </div>
      )}

      {/* Mode Description & Instruction */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] text-white/90 font-medium">
          {mode === 'web' && 'Scan with your phone camera to open Soko on your phone'}
          {mode === 'native' && 'In Soko Mobile, tap Scan QR Code and point at this screen'}
        </span>
        <span className="text-[9px] text-linear-text-tertiary">
          Scan, then approve the pairing request on this desktop. Both devices must share a network.
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
