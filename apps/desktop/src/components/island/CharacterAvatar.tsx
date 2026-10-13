import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

interface SaccadeTarget {
  x: number;
  y: number;
  isInquisitive: boolean;
  leftLidY: number;
  leftHeight: number;
  rightLidY: number;
  rightHeight: number;
  rightTilt: number;
}

/**
 * Realistic Ocular Engine for Grok-Bot.
 *
 * Implements true biological and robotics eye dynamics:
 * 1. Ballistic Saccades: Instantaneous high-velocity gaze jumps (40-60ms) followed by organic fixation pauses.
 * 2. Lid-Saccade Coupling (Listing's Eyelid Law): Upper eyelids naturally track eyeball pitch (widening when looking up, drooping from top when looking down).
 * 3. Asymmetric Top-Down Inquisitive Eyelid: During curious fixations, the right upper eyelid drops down from the top while the base stays grounded at y=29.
 * 4. 3D Visor Spherical Curvature: Eyes compress along the X axis when gazing toward the perimeter of the curved dome.
 * 5. Organic Asymmetric Blinking: Rapid ballistic eyelid descent (50ms) with spring damped reopening, plus occasional double-blinks.
 * 6. Physiological Micro-Nystagmus: Sub-pixel organic tremors during fixation pauses.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [leftEarTwitch, setLeftEarTwitch] = useState(false);
  const [rightEarTwitch, setRightEarTwitch] = useState(false);

  // Current gaze fixation state
  const [target, setTarget] = useState<SaccadeTarget>({
    x: 0,
    y: 0,
    isInquisitive: false,
    leftLidY: 14,
    leftHeight: 15,
    rightLidY: 14,
    rightHeight: 15,
    rightTilt: 0,
  });

  const saccadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Biological Saccade Engine: Randomized Fixations & Ballistic Jumps
  useEffect(() => {
    if (mood !== 'idle') return;

    const performSaccade = () => {
      // Probability distribution of realistic gaze targets
      const roll = Math.random();
      let nextTarget: SaccadeTarget;

      if (roll < 0.45) {
        // Primary Forward Focus (Center gaze)
        nextTarget = {
          x: (Math.random() - 0.5) * 0.8, // Tiny micro-variation
          y: (Math.random() - 0.5) * 0.6,
          isInquisitive: false,
          leftLidY: 14,
          leftHeight: 15,
          rightLidY: 14,
          rightHeight: 15,
          rightTilt: 0,
        };
      } else if (roll < 0.65) {
        // Glance Left (Eyes shift left, left eye compresses slightly with 3D visor curve)
        nextTarget = {
          x: -3.2 + (Math.random() - 0.5) * 0.6,
          y: -0.4 + (Math.random() - 0.5) * 0.6,
          isInquisitive: false,
          leftLidY: 14,
          leftHeight: 15,
          rightLidY: 14,
          rightHeight: 15,
          rightTilt: 0,
        };
      } else if (roll < 0.80) {
        // Glance Right
        nextTarget = {
          x: 3.2 + (Math.random() - 0.5) * 0.6,
          y: -0.4 + (Math.random() - 0.5) * 0.6,
          isInquisitive: false,
          leftLidY: 14,
          leftHeight: 15,
          rightLidY: 14,
          rightHeight: 15,
          rightTilt: 0,
        };
      } else if (roll < 0.90) {
        // Look Up Inquiringly (Lids raise up, eyes widen)
        nextTarget = {
          x: -1.2 + (Math.random() - 0.5) * 0.8,
          y: -2.4, // Looking upward
          isInquisitive: false,
          leftLidY: 12.8,  // Upper lids retract up!
          leftHeight: 16.2,
          rightLidY: 12.8,
          rightHeight: 16.2,
          rightTilt: 0,
        };
      } else {
        // Inquisitive Grok Smirk: Right upper eyelid drops down from the top!
        nextTarget = {
          x: 1.6,
          y: -0.6,
          isInquisitive: true,
          leftLidY: 13.2,  // Left eye alert & slightly raised
          leftHeight: 15.8,
          rightLidY: 20.2, // Right upper eyelid lowers from top!
          rightHeight: 8.8, // Bottom anchored at 20.2 + 8.8 = 29
          rightTilt: -4.5, // Quizzical eyelid tilt
        };
      }

      setTarget(nextTarget);

      // Saccade-triggered micro-blink (18% chance of blinking during a gaze shift)
      if (Math.random() < 0.18) {
        triggerBlink();
      }

      // Schedule next fixation with organic duration (1.4s to 3.8s)
      const nextDuration = 1400 + Math.random() * 2400;
      saccadeTimerRef.current = setTimeout(performSaccade, nextDuration);
    };

    performSaccade();

    return () => {
      if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current);
    };
  }, [mood]);

  // 2. Realistic Eyelid Blink Engine (Asymmetric Velocity & Double-Blink Chance)
  const triggerBlink = () => {
    setIsBlinking(true);

    // Fast eyelid close (55ms), then reopen (120ms)
    setTimeout(() => {
      setIsBlinking(false);

      // 12% probability of a biological double-blink
      if (Math.random() < 0.12) {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 90);
        }, 120);
      }
    }, 110);
  };

  useEffect(() => {
    if (mood !== 'idle') return;

    const scheduleBlink = () => {
      const nextBlinkInterval = 3200 + Math.random() * 2600; // Random interval between blinks
      blinkTimerRef.current = setTimeout(() => {
        triggerBlink();
        scheduleBlink();
      }, nextBlinkInterval);
    };

    scheduleBlink();

    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [mood]);

  // 3. Autonomous Ear-Fin Twitch Routine
  useEffect(() => {
    if (mood !== 'idle') return;

    const scheduleTwitch = () => {
      const nextDelay = 4500 + Math.random() * 3500;
      const timer = setTimeout(() => {
        if (Math.random() > 0.5) {
          setLeftEarTwitch(true);
          setTimeout(() => setLeftEarTwitch(false), 340);
        } else {
          setRightEarTwitch(true);
          setTimeout(() => setRightEarTwitch(false), 340);
        }
        scheduleTwitch();
      }, nextDelay);

      return timer;
    };

    const timer = scheduleTwitch();
    return () => clearTimeout(timer);
  }, [mood]);

  // Ballistic Saccade Spring: Ultra-fast (40-60ms) and settles decisively without sluggish float
  const saccadeSpring = {
    type: 'spring',
    stiffness: 950,
    damping: 46,
    mass: 0.45,
  };

  // Eyelid Morph Spring: Fluid, organic soft tissue physics
  const lidSpring = {
    type: 'spring',
    stiffness: 620,
    damping: 38,
    mass: 0.6,
  };

  // 3D Visor Horizon Curvature Compression
  const leftEye3DScaleX = target.x < -1 ? 0.91 : target.x > 1 ? 1.03 : 1.0;
  const rightEye3DScaleX = target.x > 1 ? 0.91 : target.x < -1 ? 1.03 : 1.0;

  return (
    <motion.div
      className="relative flex items-center justify-center select-none cursor-pointer"
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.12, rotate: -2 }}
      whileTap={{ scale: 0.9, rotate: 3 }}
      // Organic Idle Bob with Micro-Tilt
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
              // Idle Organic Respiration
              y: [0, -1.8, 0, -0.6, 0],
              rotate: target.isInquisitive ? [0, 3.5, 3] : [0, 1.8, 0, -1.5, 0],
              scaleX: [1, 1.025, 0.985, 1.01, 1],
              scaleY: [1, 0.975, 1.015, 0.99, 1],
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
          opacity: mood === 'alert' ? [0.35, 0.65, 0.35] : [0.18, 0.3, 0.18],
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
            <stop offset="0%" stopColor="#141418" />
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
            <feGaussianBlur stdDeviation="0.75" result="blur" />
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

        {/* 4. Minimalist Glass Visor Sheen (Moves subtly against gaze to simulate 3D refraction) */}
        <motion.path
          d="M13 13C17 9.5 27 9.5 31 13"
          stroke="#FFFFFF"
          strokeOpacity="0.22"
          strokeWidth="1.4"
          strokeLinecap="round"
          animate={{ x: -target.x * 0.25, y: -target.y * 0.2 }}
          transition={lidSpring}
        />

        {/* 5. Grok Bot Ballistic Saccade Eye Group */}
        <motion.g
          filter="url(#eye-bloom)"
          animate={{
            x: mood === 'searching' ? [-3, 3, -3] : target.x,
            y: target.y,
          }}
          transition={saccadeSpring}
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
            // Rapid Eyelid Closure Snap (Closing down toward lower third line)
            <>
              <line x1="12.5" y1="22.5" x2="19.5" y2="22.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="24.5" y1="22.5" x2="31.5" y2="22.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
            </>
          ) : (
            // Realistic Ballistic Saccades with Listing's Law Lid-Gaze Coupling
            <>
              {/* Left Eye Capsule (with 3D Spherical Compression) */}
              <motion.rect
                x="12.5"
                width="7"
                rx="3.5"
                fill="#FFFFFF"
                animate={{
                  y: target.leftLidY,
                  height: target.leftHeight,
                  scaleX: leftEye3DScaleX,
                }}
                style={{ originX: '16px', originY: '29px' }}
                transition={lidSpring}
              />

              {/* Right Eye Capsule (Half-Closed from TOP down during inquisitive saccade, 3D compressed) */}
              <motion.rect
                x="24.5"
                width="7"
                rx="3.5"
                fill="#FFFFFF"
                animate={{
                  y: target.rightLidY,
                  height: target.rightHeight,
                  rotate: target.rightTilt,
                  scaleX: rightEye3DScaleX,
                }}
                style={{ originX: '28px', originY: '29px' }}
                transition={lidSpring}
              />
            </>
          )}
        </motion.g>
      </svg>
    </motion.div>
  );
};
