/**
 * Framer Motion Animation & Spring Physics Presets
 * Critically damped Apple-style springs with zero bounce and high responsiveness.
 */

import { Transition } from 'framer-motion';

export const springPresets = {
  // Apple Dynamic Island morph: fast response, critically damped, zero overshoot
  islandMorph: {
    type: 'spring',
    stiffness: 260,
    damping: 32,
    mass: 0.8,
  } as Transition,

  // Snappy micro-interaction for buttons and icon clicks
  buttonPress: {
    type: 'spring',
    stiffness: 500,
    damping: 25,
  } as Transition,

  // Smooth popover entrance
  popoverReveal: {
    type: 'spring',
    stiffness: 300,
    damping: 28,
    mass: 0.9,
  } as Transition,

  // Staggered list fade
  staggerChild: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,
};
