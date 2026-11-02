import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../ui/primitives/Button.tsx';

interface SettingsHeaderProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  subtitle,
  onClose,
}) => {
  return (
    <header className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08] select-none">
      <div>
        <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      {onClose && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onClose}
          aria-label="Close settings window"
          title="Close settings"
        >
          <X size={14} />
        </Button>
      )}
    </header>
  );
};
