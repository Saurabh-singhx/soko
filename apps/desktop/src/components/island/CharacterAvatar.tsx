import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
}

/**
 * High-precision Gaze and Ocular Target State.
 *
 * Implements Grok Bot's signature kinematics:
 * 1. Base bottom anchoring (y = 27.5) so that eyelids close strictly from the top down.
 * 2. Ballistic saccades (fast jumps, held fixations).
 * 3. 3D Visor curvature perspective (X-scale compression near edges).
 * 4. Intentional head poses (subtle stable tilt when puzzled, NO looping bobbing/bouncing).
 */
interface GazeTarget {
  name: string;
  // Eye group translation (gaze vector)
  gazeX: number;
  gazeY: number;

  // Left Eye Morph Parameters
  leftTopY: number;      // 16.5 = open, 21.2 = squint, 26.2 = blink
  leftHeight: number;    // Anchored at BASE_BOTTOM (27.5)
  leftScaleX: number;    // 3D perspective distortion (0.90 to 1.04)
  leftTilt: number;      // Rotation in degrees around eye base

  // Right Eye Morph Parameters
  rightTopY: number;
  rightHeight: number;
  rightScaleX: number;
  rightTilt: number;

  // Head Pose (deliberate pose angle, NOT bouncing)
  headTilt: number;
}

// Global geometric constants for SVG (viewBox 0 0 44 44)
const BASE_BOTTOM = 27.5; // Bottom anchor of the eyes in neutral position
const LEFT_EYE_X = 13.0;  // Center at 16.25
const RIGHT_EYE_X = 24.5; // Center at 27.75
const EYE_WIDTH = 6.5;
const EYE_RX = 3.25;      // Full capsule radius

/**
 * Neutral baseline gaze state.
 */
const NEUTRAL_TARGET: GazeTarget = {
  name: 'forward_focus',
  gazeX: 0,
  gazeY: 0,
  leftTopY: 16.5,
  leftHeight: 11.0,
  leftScaleX: 1.0,
  leftTilt: 0,
  rightTopY: 16.5,
  rightHeight: 11.0,
  rightScaleX: 1.0,
  rightTilt: 0,
  headTilt: 0,
};

/**
 * Library of realistic, organic Grok Bot eye states.
 */
const GAZE_VARIETIES: GazeTarget[] = [
  // 1. Forward Alert Focus
  {
    name: 'forward_focus',
    gazeX: 0,
    gazeY: 0,
    leftTopY: 16.5,
    leftHeight: 11.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 16.5,
    rightHeight: 11.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 2. Glance Left (Eyes shift left, 3D visor curvature compresses left eye)
  {
    name: 'glance_left',
    gazeX: -2.6,
    gazeY: -0.2,
    leftTopY: 16.5,
    leftHeight: 11.0,
    leftScaleX: 0.90,
    leftTilt: 0,
    rightTopY: 16.5,
    rightHeight: 11.0,
    rightScaleX: 1.03,
    rightTilt: 0,
    headTilt: 0,
  },
  // 3. Glance Right (Eyes shift right, 3D visor curvature compresses right eye)
  {
    name: 'glance_right',
    gazeX: 2.6,
    gazeY: -0.2,
    leftTopY: 16.5,
    leftHeight: 11.0,
    leftScaleX: 1.03,
    leftTilt: 0,
    rightTopY: 16.5,
    rightHeight: 11.0,
    rightScaleX: 0.90,
    rightTilt: 0,
    headTilt: 0,
  },
  // 4. Inquisitive Smirk (Right eye half-closed strictly from TOP down, curious tilt)
  {
    name: 'inquisitive_right',
    gazeX: 1.3,
    gazeY: -0.3,
    leftTopY: 16.2,
    leftHeight: 11.3,
    leftScaleX: 1.02,
    leftTilt: 0,
    // Right eyelid lowers from top: top drops from 16.5 to 21.2, bottom stays at 27.5!
    rightTopY: 21.2,
    rightHeight: 6.3,
    rightScaleX: 0.96,
    rightTilt: -5.5,
    headTilt: 2.4, // Thoughtful head cock (settles solidly, does not bounce)
  },
  // 5. Inquisitive Left (Left eye half-closed strictly from TOP down)
  {
    name: 'inquisitive_left',
    gazeX: -1.3,
    gazeY: -0.3,
    leftTopY: 21.2,
    leftHeight: 6.3,
    leftScaleX: 0.96,
    leftTilt: 5.5,
    rightTopY: 16.2,
    rightHeight: 11.3,
    rightScaleX: 1.02,
    rightTilt: 0,
    headTilt: -2.4,
  },
  // 6. Thinking / Cognitive Search (Gaze up and slightly left, eyelids widen)
  {
    name: 'thinking_up',
    gazeX: -0.8,
    gazeY: -1.5,
    leftTopY: 15.6,
    leftHeight: 11.9,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 15.6,
    rightHeight: 11.9,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: -0.8,
  },
  // 7. Concentrated Squint (Both eyelids narrow slightly from top)
  {
    name: 'concentrated_squint',
    gazeX: 0,
    gazeY: 0.2,
    leftTopY: 19.2,
    leftHeight: 8.3,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 19.2,
    rightHeight: 8.3,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 8. Wide Alert / Perk (Discovery micro-expression)
  {
    name: 'wide_perk',
    gazeX: 0,
    gazeY: -0.5,
    leftTopY: 15.3,
    leftHeight: 12.2,
    leftScaleX: 1.05,
    leftTilt: 0,
    rightTopY: 15.3,
    rightHeight: 12.2,
    rightScaleX: 1.05,
    rightTilt: 0,
    headTilt: 0,
  },
  // 9. Relaxed / Chill (Both upper lids descend slightly)
  {
    name: 'relaxed_chill',
    gazeX: 0,
    gazeY: 0.5,
    leftTopY: 18.5,
    leftHeight: 9.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 18.5,
    rightHeight: 9.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
];

/**
 * Realistic Ocular Engine for Grok-Bot.
 *
 * Core Features:
 * 1. Hard Screen Clipping: SVG clipPath (#grok-visor-screen) guarantees 100% containment inside the visor dome.
 * 2. Grounded Physical Stance: All whole-head bouncing/bobbing effects are removed.
 * 3. Top-Down Eyelid Closure: Base bottom anchor remains fixed at y=27.5 while the upper lid drops downward.
 * 4. Ballistic Saccades & Rich Varieties: Instantaneous gaze shifts, horizontal scanning sweeps, and asymmetric curiosities.
 * 5. Autonomous Ear-Fin Kinematics: Fast micro-twitches that don't shake the head.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
}) => {
  const [currentTarget, setCurrentTarget] = useState<GazeTarget>(NEUTRAL_TARGET);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [leftEarTwitch, setLeftEarTwitch] = useState(false);
  const [rightEarTwitch, setRightEarTwitch] = useState(false);

  const saccadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Biological Saccade & Variety Controller
  useEffect(() => {
    if (mood !== 'idle') {
      setIsScanning(false);
      return;
    }

    const performSaccade = () => {
      const roll = Math.random();

      // 10% chance to execute an active horizontal scan sweep
      if (roll < 0.10) {
        setIsScanning(true);
        setCurrentTarget({
          name: 'scan_sweep',
          gazeX: -2.8,
          gazeY: 0,
          leftTopY: 17.5,
          leftHeight: 10.0,
          leftScaleX: 0.95,
          leftTilt: 0,
          rightTopY: 17.5,
          rightHeight: 10.0,
          rightScaleX: 0.95,
          rightTilt: 0,
          headTilt: 0,
        });

        // Scan across to the right after 500ms
        setTimeout(() => {
          setCurrentTarget((prev) => ({
            ...prev,
            gazeX: 2.8,
          }));
        }, 600);

        // End scan sweep after 1600ms
        setTimeout(() => {
          setIsScanning(false);
          setCurrentTarget(NEUTRAL_TARGET);
        }, 1600);

        saccadeTimerRef.current = setTimeout(performSaccade, 2400);
        return;
      }

      // Pick next target with weighted probability
      let nextTarget: GazeTarget;
      if (roll < 0.40) {
        // Forward neutral
        nextTarget = GAZE_VARIETIES[0];
      } else if (roll < 0.55) {
        // Glance Left
        nextTarget = GAZE_VARIETIES[1];
      } else if (roll < 0.70) {
        // Glance Right
        nextTarget = GAZE_VARIETIES[2];
      } else if (roll < 0.82) {
        // Inquisitive Smirk (Right eye top-down squint)
        nextTarget = GAZE_VARIETIES[3];
      } else if (roll < 0.90) {
        // Inquisitive Left
        nextTarget = GAZE_VARIETIES[4];
      } else if (roll < 0.95) {
        // Thinking Up
        nextTarget = GAZE_VARIETIES[5];
      } else {
        // Concentrated / Relaxed
        nextTarget = Math.random() > 0.5 ? GAZE_VARIETIES[6] : GAZE_VARIETIES[8];
      }

      setCurrentTarget(nextTarget);

      // Natural saccadic micro-blink (16% chance during gaze jump)
      if (Math.random() < 0.16) {
        triggerBlink();
      }

      // Schedule next fixation with organic duration (1.6s to 3.6s)
      const nextDuration = 1600 + Math.random() * 2000;
      saccadeTimerRef.current = setTimeout(performSaccade, nextDuration);
    };

    performSaccade();

    return () => {
      if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current);
    };
  }, [mood]);

  // 2. Realistic Eyelid Blink Engine (Ballistic Descent, Spring Reopen & Double-Blink)
  const triggerBlink = () => {
    setIsBlinking(true);

    // Fast eyelid close (45ms), then reopen (100ms)
    setTimeout(() => {
      setIsBlinking(false);

      // 14% chance of organic double-blink
      if (Math.random() < 0.14) {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 60);
        }, 110);
      }
    }, 90);
  };

  useEffect(() => {
    if (mood !== 'idle') return;

    const scheduleBlink = () => {
      const interval = 3000 + Math.random() * 2600;
      blinkTimerRef.current = setTimeout(() => {
        triggerBlink();
        scheduleBlink();
      }, interval);
    };

    scheduleBlink();

    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [mood]);

  // 3. Independent Ear-Fin Antenna Twitch Routine
  useEffect(() => {
    if (mood !== 'idle') return;

    const scheduleTwitch = () => {
      const delay = 4000 + Math.random() * 3200;
      const timer = setTimeout(() => {
        if (Math.random() > 0.5) {
          setLeftEarTwitch(true);
          setTimeout(() => setLeftEarTwitch(false), 280);
        } else {
          setRightEarTwitch(true);
          setTimeout(() => setRightEarTwitch(false), 280);
        }
        scheduleTwitch();
      }, delay);
      return timer;
    };

    const timer = scheduleTwitch();
    return () => clearTimeout(timer);
  }, [mood]);

  // High-performance spring configs
  const saccadeSpring = {
    type: 'spring',
    stiffness: 920,
    damping: 44,
    mass: 0.38,
  };

  const scanSpring = {
    type: 'spring',
    stiffness: 180,
    damping: 24,
  };

  const lidSpring = {
    type: 'spring',
    stiffness: 580,
    damping: 38,
    mass: 0.45,
  };

  const blinkSpring = {
    type: 'spring',
    stiffness: 1200,
    damping: 48,
    mass: 0.28,
  };

  const headSpring = {
    type: 'spring',
    stiffness: 320,
    damping: 28,
  };

  return (
    <motion.div
      layout
      className="relative flex items-center justify-center select-none cursor-pointer shrink-0"
      animate={{
        width: size,
        height: size,
      }}
      transition={{
        width: { type: 'spring', stiffness: 450, damping: 32 },
        height: { type: 'spring', stiffness: 450, damping: 32 },
      }}
    >
      {/* 
        BOT HEAD CONTAINER:
        No whole-body rubber bouncing! 
        The bot remains stable and poised, executing only intentional micro-tilts when inquisitive.
      */}
      <motion.div
        className="w-full h-full relative flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          rotate: mood === 'idle' ? currentTarget.headTilt : 0,
        }}
        transition={headSpring}
      >
        {/* Subtle OLED Ambient Halo (Zero vertical bob) */}
        <div className="absolute inset-0 rounded-full blur-md bg-white/15 pointer-events-none" />

        <svg
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-2xl"
        >
          <defs>
            {/* 
              HARD SCREEN CLIP:
              Guarantees 100% mathematically that NO pixel of the eyes 
              can ever bleed or render outside the circular black visor dome.
            */}
            <clipPath id="grok-visor-screen">
              <circle cx="22" cy="22" r="14.5" />
            </clipPath>

            {/* Deep OLED Black Gradient */}
            <radialGradient id="grok-visor-black" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#141418" />
              <stop offset="70%" stopColor="#050507" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>

            {/* Crisp Titanium Rim Stroke */}
            <linearGradient id="grok-rim-mono" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#888892" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.35" />
            </linearGradient>

            {/* Graphite Ear-Fin Gradient */}
            <linearGradient id="grok-fin-mono" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#22222A" />
              <stop offset="100%" stopColor="#0A0A0E" />
            </linearGradient>

            {/* OLED High-Definition Bloom Filter */}
            <filter id="eye-bloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.65" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Left Ear-Fin Antenna (Fast autonomous spring twitch) */}
          <motion.path
            d="M7 17C4 13 4 8 8 10C9 13 8 18 7 17Z"
            fill="url(#grok-fin-mono)"
            stroke="#FFFFFF"
            strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
            strokeWidth="1.2"
            animate={
              leftEarTwitch
                ? { rotate: [-16, 12, -6, 0] }
                : mood === 'alert'
                ? { rotate: -22, scale: 1.1 }
                : { rotate: 0 }
            }
            style={{ originX: '8px', originY: '17px' }}
            transition={{
              type: 'spring',
              stiffness: 600,
              damping: 24,
            }}
          />

          {/* 2. Right Ear-Fin Antenna */}
          <motion.path
            d="M37 17C40 13 40 8 36 10C35 13 36 18 37 17Z"
            fill="url(#grok-fin-mono)"
            stroke="#FFFFFF"
            strokeOpacity={mood === 'alert' ? 0.9 : 0.45}
            strokeWidth="1.2"
            animate={
              rightEarTwitch
                ? { rotate: [16, -12, 6, 0] }
                : mood === 'alert'
                ? { rotate: 22, scale: 1.1 }
                : { rotate: 0 }
            }
            style={{ originX: '36px', originY: '17px' }}
            transition={{
              type: 'spring',
              stiffness: 600,
              damping: 24,
            }}
          />

          {/* 3. Deep Black Visor Dome */}
          <circle
            cx="22"
            cy="22"
            r="16"
            fill="url(#grok-visor-black)"
            stroke="url(#grok-rim-mono)"
            strokeWidth="1.5"
          />

          {/* 4. Minimalist Glass Visor Sheen (Micro-parallax against gaze) */}
          <motion.path
            d="M14 13C18 10 26 10 30 13"
            stroke="#FFFFFF"
            strokeOpacity="0.22"
            strokeWidth="1.3"
            strokeLinecap="round"
            animate={{
              x: -currentTarget.gazeX * 0.22,
              y: -currentTarget.gazeY * 0.18,
            }}
            transition={lidSpring}
          />

          {/* 
            5. GROK BOT OCULAR SCREEN ASSEMBLY:
            Enclosed completely within #grok-visor-screen clip path.
          */}
          <g clipPath="url(#grok-visor-screen)">
            <motion.g
              filter="url(#eye-bloom)"
              animate={{
                x: currentTarget.gazeX,
                y: currentTarget.gazeY,
              }}
              transition={isScanning ? scanSpring : saccadeSpring}
            >
              {mood === 'happy' ? (
                // Joyful Upward Curved Arcs (^^)
                <>
                  <path
                    d="M13.5 22.5C13.5 19 16.5 18 19 21"
                    stroke="#FFFFFF"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M25 21C27.5 18 30.5 19 30.5 22.5"
                    stroke="#FFFFFF"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </>
              ) : mood === 'working' ? (
                // Cybernetic Scanning Bars (Laser focus during CLI / APK building)
                <motion.g
                  animate={{
                    x: [-2.2, 2.2, -2.2],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.1,
                    ease: 'easeInOut',
                  }}
                >
                  <rect
                    x="11"
                    y="19.5"
                    width="8.8"
                    height="4.5"
                    rx="2.25"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="24.2"
                    y="19.5"
                    width="8.8"
                    height="4.5"
                    rx="2.25"
                    fill="#FFFFFF"
                  />
                </motion.g>
              ) : mood === 'alert' ? (
                // Wide Luminous Circular Orbs (Incoming notification alert)
                <>
                  <motion.circle
                    cx="16.25"
                    cy="22"
                    r="4.8"
                    fill="#FFFFFF"
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                  <motion.circle
                    cx="27.75"
                    cy="22"
                    r="4.8"
                    fill="#FFFFFF"
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                </>
              ) : mood === 'error' ? (
                // Error / Slanted Slits (/ \)
                <>
                  <line x1="12.5" y1="20" x2="19.5" y2="23.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                  <line x1="24.5" y1="23.5" x2="31.5" y2="20" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                </>
              ) : (
                // Realistic Grok Bot Morphing Eyes (Top-Down Lid Kinematics)
                <>
                  {/* Left Eye Capsule */}
                  <motion.g
                    style={{ transformOrigin: `16.25px ${BASE_BOTTOM}px` }}
                    animate={{ rotate: currentTarget.leftTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={LEFT_EYE_X}
                      rx={EYE_RX}
                      width={EYE_WIDTH}
                      fill="#FFFFFF"
                      animate={{
                        y: isBlinking ? 26.2 : currentTarget.leftTopY,
                        height: isBlinking ? 1.3 : currentTarget.leftHeight,
                        scaleX: currentTarget.leftScaleX,
                      }}
                      transition={isBlinking ? blinkSpring : lidSpring}
                    />
                  </motion.g>

                  {/* Right Eye Capsule (Closes strictly from TOP down during inquisitive smirk) */}
                  <motion.g
                    style={{ transformOrigin: `27.75px ${BASE_BOTTOM}px` }}
                    animate={{ rotate: currentTarget.rightTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={RIGHT_EYE_X}
                      rx={currentTarget.name === 'inquisitive_right' ? 2.8 : EYE_RX}
                      width={EYE_WIDTH}
                      fill="#FFFFFF"
                      animate={{
                        y: isBlinking ? 26.2 : currentTarget.rightTopY,
                        height: isBlinking ? 1.3 : currentTarget.rightHeight,
                        scaleX: currentTarget.rightScaleX,
                      }}
                      transition={isBlinking ? blinkSpring : lidSpring}
                    />
                  </motion.g>
                </>
              )}
            </motion.g>
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
};
