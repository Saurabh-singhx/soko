import React from 'react';
import { RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { ProgressBar } from '../../../../ui/primitives/ProgressBar.tsx';
import { UpdateInfo } from '../../../../services/updater.ts';

interface UpdatesTabProps {
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  nativeStatus?: any;
  isChecking: boolean;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallAndRestart: () => void;
}

export const UpdatesTab: React.FC<UpdatesTabProps> = ({
  currentVersion,
  updateInfo,
  nativeStatus,
  isChecking,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallAndRestart,
}) => {
  const isAvailable = updateInfo?.hasUpdate || nativeStatus?.status === 'available';
  const isDownloading = nativeStatus?.status === 'downloading';
  const isDownloaded = nativeStatus?.status === 'downloaded';

  return (
    <div className="space-y-4">
      <Card glow>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-[#8A95FF]" />
            <h4 className="text-xs font-semibold text-white">Application Auto-Updater</h4>
          </div>
          <Badge variant="cyan" size="xs">
            v{currentVersion}
          </Badge>
        </div>

        <p className="text-[11px] text-neutral-400 mb-3">
          Soko supports delta background updates and 1-click native upgrades across Linux (AppImage) and Windows.
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />}
            onClick={onCheckForUpdates}
            disabled={isChecking || isDownloading}
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </Button>

          {isAvailable && !isDownloaded && (
            <Button
              variant="success"
              size="sm"
              icon={<Download size={12} />}
              onClick={onDownloadUpdate}
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading...' : 'Download Update'}
            </Button>
          )}

          {isDownloaded && (
            <Button
              variant="success"
              size="sm"
              icon={<CheckCircle2 size={12} />}
              onClick={onInstallAndRestart}
            >
              Restart & Install
            </Button>
          )}
        </div>

        {isDownloading && nativeStatus?.percent !== undefined && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>Downloading update...</span>
              <span>{nativeStatus.percent}%</span>
            </div>
            <ProgressBar percentage={nativeStatus.percent} variant="success" />
          </div>
        )}
      </Card>
    </div>
  );
};
