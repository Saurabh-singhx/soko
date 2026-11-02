import React from 'react';

export interface IslandGripProps {
  className?: string;
}

/**
 * Visual pill drag grip handle.
 * Signals draggable window behavior and double-click to re-center.
 */
export const IslandGrip: React.FC<IslandGripProps> = ({ className = '' }) => {
  return (
    <div
      className={`absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors pointer-events-none ${className}`}
      title="Drag to move • Double-click to center"
      aria-hidden="true"
    />
  );
};
