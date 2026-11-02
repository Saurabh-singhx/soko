import React from 'react';
import { RotateCcw, Folder, Monitor } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';

interface GeneralTabProps {
  autoStartEnabled: boolean;
  isSavingAutoStart: boolean;
  onToggleAutoStart: (enabled: boolean) => void;
  displayServerInfo?: any;
  onResetPosition: () => void;
  onOpenTransfers: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  autoStartEnabled,
  isSavingAutoStart,
  onToggleAutoStart,
  displayServerInfo,
  onResetPosition,
  onOpenTransfers,
}) => {
  return (
    <div className="space-y-4">
      {/* Autostart Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-white">Start Soko on System Login</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Automatically launch the Dynamic Island HUD in the background on startup.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoStartEnabled}
              disabled={isSavingAutoStart}
              onChange={(e) => onToggleAutoStart(e.target.checked)}
              className="sr-only peer"
              aria-label="Start on system boot"
            />
            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5E6AD2]" />
          </label>
        </div>
      </Card>

      {/* Display & Compositor Diagnostics Card */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Monitor size={14} className="text-[#8A95FF]" />
            <h4 className="text-xs font-semibold text-white">Display & Compositor Diagnostics</h4>
          </div>
          <Badge variant="cyan" size="xs">
            {displayServerInfo?.platform || 'linux'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-300 mt-2">
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">COMPOSITOR / BACKEND</span>
            <span className="text-white font-medium">
              {displayServerInfo?.compositor || 'X11 / DWM'}
            </span>
          </div>
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">OZONE PLATFORM</span>
            <span className="text-white font-medium">
              {displayServerInfo?.ozonePlatform || 'x11'}
            </span>
          </div>
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">SCALE FACTOR</span>
            <span className="text-white font-medium">
              {displayServerInfo?.display?.scaleFactor || 1.0}x
            </span>
          </div>
          <div className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
            <span className="text-[10px] text-neutral-500 block">WORK AREA</span>
            <span className="text-white font-medium">
              {displayServerInfo?.display?.workArea
                ? `${displayServerInfo.display.workArea.width}x${displayServerInfo.display.workArea.height}`
                : '1920x1080'}
            </span>
          </div>
        </div>
      </Card>

      {/* Quick Workstation Actions Card */}
      <Card>
        <h4 className="text-xs font-semibold text-white mb-2">Quick Workstation Actions</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw size={12} />}
            onClick={onResetPosition}
          >
            Re-center Dynamic Island
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Folder size={12} />}
            onClick={onOpenTransfers}
          >
            Open Transfers Folder
          </Button>
        </div>
      </Card>
    </div>
  );
};
