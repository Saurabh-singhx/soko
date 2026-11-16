import React, { useState } from 'react';
import { Copy, Check, FileCode2 } from 'lucide-react';
import { StateDiff, DiffLine } from '../types';

export interface StateDiffViewerProps {
  diff?: StateDiff;
  className?: string;
}

export const StateDiffViewer: React.FC<StateDiffViewerProps> = ({ diff, className = '' }) => {
  const [copied, setCopied] = useState(false);

  if (!diff || !diff.lines || diff.lines.length === 0) {
    return (
      <div
        className={`bg-[#0D111A] border border-[#1E2638] rounded-lg p-5 text-xs text-slate-500 font-mono text-center flex flex-col items-center justify-center gap-2 ${className}`}
      >
        <FileCode2 className="w-5 h-5 text-slate-600" />
        <span>No file modifications or diffs in this turn.</span>
      </div>
    );
  }

  const handleCopy = () => {
    const text = diff.lines
      .map((l) => `${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '} ${l.content}`)
      .join('\n');
    navigator.clipboard?.writeText(text)?.catch?.(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const addedCount = diff.lines.filter((l) => l.type === 'add').length;
  const deletedCount = diff.lines.filter((l) => l.type === 'del').length;

  const renderHighlightedContent = (line: DiffLine) => {
    const raw = line.content;

    // Syntax highlight based on line type
    if (line.type === 'del') {
      return <span className="text-red-300 font-mono">{raw}</span>;
    }
    if (line.type === 'add') {
      return (
        <span className="text-emerald-300 font-mono">
          {raw.split(/(".*?")/).map((segment, idx) => {
            if (segment.startsWith('"')) {
              return (
                <span key={idx} className="text-amber-300">
                  {segment}
                </span>
              );
            }
            return <span key={idx}>{segment}</span>;
          })}
        </span>
      );
    }

    // Normal line highlight
    const parts = raw.split(/\b(return|state|code|const|new|function|import|export|interface|type|class)\b/g);
    return (
      <span className="text-slate-300 font-mono">
        {parts.map((p, idx) => {
          if (['return', 'function', 'import', 'export', 'interface', 'type', 'class'].includes(p)) {
            return <span key={idx} className="text-pink-400 font-medium">{p}</span>;
          }
          if (p === 'state') return <span key={idx} className="text-cyan-400">{p}</span>;
          if (p === 'code') return <span key={idx} className="text-indigo-300">{p}</span>;
          if (p === 'const' || p === 'new') return <span key={idx} className="text-blue-400 font-medium">{p}</span>;
          return <span key={idx}>{p}</span>;
        })}
      </span>
    );
  };

  return (
    <div
      className={`bg-[#0D111A] border border-[#1E2638] rounded-lg overflow-hidden text-xs font-mono shadow-inner ${className}`}
    >
      {/* File header bar if filename is present */}
      {diff.filename && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#090D15] border-b border-[#1E2638] text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 font-sans font-medium">{diff.filename}</span>
            <div className="flex items-center gap-1.5 ml-1 text-[10px] font-sans">
              {addedCount > 0 && <span className="text-emerald-400 font-medium">+{addedCount}</span>}
              {deletedCount > 0 && <span className="text-rose-400 font-medium">-{deletedCount}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Copy diff"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-sans">Copied</span>
              </>
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      )}

      {/* Diff line container */}
      <div className="p-2 overflow-x-auto space-y-0.5 select-text max-h-72 overflow-y-auto custom-scrollbar">
        {diff.lines.map((line, idx) => {
          const lineNum = line.lineNumNew || line.lineNumOld || idx + 1;
          const isDel = line.type === 'del';
          const isAdd = line.type === 'add';

          return (
            <div
              key={idx}
              className={`flex items-center w-full px-2 py-0.5 rounded-sm transition-colors ${
                isDel
                  ? 'bg-red-950/50 text-red-200 border-l-2 border-red-500'
                  : isAdd
                  ? 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500'
                  : 'text-slate-300 hover:bg-slate-800/20 border-l-2 border-transparent'
              }`}
            >
              {/* Line number */}
              <span
                className={`w-6 text-right pr-2 select-none shrink-0 text-[11px] ${
                  isDel ? 'text-red-400 font-semibold' : isAdd ? 'text-emerald-400 font-semibold' : 'text-slate-600'
                }`}
              >
                {lineNum}
              </span>

              {/* Type indicator symbol (- or + or space) */}
              <span
                className={`w-3.5 select-none shrink-0 font-bold ${
                  isDel ? 'text-red-400' : isAdd ? 'text-emerald-400' : 'text-transparent'
                }`}
              >
                {isDel ? '-' : isAdd ? '+' : ' '}
              </span>

              {/* Code content */}
              <div className="flex-1 whitespace-pre pl-1">{renderHighlightedContent(line)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
