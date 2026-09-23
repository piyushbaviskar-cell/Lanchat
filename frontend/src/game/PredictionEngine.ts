export interface EntityState {
  id: string;
  x: number;
  y: number;
  timestamp: number;
}

export class PredictionEngine {
  private localState: EntityState;
  private pendingInputs: any[] = [];
  
  private remoteEntities: Map<string, EntityState[]> = new Map();

  constructor(initialState: EntityState) {
    this.localState = initialState;
  }

  // 1. Prediction: Apply input locally immediately
  applyInput(input: any) {
    this.pendingInputs.push(input);
    // Predict next state
    this.localState.x += input.dx;
    this.localState.y += input.dy;
  }

  // 2. Reconciliation: Revert to authoritative state, replay unacked inputs
  onAuthoritativeUpdate(serverState: EntityState, lastAckedInputSequence: number) {
    this.localState.x = serverState.x;
    this.localState.y = serverState.y;

    // Filter out acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter(i => i.sequence > lastAckedInputSequence);

    // Replay remaining
    for (const input of this.pendingInputs) {
      this.localState.x += input.dx;
      this.localState.y += input.dy;
    }
  }

  // 3. Interpolation: Render remote entities smoothly
  addRemoteState(state: EntityState) {
    let buffer = this.remoteEntities.get(state.id);
    if (!buffer) {
      buffer = [];
      this.remoteEntities.set(state.id, buffer);
    }
    buffer.push(state);
    
    // Keep only last 10 states
    if (buffer.length > 10) buffer.shift();
  }

  getInterpolatedState(id: string, renderTimestamp: number): EntityState | null {
    const buffer = this.remoteEntities.get(id);
    if (!buffer || buffer.length < 2) return null;

    // Find the two states bounding the render timestamp
    let s0 = buffer[0], s1 = buffer[1];
    for (let i = buffer.length - 1; i >= 1; i--) {
      if (buffer[i].timestamp <= renderTimestamp) {
        s0 = buffer[i];
        s1 = buffer[i + 1] || buffer[i];
        break;
      }
    }

    if (s0 === s1) return s0;

    // Linear interpolation
    const t = (renderTimestamp - s0.timestamp) / (s1.timestamp - s0.timestamp);
    return {
      id,
      x: s0.x + (s1.x - s0.x) * t,
      y: s0.y + (s1.y - s0.y) * t,
      timestamp: renderTimestamp
    };
  }

  getLocalState() {
    return this.localState;
  }
}
