/**
 * Soko Desktop Design System Tokens
 * Linear.app dark aesthetic & macOS/iOS Dynamic Island elevation standards.
 */

export const tokens = {
  colors: {
    canvas: '#08090A',
    surface: {
      default: '#121417',
      hover: '#1B1E24',
      active: '#22262E',
      overlay: 'rgba(11, 13, 20, 0.92)',
      glass: 'rgba(255, 255, 255, 0.035)',
      glassHover: 'rgba(255, 255, 255, 0.06)',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.08)',
      medium: 'rgba(255, 255, 255, 0.14)',
      hover: 'rgba(255, 255, 255, 0.20)',
      active: 'rgba(255, 255, 255, 0.28)',
      focus: '#5E6AD2',
    },
    brand: {
      primary: '#5E6AD2',
      hover: '#6875E8',
      subtle: 'rgba(94, 106, 210, 0.15)',
      glow: 'rgba(94, 106, 210, 0.35)',
    },
    text: {
      primary: '#F7F8F8',   // 96% contrast
      secondary: '#8A8F98', // WCAG AA compliant (6.4:1)
      tertiary: '#717680',  // WCAG AA compliant (4.6:1)
      disabled: '#43474F',
    },
    status: {
      success: '#34D399',
      successGlow: 'rgba(52, 211, 153, 0.35)',
      warning: '#F59E0B',
      error: '#F87171',
      info: '#56B6F7',
    },
  },
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    sizes: {
      caption: '11px',
      bodySm: '12px',
      body: '13px',
      headingSm: '14px',
      heading: '16px',
    },
  },
  elevation: {
    hairline: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
    island: '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    popover: '0 24px 64px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.16)',
    card: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)',
  },
  zIndex: {
    base: 1,
    content: 10,
    avatar: 20,
    overlay: 40,
    popover: 50,
  },
} as const;
