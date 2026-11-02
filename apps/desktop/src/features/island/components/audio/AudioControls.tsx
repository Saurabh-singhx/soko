import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { AudioStreamStatus } from '../../../../types/index.ts';

export interface AudioControlsProps {
  status: AudioStreamStatus;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onToggleMute: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  status,
  onPrev,
  onPlayPause,
  onNext,
  onToggleMute,
}) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0" data-no-drag="true">
      {/* Transport Buttons */}
      <div className="flex items-center gap-0.5 bg-white/[0.06] border border-white/[0.08] px-1 py-0.5 rounded-full">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous Track"
          className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5E6AD2]"
          title="Previous Track"
        >
          <SkipBack size={10} className="fill-current" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayPause();
          }}
          aria-label={status.isPlaying ? 'Pause Music' : 'Play Music'}
          className="p-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black active:scale-90 transition-all cursor-pointer shadow-[0_0_8px_rgba(52,211,153,0.35)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
          title={status.isPlaying ? 'Pause' : 'Play'}
        >
          {status.isPlaying ? (
            <Pause size={10} className="fill-current stroke-[2.5]" />
          ) : (
            <Play size={10} className="fill-current stroke-[2.5] ml-[0.5px]" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next Track"
          className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5E6AD2]"
          title="Next Track"
        >
          <SkipForward size={10} className="fill-current" />
        </button>
      </div>

      {/* Speaker Mute / Unmute */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        aria-label={status.isSpeakerMuted ? 'Unmute PC Speaker' : 'Mute PC Speaker'}
        className={`flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[9.5px] font-mono font-medium transition-all active:scale-95 border cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5E6AD2] ${
          status.isSpeakerMuted
            ? 'bg-rose-500/15 border-rose-500/35 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.25)]'
            : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title={status.isSpeakerMuted ? 'PC Speaker Muted • Click to Unmute' : 'Mute PC Speaker'}
      >
        {status.isSpeakerMuted ? (
          <>
            <VolumeX size={11} className="text-rose-400 shrink-0" />
            <span>Muted</span>
          </>
        ) : (
          <>
            <Volume2 size={11} className="text-emerald-400 shrink-0" />
            <span>Mute</span>
          </>
        )}
      </button>
    </div>
  );
};
