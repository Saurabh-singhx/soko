import React, { useState, useEffect } from 'react';
import { DynamicIsland } from './components/island/DynamicIsland.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';

/**
 * Root Multi-Window Router Component.
 *
 * Checks URL hash or window mode to render either the
 * transparent Dynamic Island or the full Settings management interface.
 */
export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'island' | 'settings'>('island');

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'settings') {
        setCurrentView('settings');
      } else {
        setCurrentView('island');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (currentView === 'settings') {
    return <SettingsView onClose={() => setCurrentView('island')} />;
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent">
      <DynamicIsland onOpenSettings={() => setCurrentView('settings')} />
    </div>
  );
};

export default App;
