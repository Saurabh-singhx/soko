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

    // Prevent default browser behavior of opening dropped files in the webview
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDragDrop);
    window.addEventListener('drop', preventDragDrop);

    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('dragover', preventDragDrop);
      window.removeEventListener('drop', preventDragDrop);
    };
  }, []);

  const handleOpenSettings = () => {
    if ((window as any).electronAPI?.openSettings) {
      (window as any).electronAPI.openSettings();
    } else {
      setCurrentView('settings');
    }
  };

  const handleCloseSettings = () => {
    if ((window as any).electronAPI?.closeSettings) {
      (window as any).electronAPI.closeSettings();
    }
    setCurrentView('island');
  };

  if (currentView === 'settings') {
    return <SettingsView onClose={handleCloseSettings} />;
  }

  return (
    <div className="w-full h-full overflow-hidden bg-transparent flex flex-col items-center justify-start select-none">
      <DynamicIsland onOpenSettings={handleOpenSettings} />
    </div>
  );
};

export default App;
