import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Laptop, Smartphone, KeyRound, AlertCircle } from 'lucide-react';
import { identityService, OperatorIdentity } from '../services/IdentityService';
import { Button } from './ui/button';

interface IdentityModalProps {
  isOpen: boolean;
  onComplete: (identity: OperatorIdentity) => void;
  allowEditMode?: boolean;
  onClose?: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({
  isOpen,
  onComplete,
  allowEditMode = false,
  onClose
}) => {
  const [fullName, setFullName] = useState('');
  const [tagPreview, setTagPreview] = useState('#....');
  const [deviceType, setDeviceType] = useState<'MOBILE' | 'DESKTOP'>('DESKTOP');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [existingIdentity, setExistingIdentity] = useState<OperatorIdentity | null>(null);

  useEffect(() => {
    const existing = identityService.getSafeState();
    if (existing) {
      setExistingIdentity(existing);
      setFullName(existing.fullName);
      setTagPreview(existing.deviceTag);
      setDeviceType(existing.deviceType);
    } else {
      setDeviceType(identityService.getDeviceType());
      identityService.deriveDeviceTag().then(tag => setTagPreview(`#${tag}`));
    }
  }, [isOpen]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName || fullName.trim().length < 3) {
      setError('Operator Call Sign / Full Name must be at least 3 characters.');
      return;
    }

    setIsProcessing(true);
    try {
      if (existingIdentity && allowEditMode) {
        // Execute rename
        const res = await identityService.rename(fullName);
        if (!res.success) {
          setError(res.error || 'Failed to update callsign.');
          setIsProcessing(false);
          return;
        }
        onComplete(identityService.getState());
        onClose?.();
      } else {
        const id = await identityService.createProfile(fullName);
        onComplete(id);
      }
    } catch (err: any) {
      setError(err.message || 'Cryptographic identity generation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const isLocked = existingIdentity && allowEditMode && existingIdentity.renameQuotaRemaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0e1320] border border-neutral-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
      >
        {/* Tactical Accent Top Strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-indigo-500 to-emerald-400" />

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-widest text-white uppercase">
                {allowEditMode ? 'Tactical Callsign Ledger' : 'Mandatory Operator Onboarding'}
              </h2>
              <p className="text-[11px] font-mono text-neutral-400">ECDSA P-256 Sovereign Node Identity</p>
            </div>
          </div>
          {allowEditMode && onClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white text-xs px-2 py-1">✕</button>
          )}
        </div>

        {/* Device & Hardware Profile Card */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
            <div className="text-indigo-400">
              {deviceType === 'MOBILE' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">Hardware Type</div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                {deviceType === 'MOBILE' ? '📱 Mobile Hotspot' : '💻 Desktop Node'}
              </div>
            </div>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
            <div className="text-green-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-mono">Device Tag</div>
              <div className="text-xs font-mono font-bold text-green-400">{tagPreview}</div>
            </div>
          </div>
        </div>

        {/* Quota Status Banner */}
        {allowEditMode && (
          <div className={`mb-4 p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            isLocked 
              ? 'bg-red-950/40 border-red-800/60 text-red-300'
              : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
          }`}>
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {isLocked 
                ? '🔒 Callsign Locked (1/1 Rename Quota Used)'
                : '1 Lifetime Rename Quota Available (1/1)'}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 mb-1.5">
              Full Legal / Operational Callsign
            </label>
            <input
              type="text"
              placeholder="e.g., Kshitij Khilari"
              value={fullName}
              disabled={isLocked || isProcessing}
              onChange={e => setFullName(e.target.value)}
              autoFocus
              className="w-full bg-[#141a29] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-green-400 placeholder:text-neutral-500 font-mono focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-mono text-red-400 bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="submit"
              disabled={isLocked || isProcessing || fullName.trim().length < 3}
              className="w-full h-11 bg-green-600 hover:bg-green-500 text-black font-bold tracking-wide rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Generating Keypair...' : allowEditMode ? 'Commit Callsign Transition' : 'Initialize Defense Node'}
            </Button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <span className="text-[10px] font-mono text-neutral-500 tracking-wider">
            AIR-GAPPED COMPLIANT • ZERO EXTERNAL CLOUD TELEMETRY
          </span>
        </div>
      </motion.div>
    </div>
  );
};
