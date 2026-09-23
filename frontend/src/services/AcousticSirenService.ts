/**
 * Synthesized Emergency Acoustic Siren
 * Generates an aggressive two-tone wailing siren (600 Hz to 1200 Hz sweep)
 * using the Web Audio API (no external assets).
 */
export class AcousticSirenService {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private sweepInterval: number | null = null;

  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public playEmergencySiren() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      this.initContext();
      if (!this.audioContext) return;

      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      // Aggressive square wave for maximum alarm visibility
      this.oscillator.type = 'square';
      
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Set initial volume
      this.gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);

      this.oscillator.start();

      // Frequency Sweep Logic (European police siren style)
      let high = true;
      const triggerSweep = () => {
        if (!this.oscillator || !this.audioContext) return;
        const now = this.audioContext.currentTime;
        const freq = high ? 1200 : 600; // 600Hz to 1200Hz
        
        // Instant pitch shift for harsh, jarring effect
        this.oscillator.frequency.setValueAtTime(freq, now);
        
        // Trigger UI Flashing
        document.body.classList.toggle('emergency-flash-red', high);
        
        high = !high;
      };

      // Toggle frequency every 400ms
      triggerSweep();
      this.sweepInterval = window.setInterval(triggerSweep, 400);

    } catch (err) {
      console.error('Failed to play acoustic siren', err);
      this.isPlaying = false;
    }
  }

  public stopEmergencySiren() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.sweepInterval !== null) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {}
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    document.body.classList.remove('emergency-flash-red');
  }
}

export const acousticSirenService = new AcousticSirenService();

// Add this to index.css or App.css:
/*
.emergency-flash-red {
  background-color: rgba(220, 38, 38, 0.2) !important;
  transition: background-color 0.1s ease-in-out;
}
*/
