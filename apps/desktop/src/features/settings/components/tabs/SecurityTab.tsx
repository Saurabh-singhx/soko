import React, { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { connectionService } from '../../../../services/connection.ts';

export const SecurityTab: React.FC = () => {
  const [revoking, setRevoking] = useState(false);
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);

  const handleRevokeAll = async () => {
    if (!window.confirm('Revoke all paired mobile devices and invalidate all active session tokens?')) {
      return;
    }
    setRevoking(true);
    try {
      await connectionService.revokeAllSessions();
      setRevokedMessage('All active sessions revoked and bearer tokens destroyed.');
      setTimeout(() => setRevokedMessage(null), 4000);
    } catch (e: any) {
      setRevokedMessage(`Revocation failed: ${e.message}`);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card glow>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <h4 className="text-xs font-semibold text-white">Zero-Trust Mutual TLS & Authentication</h4>
          </div>
          <Badge variant="success" size="xs">
            mTLS Active
          </Badge>
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
          All desktop and mobile communication is encrypted using 256-bit TLS with SHA-256 fingerprint verification, 128-bit persistent cryptographic bearer tokens, rate-limited SAS PIN authentication, and DNS rebinding protections.
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-300">
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">ENCRYPTION PROTOCOL</span>
            <span className="text-emerald-400 font-medium">TLS 1.3 / WSS</span>
          </div>
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">SESSION TTL</span>
            <span className="text-white font-medium">30 Days (Self-Healing)</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-white">Emergency Session Invalidation</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Instantly revoke all issued persistent tokens and force all mobile devices to re-pair.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={12} />}
            onClick={handleRevokeAll}
            disabled={revoking}
          >
            {revoking ? 'Revoking...' : 'Revoke All Sessions'}
          </Button>
        </div>

        {revokedMessage && (
          <p className="text-xs font-mono text-emerald-400 mt-2">
            {revokedMessage}
          </p>
        )}
      </Card>
    </div>
  );
};
