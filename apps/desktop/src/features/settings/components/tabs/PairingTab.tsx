import React from 'react';
import { Smartphone, RefreshCw, Power, Radio, ShieldCheck, QrCode } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { PairedDevice, DiscoveredDevice } from '../../../../types/index.ts';

interface PairingTabProps {
  sasPin: string;
  onRegeneratePin: () => void;
  pairedDevice: PairedDevice | null;
  onDisconnect: () => void;
  discoveredDevices: DiscoveredDevice[];
  isScanning: boolean;
  onScanDevices: () => void;
  onSelectPair: (device: DiscoveredDevice) => void;
  onShowQr: () => void;
}

export const PairingTab: React.FC<PairingTabProps> = ({
  sasPin,
  onRegeneratePin,
  pairedDevice,
  onDisconnect,
  discoveredDevices,
  isScanning,
  onScanDevices,
  onSelectPair,
  onShowQr,
}) => {
  return (
    <div className="space-y-4">
      {/* SAS Cryptographic PIN Section */}
      <Card glow>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <h4 className="text-xs font-semibold text-white">Cryptographic SAS Pairing PIN</h4>
          </div>
          <Badge variant="success" size="xs">
            Zero-Trust Active
          </Badge>
        </div>

        <p className="text-[11px] text-neutral-400 mb-3">
          Enter this Short Authentication String (SAS) code on your Android companion app to establish an encrypted mutual TLS link.
        </p>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 font-mono text-xl font-bold tracking-widest text-emerald-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            {sasPin}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={12} />}
            onClick={onRegeneratePin}
          >
            Regenerate PIN
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<QrCode size={12} />}
            onClick={onShowQr}
          >
            Show Pairing QR
          </Button>
        </div>
      </Card>

      {/* Connected Device Status */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smartphone size={14} className="text-[#8A95FF]" />
            <h4 className="text-xs font-semibold text-white">Paired Mobile Companion</h4>
          </div>
          {pairedDevice ? (
            <Badge variant="success" size="xs">
              Linked
            </Badge>
          ) : (
            <Badge variant="outline" size="xs">
              Unpaired
            </Badge>
          )}
        </div>

        {pairedDevice ? (
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">{pairedDevice.name}</span>
                <span className="text-[11px] text-neutral-400 font-mono block">
                  {pairedDevice.model} • {pairedDevice.ipAddress || 'Wi-Fi Direct'}
                </span>
              </div>
              <Button
                variant="danger"
                size="xs"
                icon={<Power size={11} />}
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono text-neutral-300">
              <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
                <span className="text-[10px] text-neutral-500 block">SIGNAL (RSSI)</span>
                <span className="text-white font-medium">{pairedDevice.rssi} dBm</span>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
                <span className="text-[10px] text-neutral-500 block">LATENCY</span>
                <span className="text-white font-medium">{pairedDevice.pingMs} ms</span>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
                <span className="text-[10px] text-neutral-500 block">TRANSPORT</span>
                <span className="text-white font-medium uppercase">{pairedDevice.transport}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-neutral-400 mt-1">
            No active mobile device connected. Use the QR code or scan Wi-Fi below to link your phone.
          </p>
        )}
      </Card>

      {/* Discovered Wi-Fi Devices */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-[#56B6F7]" />
            <h4 className="text-xs font-semibold text-white">Discovered Devices on Local Network</h4>
          </div>
          <Button
            variant="ghost"
            size="xs"
            icon={<RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />}
            onClick={onScanDevices}
            disabled={isScanning}
          >
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        </div>

        {discoveredDevices.length > 0 ? (
          <div className="space-y-1.5 mt-2">
            {discoveredDevices.map((dev) => (
              <div
                key={dev.id}
                className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                <div>
                  <span className="text-xs font-medium text-white block">{dev.name}</span>
                  <span className="text-[10px] text-neutral-500 font-mono block">
                    {dev.model} • {dev.ipAddress}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => onSelectPair(dev)}
                >
                  Pair
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-neutral-500 py-2">
            No unlinked devices found on the local Wi-Fi subnet.
          </p>
        )}
      </Card>
    </div>
  );
};
