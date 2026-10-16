import React from 'react';
import { CharacterDefinition, CharacterStateProps } from '../types.ts';
import { CharacterAvatar } from '../../components/island/CharacterAvatar.tsx';

// All states for Grok Bot map cleanly to the full procedural CharacterAvatar engine
const GrokBotStateWrapper: React.FC<CharacterStateProps> = (props) => {
  return <CharacterAvatar {...props} />;
};

const GrokBotPreview: React.FC<{ size?: number }> = ({ size = 32 }) => {
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center">
      <CharacterAvatar mood="idle" size={size} enableCursorTracking={false} />
    </div>
  );
};

export const grokBotCharacter: CharacterDefinition = {
  id: 'grok-bot',
  name: 'Grok Bot (Original)',
  version: '1.0.0',
  author: 'Soko Team',
  description: 'The iconic monochrome Grok Bot mascot with organic capsule eyes, cursor tracking, and equalizer mode.',
  format: 'native',
  isBuiltin: true,
  previewComponent: GrokBotPreview,

  // State-specific atmospheric background colors
  backgrounds: {
    idle: '#0B0D14',
    thinking: 'linear-gradient(135deg, #0B0D14 40%, #1A172C 100%)',
    music: 'linear-gradient(135deg, #0B0D14 30%, #20113B 100%)',
    happy: 'linear-gradient(135deg, #0B0D14 40%, #063826 100%)',
    working: 'linear-gradient(135deg, #0B0D14 40%, #161B2E 100%)',
    alert: 'linear-gradient(135deg, #1F0A0A 0%, #0B0D14 70%)',
    sleeping: '#05060A',
    default: '#0B0D14',
  },

  states: {
    idle: GrokBotStateWrapper,
    thinking: GrokBotStateWrapper,
    music: GrokBotStateWrapper,
    happy: GrokBotStateWrapper,
    working: GrokBotStateWrapper,
    alert: GrokBotStateWrapper,
    sleeping: GrokBotStateWrapper,
  },

  capabilities: {
    supportsCursorTracking: true,
    supportsMusicEqualizer: true,
    supportsAgentColors: true,
  },
};
