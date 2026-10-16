import React, { useState, useEffect } from 'react';
import { Sparkles, Check, AlertTriangle, Trash2, Plus, Upload, Palette, ShieldCheck, HelpCircle } from 'lucide-react';
import { CharacterDefinition } from './types.ts';
import {
  getRegisteredCharacters,
  getActiveCharacterId,
  setActiveCharacterId,
  importCustomCharacter,
  deleteCustomCharacter,
  validateCharacter,
  subscribeToCharacterChanges,
} from './registry.ts';

// Sample downloadable template pack to make testing custom imports effortless
const SAMPLE_CHARACTER_PACK = {
  id: 'pixel-buddy',
  name: 'Pixel Buddy',
  version: '1.0.0',
  author: 'Community Creator',
  description: 'Charming 8-bit companion with retro emerald and cyber violet state backgrounds.',
  backgrounds: {
    idle: '#081410',
    thinking: 'linear-gradient(135deg, #091724 30%, #1E293B 100%)',
    music: 'linear-gradient(135deg, #1A092A 20%, #3B0764 100%)',
    happy: 'linear-gradient(135deg, #052E16 30%, #047857 100%)',
  },
  states: {
    idle: {
      svg: `
        <rect x="8" y="8" width="28" height="28" rx="6" fill="#10B981" />
        <rect x="13" y="18" width="4" height="6" fill="#042F2E" />
        <rect x="27" y="18" width="4" height="6" fill="#042F2E" />
        <rect x="18" y="27" width="8" height="2" fill="#042F2E" />
      `,
    },
    thinking: {
      svg: `
        <rect x="8" y="8" width="28" height="28" rx="6" fill="#38BDF8" />
        <rect x="13" y="15" width="4" height="4" fill="#082F49" />
        <rect x="27" y="15" width="4" height="4" fill="#082F49" />
        <rect x="20" y="26" width="4" height="2" fill="#082F49" />
      `,
    },
    music: {
      svg: `
        <rect x="8" y="8" width="28" height="28" rx="6" fill="#A855F7" />
        <rect x="13" y="16" width="3" height="10" fill="#3B0764" />
        <rect x="18" y="14" width="3" height="12" fill="#3B0764" />
        <rect x="23" y="14" width="3" height="12" fill="#3B0764" />
        <rect x="28" y="16" width="3" height="10" fill="#3B0764" />
      `,
    },
    happy: {
      svg: `
        <rect x="8" y="8" width="28" height="28" rx="6" fill="#34D399" />
        <path d="M 12 18 Q 15 14 18 18" fill="none" stroke="#042F2E" stroke-width="2" />
        <path d="M 26 18 Q 29 14 32 18" fill="none" stroke="#042F2E" stroke-width="2" />
        <rect x="18" y="25" width="8" height="3" rx="1.5" fill="#042F2E" />
      `,
    },
  },
};

export const CharacterSelector: React.FC = () => {
  const [characters, setCharacters] = useState<CharacterDefinition[]>(() => getRegisteredCharacters());
  const [activeId, setActiveId] = useState<string>(() => getActiveCharacterId());

  // Import Panel state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const refreshList = () => {
    setCharacters(getRegisteredCharacters());
    setActiveId(getActiveCharacterId());
  };

  useEffect(() => {
    return subscribeToCharacterChanges(refreshList);
  }, []);

  const handleSelectCharacter = (char: CharacterDefinition) => {
    const res = setActiveCharacterId(char.id);
    if (res.success) {
      setActiveId(char.id);
    } else {
      alert(res.error);
    }
  };

  const handleDeleteCharacter = (char: CharacterDefinition) => {
    if (window.confirm(`Delete custom character pack "${char.name}"?`)) {
      deleteCustomCharacter(char.id);
      refreshList();
    }
  };

  const handleImportSubmit = () => {
    setImportStatus(null);
    if (!jsonInput.trim()) {
      setImportStatus({ success: false, message: 'Please paste a valid JSON character pack specification.' });
      return;
    }

    const res = importCustomCharacter(jsonInput);
    if (res.success) {
      setImportStatus({ success: true, message: `Successfully imported "${res.character?.name}"!` });
      setJsonInput('');
      refreshList();
      setTimeout(() => {
        setIsImportOpen(false);
        setImportStatus(null);
      }, 1500);
    } else {
      setImportStatus({ success: false, message: res.error || 'Import failed.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonInput(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Palette size={14} className="text-[#818CF8]" />
            <span>Character & Companion Selection</span>
          </h3>
          <p className="text-[11px] text-linear-text-tertiary mt-0.5">
            Choose your Dynamic Island companion. Each character manages its own expressions and state-specific backgrounds.
          </p>
        </div>

        <button
          onClick={() => {
            setIsImportOpen((prev) => !prev);
            setImportStatus(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/30 text-[#818CF8] hover:text-white text-xs font-medium border border-[#5E6AD2]/30 transition-all shadow-sm active:scale-95"
        >
          {isImportOpen ? 'Close Import' : (
            <>
              <Plus size={13} />
              <span>Import Character</span>
            </>
          )}
        </button>
      </div>

      {/* Import Character Drawer */}
      {isImportOpen && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Upload size={13} className="text-emerald-400" />
              <span>Import Character Pack (.json)</span>
            </span>
            <button
              onClick={() => setJsonInput(JSON.stringify(SAMPLE_CHARACTER_PACK, null, 2))}
              className="text-[11px] text-[#818CF8] hover:underline flex items-center gap-1"
            >
              <Sparkles size={11} />
              <span>Load Sample Template</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/10 text-white text-xs border border-white/10 transition-colors flex items-center gap-1.5">
              <Upload size={12} />
              <span>Upload JSON File</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
            <span className="text-[11px] text-linear-text-tertiary">or paste raw manifest JSON below:</span>
          </div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste character JSON manifest with essential states (idle, thinking, music) and state backgrounds..."
            rows={7}
            className="w-full font-mono text-[11px] p-2.5 rounded-lg bg-[#06080F] border border-white/10 text-white/90 focus:outline-none focus:border-[#5E6AD2] resize-y"
          />

          {importStatus && (
            <div
              className={`p-2.5 rounded-md text-xs font-medium ${
                importStatus.success
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {importStatus.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-3 py-1.5 text-xs text-linear-text-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleImportSubmit}
              className="px-4 py-1.5 rounded-md bg-[#5E6AD2] hover:bg-[#6875E8] text-white text-xs font-medium transition-colors shadow-sm"
            >
              Verify & Import Character
            </button>
          </div>
        </div>
      )}

      {/* Character Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {characters.map((char) => {
          const isActive = char.id === activeId;
          const validation = validateCharacter(char.rawManifest || char);
          const isSelectable = validation.isValid;

          // Background color swatches
          const bgs = char.backgrounds || {};

          return (
            <div
              key={char.id}
              className={`relative rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-3 ${
                isActive
                  ? 'bg-[#5E6AD2]/10 border-[#5E6AD2] shadow-[0_0_16px_rgba(94,106,210,0.25)]'
                  : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Visual Avatar Preview */}
                <div className="w-12 h-12 rounded-xl bg-[#0B0D14] border border-white/10 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                  {char.previewComponent ? (
                    <char.previewComponent size={32} />
                  ) : char.states.idle ? (
                    <char.states.idle mood="idle" size={32} />
                  ) : (
                    <HelpCircle size={20} className="text-white/40" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-white truncate">{char.name}</h4>
                    {char.isBuiltin && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-white/70">
                        Built-in
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-linear-text-tertiary line-clamp-2 mt-0.5 leading-tight">
                    {char.description || 'Custom companion pack'}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-linear-text-tertiary">
                    <span>By {char.author || 'Creator'}</span>
                    <span>•</span>
                    <span>v{char.version || '1.0'}</span>
                  </div>
                </div>
              </div>

              {/* State Backgrounds Color Palette Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                <span className="text-linear-text-tertiary flex items-center gap-1">
                  <Palette size={10} />
                  <span>Atmospheric Backgrounds:</span>
                </span>

                <div className="flex items-center gap-1.5">
                  {['idle', 'thinking', 'music', 'happy'].map((stateName) => {
                    const bgVal = (bgs as any)[stateName] || bgs.default || '#0B0D14';
                    return (
                      <div
                        key={stateName}
                        title={`${stateName.toUpperCase()}: ${bgVal}`}
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm cursor-help transition-transform hover:scale-125"
                        style={{ background: bgVal }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Status / Activation Footer */}
              <div className="flex items-center justify-between pt-1">
                {/* Validation Status Badge */}
                {isSelectable ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                    <ShieldCheck size={11} />
                    <span>Verified Essential States</span>
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium text-rose-400 cursor-help"
                    title={`Missing: ${validation.missingEssentialStates.join(', ')}`}
                  >
                    <AlertTriangle size={11} />
                    <span>Incomplete (Missing: {validation.missingEssentialStates.join(', ')})</span>
                  </span>
                )}

                {/* Activation Button */}
                <div className="flex items-center gap-2">
                  {!char.isBuiltin && (
                    <button
                      onClick={() => handleDeleteCharacter(char)}
                      title="Delete custom character pack"
                      className="p-1 rounded text-white/40 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {isActive ? (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1">
                      <Check size={11} />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSelectCharacter(char)}
                      disabled={!isSelectable}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        isSelectable
                          ? 'bg-white/10 hover:bg-[#5E6AD2] text-white hover:shadow-sm active:scale-95'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                      title={isSelectable ? 'Switch to this character' : 'Cannot activate: Character missing essential states'}
                    >
                      {isSelectable ? 'Select' : 'Incomplete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
