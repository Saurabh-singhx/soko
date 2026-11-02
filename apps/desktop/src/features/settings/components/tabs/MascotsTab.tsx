import React from 'react';
import { Sparkles, Clock, Eye } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { CharacterSelector } from '../../../../characters/CharacterSelector.tsx';

interface MascotsTabProps {
  idleTimeout: number;
  onChangeIdleTimeout: (ms: number) => void;
  onPreviewSleepOrb: () => void;
}

export const MascotsTab: React.FC<MascotsTabProps> = ({
  idleTimeout,
  onChangeIdleTimeout,
  onPreviewSleepOrb,
}) => {
  return (
    <div className="space-y-4">
      {/* Mascot Selection */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#8A95FF]" />
            <h4 className="text-xs font-semibold text-white">Choose Active Mascot</h4>
          </div>
          <Badge variant="brand" size="xs">
            Dynamic Reactive
          </Badge>
        </div>
        <p className="text-[11px] text-neutral-400 mb-3">
          Select your desktop companion avatar. Each character features procedural expressions, gaze tracking, and state-reactive environmental backgrounds.
        </p>

        <CharacterSelector />
      </Card>

      {/* Sleep Mode / Idle Orb Configuration */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-400" />
            <h4 className="text-xs font-semibold text-white">Idle Sleep Mode (Orb HUD)</h4>
          </div>
          <Badge variant="warning" size="xs">
            {idleTimeout === 0 ? 'Disabled' : `${idleTimeout / 1000}s`}
          </Badge>
        </div>

        <p className="text-[11px] text-neutral-400 mb-3">
          When inactive with no pending notifications or music, Soko smoothly contracts into an unobtrusive circular sleeping orb.
        </p>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={300000}
            step={15000}
            value={idleTimeout}
            onChange={(e) => onChangeIdleTimeout(parseInt(e.target.value, 10))}
            className="flex-1 accent-[#5E6AD2]"
            aria-label="Idle timeout duration"
          />

          <Button
            variant="secondary"
            size="sm"
            icon={<Eye size={12} />}
            onClick={onPreviewSleepOrb}
          >
            Preview Sleep Orb
          </Button>
        </div>
      </Card>
    </div>
  );
};
