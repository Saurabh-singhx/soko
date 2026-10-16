import React from 'react';
import {
  CharacterDefinition,
  CharacterValidationResult,
  ESSENTIAL_CHARACTER_STATES,
  CharacterStateProps,
} from './types.ts';
import { grokBotCharacter } from './builtin/grokBot.tsx';
import { cyberCatCharacter } from './builtin/cyberCat.tsx';

// Builtin characters shipped out of the box
const BUILTIN_CHARACTERS: Record<string, CharacterDefinition> = {
  'grok-bot': grokBotCharacter,
  'cyber-cat': cyberCatCharacter,
};

const STORAGE_ACTIVE_KEY = 'soko_active_character_id';
const STORAGE_CUSTOM_KEY = 'soko_custom_characters_data';

/**
 * Validates whether an imported character object satisfies all strict structural
 * requirements and contains every essential state so that Soko animations never break.
 */
export function validateCharacter(char: any): CharacterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingEssentialStates: string[] = [];

  if (!char || typeof char !== 'object') {
    return {
      isValid: false,
      missingEssentialStates: [...ESSENTIAL_CHARACTER_STATES],
      errors: ['Character manifest must be a valid JSON object.'],
      warnings: [],
    };
  }

  // 1. Validate ID
  if (!char.id || typeof char.id !== 'string' || !/^[a-z0-9_-]+$/i.test(char.id)) {
    errors.push('Character "id" is required and must only contain letters, numbers, hyphens, and underscores.');
  }

  // 2. Validate Name
  if (!char.name || typeof char.name !== 'string' || !char.name.trim()) {
    errors.push('Character "name" is required and cannot be empty.');
  }

  // 3. Validate States Container
  if (!char.states || typeof char.states !== 'object') {
    errors.push('Character must define a "states" dictionary.');
    return {
      isValid: false,
      missingEssentialStates: [...ESSENTIAL_CHARACTER_STATES],
      errors,
      warnings,
    };
  }

  // 4. Validate Essential States (idle, thinking, music)
  for (const essential of ESSENTIAL_CHARACTER_STATES) {
    const stateVal = char.states[essential];
    if (!stateVal) {
      missingEssentialStates.push(essential);
    } else if (typeof stateVal !== 'function' && typeof stateVal !== 'string' && typeof stateVal !== 'object') {
      errors.push(`State "${essential}" must be a React component, an SVG string, or a state specification.`);
      missingEssentialStates.push(essential);
    }
  }

  if (missingEssentialStates.length > 0) {
    errors.push(
      `Missing essential states: [${missingEssentialStates.join(', ')}]. Characters must implement all essential states to prevent animation breaks.`
    );
  }

  // 5. Validate Background Color Definitions (if provided)
  if (char.backgrounds && typeof char.backgrounds === 'object') {
    for (const [stateName, bgVal] of Object.entries(char.backgrounds)) {
      if (typeof bgVal !== 'string') {
        warnings.push(`Background for state "${stateName}" should be a valid CSS color string or gradient.`);
      }
    }
  }

  return {
    isValid: errors.length === 0 && missingEssentialStates.length === 0,
    missingEssentialStates,
    errors,
    warnings,
  };
}

/**
 * Creates a dynamic React component that renders imported SVG markup safely.
 */
function createSvgStateComponent(svgMarkupOrData: any): React.FC<CharacterStateProps> {
  let svgString = '';
  if (typeof svgMarkupOrData === 'string') {
    svgString = svgMarkupOrData;
  } else if (svgMarkupOrData && typeof svgMarkupOrData.svg === 'string') {
    svgString = svgMarkupOrData.svg;
  }

  // Extract inner SVG content if enclosed in <svg>...</svg>
  const match = svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const innerSvg = match ? match[1] : svgString;

  // Extract viewBox if specified on outer <svg>
  const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 44 44';

  return ({
    size = 32,
    isIdleMascotOnly,
    connectionStatus,
    activeAgent,
    mood,
    isMusicPlaying,
    isDragging,
    isHovered,
    isCharging,
    isOnline,
    isMultiSession,
    gitAction,
  }: CharacterStateProps) => {
    const renderSize = isIdleMascotOnly ? 56 : size;

    // Resolve dynamic accent / eye color based on Soko default eye color rules:
    // Offline / Disconnected / Alert: #EF4444 (Red)
    // Git Push: #A855F7 (Purple)
    // Git Commit: #2DD4BF (Cyber Teal)
    // Battery Charging: #FBBF24 (Amber / Lightning Gold)
    // Dragging: #FB923C (Neon Orange)
    // Multi-Session: #6366F1 (Neon Indigo)
    // Antigravity Agent: #38BDF8 (Sky Cyan)
    // Codex Agent: #10A37F (Cyber Mint)
    // Claude Agent: #F59E0B (Sunset Amber)
    // Music Playing: #C084FC (Synthwave Violet)
    // Happy Mood: #34D399 (Emerald)
    // Hover: #7DD3FC (Soft Cyan)
    // Thinking: #818CF8 (Cognitive Indigo)
    // Default Connected / Idle: #FFFFFF (White)
    let eyeColor = '#FFFFFF';
    if (isOnline === false || connectionStatus === 'disconnected' || mood === 'alert') {
      eyeColor = '#EF4444';
    } else if (isDragging) {
      eyeColor = '#FB923C';
    } else if (gitAction === 'push') {
      eyeColor = '#A855F7';
    } else if (gitAction === 'commit') {
      eyeColor = '#2DD4BF';
    } else if (activeAgent === 'antigravity' && (mood === 'working' || mood === 'thinking')) {
      eyeColor = '#38BDF8';
    } else if (activeAgent === 'codex' && (mood === 'working' || mood === 'thinking')) {
      eyeColor = '#10A37F';
    } else if (activeAgent === 'claude' && (mood === 'working' || mood === 'thinking')) {
      eyeColor = '#F59E0B';
    } else if (mood === 'working') {
      eyeColor = '#38BDF8';
    } else if (mood === 'thinking') {
      eyeColor = '#818CF8';
    } else if (isMusicPlaying) {
      eyeColor = '#C084FC';
    } else if (mood === 'happy') {
      eyeColor = '#34D399';
    } else if (isCharging) {
      eyeColor = '#FBBF24';
    } else if (isMultiSession) {
      eyeColor = '#6366F1';
    } else if (isHovered) {
      eyeColor = '#7DD3FC';
    }

    return React.createElement(
      'div',
      {
        style: {
          width: renderSize,
          height: renderSize,
          color: eyeColor,
          '--soko-eye-color': eyeColor,
          '--soko-accent-color': eyeColor,
        } as React.CSSProperties,
        className: 'flex items-center justify-center select-none',
      },
      React.createElement('svg', {
        viewBox,
        width: renderSize,
        height: renderSize,
        className: 'overflow-visible',
        dangerouslySetInnerHTML: { __html: innerSvg },
      })
    );
  };
}

/**
 * Hydrates stored JSON custom character definitions into full CharacterDefinition objects.
 */
function hydrateCustomCharacter(raw: any): CharacterDefinition | null {
  const validation = validateCharacter(raw);
  if (!validation.isValid) return null;

  const statesMap: Record<string, React.FC<CharacterStateProps>> = {};

  for (const [stName, stVal] of Object.entries(raw.states)) {
    if (typeof stVal === 'function') {
      statesMap[stName] = stVal as React.FC<CharacterStateProps>;
    } else {
      statesMap[stName] = createSvgStateComponent(stVal);
    }
  }

  return {
    id: raw.id,
    name: raw.name,
    version: raw.version || '1.0.0',
    author: raw.author || 'Custom Creator',
    description: raw.description || 'Imported custom character pack',
    format: raw.format || 'custom',
    backgrounds: raw.backgrounds || {
      idle: '#0B0D14',
      thinking: 'linear-gradient(135deg, #0B0D14, #1B1E2E)',
      music: 'linear-gradient(135deg, #0B0D14, #26123D)',
      happy: 'linear-gradient(135deg, #0B0D14, #083321)',
      default: '#0B0D14',
    },
    states: {
      ...statesMap,
      idle: statesMap['idle'],
      thinking: statesMap['thinking'] || statesMap['idle'],
      music: statesMap['music'] || statesMap['idle'],
      happy: statesMap['happy'],
      working: statesMap['working'],
      alert: statesMap['alert'],
      sleeping: statesMap['sleeping'],
    },
    capabilities: raw.capabilities || {
      supportsCursorTracking: false,
      supportsMusicEqualizer: false,
      supportsAgentColors: true,
    },
    isCustom: true,
    rawManifest: raw,
  };
}

/**
 * Load all custom imported characters from LocalStorage.
 */
export function getCustomCharacters(): CharacterDefinition[] {
  try {
    const rawData = localStorage.getItem(STORAGE_CUSTOM_KEY);
    if (!rawData) return [];
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => hydrateCustomCharacter(item))
      .filter((c): c is CharacterDefinition => c !== null);
  } catch (err) {
    console.warn('[CharacterRegistry] Failed loading custom characters:', err);
    return [];
  }
}

/**
 * Return all registered characters (built-in + verified custom imports).
 */
export function getRegisteredCharacters(): CharacterDefinition[] {
  const custom = getCustomCharacters();
  const all: CharacterDefinition[] = [...Object.values(BUILTIN_CHARACTERS)];
  for (const c of custom) {
    if (!all.some((existing) => existing.id === c.id)) {
      all.push(c);
    }
  }
  return all;
}

/**
 * Get active character ID from localStorage (default: 'grok-bot').
 */
export function getActiveCharacterId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (stored) {
      const all = getRegisteredCharacters();
      if (all.some((c) => c.id === stored)) {
        return stored;
      }
    }
  } catch {}
  return 'grok-bot';
}

/**
 * Get the currently active character object (or target ID if provided).
 */
export function getActiveCharacter(targetId?: string): CharacterDefinition {
  const activeId = targetId || getActiveCharacterId();
  const all = getRegisteredCharacters();
  const found = all.find((c) => c.id === activeId);
  return found || BUILTIN_CHARACTERS['grok-bot'];
}

// Multi-window communication bus (Electron islandWindow <-> settingsWindow)
const SYNC_CHANNEL_NAME = 'soko_character_bus';

export function notifyCharacterChanged(id: string) {
  try {
    window.dispatchEvent(new CustomEvent('soko:character-changed', { detail: { id } }));
  } catch {}
  try {
    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.postMessage({ type: 'soko:character-changed', id });
    bc.close();
  } catch {}
  try {
    (window as any).electronAPI?.syncCharacter?.('soko:character-changed', id);
  } catch {}
}

export function notifyCharacterImported(id: string) {
  try {
    window.dispatchEvent(new CustomEvent('soko:character-imported', { detail: { id } }));
  } catch {}
  try {
    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.postMessage({ type: 'soko:character-imported', id });
    bc.close();
  } catch {}
  try {
    (window as any).electronAPI?.syncCharacter?.('soko:character-imported', id);
  } catch {}
}

export function notifyCharacterDeleted(id: string) {
  try {
    window.dispatchEvent(new CustomEvent('soko:character-deleted', { detail: { id } }));
  } catch {}
  try {
    const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.postMessage({ type: 'soko:character-deleted', id });
    bc.close();
  } catch {}
  try {
    (window as any).electronAPI?.syncCharacter?.('soko:character-deleted', id);
  } catch {}
}

export function subscribeToCharacterChanges(callback: (id?: string) => void): () => void {
  const onLocal = (e: any) => callback(e?.detail?.id);
  window.addEventListener('soko:character-changed', onLocal);
  window.addEventListener('soko:character-imported', onLocal);
  window.addEventListener('soko:character-deleted', onLocal);

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_ACTIVE_KEY || e.key === STORAGE_CUSTOM_KEY || !e.key) {
      const newId = localStorage.getItem(STORAGE_ACTIVE_KEY) || undefined;
      callback(newId);
    }
  };
  window.addEventListener('storage', onStorage);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (event.data?.type?.startsWith('soko:character-')) {
        callback(event.data?.id);
      }
    };
  } catch {}

  const unsubIpc = (window as any).electronAPI?.onCharacterSync?.((data: any) => {
    const newId = data?.payload || data?.id;
    if (newId && (data?.type === 'soko:character-changed' || !data?.type)) {
      try {
        localStorage.setItem(STORAGE_ACTIVE_KEY, newId);
      } catch {}
    }
    callback(newId);
  });

  return () => {
    window.removeEventListener('soko:character-changed', onLocal);
    window.removeEventListener('soko:character-imported', onLocal);
    window.removeEventListener('soko:character-deleted', onLocal);
    window.removeEventListener('storage', onStorage);
    try {
      bc?.close();
    } catch {}
    unsubIpc?.();
  };
}

/**
 * Set active character ID with strict validation guardrail.
 * Will ONLY activate if all essential states are verified.
 */
export function setActiveCharacterId(id: string): { success: boolean; error?: string } {
  const all = getRegisteredCharacters();
  const target = all.find((c) => c.id === id);

  if (!target) {
    return { success: false, error: `Character with id "${id}" was not found.` };
  }

  // Strict guardrail check
  const validation = validateCharacter(target.rawManifest || target);
  if (!validation.isValid) {
    return {
      success: false,
      error: `Cannot activate character "${target.name}": Missing essential states [${validation.missingEssentialStates.join(', ')}].`,
    };
  }

  localStorage.setItem(STORAGE_ACTIVE_KEY, id);
  notifyCharacterChanged(id);
  return { success: true };
}

/**
 * Import a new custom character pack from JSON string or object.
 * Strictly validates essential states before saving.
 */
export function importCustomCharacter(
  input: string | object
): { success: boolean; character?: CharacterDefinition; error?: string } {
  let parsed: any;
  try {
    parsed = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (err: any) {
    return { success: false, error: `Invalid JSON syntax: ${err.message}` };
  }

  // 1. Strict validation
  const validation = validateCharacter(parsed);
  if (!validation.isValid) {
    return {
      success: false,
      error: `Validation failed: ${validation.errors.join(' ')}`,
    };
  }

  // 2. Prevent overwriting system builtin IDs
  if (parsed.id === 'grok-bot' || parsed.id === 'cyber-cat') {
    return { success: false, error: `Cannot overwrite protected system character id "${parsed.id}".` };
  }

  // 3. Save to localStorage
  try {
    const rawData = localStorage.getItem(STORAGE_CUSTOM_KEY);
    const existing: any[] = rawData ? JSON.parse(rawData) : [];
    const filtered = existing.filter((item) => item.id !== parsed.id);
    filtered.push(parsed);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(filtered));

    const hydrated = hydrateCustomCharacter(parsed);
    if (!hydrated) {
      return { success: false, error: 'Failed to hydrate character after saving.' };
    }

    notifyCharacterImported(parsed.id);
    return { success: true, character: hydrated };
  } catch (err: any) {
    return { success: false, error: `Failed to persist custom character: ${err.message}` };
  }
}

/**
 * Delete a custom character pack.
 */
export function deleteCustomCharacter(id: string): boolean {
  if (id === 'grok-bot' || id === 'cyber-cat') return false;

  try {
    const rawData = localStorage.getItem(STORAGE_CUSTOM_KEY);
    if (!rawData) return false;
    const existing: any[] = JSON.parse(rawData);
    const filtered = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(filtered));

    // If deleting active character, revert to grok-bot
    if (getActiveCharacterId() === id) {
      setActiveCharacterId('grok-bot');
    }

    notifyCharacterDeleted(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the atmospheric state background color or gradient for the active character.
 */
export function getCharacterBackground(
  character: CharacterDefinition,
  mood: string,
  options?: {
    isMusicPlaying?: boolean;
    isSleeping?: boolean;
    isDragging?: boolean;
    isHovered?: boolean;
    isCharging?: boolean;
    isOnline?: boolean;
    isMultiSession?: boolean;
    gitAction?: 'commit' | 'push' | null;
  } | boolean,
  legacyIsSleeping?: boolean
): string {
  const bgs = character.backgrounds || {};

  let isMusicPlaying = false;
  let isSleeping = false;
  let isDragging = false;
  let isHovered = false;
  let isCharging = false;
  let isOnline = true;
  let isMultiSession = false;
  let gitAction: 'commit' | 'push' | null = null;

  if (typeof options === 'boolean') {
    isMusicPlaying = options;
    isSleeping = Boolean(legacyIsSleeping);
  } else if (options && typeof options === 'object') {
    isMusicPlaying = Boolean(options.isMusicPlaying);
    isSleeping = Boolean(options.isSleeping);
    isDragging = Boolean(options.isDragging);
    isHovered = Boolean(options.isHovered);
    isCharging = Boolean(options.isCharging);
    isOnline = options.isOnline !== false;
    isMultiSession = Boolean(options.isMultiSession);
    gitAction = options.gitAction || null;
  }

  // Priority 1: Critical Alerts & Offline Network State
  if (!isOnline && bgs.offline) {
    return bgs.offline;
  }
  if (mood === 'alert' && bgs.alert) {
    return bgs.alert;
  }
  // Priority 2: Dragging (tactile movement)
  if (isDragging && bgs.dragging) {
    return bgs.dragging;
  }
  // Priority 3: Git push operation
  if (gitAction === 'push' && bgs.git_push) {
    return bgs.git_push;
  }
  // Priority 4: Git commit operation
  if (gitAction === 'commit' && bgs.git_commit) {
    return bgs.git_commit;
  }
  // Priority 5: Active working mood (agent build/exec)
  if (mood === 'working' && bgs.working) {
    return bgs.working;
  }
  // Priority 6: Thinking cognitive mood
  if (mood === 'thinking' && bgs.thinking) {
    return bgs.thinking;
  }
  // Priority 7: Music playback
  if (isMusicPlaying && bgs.music) {
    return bgs.music;
  }
  // Priority 8: Happy celebration
  if (mood === 'happy' && bgs.happy) {
    return bgs.happy;
  }
  // Priority 9: Online reconnect pulse
  if (isOnline && bgs.online && mood === 'happy') {
    return bgs.online;
  }
  // Priority 10: Battery charging connected (ambient hardware power)
  if (isCharging && bgs.charging) {
    return bgs.charging;
  }
  // Priority 11: Concurrent multi-session agents
  if (isMultiSession && bgs.multi_session) {
    return bgs.multi_session;
  }
  // Priority 12: Hover state
  if (isHovered && bgs.hover) {
    return bgs.hover;
  }
  // Priority 13: Sleeping (idle mascot orb mode)
  if (isSleeping && bgs.sleeping) {
    return bgs.sleeping;
  }
  // Priority 14: Idle default
  if (bgs.idle) {
    return bgs.idle;
  }
  return bgs.default || '#0B0D14';
}
