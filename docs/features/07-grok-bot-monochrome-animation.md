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

### B. Micro-Saccade Gaze Physics
The eyes do not remain static when idle. Every 2.5 to 4 seconds, the eyes execute a smooth **micro-saccade**:
1. Eyes glide together across the X/Y plane: `x: [-4px, +4px]`, `y: [-2px, +2px]`.
2. Asymmetric inertia: The eye closest to the movement direction moves first by a 25ms lead time, while the trailing eye follows elastically.
3. Deceleration curve: Uses an exponential ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`), avoiding robotic linear transitions.

### C. The Elastic Razor Blink Cycle
Standard animations use slow fades or simple line swaps. Grok Bot uses a rapid, high-spring snap:
* **0ms**: Eye starts at 100% height.
* **45ms**: Rapid elastic collapse to 5% height (`scaleY: 0.05`).
* **95ms**: High-velocity expansion with overshoot bounce (`scaleY: 1.15`).
* **140ms**: Settles back to resting state (`scaleY: 1.0`).

### D. The Asymmetric "Quirky Cocked" Expression
Grok's signature witty personality comes from **asymmetry**:
* During idle curiosity or processing, the left eye remains a tall vertical pill while the right eye squints slightly (`scaleY: 0.82`) with a subtle rotation tilt (`rotate: -6°`).
* The left ear-fin perks up 15° higher than the right, conveying curious attention.

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
