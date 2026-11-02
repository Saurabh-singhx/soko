import React from 'react';
import { motion } from 'framer-motion';

export interface AudioWaveformProps {
  isPlaying: boolean;
  barColor?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isPlaying,
  barColor = 'bg-emerald-400',
}) => {
  return (
    <div className="flex items-end gap-[2px] h-3 pb-[1px] shrink-0" aria-hidden="true">
      <motion.span
        className={`w-[2px] rounded-full ${barColor}`}
        animate={isPlaying ? { height: ['3px', '11px', '4px', '10px', '3px'] } : { height: '3px' }}
        transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className={`w-[2px] rounded-full ${barColor}`}
        animate={isPlaying ? { height: ['8px', '3px', '12px', '5px', '8px'] } : { height: '5px' }}
        transition={{ duration: 0.52, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className={`w-[2px] rounded-full ${barColor}`}
        animate={isPlaying ? { height: ['4px', '12px', '3px', '9px', '4px'] } : { height: '3px' }}
        transition={{ duration: 0.72, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className={`w-[2px] rounded-full ${barColor}`}
        animate={isPlaying ? { height: ['10px', '4px', '11px', '2px', '10px'] } : { height: '4px' }}
        transition={{ duration: 0.48, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};
