# Feature Research & Engineering: Dynamic Island HUD & Mascot

> **Feature Goal**: Provide a top-center floating heads-up display (HUD) on Windows and Linux desktops inspired by iOS Dynamic Island. The HUD features an animated reactive character mascot, smooth spring physics morphing between compact and expanded states, always-on-top positioning, and seamless mouse click-through behavior when not hovered.

---

## 1. Technical Requirements & User Stories

1. **Top-Center Floating Placement**: The island rests at the very top-center of the primary monitor (`top: 0`, centered along the X axis).
2. **Reactive Mascot Avatar**: A circular mascot capable of conveying emotions (idle breathing, happy, processing, alert, error) reacting in real time to phone events.
3. **Fluid Layout Expansion**:
   - **Compact Mode**: (Width: ~180px, Height: ~36px) Shows the mascot, connection dot, and miniature battery or status glyph.
   - **Notification Mode**: (Width: ~380px, Height: ~84px) Expands downward and outward with sender name, message body, app icon, and dismiss/action buttons.
   - **CLI Mode**: (Width: ~420px, Height: ~120px) Shows the active command (e.g., `agy status`), animated terminal spinner, and live stdout tail.
   - **Transfer Mode**: (Width: ~340px, Height: ~76px) Shows filename, transfer rate, progress bar, and completion checkmark.
4. **Click-Through Transparency**: Transparent margins around the compact pill must **not block mouse clicks** directed at native browser tabs or window titlebars directly behind them.
5. **Cross-Platform Compatibility**: Must run natively on Windows 10/11 and Linux (both X11 and Wayland compositors).

---

## 2. Research & Exploration History

### Attempt 1: Single Electron Window (Failed & Abandoned)
- **Concept**: Use an Electron window with `transparent: true` and `alwaysOnTop: true`.
- **Why it Failed**:
  - Memory consumption: Electron consumed ~150–220 MB RAM at idle just to render a tiny pill.
  - Transparent hit-testing was buggy: `win.setIgnoreMouseEvents(true, { forward: true })` on Linux X11 caused severe cursor flicker and missed drag-and-drop events over underlying applications.
  - On Linux Wayland, Electron's transparency created black border artifacts.

### Attempt 2: Full-Width Transparent Strip (Failed)
- **Concept**: Make a window covering the full display width (`width: 1920`, `height: 200`) at the top of the screen and render CSS elements in the middle.
- **Why it Failed**:
  - Even with CSS `pointer-events: none` on the transparent backdrop, the operating system window manager still assigned cursor focus to the invisible window, preventing users from clicking browser tabs, window minimize/maximize buttons, or title bars.

### Attempt 3: Native Dynamic Window Sizing with Tauri v2 (Selected Architecture)
- **Concept**: Use Tauri v2 with native Rust window control. Instead of keeping a large invisible window, the Rust backend dynamically resizes the actual OS window boundaries (`window.set_size()`) and positions (`window.set_position()`) in lockstep with the UI animation.
- **Why it Succeeded**:
  - Minimal footprint: Idle memory sits under **35 MB RAM**.
  - No hit-testing dead zones: The physical OS window only spans the exact pixel bounding box of the island.
  - Native window handles allow setting platform-specific flags (`WS_EX_TOPMOST` on Windows, `_NET_WM_STATE_ABOVE` on Linux X11).

---

## 3. Platform-Specific Window Implementations

### Windows (Win32 API)
Under Windows, the island window uses:
- `WS_EX_TOPMOST`: Ensures the island stays above full-screen browser sessions and games running in borderless windowed mode.
- `WS_EX_TOOLWINDOW`: Hides the island from the Alt-Tab task switcher.
- DWM (Desktop Window Manager) Blur behind window enabled via `dwmapi.dll` for smooth alpha blending.

### Linux (X11 & Wayland)
- **X11**:
  - Set `_NET_WM_STATE_ABOVE` and `_NET_WM_STATE_STAYS_ON_TOP`.
  - Set `_NET_WM_WINDOW_TYPE_DOCK` or `_NET_WM_WINDOW_TYPE_NOTIFICATION` to prevent window managers (i3, bspwm, GNOME) from tiling or altering the window.
- **Wayland**:
  - Wayland security architecture prevents standard clients from arbitrarily forcing themselves above other windows.
  - **Solution**: Support the `wlr-layer-shell` protocol for wlroots compositors (Sway, Hyprland) placing the window on the `Overlay` layer. For GNOME Wayland, fallback to desktop notification banners or a dedicated GNOME Shell extension hook.

---

## 4. Reactive Character Mascot State Machine

The character mascot uses a state machine modeled after vector animators (Rive / SVG Canvas):

```
       ┌────────────────────────┐
       │      STATE: IDLE       │
       │ (Blinking, Soft Float) │
       └───────────┬────────────┘
                   │
    ┌──────────────┼──────────────┬──────────────┐
    ▼              ▼              ▼              ▼
┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│ SEARCH  │  │   ALERT   │  │  WORKING  │  │  SUCCESS  │
│ Looking │  │ Wide Eyes │  │ Goggles / │  │   Smile   │
│ Around  │  │   Bounce  │  │  Typing   │  │   Bounce  │
└─────────┘  └───────────┘  └───────────┘  └───────────┘
```

### The "Nova" Cyber-Critter Design Architecture
To make the bot original and visually engaging rather than a generic flat smiley:
1. **Aerodynamic Audio Ear-Fins (Antennae)**: Dual lateral ear-fins that perk up during alerts, tilt back when working on CLI agents, and droop when Bluetooth disconnects.
2. **Obsidian Glass Visor Dome**: Multi-layer vector rendering with curved specular light reflection sheen.
3. **Chromatic Blush Pads**: Glowing soft-focus cheek pads shifting across neon violet, cyber cyan, and emerald.
4. **Specular Catchlight Pupils**: Dual-layered glow pupils with secondary catchlight stars.

### Dynamic Mood Color Palette Matrix

| State Trigger | Core Glow & Fins | Rim Gradient | Eye Visuals | Associated System Event |
| :--- | :--- | :--- | :--- | :--- |
| **Idle / Relaxed** | Cyber Cyan (`#00F0FF`) | Neon Violet ➔ Cyan | Specular catchlight pupils | Device paired and idling |
| **Incoming Notif** | Sunset Coral (`#FF3366`) | Coral ➔ Gold | Wide glowing amber rings | Phone notification received |
| **CLI Running** | Electric Violet (`#8B5CF6`) | Violet ➔ Cyan | Terminal crosshairs & goggles | `antigravity-cli` / agent active |
| **Success / Saved** | Emerald (`#10B981`) | Emerald ➔ Aqua | Joyful sparkle crescent arcs | APK transfer / CLI exit 0 |
| **Error / Failed** | Crimson (`#EF4444`) | Crimson ➔ Maroon | Glitch red crosshairs | Process exit non-zero / checksum fail |
| **Searching** | Indigo (`#6366F1`) | Indigo ➔ Blue | Sideways radar gaze | Bluetooth discovery active |

---

## 5. Animation Physics & UI Stack

- **Physics Engine**: Framer Motion / Spring physics with Apple-matching curves:
  - `stiffness: 450`, `damping: 32`, `mass: 0.85`.
- **Layout Morphing**: Uses layout morphing (`layout` & `layoutId` properties) so dimensions resize organically without jarring frame jumps.
- **Color Aesthetics**: Deep obsidian core (`#0A0A0C`), multi-spectrum aurora gradients, and OLED deep black contrast.
