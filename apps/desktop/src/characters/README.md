# Soko Character Engine — Architecture & Technical Reference

> For the complete architectural guide, state machine triggers, and the AI system prompt, see:  
> [`docs/characters/README.md`](file:///home/saurabh/coding/soko/docs/characters/README.md)

---

## Technical Overview for Creators & AI

This directory houses Soko's modular character subsystem:

- **`types.ts`**: TypeScript contracts (`CharacterDefinition`, `CharacterStateProps`, `CharacterStateBackgrounds`, `ESSENTIAL_CHARACTER_STATES = ['idle', 'thinking', 'music']`, plus optional extended states `dragging`, `hover`, `charging`, `online`, `offline`, `git_commit`, `git_push`, `multi_session`).
- **`registry.ts`**: Validation engine (`validateCharacter`), activation guardrails (`setActiveCharacterId`), persistence in `localStorage`, and event synchronization.
- **`CharacterHost.tsx`**: Dynamic state mounting, Framer Motion transitions, ambient backlight halo bloom, and fallback resolution.
- **`CharacterSelector.tsx`**: Settings UI card grid, verification badges, disabled-button guardrails, and JSON import drawer.
- **`builtin/`**: Built-in reference implementations (`grok-bot`, `cyber-cat`).

### Tech Stack Required for AI Generation:
- **Data Format**: Pure JSON (RFC 8259).
- **Graphics**: SVG 1.1 / 2.0 Vector Primitives (`<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<g>`, `<defs>`, gradients). No raster images (`<image href="...">`).
- **Coordinate Space**: Normalized 2D Cartesian `viewBox="0 0 44 44"` centered at `(22, 22)`.
- **Atmospheric Colors**: CSS3 Colors (Hex `#RRGGBB`, `rgb()`, `rgba()`, `linear-gradient(...)`, `radial-gradient(...)`).
- **Optional Micro-Animations**: Pure inline SVG `<style>` keyframes (`@keyframes ...`). Zero JavaScript or `<script>` tags.
- **Host Runtime**: React 18 + Framer Motion (`AnimatePresence` spring physics).
