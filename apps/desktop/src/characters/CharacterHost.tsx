import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CharacterStateProps, CharacterDefinition } from './types.ts';
import { getActiveCharacter, subscribeToCharacterChanges } from './registry.ts';

interface CharacterHostProps extends CharacterStateProps {
  onBackgroundChange?: (bg: string) => void;
  character?: CharacterDefinition;
}

/**
 * Universal Character Host Component.
 * Dynamically mounts the active character (Grok Bot, Cyber Neko, or imported pack)
 * and safely delegates rendering to the active state renderer with fallback guarantees.
 */
export const CharacterHost: React.FC<CharacterHostProps> = (props) => {
  const [activeChar, setActiveChar] = useState<CharacterDefinition>(() => props.character || getActiveCharacter());

  useEffect(() => {
    if (props.character) {
      setActiveChar(props.character);
    }
  }, [props.character]);

  useEffect(() => {
    return subscribeToCharacterChanges((newId) => {
      setActiveChar(getActiveCharacter(newId));
    });
  }, []);

  const currentChar = props.character || activeChar;

  // Resolve active state renderer and active state key
  const { activeStateKey, StateRenderer } = useMemo(() => {
    const states = currentChar.states || {};

    // For single-component native mascots (Grok Bot, Cyber Cat), keep a single persistent state key
    // so internal canvas/SVG physics, cursor tracking, and eye states are never destroyed or reset during interactions.
    if (currentChar.id === 'grok-bot' || currentChar.id === 'cyber-cat' || currentChar.format === 'native') {
      const fallback = states.idle || states.music || states.thinking;
      return { activeStateKey: 'root', StateRenderer: fallback };
    }

    // For modular/custom characters, only switch state key if the character ACTUALLY implements a dedicated state component!
    // Priority 1: Critical Alerts & Offline
    if (props.isOnline === false && states.offline) {
      return { activeStateKey: 'offline', StateRenderer: states.offline };
    }
    if (props.mood === 'alert' && states.alert) {
      return { activeStateKey: 'alert', StateRenderer: states.alert };
    }

    // Priority 2: Immediate Tactile Dragging
    if (props.isDragging && states.dragging) {
      return { activeStateKey: 'dragging', StateRenderer: states.dragging };
    }

    // Priority 3: Transient Git Operations
    if (props.gitAction === 'push' && states.git_push) {
      return { activeStateKey: 'git_push', StateRenderer: states.git_push };
    }
    if (props.gitAction === 'commit' && states.git_commit) {
      return { activeStateKey: 'git_commit', StateRenderer: states.git_commit };
    }

    // Priority 4: Active Task / Coding Execution
    if (props.mood === 'working' && states.working) {
      return { activeStateKey: 'working', StateRenderer: states.working };
    }

    // Priority 5: Cognitive Thinking
    if (props.mood === 'thinking' && states.thinking) {
      return { activeStateKey: 'thinking', StateRenderer: states.thinking };
    }

    // Priority 6: Music Playback Visualizer
    if (props.isMusicPlaying && states.music) {
      return { activeStateKey: 'music', StateRenderer: states.music };
    }

    // Priority 7: Task Celebration / Online Reconnect
    if (props.mood === 'happy' && states.happy) {
      return { activeStateKey: 'happy', StateRenderer: states.happy };
    }
    if (props.isOnline && states.online && props.mood === 'happy') {
      return { activeStateKey: 'online', StateRenderer: states.online };
    }

    // Priority 8: Ambient Hardware Charging
    if (props.isCharging && states.charging) {
      return { activeStateKey: 'charging', StateRenderer: states.charging };
    }

    // Priority 9: Ambient Concurrent Multi-Session
    if (props.isMultiSession && states.multi_session) {
      return { activeStateKey: 'multi_session', StateRenderer: states.multi_session };
    }

    // Priority 10: Interactive Cursor Hover
    if (props.isHovered && states.hover) {
      return { activeStateKey: 'hover', StateRenderer: states.hover };
    }

    // Priority 11: Sleeping / Idle Mascot Orb
    if (props.isIdleMascotOnly && states.sleeping) {
      return { activeStateKey: 'sleeping', StateRenderer: states.sleeping };
    }

    // Priority 12: Default guaranteed essential fallback
    const fallback = states.idle || states.music || states.thinking;
    return { activeStateKey: 'idle', StateRenderer: fallback };
  }, [
    currentChar,
    props.mood,
    props.isMusicPlaying,
    props.isDragging,
    props.isHovered,
    props.isCharging,
    props.isOnline,
    props.isMultiSession,
    props.gitAction,
    props.isIdleMascotOnly,
  ]);

  // Resolve dynamic eye and accent color based on active state
  const effectiveEyeColor = useMemo(() => {
    if (props.isOnline === false || props.connectionStatus === 'disconnected' || props.mood === 'alert') {
      return '#EF4444'; // Red alert / disconnected / offline
    }
    if (props.isDragging) {
      return '#FB923C'; // Dragging Neon Orange
    }
    if (props.gitAction === 'push') {
      return '#A855F7'; // Git Push Purple
    }
    if (props.gitAction === 'commit') {
      return '#2DD4BF'; // Git Commit Cyber Teal
    }
    if (props.activeAgent === 'antigravity' && (props.mood === 'working' || props.agentStatus?.status === 'working' || props.agentStatus?.status === 'thinking')) {
      return '#38BDF8'; // Electric Sky Cyan for Google Antigravity
    }
    if (props.activeAgent === 'codex' && (props.mood === 'working' || props.agentStatus?.status === 'working' || props.agentStatus?.status === 'thinking')) {
      return '#10A37F'; // Cyber Mint for OpenAI Codex
    }
    if (props.activeAgent === 'claude' && (props.mood === 'working' || props.agentStatus?.status === 'working' || props.agentStatus?.status === 'thinking')) {
      return '#F59E0B'; // Sunset Amber for Anthropic Claude
    }
    if (props.mood === 'working') {
      return '#38BDF8'; // Active Working Sky Cyan
    }
    if (props.mood === 'thinking') {
      return '#818CF8'; // Cognitive Indigo Thinking
    }
    if (props.isMusicPlaying) {
      return '#C084FC'; // Synthwave Violet Music
    }
    if (props.mood === 'happy') {
      return '#34D399'; // Emerald Happy
    }
    if (props.isCharging) {
      return '#FBBF24'; // Charging Amber / Lightning Gold
    }
    if (props.isMultiSession) {
      return '#6366F1'; // Multi-Session Neon Indigo
    }
    if (props.isHovered) {
      return '#7DD3FC'; // Soft Cyan Hover
    }
    return '#FFFFFF'; // OLED White
  }, [
    props.connectionStatus,
    props.mood,
    props.activeAgent,
    props.agentStatus,
    props.isMusicPlaying,
    props.isDragging,
    props.isHovered,
    props.isCharging,
    props.isOnline,
    props.isMultiSession,
    props.gitAction,
  ]);

  if (!StateRenderer) {
    return null;
  }

  // Key only changes when switching character ID or when the character actually switches between distinct state components
  const renderKey = `${currentChar.id}-${activeStateKey}`;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Subtle OLED Ambient Halo behind Mascot - dynamic glow smoothly transitioning with eye color */}
      {currentChar.id !== 'grok-bot' && !props.isIdleMascotOnly && (
        <div
          className="absolute inset-0 rounded-full blur-md pointer-events-none transition-all duration-300"
          style={{
            backgroundColor: `${effectiveEyeColor}28`,
            boxShadow: `0 0 20px ${effectiveEyeColor}4D`,
          }}
        />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={renderKey}
          initial={{ opacity: 0.88 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.88 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="relative flex items-center justify-center"
        >
          <StateRenderer {...props} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
