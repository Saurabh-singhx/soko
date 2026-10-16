# Soko Character Engine — Architecture & Technical Specification

> **For Creators & AI Model Prompts**:  
> This document explains the **internal architecture, technical contract, rendering engine, and state machine** of the Soko Character Subsystem.  
> It does **not** dictate what character you should build. You define the character identity, visual concept, and aesthetic—this guide ensures the generated output technically integrates into Soko's Dynamic Island with zero errors.

---

## 📋 Table of Contents
1. [🛠️ Technology Stack & Formats for AI](#1-technology-stack--formats-for-ai)
2. [🏗️ System Architecture & Lifecycle](#2-system-architecture--lifecycle)
3. [🤖 AI Architecture System Prompt (Copy & Paste)](#3-ai-architecture-system-prompt-copy--paste)
4. [📐 Technical Schema Specification](#4-technical-schema-specification)
5. [⚙️ State Machine & Desktop Triggers](#5-state-machine--desktop-triggers)
6. [🎨 Atmospheric State Background Engine](#6-atmospheric-state-background-engine)
7. [🛡️ Validation Engine & Guardrail Rules](#7-validation-engine--guardrail-rules)
8. [🖌️ SVG Vector Rendering Specifications](#8-svg-vector-rendering-specifications)
9. [📥 Installation & Verification Workflow](#9-installation--verification-workflow)
10. [🛡️ Error Handling, Fallbacks & Edge Cases](#10-error-handling-fallbacks--edge-cases)

---

## 1. 🛠️ Technology Stack & Formats for AI

When generating or constructing a Soko character pack, the AI **must** use the following exact technologies:

| Layer | Technology | Specification & Supported Features | Prohibited / Not Allowed |
| :--- | :--- | :--- | :--- |
| **Data Format** | **JSON** (RFC 8259) | UTF-8 encoded, strictly valid JSON. Characters, states, and backgrounds must be key-value pairs in a single object. | No YAML, No XML root wrapper, No Markdown commentary inside the JSON. |
| **Graphics** | **SVG Vector Graphics** (SVG 1.1 / 2.0) | Pure vector primitives: `<path>`, `<circle>`, `<ellipse>`, `<rect>`, `<polygon>`, `<polyline>`, `<line>`, `<g>`, `<defs>`, `<linearGradient>`, `<radialGradient>`, `<stop>`. | ❌ **No raster images** (`<image href="...">` is strictly blocked for security and offline speed). |
| **Coordinate Space** | **SVG 2D ViewBox** | Fixed coordinate grid: `viewBox="0 0 44 44"`. Soko dynamically scales the vector output to `32×32px` (compact HUD) and `56×56px` (idle orb). | ❌ Do not hardcode fixed outer pixel dimensions (`width="500px"`). |
| **Atmospheric Colors** | **CSS3 Color Specification** | Hex codes (`#0B0D14`), `rgb()`, `rgba()`, `linear-gradient(...)`, and `radial-gradient(...)`. Applied dynamically to Soko's Dynamic Island container. | ❌ Avoid non-standard CSS properties or external CSS stylesheets. |
| **Optional Micro-Animations** | **Pure Inline SVG `<style>` Keyframes** | Self-contained SVG CSS animations (e.g. `@keyframes blink { ... }`, `@keyframes wave { ... }`). | ❌ **No JavaScript** (`<script>` tags, `onload=`, `onclick=` are strictly purged by the security sandbox). |
| **Host Runtime** | **React 18 + Framer Motion** | Soko hosts the character inside a React dynamic island component with `AnimatePresence` spring physics transitions. | Handled automatically by Soko's runtime. |

---

## 2. System Architecture & Lifecycle

Soko's Mascot & Island engine is built on an event-driven, decoupled micro-architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Dynamic Island Host HUD                         │
│  ┌────────────────────────┐         ┌───────────────────────────────┐  │
│  │   Parent Motion Pill   │ ◄───────┤  Character Atmospheric Engine │  │
│  │ (Dynamic style.bg)     │         │  (Resolves hex / CSS gradient)│  │
│  └───────────┬────────────┘         └───────────────▲───────────────┘  │
│              │                                      │                  │
│              ▼                                      │                  │
│  ┌────────────────────────┐         ┌───────────────┴───────────────┐  │
│  │     CharacterHost      ├────────►│ State Selector & Fallback     │  │
│  │ (Framer AnimatePresence│         │ (music > thinking > happy >   │  │
│  │  300ms ease transition)│         │  working > alert > idle)      │  │
│  └───────────┬────────────┘         └───────────────────────────────┘  │
│              │                                                         │
│              ▼                                                         │
│  ┌────────────────────────┐         ┌───────────────────────────────┐  │
│  │ Dynamic SVG Renderer   │ ◄───────┤ Character Registry & Storage  │  │
│  │ (viewBox="0 0 44 44")  │         │ (localStorage persistence +   │  │
│  │ 32px pill / 56px orb   │         │  EventBus synchronization)    │  │
│  └────────────────────────┘         └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities:
1. **`CharacterHost`**: Dynamically mounts the currently active character and animates transitions between states using Framer Motion (`opacity` and `scale` physics).
2. **`CharacterRegistry`**: Validates character manifests, manages persistent storage in `localStorage`, prevents overwriting system cores, and dispatches global window sync events:
   - `soko:character-changed`: Broadcast when a new character is activated.
   - `soko:character-imported`: Broadcast when a custom pack is verified and saved.
   - `soko:character-deleted`: Broadcast when a custom pack is removed.
3. **Atmospheric Engine (`getCharacterBackground`)**: Reads the active character's `backgrounds` table and binds directly to the Dynamic Island root container with a smooth `0.3s ease` CSS transition.
4. **Fallback Guarantee**: If an optional state is missing, Soko falls back through:  
   `active_state` ➔ `idle` ➔ default OLED `#0B0D14`. This ensures the UI never crashes or renders blank space.

---

## 3. AI Architecture System Prompt (Copy & Paste)

When using an LLM (ChatGPT, Claude, Gemini, DeepSeek) to generate a character, paste this prompt. You only need to describe your character concept in Section B:

```text
You are a senior frontend systems architect and SVG vector artist.
Your task is to generate a custom character manifest for Soko Desktop Dynamic Island.

=== [A] TECHNICAL SPECIFICATION & ARCHITECTURE ===
1. OUTPUT: Return ONLY a single valid, parseable JSON object enclosed in a ```json codeblock. No commentary.
2. ESSENTIAL STATES (MANDATORY): The JSON "states" dictionary MUST implement:
   - "idle": The default resting state.
   - "thinking": Active when CLI agents are reasoning/planning.
   - "music": Active when audio/music is streaming.
   (Soko's strict guardrail blocks activation if ANY of these 3 essential states are missing).
3. OPTIONAL EXTENDED STATES (SUPPORTED):
   - "dragging": Active when user is moving the Dynamic Island or dragging files over it.
   - "hover": Interactive gaze when cursor hovers over the mascot.
   - "charging": Active when battery power cable connects.
   - "online": Celebratory pulse when internet reconnects.
   - "offline": Warning state when internet disconnects.
   - "git_commit": Active when code commits to Git repository.
   - "git_push": Active when code pushes to GitHub.
   - "multi_session": Active when concurrent CLI agent sessions run simultaneously.
   - "happy": Celebratory / task-complete state.
   - "working": High-intensity task execution state.
   - "alert": Security / transfer / command failure state.
   - "sleeping": Ambient idle orb mode state.
4. SVG FORMAT: Each state must contain an "svg" string property.
   - Designed for viewBox="0 0 44 44".
   - Center of mass must be (x: 22, y: 22).
   - Use clean, self-contained SVG primitives: <path>, <circle>, <rect>, <polygon>, <g>, <defs>, gradients.
   - No external image URLs (<image href="...">) and no JavaScript/inline event handlers.
   - Responsive: Soko scales this SVG to 32x32px (compact pill) and 56x56px (enlarged idle orb).
5. ATMOSPHERIC BACKGROUNDS: Include a "backgrounds" dictionary defining matching CSS hex colors or linear/radial gradients for states ("idle", "thinking", "music", "dragging", "hover", "charging", "online", "offline", "git_commit", "git_push", "multi_session", "happy", "working", "alert", "sleeping", "default").
6. DYNAMIC EYE COLOR & AMBIENT BACKLIGHT: Soko automatically injects the active eye color into the SVG wrapper via "currentColor" and CSS variables "var(--soko-eye-color)" and "var(--soko-accent-color)". Use "currentColor" or "var(--soko-eye-color)" on eyes/pupils/visors. Soko dynamically projects an ambient backlight glow halo behind your mascot matching this eye color!
   - Disconnected / Offline / Alert: #EF4444 (Alert Red)
   - GitHub Push: #A855F7 (Git Purple)
   - GitHub Commit: #2DD4BF (Cyber Teal)
   - Battery Charging: #FBBF24 (Amber / Lightning Gold)
   - Dragging Kinetic: #FB923C (Neon Orange)
   - Multi-Session Concurrent: #6366F1 (Neon Indigo)
   - Antigravity CLI Agent: #38BDF8 (Sky Cyan)
   - OpenAI Codex CLI Agent: #10A37F (Cyber Mint)
   - Anthropic Claude CLI Agent: #F59E0B (Sunset Amber)
   - Music Streaming (Desktop & Connector): #C084FC (Synthwave Violet)
   - Task Completed / Happy: #34D399 (Emerald Green)
   - Hover Interactive: #7DD3FC (Soft Cyan)
   - Normal Standby: #FFFFFF (White)
7. IDENTIFIER: "id" must be a unique lowercase slug (^[a-z0-9_-]+$). Do NOT use "grok-bot" or "cyber-cat".

=== [B] CHARACTER DESIGN & ART DIRECTION ===
[DESCRIBE YOUR CHARACTER HERE: E.g., name, visual concept, creature/robot/mascot type, color palette, eye styles, and how each state should look]
```

---

## 4. Technical Schema Specification

Each character pack is declared as a JSON manifest adhering to the following TypeScript interfaces:

```typescript
export interface CharacterManifest {
  id: string;                                   // Unique slug: /^[a-z0-9_-]+$/
  name: string;                                 // Display name in settings
  version?: string;                             // Semantic version e.g. "1.0.0"
  author?: string;                              // Creator name / handle
  description?: string;                         // 1-2 sentence aesthetic summary
  backgrounds?: CharacterStateBackgrounds;      // CSS colors/gradients per state
  states: CharacterStatesDictionary;            // SVG renderers per state
}

export interface CharacterStateBackgrounds {
  idle?: string;          // e.g. "#0B0D14" or "linear-gradient(135deg, #090B10, #141622)"
  thinking?: string;      // e.g. "linear-gradient(135deg, #091724, #1E293B)"
  music?: string;         // e.g. "linear-gradient(135deg, #1A092A, #3B0764)"
  dragging?: string;      // e.g. "linear-gradient(135deg, #2D1402, #431407)"
  hover?: string;         // e.g. "linear-gradient(135deg, #091724, #1E293B)"
  charging?: string;      // e.g. "linear-gradient(135deg, #2E1A05, #1E1B4B)"
  online?: string;        // e.g. "linear-gradient(135deg, #052E16, #047857)"
  offline?: string;       // e.g. "linear-gradient(135deg, #2A0808, #0B0D14)"
  git_commit?: string;    // e.g. "linear-gradient(135deg, #042F2E, #134E4A)"
  git_push?: string;      // e.g. "linear-gradient(135deg, #2E1065, #3B0764)"
  multi_session?: string; // e.g. "linear-gradient(135deg, #1E1B4B, #312E81)"
  happy?: string;         // e.g. "linear-gradient(135deg, #052E16, #047857)"
  working?: string;       // e.g. "linear-gradient(135deg, #0F172A, #1E293B)"
  alert?: string;         // e.g. "linear-gradient(135deg, #2A0808, #0F172A)"
  sleeping?: string;      // e.g. "#05060A"
  default?: string;       // Fallback if state background is undefined
}

export interface CharacterStatesDictionary {
  // [MANDATORY] Essential states
  idle: { svg: string };          // Resting baseline state
  thinking: { svg: string };      // Cognitive agent reasoning state
  music: { svg: string };         // Audio stream & music connector visualizer

  // [OPTIONAL] Extended system & OS states
  dragging?: { svg: string };     // Moving window or dragging files
  hover?: { svg: string };        // Cursor hovering over island or mascot
  charging?: { svg: string };     // Power supply / charging cable connected
  online?: { svg: string };       // Internet connection reconnected pulse
  offline?: { svg: string };      // Internet disconnected warning
  git_commit?: { svg: string };   // Code commit to Git
  git_push?: { svg: string };     // Code push to GitHub
  multi_session?: { svg: string };// Concurrent CLI agents running
  happy?: { svg: string };        // Task completed celebratory state
  working?: { svg: string };      // Shell execution & compilation build
  alert?: { svg: string };        // System / security warning
  sleeping?: { svg: string };     // Idle mascot orb mode
}
```

---

## 5. State Machine & Desktop Triggers

Soko's desktop runtime monitors events from the OS, CLI agents, local WebSocket bridge, and media pipeline. The active character automatically receives state updates:

| State Key | Required? | Runtime Trigger Condition in Soko | Purpose & Visual Context |
| :--- | :---: | :--- | :--- |
| **`idle`** | **YES** | Default state when no active task, audio, or alert is present. | Baseline resting face, neutral gaze, friendly presence. |
| **`thinking`** | **YES** | CLI Coding Agent (Google Antigravity, OpenAI Codex, Claude) is reasoning or running tool loops (`status: "thinking"` or `"waiting"`). | Visual focus, active visors, analytical eye gestures, cognitive energy. |
| **`music`** | **YES** | Local audio stream or YouTube Music Connector is active (`audioStatus.isPlaying === true`). | Equalizer bars, sound wave pulses, headphones, rhythmic beats. |
| **`dragging`** | No | User is dragging the Dynamic Island across desktop or dragging files over the island. | Kinetic alertness, braced posture, motion focus. |
| **`hover`** | No | Mouse cursor is hovering over the dynamic island or mascot avatar. | Curious gaze, head perk, interactive micro-expressions. |
| **`charging`** | No | Laptop / device charging cable is connected (`navigator.getBattery().charging === true`). | Lightning energy, glowing battery recharge accents. |
| **`online`** | No | Internet uplink re-established after disconnect (`window.online` event). | Emerald green pulse, reconnected celebratory expression. |
| **`offline`** | No | Network disconnected / no internet connection (`window.offline` event). | Red warning indicators, disconnected alert eyes. |
| **`git_commit`** | No | Active agent or user commits changes to Git repository (`git commit`). | Cyber teal accents, successful commit celebration. |
| **`git_push`** | No | Active agent or user pushes changes to GitHub (`git push`). | Violet rocket intensity, deployment energy. |
| **`multi_session`** | No | Multiple concurrent CLI agent sessions active (`agentStatus.activeCount > 1`). | Split-brain neural matrix, dual-agent indicator. |
| **`happy`** | No | CLI Agent task completes successfully (`status: "completed"`), or user clicks the mascot avatar. | Joyful expression, blinking smiles, celebratory accents, positive feedback. |
| **`working`** | No | Active terminal process is executing a shell command or compilation build. | Dynamic intensity, motion lines, focused productivity. |
| **`alert`** | No | Unauthorized device rejected, transfer failure, or CLI error status. | Warning indicators, alert colors, widened gaze. |
| **`sleeping`** | No | Inactivity timer triggers contracts into ambient 56px Idle Mascot Orb mode. | Closed eyes, resting breath, gentle ambient vibes. |

### 5.1 State & Background Priority Resolution Hierarchy

To ensure custom characters feel as alive and responsive as Default Soko (`grok-bot`), Soko applies an explicit **Priority Resolution Hierarchy** across character animations, dynamic island backgrounds, and eye colors.

> [!IMPORTANT]
> **Active Task Precedence**: When a laptop is plugged into a charger (`isCharging = true`), ambient charging status **never** suppresses active cognitive tasks (`working`, `thinking`, `music`, or `happy`). The character only displays `charging` when resting in idle standby!

| Priority | State Key | Eye / Glow Color | Resolution Condition & Precedence |
| :---: | :--- | :--- | :--- |
| **1** | `alert` / `offline` | Alert Red (`#EF4444`) | Critical alert, rejected auth, or disconnected internet. |
| **2** | `dragging` | Neon Orange (`#FB923C`) | Tactile interaction: user is dragging window or dropping files. |
| **3** | `git_push` | Git Purple (`#A855F7`) | Active 5s burst when code is pushed to GitHub. |
| **4** | `git_commit` | Cyber Teal (`#2DD4BF`) | Active 5s burst when Git commit is recorded. |
| **5** | `working` | Active Agent Color / (`#38BDF8`) | Terminal build, shell command execution, or active CLI agent coding. |
| **6** | `thinking` | Cognitive Indigo (`#818CF8`) | CLI Agent cognitive reasoning, planning, or tool invocation. |
| **7** | `music` | Synthwave Violet (`#C084FC`) | Active desktop audio playback or YouTube Music Connector stream. |
| **8** | `happy` / `online` | Emerald Green (`#34D399` / `#10B981`) | Task completion celebration or 4.5s internet reconnect pulse. |
| **9** | `charging` | Amber Gold (`#FBBF24`) | AC power connected while character is in idle resting standby. |
| **10** | `multi_session` | Neon Indigo (`#6366F1`) | Concurrent background CLI agent sessions active while idle. |
| **11** | `hover` | Soft Cyan (`#7DD3FC`) | Interactive cursor hover gaze over mascot or island. |
| **12** | `sleeping` | Ambient Dark | Idle mascot orb mode after inactivity timeout. |
| **13** | `idle` | OLED White (`#FFFFFF`) | Default baseline resting state. |

### Dynamic Eye & Accent Color Triggers

Both built-in and custom characters in Soko react to system events with dynamic eye and accent colors:

| Event / Trigger | Color Name | Hex Code | Purpose in Soko |
| :--- | :--- | :--- | :--- |
| **Offline / Disconnected / Alert** | Alert Red | `#EF4444` | Internet offline, phone disconnected, or command failure. |
| **GitHub Push** | Git Purple | `#A855F7` | Triggered when pushing code to GitHub. |
| **GitHub Commit** | Cyber Teal | `#2DD4BF` | Triggered when code commit is registered. |
| **Battery Charging** | Amber Gold | `#FBBF24` | Triggered when power charging cable connects. |
| **Dragging Kinetic** | Neon Orange | `#FB923C` | Triggered when moving the island HUD or dragging files. |
| **Multi-Session** | Neon Indigo | `#6366F1` | Triggered when multiple CLI agents run concurrently. |
| **Internet Online Reconnect** | Emerald Green | `#10B981` | 4.5-second celebratory pulse when internet or phone connects. |
| **Hover Interactive** | Soft Cyan | `#7DD3FC` | Triggered when cursor hovers over the mascot avatar. |
| **Google Antigravity CLI** | Electric Sky Cyan | `#38BDF8` | Triggered when Antigravity CLI agent is planning or running tasks. |
| **OpenAI Codex CLI** | Cyber Mint | `#10A37F` | Triggered when OpenAI Codex agent is active. |
| **Anthropic Claude CLI** | Sunset Amber | `#F59E0B` | Triggered when Anthropic Claude agent is active. |
| **Music Streaming (Desktop & Connector)** | Synthwave Violet | `#C084FC` | Triggered during desktop audio stream or music connector playback. |
| **Task Completed / Happy** | Joyful Emerald | `#34D399` | Celebratory pulse when CLI agent completes a task or user clicks. |
| **Connected / Idle Standby** | OLED White | `#FFFFFF` | Normal baseline resting color. |

**How Custom SVGs Tap Into Eye Colors:**
Soko automatically computes the active eye color and injects it into the SVG container as:
1. `currentColor`: Any element with `fill="currentColor"` or `stroke="currentColor"` dynamically adopts this color.
2. CSS Variables: `var(--soko-eye-color)` and `var(--soko-accent-color)`.


---

## 6. Atmospheric State Background Engine

Soko's Dynamic Island pill is not static—it dynamically coordinates its container styling with the character's active state.

```
┌───────────────────────────────────────────────────────────────┐
│ Dynamic Island HUD                                            │
│                                                               │
│ [Mascot Avatar]   ⚡ Antigravity: Planning code refactor...    │
│                                                               │
│ ◄────── Active Container Background: backgrounds.thinking ────►│
└───────────────────────────────────────────────────────────────┘
```

### Supported Background Formats:
* **Solid Hex**: `"#0B0D14"`, `"#064E3B"`, `"#1E1B4B"`
* **Linear Gradients**: `"linear-gradient(135deg, #091724 30%, #1E293B 100%)"`
* **Radial Gradients**: `"radial-gradient(circle at top, #1E1B4B 0%, #0B0D14 80%)"`
* **Alpha / Semi-transparency**: `"rgba(11, 13, 20, 0.92)"`

### Dual-Layer Ambient Eye-Color Backlight Effect

Beyond the overall container background, Soko projects a dynamic **dual-layer ambient backlight glow** driven directly by the character's eye color:

1. **Mascot OLED Halo Bloom**:
   - Projected directly behind the character's head with a soft `blur-md` and `box-shadow` matching the eye color.
   - When disconnected, Soko glows with an ambient red halo (`#EF4444`).
   - When Antigravity or Codex runs, an electric cyan (`#38BDF8`) or cyber mint (`#10A37F`) halo illuminates behind the character.
2. **Island Backlight Aura**:
   - A soft radial aura (`radial-gradient(circle at center, ${eyeColor} 0%, transparent 70%)`) radiates from behind the mascot across the left side of the Dynamic Island container.
   - Seamlessly blends with whatever custom `backgrounds` you specify!

> [!TIP]
> Soko renders linear-text and high-contrast badges inside the island pill. For optimal readability, choose dark, saturated atmospheric tones (`#04xxxx` through `#1Fxxxx`).

---

## 7. Validation Engine & Guardrail Rules

To ensure stability across all platforms (Linux AppImage/deb and Windows), Soko enforces automated validation guardrails before allowing character activation:

```typescript
// Validation execution before save & activation:
const validation = validateCharacter(characterManifest);

if (!validation.isValid) {
  // Soko refuses activation and disables the "Select" button
  console.error("Missing essential states:", validation.missingEssentialStates);
}
```

### Guardrail Criteria:
1. **Essential States Rule**: The manifest **must** implement `idle`, `thinking`, and `music`. If any of these are omitted:
   * Validation fails: `isValid: false`.
   * UI displays: `Incomplete (Missing: [state])`.
   * The **"Select" button is strictly disabled**.
2. **Slug ID Rule**: `id` must match `^[a-z0-9_-]+$`. Spaces, capital letters, and symbols are rejected.
3. **Protected Core IDs**: Custom characters cannot overwrite system builtin IDs (`grok-bot`, `cyber-cat`).
4. **Security Sanitization**:
   * No `<script>` or `<foreignObject>` tags.
   * No event handlers (`onload=`, `onclick=`, `onerror=`).
   * No external network dependencies (`<image href="http...">`).

---

## 8. SVG Vector Rendering Specifications

Soko's rendering pipeline injects the SVG string into an optimized viewport:

```html
<div style="width: 32px; height: 32px" class="flex items-center justify-center">
  <svg viewBox="0 0 44 44" width="32" height="32" class="overflow-visible">
    <!-- Character SVG inner elements injected here -->
  </svg>
</div>
```

### Design Coordinates & Layout Guidelines:
* **Coordinate Grid**: `0 0 44 44` (Origin `0,0` is top-left, `44,44` is bottom-right).
* **Center of Mass**: Anchor facial features around `(x: 22, y: 22)`.
* **Safe Margins**: Keep key visuals within `x: [4, 40]` and `y: [4, 40]` to avoid clipping during smooth spring physics transitions.
* **Dual Resolution Support**:
  * **Compact Dynamic Island**: Rendered at `32×32px`. Keep primary shapes clear and legible at small sizes.
  * **Idle Mascot Orb**: Rendered at `56×56px`. Clean vector paths scale crisply with zero pixelation.

---

## 9. Installation & Verification Workflow

1. **Open Soko Desktop Settings**:
   * Click on the Dynamic Island or open settings (`Settings → Mascot & Dynamic Island`).
2. **Open the Import Drawer**:
   * Click the **"Import Character"** button.
3. **Provide Manifest**:
   * Click **Upload JSON File** or paste the raw JSON into the text area.
4. **Validation Check**:
   * Soko instantly evaluates the manifest against all guardrails.
   * A valid pack displays a green **"Verified Essential States"** badge.
5. **Activate**:
   * Click **Select**. The Dynamic Island immediately swaps the avatar and smoothly cross-fades the atmospheric background.

---

## 10. 🛡️ Error Handling, Fallbacks & Edge Cases

When developing characters or integrating automated triggers, Soko's runtime employs defensive design patterns to guarantee that animations, audio playback, and HUD positioning never break:

### 10.1 Music Connector Audio Stream Synchronization
* **The Challenge**: When streaming high-bitrate YouTube Music to mobile via `soko-music-connector`, the connector daemon automatically issues an MPRIS `Pause` command to the desktop browser so audio does not double-play. Consequently, OS audio sinks (`pactl` / PipeWire) report playback as idle.
* **The Mitigation**: Soko Bridge tracks active `MUSIC_NOW_PLAYING` broadcasts and HTTP 206 byte-range transfer streams in real time. Whenever a connector track is playing or streaming to mobile, Soko synthesizes `AUDIO_STATUS { isPlaying: true, isStreamingToMobile: true }`. Both the mascot visualizer and island audio equalizer remain 100% animated.

### 10.2 Hardware Battery & Charging Detection
* **The Challenge**: Desktop PCs plugged permanently into AC power may report `navigator.getBattery().charging = true` with `chargingTime = 0` and `level = 1.0` indefinitely, or reject the Web Battery API entirely.
* **The Mitigation**: Soko wraps battery initialization in strict `try/catch` and promises handlers. On desktop workstations without batteries, the query fails gracefully without throwing errors or locking the UI into a perpetual charging state. On laptops, real-time `chargingchange` events trigger the lightning golden amber glow (`#FBBF24`).

### 10.3 Network Connectivity & Offline Flakiness
* **The Challenge**: Wi-Fi connections can experience momentary packet drops or captive portals during network handoffs.
* **The Mitigation**: Soko listens to browser `online` and `offline` events. When transitioning offline, Soko enters the `offline` warning state (`#EF4444`). When internet uplink returns, Soko triggers a 4.5-second celebratory `online` pulse (`#10B981`) and automatically reverts to `idle`.

### 10.4 Transient State Lifecycles (Dragging, Git Commit/Push)
* **The Challenge**: Users dragging the Dynamic Island across multiple screens or mouse leaving the window could leave the mascot stuck in the `dragging` state.
* **The Mitigation**:
  * Window mousemove events monitor `e.buttons !== 1`. If the mouse is released anywhere outside the Electron window, `isDragging` is automatically reset within a 120ms debounce.
  * Git commit and push states (`git_commit`, `git_push`) are held for exactly 5 seconds before returning to the active agent or resting idle state.

### 10.5 Guaranteed Multi-Tier Fallback Chain
* **The Rule**: Missing optional states will **never** throw React errors or render invisible pixels.
* **Resolution Order**:
  `Active State` ➔ `Thinking` / `Happy` (if cognitive/celebratory) ➔ `Idle` (Mandatory Essential) ➔ `#0B0D14` (OLED Core Fallback).
