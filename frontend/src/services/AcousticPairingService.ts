// @ts-nocheck
export class AcousticPairingService {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private listening = false;

  // FSK configuration
  private freqSpace = 18000;
  private freqMark = 18500;
  private baudRate = 100; // bits per second
  private bitDuration = 1 / this.baudRate;
  
  // Preamble: 10101011 (0xAB) to signal start of payload
  private preamble = [1, 0, 1, 0, 1, 0, 1, 1];

  constructor() {}

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async transmit(payload: string) {
    this.initAudio();
    if (this.audioCtx!.state === 'suspended') {
      await this.audioCtx!.resume();
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    
    const bits: number[] = [...this.preamble];
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      for (let b = 7; b >= 0; b--) {
        bits.push((byte >> b) & 1);
      }
    }
    // End sequence
    bits.push(0,0,0,0,0,0,0,0);

    const osc = this.audioCtx!.createOscillator();
    osc.type = 'sine';
    osc.connect(this.audioCtx!.destination);

    let startTime = this.audioCtx!.currentTime + 0.1;
    
    for (let i = 0; i < bits.length; i++) {
      const freq = bits[i] === 1 ? this.freqMark : this.freqSpace;
      osc.frequency.setValueAtTime(freq, startTime + i * this.bitDuration);
    }

    osc.start(startTime);
    osc.stop(startTime + bits.length * this.bitDuration);
  }

  async startListening(onDataReceived: (payload: string) => void) {
    this.initAudio();
    if (this.audioCtx!.state === 'suspended') {
      await this.audioCtx!.resume();
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = this.audioCtx!.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx!.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      
      this.listening = true;
      this.analyze(onDataReceived);
    } catch (e) {
      console.error("Microphone access denied or error:", e);
      throw e;
    }
  }

  stopListening() {
    this.listening = false;
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
  }

  private analyze(onDataReceived: (payload: string) => void) {
    if (!this.listening || !this.analyser || !this.audioCtx) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const sampleRate = this.audioCtx.sampleRate;
    
    const freqToIndex = (freq: number) => Math.round(freq * this.analyser!.fftSize / sampleRate);
    
    const spaceIndex = freqToIndex(this.freqSpace);
    const markIndex = freqToIndex(this.freqMark);
    
    let bitBuffer: number[] = [];
    let isReceiving = false;
    
    const tick = () => {
      if (!this.listening) return;
      
      this.analyser!.getFloatFrequencyData(dataArray);
      
      const spacePower = dataArray[spaceIndex];
      const markPower = dataArray[markIndex];
      
      const threshold = -70; // dB threshold
      
      if (spacePower > threshold || markPower > threshold) {
         const bit = markPower > spacePower ? 1 : 0;
         bitBuffer.push(bit);
         // Process bits via simple sampling (this is highly simplified and lacks clock recovery)
         // For a production FSK modem, you'd need clock recovery (Costas loop/PLL) and FEC.
         if (bitBuffer.length > 1000) bitBuffer.shift(); 
         
         // In a real app we decode the bytes here and trigger onDataReceived
      } else {
         if (bitBuffer.length > 32) {
           // Decode
           // ...
           bitBuffer = [];
         }
      }
      
      requestAnimationFrame(tick);
    };
    
    tick();
  }
}

export const acousticPairingService = new AcousticPairingService();
