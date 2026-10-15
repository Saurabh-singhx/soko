export interface ProjectBadgeTheme {
  bg: string;
  text: string;
  border: string;
  glow: string;
  agentText: string;
  dot: string;
}

/**
 * Deterministically generates high-contrast, sleek themes for CLI agents and sessions.
 * - Different CLI agents (Antigravity, Codex, Claude) get distinct thematic color palettes.
 * - Different sessions or workspaces within that agent get distinct harmonic sub-colors.
 */
export function getAgentProjectTheme(
  agent?: string | null,
  sessionId?: string,
  workspaceName?: string,
  sessionIndex?: number
): ProjectBadgeTheme {
  // Deterministic seed based on session index or hash of (sessionId + workspaceName)
  let seed = typeof sessionIndex === 'number' && sessionIndex >= 0 ? sessionIndex : 0;
  if (typeof sessionIndex !== 'number' || sessionIndex < 0) {
    const str = `${sessionId || ''}:${workspaceName || ''}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    seed = hash;
  }

  const agentType = (agent || '').toLowerCase();

  // 1. Google Antigravity Palette (Indigo, Violet, Sky, Purple)
  if (agentType.includes('antigravity')) {
    const themes: ProjectBadgeTheme[] = [
      {
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-300',
        border: 'border-indigo-500/35',
        glow: 'shadow-[0_0_8px_rgba(99,102,241,0.25)]',
        agentText: 'text-indigo-400',
        dot: 'bg-indigo-400',
      },
      {
        bg: 'bg-violet-500/15',
        text: 'text-violet-300',
        border: 'border-violet-500/35',
        glow: 'shadow-[0_0_8px_rgba(139,92,246,0.25)]',
        agentText: 'text-violet-400',
        dot: 'bg-violet-400',
      },
      {
        bg: 'bg-sky-500/15',
        text: 'text-sky-300',
        border: 'border-sky-500/35',
        glow: 'shadow-[0_0_8px_rgba(14,165,233,0.25)]',
        agentText: 'text-sky-400',
        dot: 'bg-sky-400',
      },
      {
        bg: 'bg-purple-500/15',
        text: 'text-purple-300',
        border: 'border-purple-500/35',
        glow: 'shadow-[0_0_8px_rgba(168,85,247,0.25)]',
        agentText: 'text-purple-400',
        dot: 'bg-purple-400',
      },
    ];
    return themes[seed % themes.length];
  }

  // 2. OpenAI Codex Palette (Emerald, Teal, Cyan, Lime)
  if (agentType.includes('codex')) {
    const themes: ProjectBadgeTheme[] = [
      {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-300',
        border: 'border-emerald-500/35',
        glow: 'shadow-[0_0_8px_rgba(16,185,129,0.25)]',
        agentText: 'text-emerald-400',
        dot: 'bg-emerald-400',
      },
      {
        bg: 'bg-teal-500/15',
        text: 'text-teal-300',
        border: 'border-teal-500/35',
        glow: 'shadow-[0_0_8px_rgba(20,184,166,0.25)]',
        agentText: 'text-teal-400',
        dot: 'bg-teal-400',
      },
      {
        bg: 'bg-cyan-500/15',
        text: 'text-cyan-300',
        border: 'border-cyan-500/35',
        glow: 'shadow-[0_0_8px_rgba(6,182,212,0.25)]',
        agentText: 'text-cyan-400',
        dot: 'bg-cyan-400',
      },
      {
        bg: 'bg-lime-500/15',
        text: 'text-lime-300',
        border: 'border-lime-500/35',
        glow: 'shadow-[0_0_8px_rgba(132,204,22,0.25)]',
        agentText: 'text-lime-400',
        dot: 'bg-lime-400',
      },
    ];
    return themes[seed % themes.length];
  }

  // 3. Anthropic Claude Palette (Amber, Orange, Rose, Yellow)
  if (agentType.includes('claude')) {
    const themes: ProjectBadgeTheme[] = [
      {
        bg: 'bg-amber-500/15',
        text: 'text-amber-300',
        border: 'border-amber-500/35',
        glow: 'shadow-[0_0_8px_rgba(245,158,11,0.25)]',
        agentText: 'text-amber-400',
        dot: 'bg-amber-400',
      },
      {
        bg: 'bg-orange-500/15',
        text: 'text-orange-300',
        border: 'border-orange-500/35',
        glow: 'shadow-[0_0_8px_rgba(249,115,22,0.25)]',
        agentText: 'text-orange-400',
        dot: 'bg-orange-400',
      },
      {
        bg: 'bg-rose-500/15',
        text: 'text-rose-300',
        border: 'border-rose-500/35',
        glow: 'shadow-[0_0_8px_rgba(244,63,94,0.25)]',
        agentText: 'text-rose-400',
        dot: 'bg-rose-400',
      },
      {
        bg: 'bg-yellow-500/15',
        text: 'text-yellow-300',
        border: 'border-yellow-500/35',
        glow: 'shadow-[0_0_8px_rgba(234,179,8,0.25)]',
        agentText: 'text-yellow-400',
        dot: 'bg-yellow-400',
      },
    ];
    return themes[seed % themes.length];
  }

  // 4. Fallback Multi-Session Color Palette (Blue, Fuchsia, Teal, Purple)
  const fallbackThemes: ProjectBadgeTheme[] = [
    {
      bg: 'bg-blue-500/15',
      text: 'text-blue-300',
      border: 'border-blue-500/35',
      glow: 'shadow-[0_0_8px_rgba(59,130,246,0.25)]',
      agentText: 'text-blue-400',
      dot: 'bg-blue-400',
    },
    {
      bg: 'bg-fuchsia-500/15',
      text: 'text-fuchsia-300',
      border: 'border-fuchsia-500/35',
      glow: 'shadow-[0_0_8px_rgba(217,70,239,0.25)]',
      agentText: 'text-fuchsia-400',
      dot: 'bg-fuchsia-400',
    },
    {
      bg: 'bg-teal-500/15',
      text: 'text-teal-300',
      border: 'border-teal-500/35',
      glow: 'shadow-[0_0_8px_rgba(20,184,166,0.25)]',
      agentText: 'text-teal-400',
      dot: 'bg-teal-400',
    },
    {
      bg: 'bg-purple-500/15',
      text: 'text-purple-300',
      border: 'border-purple-500/35',
      glow: 'shadow-[0_0_8px_rgba(168,85,247,0.25)]',
      agentText: 'text-purple-400',
      dot: 'bg-purple-400',
    },
  ];
  return fallbackThemes[seed % fallbackThemes.length];
}
