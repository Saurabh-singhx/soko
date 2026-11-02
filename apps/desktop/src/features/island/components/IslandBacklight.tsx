import React from 'react';

export interface IslandBacklightProps {
  color: string;
  className?: string;
}

/**
 * Dynamic eye-color ambient aura glow behind the active mascot.
 */
export const IslandBacklight: React.FC<IslandBacklightProps> = ({
  color,
  className = '',
}) => {
  return (
    <div
      className={`absolute -left-6 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none transition-opacity duration-300 ease-out ${className}`}
      style={{
        background: `radial-gradient(circle at center, ${color}2A 0%, transparent 70%)`,
      }}
      aria-hidden="true"
    />
  );
};
