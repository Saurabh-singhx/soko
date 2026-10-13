import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { MascotMood } from '../../types/index.ts';

interface CharacterAvatarProps {
  mood: MascotMood;
  size?: number;
  notificationKey?: string | number;
}

/**
 * High-precision Gaze and Ocular Target State for Grok Bot.
 */
interface GazeTarget {
  name: string;
  // Eye group translation (gaze vector)
  gazeX: number;
  gazeY: number;

  // Left Eye Morph Parameters
  leftTopY: number;      // 16.0 = neutral open, 21.5 = squint, 26.8 = blink
  leftHeight: number;    // Anchored at BASE_BOTTOM (28.0)
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
// Visor center is (22, 22). With BASE_BOTTOM = 28.0 and neutral top = 16.0,
// the eye center is (16 + 28)/2 = 22.0, aligning dead-center in the visor dome.
const BASE_BOTTOM = 28.0;
const LEFT_EYE_X = 12.5;   // Width 7.0 -> spans 12.5 to 19.5, center at 16.0
const RIGHT_EYE_X = 24.5;  // Width 7.0 -> spans 24.5 to 31.5, center at 28.0
const EYE_WIDTH = 7.0;
const EYE_RX = 3.5;        // Full pill capsule radius

/**
 * Neutral baseline gaze state.
 */
const NEUTRAL_TARGET: GazeTarget = {
  name: 'forward_focus',
  gazeX: 0,
  gazeY: 0,
  leftTopY: 16.0,
  leftHeight: 12.0,
  leftScaleX: 1.0,
  leftTilt: 0,
  rightTopY: 16.0,
  rightHeight: 12.0,
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
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 2. Glance Left (Eyes shift left, 3D visor curvature compresses left eye)
  {
    name: 'glance_left',
    gazeX: -2.5,
    gazeY: -0.2,
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 0.90,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 1.03,
    rightTilt: 0,
    headTilt: 0,
  },
  // 3. Glance Right (Eyes shift right toward island body)
  {
    name: 'glance_right',
    gazeX: 2.8,
    gazeY: -0.2,
    leftTopY: 16.0,
    leftHeight: 12.0,
    leftScaleX: 1.03,
    leftTilt: 0,
    rightTopY: 16.0,
    rightHeight: 12.0,
    rightScaleX: 0.90,
    rightTilt: 0,
    headTilt: 0,
  },
  // 4. Inquisitive Smirk (Right eye half-closed strictly from TOP down, curious tilt)
  {
    name: 'inquisitive_right',
    gazeX: 1.4,
    gazeY: -0.3,
    leftTopY: 15.6,
    leftHeight: 12.4,
    leftScaleX: 1.02,
    leftTilt: 0,
    rightTopY: 21.5,
    rightHeight: 6.5,
    rightScaleX: 0.96,
    rightTilt: -5.5,
    headTilt: 2.5,
  },
  // 5. Inquisitive Left (Left eye half-closed strictly from TOP down)
  {
    name: 'inquisitive_left',
    gazeX: -1.4,
    gazeY: -0.3,
    leftTopY: 21.5,
    leftHeight: 6.5,
    leftScaleX: 0.96,
    leftTilt: 5.5,
    rightTopY: 15.6,
    rightHeight: 12.4,
    rightScaleX: 1.02,
    rightTilt: 0,
    headTilt: -2.5,
  },
  // 6. Thinking / Cognitive Search (Gaze up and slightly left, eyelids widen)
  {
    name: 'thinking_up',
    gazeX: -0.8,
    gazeY: -1.4,
    leftTopY: 15.0,
    leftHeight: 13.0,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 15.0,
    rightHeight: 13.0,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: -0.8,
  },
  // 7. Concentrated Squint (Both eyelids narrow slightly from top)
  {
    name: 'concentrated_squint',
    gazeX: 0,
    gazeY: 0.2,
    leftTopY: 19.5,
    leftHeight: 8.5,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 19.5,
    rightHeight: 8.5,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
  // 8. Wide Alert / Perk (Discovery micro-expression)
  {
    name: 'wide_perk',
    gazeX: 0,
    gazeY: -0.4,
    leftTopY: 14.8,
    leftHeight: 13.2,
    leftScaleX: 1.05,
    leftTilt: 0,
    rightTopY: 14.8,
    rightHeight: 13.2,
    rightScaleX: 1.05,
    rightTilt: 0,
    headTilt: 0,
  },
  // 9. Relaxed / Chill (Both upper lids descend slightly)
  {
    name: 'relaxed_chill',
    gazeX: 0,
    gazeY: 0.4,
    leftTopY: 18.2,
    leftHeight: 9.8,
    leftScaleX: 1.0,
    leftTilt: 0,
    rightTopY: 18.2,
    rightHeight: 9.8,
    rightScaleX: 1.0,
    rightTilt: 0,
    headTilt: 0,
  },
];

/**
 * Realistic Ocular Engine for Grok-Bot.
 *
 * Core Features:
 * 1. Hard Screen Clipping: SVG clipPath (#grok-visor-screen) strictly bounds the visor screen.
 * 2. Optical Center Alignment: Baseline at (22, 22) with direct SVG attributes to guarantee visibility.
 * 3. Notification Varieties: Spin effects (360° roll), watching left-right at notification text, curious winks.
 * 4. Grounded Physical Stance: No whole-head rubber bouncing; intentional head poses only.
 * 5. Top-Down Eyelid Closure: Base bottom anchor remains fixed at BASE_BOTTOM (28.0) while the upper lid drops down.
 * 6. Ballistic Saccades & Rich Varieties: Instantaneous gaze shifts, horizontal scanning sweeps, and asymmetric curiosities.
 * 7. Autonomous Ear-Fin Kinematics: Fast micro-twitches that don't shake the head.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  mood,
  size = 32,
  notificationKey,
}) => {
  const [currentTarget, setCurrentTarget] = useState<GazeTarget>(NEUTRAL_TARGET);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [leftEarTwitch, setLeftEarTwitch] = useState(false);
  const [rightEarTwitch, setRightEarTwitch] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);

  const saccadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearNotificationTimers = () => {
    notificationTimersRef.current.forEach((t) => clearTimeout(t));
    notificationTimersRef.current = [];
  };

  // 1. Notification Event Choreography: Spin Effect, Watch Right/Left, Curious Smirks
  useEffect(() => {
    if (mood !== 'alert') {
      clearNotificationTimers();
      return;
    }

    clearNotificationTimers();

    // Pick 1 of 4 distinct notification reaction choreographies
    const variant = Math.floor(Math.random() * 4);

    if (variant === 0) {
      // VARIETY A: 360 Spin Roll -> Snap Watch Right (reading text) -> Check Left -> Settle
      setSpinAngle((prev) => prev + 360);
      setLeftEarTwitch(true);
      setRightEarTwitch(true);

      const t1 = setTimeout(() => {
        // Eyes immediately dart right towards the notification body!
        setCurrentTarget({
          name: 'watch_notif_right',
          gazeX: 3.4,
          gazeY: -0.2,
          leftTopY: 15.2,
          leftHeight: 12.8,
          leftScaleX: 1.04,
          leftTilt: 0,
          rightTopY: 15.2,
          rightHeight: 12.8,
          rightScaleX: 0.94,
          rightTilt: 0,
          headTilt: 2.5,
        });
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
      }, 350);

      const t2 = setTimeout(() => {
        // Turn eyes left to check surroundings / user
        setCurrentTarget({
          name: 'glance_left',
          gazeX: -2.6,
          gazeY: 0,
          leftTopY: 16.0,
          leftHeight: 12.0,
          leftScaleX: 0.90,
          leftTilt: 0,
          rightTopY: 16.0,
          rightHeight: 12.0,
          rightScaleX: 1.02,
          rightTilt: 0,
          headTilt: -1.5,
        });
      }, 1400);

      const t3 = setTimeout(() => {
        // Look back right at the notification with an inquisitive squint!
        setCurrentTarget({
          name: 'inquisitive_right',
          gazeX: 3.0,
          gazeY: -0.3,
          leftTopY: 15.6,
          leftHeight: 12.4,
          leftScaleX: 1.02,
          leftTilt: 0,
          rightTopY: 21.5,
          rightHeight: 6.5,
          rightScaleX: 0.96,
          rightTilt: -5.5,
          headTilt: 3.2,
        });
        triggerBlink();
      }, 2600);

      notificationTimersRef.current.push(t1, t2, t3);
    } else if (variant === 1) {
      // VARIETY B: Observant Scanner: Smooth scan sweep across text lines
      setCurrentTarget({
        name: 'scan_sweep_start',
        gazeX: -2.8,
        gazeY: -0.2,
        leftTopY: 16.2,
        leftHeight: 11.8,
        leftScaleX: 0.95,
        leftTilt: 0,
        rightTopY: 16.2,
        rightHeight: 11.8,
        rightScaleX: 0.95,
        rightTilt: 0,
        headTilt: -2.0,
      });

      const t1 = setTimeout(() => {
        // Smoothly scan all the way across to the right!
        setIsScanning(true);
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: 3.4,
          headTilt: 3.0,
        }));
      }, 300);

      const t2 = setTimeout(() => {
        setIsScanning(false);
        // Perk up with curious wink
        triggerBlink();
        setRightEarTwitch(true);
        setTimeout(() => setRightEarTwitch(false), 300);
      }, 1600);

      const t3 = setTimeout(() => {
        // Fix gaze right at the text with alert focus
        setCurrentTarget({
          name: 'alert_inspect',
          gazeX: 3.2,
          gazeY: 0,
          leftTopY: 15.0,
          leftHeight: 13.0,
          leftScaleX: 1.04,
          leftTilt: 0,
          rightTopY: 15.0,
          rightHeight: 13.0,
          rightScaleX: 0.94,
          rightTilt: 0,
          headTilt: 2.0,
        });
      }, 2400);

      notificationTimersRef.current.push(t1, t2, t3);
    } else if (variant === 2) {
      // VARIETY C: Double-Take: Snap right -> surprise blink -> 360 Spin!
      setCurrentTarget({
        name: 'watch_right_alert',
        gazeX: 3.5,
        gazeY: -0.4,
        leftTopY: 14.8,
        leftHeight: 13.2,
        leftScaleX: 1.05,
        leftTilt: 0,
        rightTopY: 14.8,
        rightHeight: 13.2,
        rightScaleX: 0.95,
        rightTilt: 0,
        headTilt: 4.0,
      });

      const t1 = setTimeout(() => {
        triggerBlink();
      }, 600);

      const t2 = setTimeout(() => {
        // Acrobatic flip on surprise!
        setSpinAngle((prev) => prev + 360);
      }, 1000);

      const t3 = setTimeout(() => {
        // Settles into inquisitive gaze looking at notification
        setCurrentTarget({
          name: 'inquisitive_right',
          gazeX: 2.8,
          gazeY: -0.2,
          leftTopY: 15.6,
          leftHeight: 12.4,
          leftScaleX: 1.02,
          leftTilt: 0,
          rightTopY: 21.5,
          rightHeight: 6.5,
          rightScaleX: 0.96,
          rightTilt: -5.5,
          headTilt: 2.8,
        });
      }, 1500);

      notificationTimersRef.current.push(t1, t2, t3);
    } else {
      // VARIETY D: Radar Perk: Ear-fin high vibration perk, wide eyes, glances left & right
      setLeftEarTwitch(true);
      setRightEarTwitch(true);
      setTimeout(() => {
        setLeftEarTwitch(false);
        setRightEarTwitch(false);
      }, 400);

      setCurrentTarget({
        name: 'wide_radar',
        gazeX: 3.2,
        gazeY: -0.2,
        leftTopY: 14.6,
        leftHeight: 13.4,
        leftScaleX: 1.06,
        leftTilt: 0,
        rightTopY: 14.6,
        rightHeight: 13.4,
        rightScaleX: 0.94,
        rightTilt: 0,
        headTilt: 2.2,
      });

      const t1 = setTimeout(() => {
        // Quick glance left
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: -2.8,
          headTilt: -2.2,
        }));
      }, 1200);

      const t2 = setTimeout(() => {
        // Snap back right to read
        setCurrentTarget((prev) => ({
          ...prev,
          gazeX: 3.2,
          headTilt: 2.5,
        }));
        triggerBlink();
      }, 2200);

      notificationTimersRef.current.push(t1, t2);
    }

    return () => {
      clearNotificationTimers();
    };
  }, [mood, notificationKey]);

  // 2. Biological Saccade & Variety Controller for Idle State
  useEffect(() => {
    if (mood !== 'idle') {
      setIsScanning(false);
      return;
    }

    const performSaccade = () => {
      const roll = Math.random();

      // 12% chance to execute an active horizontal scan sweep
      if (roll < 0.12) {
        setIsScanning(true);
        setCurrentTarget({
          name: 'scan_sweep',
          gazeX: -2.5,
          gazeY: 0,
          leftTopY: 17.0,
          leftHeight: 11.0,
          leftScaleX: 0.95,
          leftTilt: 0,
          rightTopY: 17.0,
          rightHeight: 11.0,
          rightScaleX: 0.95,
          rightTilt: 0,
          headTilt: 0,
        });

        // Scan across to the right after 450ms
        setTimeout(() => {
          setCurrentTarget((prev) => ({
            ...prev,
            gazeX: 2.5,
          }));
        }, 450);

        // End scan sweep after 1300ms
        setTimeout(() => {
          setIsScanning(false);
          setCurrentTarget(NEUTRAL_TARGET);
        }, 1300);

        saccadeTimerRef.current = setTimeout(performSaccade, 2000);
        return;
      }

      // Pick next target with weighted probability
      let nextTarget: GazeTarget;
      if (roll < 0.35) {
        // Forward neutral
        nextTarget = GAZE_VARIETIES[0];
      } else if (roll < 0.52) {
        // Glance Left
        nextTarget = GAZE_VARIETIES[1];
      } else if (roll < 0.68) {
        // Glance Right
        nextTarget = GAZE_VARIETIES[2];
      } else if (roll < 0.80) {
        // Inquisitive Smirk (Right eye top-down squint)
        nextTarget = GAZE_VARIETIES[3];
      } else if (roll < 0.88) {
        // Inquisitive Left
        nextTarget = GAZE_VARIETIES[4];
      } else if (roll < 0.94) {
        // Thinking Up
        nextTarget = GAZE_VARIETIES[5];
      } else {
        // Concentrated / Relaxed
        nextTarget = Math.random() > 0.5 ? GAZE_VARIETIES[6] : GAZE_VARIETIES[8];
      }

      setCurrentTarget(nextTarget);

      // Natural saccadic micro-blink (18% chance during gaze jump)
      if (Math.random() < 0.18) {
        triggerBlink();
      }

      // Responsive saccade duration: 1.0s to 2.2s (lively and active!)
      const nextDuration = 1000 + Math.random() * 1200;
      saccadeTimerRef.current = setTimeout(performSaccade, nextDuration);
    };

    performSaccade();

    return () => {
      if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current);
    };
  }, [mood]);

  // 3. Realistic Eyelid Blink Engine (Ballistic Descent, Spring Reopen & Double-Blink)
  const triggerBlink = () => {
    setIsBlinking(true);

    // Fast eyelid close (45ms), then reopen (85ms)
    setTimeout(() => {
      setIsBlinking(false);

      // 14% chance of organic double-blink
      if (Math.random() < 0.14) {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 55);
        }, 100);
      }
    }, 85);
  };

  useEffect(() => {
    const scheduleBlink = () => {
      const interval = (mood === 'alert' ? 2400 : 2800) + Math.random() * 2000;
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

  // 4. Independent Ear-Fin Antenna Twitch Routine
  useEffect(() => {
    const scheduleTwitch = () => {
      const delay = (mood === 'alert' ? 2500 : 3800) + Math.random() * 2600;
      const timer = setTimeout(() => {
        if (Math.random() > 0.5) {
          setLeftEarTwitch(true);
          setTimeout(() => setLeftEarTwitch(false), 260);
        } else {
          setRightEarTwitch(true);
          setTimeout(() => setRightEarTwitch(false), 260);
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
    stiffness: 350,
    damping: 22,
    mass: 0.7,
  };

  // Compute live animated parameters
  const currentLeftTopY = isBlinking ? 26.8 : currentTarget.leftTopY;
  const currentLeftHeight = isBlinking ? 1.2 : currentTarget.leftHeight;
  const currentRightTopY = isBlinking ? 26.8 : currentTarget.rightTopY;
  const currentRightHeight = isBlinking ? 1.2 : currentTarget.rightHeight;
  const currentRightRx = currentTarget.name.includes('inquisitive') ? 3.0 : EYE_RX;

  // Handle direct click spin reaction
  const handleAvatarClick = () => {
    setSpinAngle((prev) => prev + 360);
    triggerBlink();
    setLeftEarTwitch(true);
    setRightEarTwitch(true);
    setTimeout(() => {
      setLeftEarTwitch(false);
      setRightEarTwitch(false);
    }, 320);
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
      onClick={handleAvatarClick}
    >
      {/* 
        BOT HEAD CONTAINER:
        Executes crisp spring spins on notification arrival or click, 
        and holds stable, deliberate micro-tilts when inquisitive.
      */}
      <motion.div
        className="w-full h-full relative flex items-center justify-center"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        animate={{
          rotate: currentTarget.headTilt + spinAngle,
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
              can ever bleed outside the circular black visor dome.
            */}
            <clipPath id="grok-visor-screen">
              <circle cx="22" cy="22" r="15" />
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
                ? { rotate: [-18, 14, -8, 0] }
                : mood === 'alert'
                ? { rotate: -24, scale: 1.12 }
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
                ? { rotate: [18, -14, 8, 0] }
                : mood === 'alert'
                ? { rotate: 24, scale: 1.12 }
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

          {/* 
            4. GROK BOT OCULAR SCREEN ASSEMBLY:
            Enclosed completely within #grok-visor-screen clip path.
          */}
          <g clipPath="url(#grok-visor-screen)">
            <motion.g
              filter="url(#eye-bloom)"
              transform={`translate(${currentTarget.gazeX}, ${currentTarget.gazeY})`}
              animate={{
                x: currentTarget.gazeX,
                y: currentTarget.gazeY,
              }}
              style={{
                transition: isScanning ? 'transform 0.55s ease-in-out' : 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              transition={isScanning ? scanSpring : saccadeSpring}
            >
              {mood === 'happy' ? (
                // Joyful Upward Curved Arcs (^^)
                <>
                  <path
                    d="M13 22C13 18.5 16 17.5 19 21"
                    stroke="#FFFFFF"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M25 21C28 17.5 31 18.5 31 22"
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
              ) : mood === 'error' ? (
                // Error / Slanted Slits (/ \)
                <>
                  <line x1="12.5" y1="20" x2="19.5" y2="23.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                  <line x1="24.5" y1="23.5" x2="31.5" y2="20" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
                </>
              ) : (
                // Realistic Grok Bot Morphing Eyes (Alert & Idle states with Top-Down Lid Kinematics)
                <>
                  {/* Left Eye Capsule */}
                  <motion.g
                    transform={`rotate(${currentTarget.leftTilt}, 16, 28)`}
                    style={{
                      transformOrigin: `16px ${BASE_BOTTOM}px`,
                      transition: 'transform 0.14s ease-out',
                    }}
                    animate={{ rotate: currentTarget.leftTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={LEFT_EYE_X}
                      y={currentLeftTopY}
                      rx={EYE_RX}
                      width={EYE_WIDTH}
                      height={currentLeftHeight}
                      fill="#FFFFFF"
                      animate={{
                        attrY: currentLeftTopY,
                        height: currentLeftHeight,
                        scaleX: currentTarget.leftScaleX,
                      }}
                      transition={isBlinking ? blinkSpring : lidSpring}
                    />
                  </motion.g>

                  {/* Right Eye Capsule (Closes strictly from TOP down during inquisitive smirk) */}
                  <motion.g
                    transform={`rotate(${currentTarget.rightTilt}, 28, 28)`}
                    style={{
                      transformOrigin: `28px ${BASE_BOTTOM}px`,
                      transition: 'transform 0.14s ease-out',
                    }}
                    animate={{ rotate: currentTarget.rightTilt }}
                    transition={lidSpring}
                  >
                    <motion.rect
                      x={RIGHT_EYE_X}
                      y={currentRightTopY}
                      rx={currentRightRx}
                      width={EYE_WIDTH}
                      height={currentRightHeight}
                      fill="#FFFFFF"
                      animate={{
                        attrY: currentRightTopY,
                        height: currentRightHeight,
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
