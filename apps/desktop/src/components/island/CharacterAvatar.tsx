import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

/**
 * Animated SVG Character Avatar Mascot.
 *
 * Morphs eyes, mouth, and head bobbing dynamically based on active state:
 * - Idle: Gentle breathing, occasional blinks.
 * - Alert: Wide circular eyes, exclamation bounce.
 * - Working: Focused eyes, rotating miniature gear / terminal goggles.
 * - Happy: Crescent eyes, wide beaming smile.
 * - Error: Dizzy X-eyes, slight shake.
 * - Searching: Eyes darting left and right looking for Bluetooth beacon.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 28,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Automatic gentle blink loop during idle state
  useEffect(() => {
    if (mood !== 'idle') return;

    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3800);

    return () => clearInterval(interval);
  }, [mood]);

  return (
    <motion.div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      animate={
        mood === 'alert'
          ? { y: [0, -3, 0], scale: [1, 1.15, 1] }
          : mood === 'working'
          ? { rotate: [0, -2, 2, 0] }
          : mood === 'searching'
          ? { x: [-2, 2, -2] }
          : { y: [0, -1, 0] }
      }
      transition={{
        repeat: Infinity,
        duration: mood === 'alert' ? 0.6 : mood === 'working' ? 1.2 : 2.5,
        ease: 'easeInOut',
      }}
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        {/* Mascot Face Base Circle */}
        <motion.circle
          cx="18"
          cy="18"
          r="16"
          fill="url(#mascot-gradient)"
          stroke={
            mood === 'error'
              ? '#EF4444'
              : mood === 'working'
              ? '#F59E0B'
              : mood === 'alert'
              ? '#00F0FF'
              : 'rgba(255, 255, 255, 0.25)'
          }
          strokeWidth="1.5"
        />

        {/* Eye State Renders */}
        {mood === 'happy' ? (
          // Happy Crescent Eyes (^_^)
          <>
            <path
              d="M10 16C10 14 13 13 15 15"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M21 15C23 13 26 14 26 16"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        ) : mood === 'error' ? (
          // Dizzy X Eyes (>_<)
          <>
            <path d="M11 14L15 18M15 14L11 18" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 14L25 18M25 14L21 18" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : mood === 'working' ? (
          // Focused / Terminal Goggles
          <>
            <rect x="9" y="13" width="7" height="6" rx="2" fill="#00F0FF" fillOpacity="0.8" />
            <rect x="20" y="13" width="7" height="6" rx="2" fill="#00F0FF" fillOpacity="0.8" />
            <path d="M16 16H20" stroke="#00F0FF" strokeWidth="1.5" />
          </>
        ) : mood === 'searching' ? (
          // Eyes looking sideways
          <>
            <circle cx="15" cy="16" r="2.4" fill="#FFFFFF" />
            <circle cx="25" cy="16" r="2.4" fill="#FFFFFF" />
          </>
        ) : isBlinking ? (
          // Blinking Slit
          <>
            <line x1="11" y1="16" x2="15" y2="16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <line x1="21" y1="16" x2="25" y2="16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          // Standard Curious Big Eyes (● ●)
          <>
            <circle cx="13" cy="16" r="2.4" fill="#FFFFFF" />
            <circle cx="23" cy="16" r="2.4" fill="#FFFFFF" />
            {/* Specular Highlight Dots */}
            <circle cx="14" cy="15" r="0.8" fill="#0A0A0C" />
            <circle cx="24" cy="15" r="0.8" fill="#0A0A0C" />
          </>
        )}

        {/* Mouth State Renders */}
        {mood === 'happy' ? (
          // Wide Beaming Smile
          <path
            d="M13 22C14.5 25 21.5 25 23 22"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : mood === 'error' ? (
          // Wavy Confused Mouth
          <path
            d="M13 23Q16 21 18 23T23 22"
            stroke="#EF4444"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : mood === 'alert' ? (
          // Surprised Small 'O'
          <ellipse cx="18" cy="23" rx="2" ry="2.5" fill="#FFFFFF" />
        ) : mood === 'working' ? (
          // Determined Straight Line
          <line x1="14" y1="23" x2="22" y2="23" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          // Gentle Content Half-Smile
          <path
            d="M14 22C15.5 23.8 20.5 23.8 22 22"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}

        {/* Gradient Defs */}
        <defs>
          <linearGradient id="mascot-gradient" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E1E26" />
            <stop offset="1" stopColor="#0E0E12" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};
