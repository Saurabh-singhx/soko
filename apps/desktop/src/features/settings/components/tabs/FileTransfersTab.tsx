import React from 'react';
import { FolderDown, Folder, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Card } from '../../../../ui/primitives/Card.tsx';
import { Button } from '../../../../ui/primitives/Button.tsx';
import { Badge } from '../../../../ui/primitives/Badge.tsx';
import { TransferHistoryItem } from '../../../../types/index.ts';

interface FileTransfersTabProps {
  history: TransferHistoryItem[];
  onOpenTransfers: () => void;
  onOpenFile: (filename: string) => void;
}

export const FileTransfersTab: React.FC<FileTransfersTabProps> = ({
  history,
  onOpenTransfers,
  onOpenFile,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FolderDown size={14} className="text-[#56B6F7]" />
            <h4 className="text-xs font-semibold text-white">Transfers Directory Storage</h4>
          </div>
          <Button
            variant="secondary"
            size="xs"
            icon={<Folder size={11} />}
            onClick={onOpenTransfers}
          >
            Open Folder
          </Button>
        </div>
        <p className="text-[11px] text-neutral-400">
          All files transmitted from phone or laptop are cryptographically validated with SHA-256 and stored in the isolated workspace transfers sandbox.
        </p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold text-white mb-2">Recent Transfers History</h4>
        {history.length > 0 ? (
          <div className="space-y-1.5">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-black/25 border border-white/[0.06]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-medium text-white truncate max-w-[200px]">
                    {item.filename}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    ({formatBytes(item.totalBytes)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={item.direction === 'received' ? 'cyan' : 'brand'} size="xs">
                    {item.direction}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={<ExternalLink size={10} />}
                    onClick={() => onOpenFile(item.filename)}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-neutral-500 py-3 text-center font-mono">
            No transfer history recorded yet.
          </p>
        )}
      </Card>
    </div>
  );
};
