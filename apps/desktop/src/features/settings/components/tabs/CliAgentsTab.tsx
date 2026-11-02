import React from 'react';
import { Terminal, Shield } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';

export const CliAgentsTab: React.FC = () => {
  const whitelistedCommands = [
    { cmd: 'git status', category: 'Source Control', desc: 'Inspect working tree status' },
    { cmd: 'git diff', category: 'Source Control', desc: 'Inspect unstaged code differences' },
    { cmd: 'npm test', category: 'Test Runner', desc: 'Execute repository test suites' },
    { cmd: 'agy status', category: 'Agent Fleet', desc: 'Query Antigravity multi-agent VM status' },
    { cmd: 'cargo test', category: 'Rust Core', desc: 'Execute Rust Tauri backend unit tests' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" />
            <h4 className="text-xs font-semibold text-white">Whitelisted Remote CLI Commands</h4>
          </div>
          <Badge variant="success" size="xs">
            Sandboxed
          </Badge>
        </div>
        <p className="text-[11px] text-neutral-400 mb-3">
          For security against unauthorized command execution, mobile companions can only trigger commands registered in the desktop whitelist.
        </p>

        <div className="space-y-1.5">
          {whitelistedCommands.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-black/25 border border-white/[0.06]"
            >
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-[#8A95FF]" />
                <code className="text-xs font-mono text-emerald-300">{item.cmd}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-500 font-mono">{item.desc}</span>
                <Badge variant="outline" size="xs">{item.category}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
