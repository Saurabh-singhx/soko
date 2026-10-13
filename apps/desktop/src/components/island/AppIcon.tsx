import React from 'react';

interface AppIconProps {
  appName: string;
  packageName?: string;
  size?: number;
}

export interface AppBrandInfo {
  color: string;
  badgeBg: string;
}

/**
 * Returns brand metadata (official color & subtle dark-tinted badge background)
 * that fits harmoniously within the Linear dark theme.
 */
export const getAppBrandInfo = (appName: string, packageName: string = ''): AppBrandInfo => {
  const query = `${appName} ${packageName}`.toLowerCase();

  if (query.includes('whatsapp')) {
    return { color: '#25D366', badgeBg: 'rgba(37, 211, 102, 0.12)' };
  }
  if (query.includes('telegram')) {
    return { color: '#229ED9', badgeBg: 'rgba(34, 158, 217, 0.14)' };
  }
  if (query.includes('slack')) {
    return { color: '#ECB22E', badgeBg: 'rgba(74, 21, 75, 0.35)' };
  }
  if (query.includes('discord')) {
    return { color: '#5865F2', badgeBg: 'rgba(88, 101, 242, 0.16)' };
  }
  if (query.includes('github')) {
    return { color: '#F0F6FC', badgeBg: 'rgba(240, 246, 252, 0.10)' };
  }
  if (query.includes('linear')) {
    return { color: '#5E6AD2', badgeBg: 'rgba(94, 106, 210, 0.16)' };
  }
  if (query.includes('gmail') || query.includes('mail')) {
    return { color: '#EA4335', badgeBg: 'rgba(234, 67, 53, 0.14)' };
  }
  if (query.includes('twitter') || query.includes('x.com') || query === 'x') {
    return { color: '#FFFFFF', badgeBg: 'rgba(255, 255, 255, 0.10)' };
  }
  if (query.includes('instagram')) {
    return { color: '#E1306C', badgeBg: 'rgba(225, 48, 108, 0.14)' };
  }
  if (query.includes('spotify')) {
    return { color: '#1DB954', badgeBg: 'rgba(29, 185, 84, 0.14)' };
  }
  if (query.includes('youtube')) {
    return { color: '#FF0000', badgeBg: 'rgba(255, 0, 0, 0.14)' };
  }
  if (query.includes('antigravity') || query.includes('agy')) {
    return { color: '#00E5FF', badgeBg: 'rgba(0, 229, 255, 0.14)' };
  }
  if (query.includes('message') || query.includes('sms')) {
    return { color: '#1A73E8', badgeBg: 'rgba(26, 115, 232, 0.14)' };
  }

  // Default / System Fallback
  return { color: '#8A8F98', badgeBg: 'rgba(255, 255, 255, 0.06)' };
};

/**
 * Authentic brand SVG icons rendered in their official colors,
 * styled to fit sleekly inside Linear's dark minimalism.
 */
export const AppIcon: React.FC<AppIconProps> = ({
  appName,
  packageName = '',
  size = 16,
}) => {
  const query = `${appName} ${packageName}`.toLowerCase();

  // 1. WhatsApp
  if (query.includes('whatsapp')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M20.52 3.48A11.93 11.93 0 0012.04 0C5.43 0 .07 5.37.07 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.21-1.63a11.94 11.94 0 005.83 1.51h.01c6.61 0 11.97-5.37 11.97-11.98 0-3.2-1.25-6.22-3.5-8.42zm-8.48 18.4h-.01a9.92 9.92 0 01-5.06-1.39l-.36-.22-3.76.99 1-3.66-.24-.38a9.93 9.93 0 01-1.52-5.24C2.08 6.48 6.55 2.01 12.04 2.01c2.66 0 5.16 1.04 7.04 2.92a9.88 9.88 0 012.92 7.05c0 5.5-4.47 9.9-9.96 9.9zm5.46-7.46c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.51 0 1.48 1.08 2.91 1.23 3.11.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"
          fill="#25D366"
        />
      </svg>
    );
  }

  // 2. Telegram
  if (query.includes('telegram')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <circle cx="12" cy="12" r="11" fill="#229ED9" />
        <path
          d="M5.6 11.8l11.2-4.4c.5-.2 1 .1.8.7l-1.9 9c-.1.6-.5.7-1 .4l-2.7-2-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.7 4.9-4.5c.2-.2 0-.3-.3-.1l-6.1 3.9-2.6-.9c-.6-.2-.6-.6.1-.9z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 3. Slack
  if (query.includes('slack')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path d="M5.04 14.28A2.52 2.52 0 102.52 11.76h2.52v2.52zm1.26 0a2.52 2.52 0 005.04 0V6.72a2.52 2.52 0 10-5.04 0v7.56z" fill="#36C5F0" />
        <path d="M9.72 5.04A2.52 2.52 0 1012.24 2.52v2.52H9.72zm0 1.26a2.52 2.52 0 000 5.04h7.56a2.52 2.52 0 100-5.04H9.72z" fill="#2EB67D" />
        <path d="M18.96 9.72A2.52 2.52 0 1021.48 12.24h-2.52V9.72zm-1.26 0a2.52 2.52 0 00-5.04 0v7.56a2.52 2.52 0 105.04 0V9.72z" fill="#ECB22E" />
        <path d="M14.28 18.96A2.52 2.52 0 1011.76 21.48v-2.52h2.52zm0-1.26a2.52 2.52 0 000-5.04H6.72a2.52 2.52 0 100 5.04h7.56z" fill="#E01E5A" />
      </svg>
    );
  }

  // 4. Discord
  if (query.includes('discord')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          fill="#5865F2"
        />
      </svg>
    );
  }

  // 5. GitHub
  if (query.includes('github')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          fill="#F0F6FC"
        />
      </svg>
    );
  }

  // 6. Linear
  if (query.includes('linear')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <circle cx="12" cy="12" r="10" stroke="#5E6AD2" strokeWidth="2.4" fill="none" />
        <path d="M7 16L16 7" stroke="#5E6AD2" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="7" r="1.6" fill="#5E6AD2" />
      </svg>
    );
  }

  // 7. Gmail / Google Mail
  if (query.includes('gmail') || query.includes('mail')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"
          fill="#EA4335"
        />
      </svg>
    );
  }

  // 8. Twitter / X
  if (query.includes('twitter') || query.includes('x.com') || query === 'x') {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 9. Instagram
  if (query.includes('instagram')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <defs>
          <linearGradient id="ig-grad-app" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FD5949" />
            <stop offset="50%" stopColor="#D6249F" />
            <stop offset="100%" stopColor="#285AEB" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="4.5" stroke="url(#ig-grad-app)" strokeWidth="1.8" fill="none" />
        <circle cx="12" cy="12" r="4" stroke="url(#ig-grad-app)" strokeWidth="1.8" fill="none" />
        <circle cx="16.5" cy="7.5" r="1.1" fill="#FD5949" />
      </svg>
    );
  }

  // 10. Spotify
  if (query.includes('spotify')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <circle cx="12" cy="12" r="11" fill="#1DB954" />
        <path d="M16.5 15.5c-.2.3-.5.4-.7.2-2-1.2-4.5-1.5-7.5-.8-.3.1-.6-.1-.7-.4s.1-.6.4-.7c3.3-.8 6.1-.4 8.3 1 .3.2.4.5.2.7zm1.1-2.4c-.2.3-.6.4-1 .3-2.3-1.4-5.8-1.8-8.5-1-.4.1-.8-.1-.9-.4s.1-.8.4-.9c3.2-1 7.1-.5 9.7 1.1.4.2.5.6.3.9zm.1-2.5c-2.7-1.7-7.3-1.8-9.9-1-.4.1-.9-.2-1-.6s.2-.9.6-1c3.1-1 8.1-.8 11.2 1.1.4.3.5.7.3 1.1-.2.4-.7.5-1.2.4z" fill="#000000" />
      </svg>
    );
  }

  // 11. YouTube
  if (query.includes('youtube')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 00-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
          fill="#FF0000"
        />
      </svg>
    );
  }

  // 12. Antigravity (agy CLI)
  if (query.includes('antigravity') || query.includes('agy')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#0A0B0E" stroke="#5E6AD2" strokeWidth="1.6" />
        <path d="M7 8l5 4-5 4" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="13" y1="16" x2="17" y2="16" stroke="#5E6AD2" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 13. Messages / SMS
  if (query.includes('message') || query.includes('sms')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
        <path
          d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
          fill="#1A73E8"
        />
        <line x1="6" y1="8" x2="14" y2="8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="6" y1="12" x2="18" y2="12" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // 14. Generic / System Notification Bell
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zm-4.27 13a2 2 0 01-3.46 0"
        stroke="#8A8F98"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
