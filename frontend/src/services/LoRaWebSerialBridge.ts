export class LoRaWebSerialBridge {
  private port: any | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private isConnected = false;

  async requestPort() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported in this browser.');
    }
    
    // Filter for common ESP32 / CP210x / CH340 vendor IDs used in Meshtastic nodes
    this.port = await (navigator as any).serial.requestPort({
      filters: [
        { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
        { usbVendorId: 0x1a86 }, // QinHeng CH340
        { usbVendorId: 0x303a }, // Espressif
      ]
    });
  }

  async connect(baudRate = 115200) {
    if (!this.port) throw new Error("No port selected. Call requestPort() first.");
    
    await this.port.open({ baudRate });
    this.isConnected = true;
    
    // Meshtastic expects raw protobufs over serial.
    // For this bridge, we handle raw ArrayBuffers.
    this.reader = this.port.readable!.getReader();
    this.writer = this.port.writable!.getWriter();
    
    console.log(`[LoRa Bridge] Connected at ${baudRate} baud.`);
    this.readLoop();
  }

  private async readLoop() {
    try {
      while (this.isConnected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        if (value) {
          this.handleIncomingRadioPayload(value);
        }
      }
    } catch (e) {
      console.error("[LoRa Bridge] Read error:", e);
    } finally {
      this.reader?.releaseLock();
    }
  }

  private handleIncomingRadioPayload(data: Uint8Array) {
    // In a full implementation, this parses the Meshtastic protobuf envelope (FromRadio)
    // and extracts the APEX ciphertext payload to pass to the Double Ratchet engine.
    console.log(`[LoRa Bridge] Received ${data.length} bytes from radio.`);
  }

  async transmit(payload: ArrayBuffer) {
    if (!this.isConnected || !this.writer) {
      throw new Error("Cannot transmit: LoRa radio not connected.");
    }
    
    const data = new Uint8Array(payload);
    
    // In a full implementation, we would wrap the payload in a ToRadio protobuf envelope.
    // For now, we write the raw padded bytes to the serial stream.
    await this.writer.write(data);
    console.log(`[LoRa Bridge] Transmitted ${data.length} bytes.`);
  }

  async disconnect() {
    this.isConnected = false;
    
    if (this.reader) {
      await this.reader.cancel();
      this.reader.releaseLock();
    }
    
    if (this.writer) {
      await this.writer.close();
      this.writer.releaseLock();
    }
    
    if (this.port) {
      await this.port.close();
    }
    
    console.log("[LoRa Bridge] Disconnected.");
  }
}

export const loRaWebSerialBridge = new LoRaWebSerialBridge();
