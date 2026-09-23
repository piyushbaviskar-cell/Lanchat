// @ts-nocheck
/**
 * Zero-Knowledge Client-Side E2EE Service
 * Uses Web Crypto API (window.crypto.subtle) with ECDH (P-256) for key exchange
 * and AES-GCM (256-bit) for symmetric payload encryption.
 */

export class WebCryptoService {
  private keyPair: CryptoKeyPair | null = null;
  private sharedSecret: CryptoKey | null = null;
  private aesKey: CryptoKey | null = null;

  /**
   * Initializes the ECDH P-256 keypair for this session.
   */
  public async initializeKeyPair(): Promise<void> {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Exports the public key as a JWK (JSON Web Key) to be sent over STOMP.
   */
  public async exportPublicKey(): Promise<JsonWebKey> {
    if (!this.keyPair) throw new Error('Key pair not initialized');
    return await window.crypto.subtle.exportKey('jwk', this.keyPair.publicKey);
  }

  /**
   * Receives a peer's public key (JWK), derives the shared ECDH secret,
   * and expands it via HKDF into a 256-bit AES-GCM symmetric key.
   */
  public async deriveSharedSecret(peerPublicKeyJwk: JsonWebKey): Promise<void> {
    if (!this.keyPair) throw new Error('Key pair not initialized');

    const peerPublicKey = await window.crypto.subtle.importKey(
      'jwk',
      peerPublicKeyJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );

    this.aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      this.keyPair.privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a plaintext string into a Base64 payload, prepending the 12-byte IV.
   * Format: Base64( IV (12 bytes) || Ciphertext )
   */
  public async encryptMessage(plaintext: string): Promise<string> {
    if (!this.aesKey) throw new Error('AES key not derived. Missing peer exchange.');

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.aesKey,
      encoded
    );

    // Combine IV and Ciphertext
    const payload = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ciphertextBuffer), iv.length);

    // Convert to Base64 for STOMP transport
    return btoa(String.fromCharCode(...payload));
  }

  /**
   * Decrypts a Base64 payload back into plaintext.
   * Extracts the 12-byte IV from the front of the payload.
   */
  public async decryptMessage(base64Payload: string): Promise<string> {
    if (!this.aesKey) throw new Error('AES key not derived. Missing peer exchange.');

    const binaryStr = atob(base64Payload);
    const payload = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      payload[i] = binaryStr.charCodeAt(i);
    }

    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.aesKey,
        ciphertext
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.error('Cryptographic validation failed (Possible Tampering):', e);
      throw new Error('E2EE Decryption Failed: Tampered or malformed payload.');
    }
  }

  public isReady(): boolean {
    return this.aesKey !== null;
  }
}

export const webCryptoService = new WebCryptoService();
