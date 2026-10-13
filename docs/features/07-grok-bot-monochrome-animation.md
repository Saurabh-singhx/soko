# Feature Research & Engineering: Grok Bot Monochrome Animation System

> **Feature Goal**: Replicate the iconic, minimalist **Grok Bot** animation language in a pure **Black & White (Monochrome OLED)** design. This includes organic capsule eye morphing, realistic saccade gaze tracking, asymmetric inquisitive head/eye cocking, elastic razor blinks, and responsive robotic ear-fin kinematics.

---

## 1. Aesthetic Philosophy: Pure Monochrome (Black & White)

Unlike traditional colorful or cartoonish avatars, the **Grok Bot** design language is rooted in high-contrast minimalism:

* **Pure OLED Deep Black (`#000000` / `#0A0A0C`)**: Provides an infinite contrast canvas without distracting visual noise.
* **Stark Luminous White (`#FFFFFF`)**: The eyes are clean, geometric white capsules with a subtle ambient bloom (`drop-shadow: 0 0 8px rgba(255, 255, 255, 0.7)`).
* **Zero Cartoon Clutter**: No colorful gradients, mouth outlines, or cartoon blush circles. Emotion is conveyed purely through **geometric eye morphology and spring physics**.
* **Monochrome Metallic Ear-Fins**: Minimalist aerodynamic audio fins rendered in deep matte graphite with crisp white neon rim strokes.

---

## 2. Grok Bot Eye Kinematics & Morphing Geometry

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GROK BOT EYE MORPH STATES                       │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. NEUTRAL IDLE   │ 2. ASYMMETRIC     │ 3. THINKING / CLI RUNNING      │
│                   │    INQUISITIVE    │                                │
│    ┌─┐     ┌─┐    │    ┌─┐            │    ┌───────┐     ┌───────┐     │
│    │ │     │ │    │    │ │     ┌─┐    │    └───────┘     └───────┘     │
│    └─┘     └─┘    │    └─┘     └─┘    │   (Horizontal pulsing bars)    │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ 4. RAZOR BLINK    │ 5. HAPPY SMIRK    │ 6. ALERT / SURPRISED           │
│                   │                   │                                │
│    ───     ───    │    ╭─╮     ╭─╮    │      ███            ███        │
│  (Razor slit)     │   (Upward arcs)   │     (Wide orb dilation)        │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### A. The Eye Capsule Geometry
* Each eye is modeled as a dynamic rounded rectangle (`rx: 5px` to `rx: 12px` depending on dilation).
* **Neutral Dimensions**: Width: 7.5px, Height: 15px.
* **Aspect Ratio Variation**:
  * Idle: `1 : 2.0` (tall rounded capsule)
  * Thinking / Working: `3.5 : 1` (horizontal scanning bar)
  * Alert: `1 : 1` (perfect luminous circle)
  * Blink: `8 : 1` (razor-thin horizontal slit)

### B. Biological Ballistic Saccades vs. Linear Sliding
Real biological and high-end animatronic eyes (Pixar, Vector, Grok Bot) do **not** slide slowly across the face like elevators:
1. **Ballistic Saccades**: Gaze changes occur via instantaneous ballistic jumps (duration: **40–60ms** via high-stiffness spring `stiffness: 950, damping: 46`).
2. **Organic Fixation Pauses**: After each jump, the gaze locks in place for a randomized duration (**1.4s to 3.8s**), observing its surroundings.
3. **Probabilistic Focus Distribution**: Gaze targets follow a realistic focus hierarchy (45% straight center, 20% glance left, 15% glance right, 10% look up, 10% inquisitive cock).
4. **Lid-Saccade Vertical Coupling (Listing's Eyelid Law)**:
   * When gazing **upward** (`y = -2.4`), upper eyelids naturally retract higher (`y = 12.8, height = 16.2`), widening the ocular aperture.
   * When gazing **downward**, upper eyelids droop downward over the pupil.
5. **3D Visor Spherical Curvature**: As an eye approaches the lateral perimeter of the helmet, it compresses horizontally along the X-axis (`scaleX: 0.91`), simulating realistic 3D perspective distortion around a spherical glass dome.

### C. The Organic Eyelid Blink Engine
Rather than symmetrical linear fades, real eyelids use fast ballistic descent and spring rebound:
* **Descent Phase (50ms)**: Eyelids collapse downward to a razor slit at `y = 22.5`.
* **Rebound Phase (120ms)**: Elastic rebound springs the eyelid back open to the current fixation height.
* **Double-Blinks**: 12% probability of a rapid double-blink sequence (common when real creatures refocus).
* **Saccadic Blink Suppression**: 18% probability of triggering a natural blink during a major gaze jump.

### D. The Asymmetric "Quirky Cocked" Expression (Top-Down Lid Closing)
Grok's signature witty personality comes from **asymmetry and realistic eyelid physics**:
* **Grounded Baseline**: Both eyes share an identical bottom baseline anchor at `y + height = 29`.
* **Top-Down Eyelid Closure**: When the right eye half-closes into an inquisitive squint, the bottom edge **never moves upward**. Instead, the top eyelid drops down from `y = 14` to `y = 20` (reducing height from `15` to `9`), with `originY: 29px` keeping the base locked in place.
* **Curious Cock**: The left eye lifts slightly to `y = 13` (attentive and widened), while the right lid droops from above with a subtle `-4°` tilt.
* The left ear-fin perks up 15° higher than the right, completing the quizzical cocked stance.

---

## 3. Ear-Fin Secondary Motion (Antennae Kinematics)

The aerodynamic audio ear-fins flanking the visor have their own independent spring physics:

1. **Spring Lag**: When the head bobs down, the ear-fins lag behind by 80ms before rebounding.
2. **Autonomous Micro-Twitches**: An independent periodic timer triggers a double-twitch on the left or right fin (`rotate: [-18°, +12°, -5°, 0°]`) simulating active acoustic sensing.
3. **Alert Perk**: When an incoming notification arrives, both fins snap upward into a 30° perked stance with spring vibration.

---

## 4. State Machine Transition Table

| System Event | Bot State | Eye Shape | Gaze Direction | Ear-Fin Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Idle Standby** | `idle` | Tall rounded capsules | Micro-saccades (left/center/right) | Gentle breathing, random twitches |
| **Incoming Notif** | `alert` | Wide luminous circles | Centered, slight forward expansion | Snaps up to +30° perked stance |
| **CLI Running** | `working` | Horizontal scanning bars | Subtle oscillating pulse | Tilted back with focus stance |
| **CLI Succeeded** | `happy` | Curved upward arcs `(^^)` | Lifted upward gaze | Joyful bounce oscillation |
| **Error / Fault** | `error` | Narrowed squinted slits | Tilted asymmetric angles | Drooped downward (-15°) |
| **BT Scanning** | `searching`| Narrowed capsules | Sweeping side-to-side radar | Alternating ear-fin tilt |
