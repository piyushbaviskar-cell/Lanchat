import React from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';

interface LightboxModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  caption?: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  imageSrc,
  caption,
  onClose
}) => {
  if (!isOpen || !imageSrc) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `tactical-recon-${Date.now()}.webp`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative max-w-4xl max-h-[90vh] bg-[#0c101d] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-neutral-900/80 border-b border-neutral-800 font-mono text-xs text-white">
          <span className="text-green-400 font-bold tracking-wider uppercase">
            TACTICAL RECON IMAGE PREVIEW
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-colors"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-[#080b14]">
          <img
            src={imageSrc}
            alt={caption || 'Reconnaissance Asset'}
            className="max-w-full max-h-[75vh] object-contain rounded-lg border border-neutral-800/80 shadow-lg"
          />
        </div>

        {caption && (
          <div className="p-3 bg-neutral-900/80 border-t border-neutral-800 font-mono text-[11px] text-neutral-400">
            {caption}
          </div>
        )}
      </motion.div>
    </div>
  );
};
