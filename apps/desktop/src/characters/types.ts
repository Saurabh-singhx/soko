import React from 'react';
import {
  MascotMood,
  ConnectionStatus,
  CliAgentId,
  AgentActivityStatus,
} from '../types/index.ts';

export interface CharacterStateProps {
  mood: MascotMood;
  size?: number;
  notificationKey?: string | number;
  isMusicPlaying?: boolean;
  isIdleMascotOnly?: boolean;
  enableCursorTracking?: boolean;
  connectionStatus?: ConnectionStatus;
  activeAgent?: CliAgentId;
  agentStatus?: AgentActivityStatus | null;
  // Dynamic runtime states
  isDragging?: boolean;
  isHovered?: boolean;
  isCharging?: boolean;
  isOnline?: boolean;
  isMultiSession?: boolean;
  gitAction?: 'commit' | 'push' | null;
}

/**
 * State-specific background colors or gradients defined by the character.
 * When Soko transitions into a state, the Dynamic Island HUD smoothly adopts
 * the character's designated atmospheric background.
 */
export interface CharacterStateBackgrounds {
  idle?: string;       // e.g. '#000000', '#0B0D14', 'linear-gradient(135deg, #090B10, #141622)'
  thinking?: string;   // e.g. '#111827', 'linear-gradient(135deg, #181528, #251E40)'
  music?: string;      // e.g. '#160D29', 'linear-gradient(135deg, #1C0A35, #2B1055)'
  happy?: string;      // e.g. '#064E3B', 'linear-gradient(135deg, #042F2E, #0F766E)'
  working?: string;    // e.g. '#1E1B4B'
  alert?: string;      // e.g. '#450A0A'
  sleeping?: string;   // e.g. '#05050A'
  dragging?: string;   // e.g. 'linear-gradient(135deg, #2D1402, #431407)'
  hover?: string;      // e.g. 'linear-gradient(135deg, #091724, #1E293B)'
  charging?: string;   // e.g. 'linear-gradient(135deg, #2E1A05, #1E1B4B)'
  online?: string;     // e.g. 'linear-gradient(135deg, #052E16, #047857)'
  offline?: string;    // e.g. 'linear-gradient(135deg, #2A0808, #0B0D14)'
  git_commit?: string; // e.g. 'linear-gradient(135deg, #042F2E, #134E4A)'
  git_push?: string;   // e.g. 'linear-gradient(135deg, #2E1065, #3B0764)'
  multi_session?: string; // e.g. 'linear-gradient(135deg, #1E1B4B, #312E81)'
  default?: string;    // Fallback background
}

/**
 * The essential states required for any character to be considered valid and selectable.
 * If any of these are missing, Soko blocks selection to prevent animation breaks.
 */
export const ESSENTIAL_CHARACTER_STATES = ['idle', 'thinking', 'music'] as const;
export type EssentialCharacterState = typeof ESSENTIAL_CHARACTER_STATES[number];

export interface CharacterCapabilities {
  supportsCursorTracking?: boolean;
  supportsMusicEqualizer?: boolean;
  supportsAgentColors?: boolean;
}

/**
 * Standard contract for any character in Soko.
 */
export interface CharacterDefinition {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  previewSvg?: string;
  previewComponent?: React.ComponentType<{ size?: number }>;
  format: 'native' | 'svg-pack' | 'lottie-pack' | 'custom';

  // Dynamic state backgrounds
  backgrounds?: CharacterStateBackgrounds;

  // State animation renderers
  states: {
    idle: React.ComponentType<CharacterStateProps>;
    thinking: React.ComponentType<CharacterStateProps>;
    music: React.ComponentType<CharacterStateProps>;
    happy?: React.ComponentType<CharacterStateProps>;
    working?: React.ComponentType<CharacterStateProps>;
    alert?: React.ComponentType<CharacterStateProps>;
    sleeping?: React.ComponentType<CharacterStateProps>;
    dragging?: React.ComponentType<CharacterStateProps>;
    hover?: React.ComponentType<CharacterStateProps>;
    charging?: React.ComponentType<CharacterStateProps>;
    online?: React.ComponentType<CharacterStateProps>;
    offline?: React.ComponentType<CharacterStateProps>;
    git_commit?: React.ComponentType<CharacterStateProps>;
    git_push?: React.ComponentType<CharacterStateProps>;
    multi_session?: React.ComponentType<CharacterStateProps>;
    custom?: Record<string, React.ComponentType<CharacterStateProps>>;
  };

  capabilities?: CharacterCapabilities;
  isCustom?: boolean;
  isBuiltin?: boolean;
  rawManifest?: any;
}

export interface CharacterValidationResult {
  isValid: boolean;
  missingEssentialStates: string[];
  errors: string[];
  warnings: string[];
}
