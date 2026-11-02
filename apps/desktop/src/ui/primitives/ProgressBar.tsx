import React from 'react';
import { motion } from 'framer-motion';

export interface ProgressBarProps {
  percentage: number;
  variant?: 'brand' | 'success' | 'warning' | 'error';
  height?: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  variant = 'brand',
  height = 4,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));

  const variantColor = {
    brand: 'bg-[#5E6AD2]',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-rose-400',
  }[variant];

  return (
    <div
      style={{ height }}
      className={`w-full bg-white/[0.08] rounded-full overflow-hidden select-none ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={`h-full rounded-full ${variantColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </div>
  );
};
