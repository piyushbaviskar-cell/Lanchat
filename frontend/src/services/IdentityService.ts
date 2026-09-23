/**
 * IdentityService: Tactical Cryptographic Identity & 1-Rename Quota Engine
 * Generates ECDSA P-256 keypair via WebCrypto SubtleCrypto
 * Derives deterministic 4-character #Tag: SHA256(RawPublicKey)[0..4] => #7F2A
 * Enforces strict 1-Rename lifetime quota per device profile
 */

import { safeGetStorage, safeSetStorage } from '../utils/safeEnv';

export interface OperatorIdentity {
  fullName: string;
  deviceTag: string;
  publicKeyHex: string;
  deviceType: 'MOBILE' | 'DESKTOP';
  renameQuotaRemaining: number;
  isStealthActive: boolean;
  onboardedAt: number;
}

export class IdentityService {
  private state: OperatorIdentity | null = null;
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  private listeners: ((id: OperatorIdentity) => void)[] = [];

  public getDeviceType(): 'MOBILE' | 'DESKTOP' {
    if (typeof navigator === 'undefined') return 'DESKTOP';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return isMobile ? 'MOBILE' : 'DESKTOP';
  }

  async initialize(): Promise<OperatorIdentity | null> {
    const savedState = safeGetStorage<OperatorIdentity | null>('apex_identity', null);
    if (savedState && savedState.fullName && savedState.deviceTag) {
      this.state = savedState;
      await this.generateOrLoadKeys();
      this.notify();
      return this.state;
    }
    return null;
  }

  public hasCompletedOnboarding(): boolean {
    return !!(this.state && this.state.fullName && this.state.fullName.trim().length >= 3);
  }

  async createProfile(fullName: string): Promise<OperatorIdentity> {
    if (!fullName || fullName.trim().length < 3) {
      throw new Error('Operator Call Sign / Full Name must be at least 3 characters.');
    }

    await this.generateOrLoadKeys();
    const tag = await this.deriveDeviceTag();
    const pubKeyHex = await this.exportPublicKeyHex();
    const deviceType = this.getDeviceType();

    this.state = {
      fullName: fullName.trim(),
      deviceTag: `#${tag}`,
      publicKeyHex: pubKeyHex,
      deviceType,
      renameQuotaRemaining: 1,
      isStealthActive: false,
      onboardedAt: Date.now()
    };

    this.saveState();
    this.notify();
    return this.state;
  }

  private async generateOrLoadKeys() {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      console.warn('[WebCrypto] SubtleCrypto unavailable (Secure Context required). Using fallback.');
      return;
    }
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
    } catch (e) {
      console.error('[WebCrypto] Key generation failed', e);
    }
  }

  public async deriveDeviceTag(): Promise<string> {
    if (!this.publicKey || typeof window === 'undefined' || !window.crypto?.subtle) {
      return Math.random().toString(16).substring(2, 6).toUpperCase();
    }
    try {
      const exported = await window.crypto.subtle.exportKey("raw", this.publicKey);
      const hash = await window.crypto.subtle.digest("SHA-256", exported);
      const hashArray = Array.from(new Uint8Array(hash));
      const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return hex.substring(0, 4);
    } catch (e) {
      return Math.random().toString(16).substring(2, 6).toUpperCase();
    }
  }

  private async exportPublicKeyHex(): Promise<string> {
    if (!this.publicKey || typeof window === 'undefined' || !window.crypto?.subtle) {
      return "00000000000000000000000000000000";
    }
    try {
      const exported = await window.crypto.subtle.exportKey("raw", this.publicKey);
      const hashArray = Array.from(new Uint8Array(exported));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch (e) {
      return "00000000000000000000000000000000";
    }
  }

  private saveState() {
    if (this.state) {
      safeSetStorage('apex_identity', this.state);
    }
  }

  getState(): OperatorIdentity {
    if (!this.state) throw new Error("Identity not initialized");
    return this.state;
  }

  getSafeState(): OperatorIdentity | null {
    return this.state;
  }

  getPrivateKey(): CryptoKey | null {
    return this.privateKey;
  }

  /**
   * Enforce Strict 1-Rename Quota
   */
  async rename(newName: string): Promise<{ success: boolean; error?: string; auditLog?: string }> {
    if (!this.state) return { success: false, error: 'Identity not initialized' };
    if (this.state.renameQuotaRemaining <= 0) {
      return { success: false, error: 'Callsign Locked: Lifetime 1/1 rename quota exhausted.' };
    }
    if (!newName || newName.trim().length < 3) {
      return { success: false, error: 'Callsign must be at least 3 characters.' };
    }

    const oldName = this.state.fullName;
    this.state.fullName = newName.trim();
    this.state.renameQuotaRemaining = 0; // Permanently lock
    this.saveState();
    this.notify();

    const auditLog = `[AUDIT: ${this.state.deviceTag} transitioned name from '${oldName}' to '${this.state.fullName}']`;
    return { success: true, auditLog };
  }

  toggleStealthMode(): boolean {
    if (!this.state) return false;
    this.state.isStealthActive = !this.state.isStealthActive;
    this.saveState();
    this.notify();
    return this.state.isStealthActive;
  }

  getDisplayName(): string {
    if (!this.state) return "Unauthenticated Operator";
    if (this.state.isStealthActive) return `Anonymous ${this.state.deviceTag}`;
    return `${this.state.fullName} ${this.state.deviceTag}`;
  }

  subscribe(cb: (id: OperatorIdentity) => void) {
    this.listeners.push(cb);
    if (this.state) cb(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    if (this.state) {
      this.listeners.forEach(cb => cb(this.state!));
    }
  }
}

export const identityService = new IdentityService();
