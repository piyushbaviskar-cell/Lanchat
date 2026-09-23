/**
 * BEL Tactical HF/VHF Radio Transceiver Bridge
 * - Web Serial API (navigator.serial) interface for external tactical SDR / transceiver
 * - Fallback Audio Modem: Bell 202 AFSK (1200 baud, 1200 Hz mark / 2200 Hz space) via Web Audio API
 * - STANAG 5066 Framing with CRC-32 for ionospheric skywave link survival
 */

export class BelRadioDriver {
  private serialPort: any = null;
  private audioContext: AudioContext | null = null;
  private isTransmittingAudio: boolean = false;

  public isTransmitting(): boolean {
    return this.isTransmittingAudio;
  }

  // CRC-32 Lookup Table for STANAG 5066 Frame Verification
  private static crcTable: Uint32Array = BelRadioDriver.generateCrcTable();

  private static generateCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  }

  public static calculateCrc32(bytes: Uint8Array): number {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ BelRadioDriver.crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  /**
   * STANAG 5066 Frame Builder:
   * [SYNC (2B: 0xEB90)] [LENGTH (2B)] [PAYLOAD (N B)] [CRC32 (4B)]
   */
  public frameStanag5066(payload: Uint8Array): Uint8Array {
    const frame = new Uint8Array(2 + 2 + payload.length + 4);
    frame[0] = 0xEB;
    frame[1] = 0x90;
    frame[2] = (payload.length >> 8) & 0xFF;
    frame[3] = payload.length & 0xFF;
    frame.set(payload, 4);

    const crc = BelRadioDriver.calculateCrc32(payload);
    const crcOffset = 4 + payload.length;
    frame[crcOffset] = (crc >> 24) & 0xFF;
    frame[crcOffset + 1] = (crc >> 16) & 0xFF;
    frame[crcOffset + 2] = (crc >> 8) & 0xFF;
    frame[crcOffset + 3] = crc & 0xFF;

    return frame;
  }

  /**
   * Attempt to open WebSerial port to BEL SDR
   */
  async connectSerial(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      try {
        this.serialPort = await (navigator as any).serial.requestPort();
        await this.serialPort.open({ baudRate: 9600 });
        console.log('[BEL-Radio] Connected to Tactical SDR via Web Serial.');
        return true;
      } catch (e) {
        console.warn('[BEL-Radio] Serial port request cancelled or failed, using AFSK audio modem fallback.');
      }
    }
    return false;
  }

  /**
   * Fallback Bell 202 AFSK Audio Modem Modulator (1200 Baud)
   * Mark: 1200 Hz (1), Space: 2200 Hz (0)
   */
  async transmitAfskAudio(payload: Uint8Array): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const framed = this.frameStanag5066(payload);
    const sampleRate = this.audioContext.sampleRate;
    const baudRate = 1200;
    const samplesPerBit = Math.floor(sampleRate / baudRate);

    // Calculate total bit count: 8 preamble bits + (framed bytes * 10 [1 start, 8 data, 1 stop]) + 8 trailer
    const totalBits = 16 + framed.length * 10 + 16;
    const buffer = this.audioContext.createBuffer(1, totalBits * samplesPerBit, sampleRate);
    const channelData = buffer.getChannelData(0);

    let phase = 0;
    let sampleIdx = 0;

    const writeTone = (freq: number) => {
      const phaseInc = (2 * Math.PI * freq) / sampleRate;
      for (let i = 0; i < samplesPerBit; i++) {
        channelData[sampleIdx++] = Math.sin(phase) * 0.4;
        phase += phaseInc;
      }
    };

    // Preamble (Marks)
    for (let i = 0; i < 16; i++) writeTone(1200);

    // Payload bits
    for (let i = 0; i < framed.length; i++) {
      const byte = framed[i];
      // Start bit (Space = 2200 Hz)
      writeTone(2200);
      // 8 Data bits LSB first
      for (let bit = 0; bit < 8; bit++) {
        const isOne = (byte & (1 << bit)) !== 0;
        writeTone(isOne ? 1200 : 2200);
      }
      // Stop bit (Mark = 1200 Hz)
      writeTone(1200);
    }

    // Trailer
    for (let i = 0; i < 16; i++) writeTone(1200);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    this.isTransmittingAudio = true;
    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        this.isTransmittingAudio = false;
        resolve();
      };
    });
  }

  async transmit(payload: Uint8Array): Promise<{ transport: 'SERIAL' | 'AFSK_AUDIO'; success: boolean }> {
    if (this.serialPort && this.serialPort.writable) {
      const framed = this.frameStanag5066(payload);
      const writer = this.serialPort.writable.getWriter();
      await writer.write(framed);
      writer.releaseLock();
      return { transport: 'SERIAL', success: true };
    } else {
      await this.transmitAfskAudio(payload);
      return { transport: 'AFSK_AUDIO', success: true };
    }
  }
}

export const belRadioDriver = new BelRadioDriver();
