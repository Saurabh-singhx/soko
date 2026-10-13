import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

type GazeDirection = 'center' | 'left' | 'right' | 'up-left' | 'inquisitive';

/**
 * "Grok-Bot" - High-Contrast Monochrome (Black & White) Kinetic Avatar.
 *
 * Features based on Grok Bot AI kinematics:
 * 1. Pure OLED Black & Stark White Aesthetic: Minimalist, clean, distraction-free.
 * 2. Morphing Geometric Eye Capsules: Dynamic capsules morphing between tall pills, wide orbs, horizontal bars, and arcs.
 * 3. Organic Gaze Saccades: Eyes glide smoothly across the visor to observe surroundings.
 * 4. Asymmetric Inquisitive Cocking: Classic Grok expression with one eye tilted and raised.
 * 5. Elastic Razor Blink: Fast snap collapse to a razor slit with spring overshoot.
 * 6. Aerodynamic Ear-Fins: Monochrome antennae with secondary spring lag and autonomous twitches.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [gaze, setGaze] = useState<GazeDirection>('center');
  const [leftEarTwitch, setLeftEarTwitch] = useState(false);
  const [rightEarTwitch, setRightEarTwitch] = useState(false);

  // 1. Natural Blink Loop with Rapid Snap & Elastic Overshoot
  useEffect(() => {
    if (mood !== 'idle') return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
    }, 3800);

    return () => clearInterval(blinkInterval);
  }, [mood]);

  // 2. Micro-Saccade Gaze Routine
  useEffect(() => {
    if (mood !== 'idle') return;

    const directions: GazeDirection[] = ['center', 'left', 'inquisitive', 'center', 'right', 'up-left'];
    let step = 0;

    const gazeInterval = setInterval(() => {
      step = (step + 1) % directions.length;
      setGaze(directions[step]);
    }, 2900);

    return () => clearInterval(gazeInterval);
  }, [mood]);

  // 3. Autonomous Ear-Fin Twitch Routine
  useEffect(() => {
    if (mood !== 'idle') return;

    const twitchInterval = setInterval(() => {
      const which = Math.random() > 0.5 ? 'left' : 'right';
      if (which === 'left') {
        setLeftEarTwitch(true);
        setTimeout(() => setLeftEarTwitch(false), 360);
      } else {
        setRightEarTwitch(true);
        setTimeout(() => setRightEarTwitch(false), 360);
      }
    }, 5200);

    return () => clearInterval(twitchInterval);
  }, [mood]);

  // Compute Gaze Translation Offsets
  const getGazeOffset = () => {
    switch (gaze) {
      case 'left':
        return { x: -3.5, y: 0 };
      case 'right':
        return { x: 3.5, y: 0 };
      case 'up-left':
        return { x: -2.5, y: -2 };
      case 'inquisitive':
        return { x: 1.5, y: -1 };
      case 'center':
      default:
        return { x: 0, y: 0 };
    }
  };

  const gazeOffset = getGazeOffset();

  // Grok Spring Physics Configuration
  const springTransition = {
    type: 'spring',
    stiffness: 480,
    damping: 30,
    mass: 0.8,
  };

  return (
    <motion.div
      className="relative flex items-center justify-center select-none cursor-pointer"
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.12, rotate: -2 }}
      whileTap={{ scale: 0.9, rotate: 3 }}
      // Ambient Organic Idle Bob & Asymmetric Tilt
      animate={
        mood === 'alert'
          ? {
              y: [0, -5, 0, -2, 0],
              scaleX: [1, 0.94, 1.06, 0.98, 1],
              scaleY: [1, 1.12, 0.95, 1.03, 1],
              rotate: [0, -4, 4, 0],
            }
          : mood === 'working'
          ? {
              y: [0, -1.2, 0],
              rotate: [-2, 2, -2],
              scaleX: [1, 1.02, 1],
              scaleY: [1, 0.98, 1],
            }
          : mood === 'searching'
          ? {
              x: [-3, 3, -3],
              rotate: [-5, 5, -5],
            }
          : {
              // Idle Organic Grok Bobs
              y: [0, -2, 0, -0.6, 0],
              rotate: gaze === 'inquisitive' ? [0, 4, 3] : [0, 2.5, 0, -2, 0],
              scaleX: [1, 1.03, 0.98, 1.02, 1],
              scaleY: [1, 0.97, 1.02, 0.98, 1],
            }
      }
      transition={{
        repeat: Infinity,
        duration: mood === 'alert' ? 0.65 : mood === 'working' ? 0.95 : 3.8,
        ease: 'easeInOut',
      }}
    >
      {/* Subtle Monochrome Ambient Halo */}
      <motion.div
        className="absolute inset-0 rounded-full blur-md bg-white/20 pointer-events-none"
        animate={{
          scale: mood === 'alert' ? [1, 1.25, 1] : [1, 1.12, 1],
          opacity: mood === 'alert' ? [0.35, 0.65, 0.35] : [0.18, 0.32, 0.18],
        }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
      />

      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-2xl"
      >
        <defs>
          {/* Pure OLED Black Visor Gradient */}
          <radialGradient id="grok-visor-black" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#121216" />
            <stop offset="70%" stopColor="#050507" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          {/* Crisp Monochrome Rim Stroke */}
          <linearGradient id="grok-rim-mono" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#888892" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
          </linearGradient>

          {/* Matte Graphite Ear-Fin Fill */}
          <linearGradient id="grok-fin-mono" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#22222A" />
            <stop offset="100%" stopColor="#0A0A0E" />
          </linearGradient>

          {/* Eye Bloom Glow Filter */}
          <filter id="eye-bloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Left Monochrome Ear-Fin (Antenna with Spring Twitch) */}
        <motion.path
          d="M7 17C4 13 4 8 8 10C9 13 8 18 7 17Z"
          fill="url(#grok-fin-mono)"
          stroke="#FFFFFF"
          strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
          strokeWidth="1.2"
          animate={
            leftEarTwitch
              ? { rotate: [-18, 14, -8, 0] }
              : mood === 'alert'
              ? { rotate: [-18, -32, -18], scale: [1, 1.15, 1] }
              : mood === 'working'
              ? { rotate: [-6, 6, -6] }
              : { rotate: [-2, 3, -2] }
          }
          style={{ originX: '8px', originY: '17px' }}
          transition={{
            repeat: leftEarTwitch ? 0 : Infinity,
            duration: leftEarTwitch ? 0.32 : 2.4,
            ease: 'easeInOut',
          }}
        />

        {/* 2. Right Monochrome Ear-Fin (Antenna with Secondary Lag) */}
        <motion.path
          d="M37 17C40 13 40 8 36 10C35 13 36 18 37 17Z"
          fill="url(#grok-fin-mono)"
          stroke="#FFFFFF"
          strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
          strokeWidth="1.2"
          animate={
            rightEarTwitch
              ? { rotate: [18, -14, 8, 0] }
              : mood === 'alert'
              ? { rotate: [18, 32, 18], scale: [1, 1.15, 1] }
              : mood === 'working'
              ? { rotate: [6, -6, 6] }
              : { rotate: [2, -3, 2] }
          }
          style={{ originX: '36px', originY: '17px' }}
          transition={{
            repeat: rightEarTwitch ? 0 : Infinity,
            duration: rightEarTwitch ? 0.32 : 2.6,
            ease: 'easeInOut',
          }}
        />

        {/* 3. Pure Black Visor Dome */}
        <circle
          cx="22"
          cy="22"
          r="16.5"
          fill="url(#grok-visor-black)"
          stroke="url(#grok-rim-mono)"
          strokeWidth="1.6"
        />

        {/* 4. Minimalist Curved Specular Light Rim (Subtle Glass Arc) */}
        <path
          d="M13 13C17 9.5 27 9.5 31 13"
          stroke="#FFFFFF"
          strokeOpacity="0.22"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* 5. Grok Bot Dynamic Eye Geometry */}
        <motion.g
          filter="url(#eye-bloom)"
          animate={{
            x: mood === 'searching' ? [-3, 3, -3] : gazeOffset.x,
            y: gazeOffset.y,
          }}
          transition={springTransition}
        >
          {mood === 'happy' ? (
            // Joyful Upward Crescent Arcs (^^)
            <>
              <path
                d="M13.5 21C13.5 17.5 17 16.5 19 19.5"
                stroke="#FFFFFF"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                d="M25 19.5C27 16.5 30.5 17.5 30.5 21"
                stroke="#FFFFFF"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </>
          ) : mood === 'working' ? (
            // Terminal Focus: Horizontal Scanning Bars with Pulse
            <>
              <motion.rect
                x="11"
                y="19"
                width="8.5"
                height="5"
                rx="2.5"
                fill="#FFFFFF"
                animate={{ width: [8.5, 9.5, 8.5], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              />
              <motion.rect
                x="24.5"
                y="19"
                width="8.5"
                height="5"
                rx="2.5"
                fill="#FFFFFF"
                animate={{ width: [8.5, 9.5, 8.5], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
              />
            </>
          ) : mood === 'alert' ? (
            // Alert: Wide Giant Spherical Orbs
            <>
              <motion.circle
                cx="16"
                cy="21.5"
                r="4.8"
                fill="#FFFFFF"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              />
              <motion.circle
                cx="28"
                cy="21.5"
                r="4.8"
                fill="#FFFFFF"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              />
            </>
          ) : mood === 'error' ? (
            // Error / Confusion: Narrow Slanted Slits
            <>
              <line x1="12" y1="20" x2="19" y2="23" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="25" y1="23" x2="32" y2="20" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
            </>
          ) : isBlinking ? (
            // Elastic Razor Blink (Rapid Horizontal Slit)
            <>
              <line x1="12.5" y1="21.5" x2="19" y2="21.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              <line x1="25" y1="21.5" x2="31.5" y2="21.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            // Natural Grok Bot Eye Capsules with Asymmetric Inquisitive Cocking
            <>
              {/* Left Eye Capsule (Attentive & Slightly Lifted) */}
              <motion.rect
                x="12.5"
                y="14"
                width="7"
                height="15"
                rx="3.5"
                fill="#FFFFFF"
                animate={
                  gaze === 'inquisitive'
                    ? { y: 13, height: 16 }
                    : { y: 14, height: 15 }
                }
                style={{ originX: '16px', originY: '29px' }}
                transition={springTransition}
              />

              {/* Right Eye Capsule (Half-Closed from the TOP down, bottom anchored at y=29) */}
              <motion.rect
                x="24.5"
                y="14"
                width="7"
                height="15"
                rx="3.5"
                fill="#FFFFFF"
                animate={
                  gaze === 'inquisitive'
                    ? {
                        y: 20,       // Top eyelid drops down from y=14 to y=20
                        height: 9,   // Height shrinks so bottom stays anchored at 20 + 9 = 29
                        rotate: -4,  // Subtle quizzical lid tilt
                      }
                    : {
                        y: 14,
                        height: 15,
                        rotate: 0,
                      }
                }
                style={{ originX: '28px', originY: '29px' }}
                transition={springTransition}
              />
            </>
          )}
        </motion.g>
      </svg>
    </motion.div>
  );
};
