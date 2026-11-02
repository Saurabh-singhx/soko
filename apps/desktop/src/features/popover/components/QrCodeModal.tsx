import React from 'react';
import { motion } from 'framer-motion';
import { X, QrCode, Copy, Check } from 'lucide-react';
import { Button } from '../../../ui/primitives/Button.tsx';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrSvg: string;
  pairUri: string;
  sasPin: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  qrSvg,
  pairUri,
  sasPin,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(pairUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md font-sans"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[300px] bg-[#0E1017] border border-white/15 rounded-2xl p-4 shadow-[0_24px_64px_rgba(0,0,0,0.9)] flex flex-col items-center select-none"
      >
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-1.5">
            <QrCode size={14} className="text-[#8A95FF]" />
            <span className="text-xs font-semibold text-white">Pair Mobile Companion</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close QR Modal"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="w-[170px] h-[170px] bg-white p-2.5 rounded-xl shadow-inner flex items-center justify-center">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-full h-full" />
        </div>

        <div className="mt-3 text-center">
          <span className="text-[11px] text-neutral-400 block">Or enter 6-digit PIN manually:</span>
          <span className="font-mono text-base font-bold text-emerald-400 tracking-wider">
            {sasPin}
          </span>
        </div>

        <Button
          variant="secondary"
          size="xs"
          icon={copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          onClick={handleCopy}
          className="mt-3 w-full"
        >
          {copied ? 'Copied URI' : 'Copy Pairing URI'}
        </Button>
      </motion.div>
    </div>
  );
};
